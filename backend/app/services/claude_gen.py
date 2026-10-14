"""Optional: Claude writes extra multiple-choice questions grounded in slide text.

Only used when ANTHROPIC_API_KEY is set. Rule-based questions from the slides
always exist; these add variety. Every question must be answerable from the
supplied slides, and each one cites the slide it came from.
"""

from __future__ import annotations

import json
import logging

import anthropic

from ..config import CLAUDE_MODEL

log = logging.getLogger(__name__)

SYSTEM = """You write multiple-choice revision questions for a university student, using only the lecture slides provided.

Rules:
- Every question must be answerable from the slides alone. Do not add facts the slides don't state.
- Test understanding and application (Bloom K2-K4), not trivia such as slide numbers or titles.
- Exactly four options. One is correct. Distractors should be plausible misreadings of the material, not jokes.
- The explanation says why the answer is right in one or two sentences, in plain language.
- Tag each question with the single best-matching concept from the list given.
- Do not repeat or lightly reword any of the existing questions listed."""


def _schema(concepts: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "concept": {"type": "string", "enum": concepts},
                        "prompt": {"type": "string"},
                        "options": {"type": "array", "items": {"type": "string"}},
                        "answerIndex": {"type": "integer"},
                        "explanation": {"type": "string"},
                        "slide": {"type": "integer"},
                    },
                    "required": ["concept", "prompt", "options", "answerIndex", "explanation", "slide"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["questions"],
        "additionalProperties": False,
    }


class ClaudeUnavailable(Exception):
    pass


def generate_questions(
    topic_title: str, slides_text: str, concepts: list[str], existing_prompts: list[str], count: int = 8
) -> list[dict]:
    concepts = concepts or [topic_title]
    existing = "\n".join(f"- {p}" for p in existing_prompts) or "(none)"
    user = (
        f"Topic: {topic_title}\n\nConcepts:\n" + "\n".join(f"- {c}" for c in concepts) + f"\n\nExisting questions (do not repeat):\n{existing}"
        f"\n\nWrite {count} new questions.\n\n<slides>\n{slides_text}\n</slides>"
    )
    client = anthropic.Anthropic()
    try:
        response = client.beta.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=16000,
            system=SYSTEM,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": _schema(concepts)}},
            betas=["server-side-fallback-2026-07-01"],
            extra_body={"fallbacks": "default"},
        )
    except anthropic.AuthenticationError as e:
        raise ClaudeUnavailable("The Anthropic API key was rejected.") from e
    except anthropic.RateLimitError as e:
        raise ClaudeUnavailable("Claude is rate-limited right now. Try again in a minute.") from e
    except anthropic.APIStatusError as e:
        raise ClaudeUnavailable(f"Claude request failed ({e.status_code}).") from e
    except anthropic.APIConnectionError as e:
        raise ClaudeUnavailable("Couldn't reach the Claude API.") from e

    if response.stop_reason == "refusal":
        raise ClaudeUnavailable("Claude declined to write questions for this material.")
    if response.stop_reason == "max_tokens":
        log.warning("Question generation hit max_tokens for %s", topic_title)
    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise ClaudeUnavailable("Claude returned no questions.")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise ClaudeUnavailable("Claude's answer couldn't be read.") from e

    out = []
    seen = {p.strip().lower() for p in existing_prompts}
    for q in data.get("questions", []):
        opts = [o.strip() for o in q.get("options", []) if o.strip()]
        idx = q.get("answerIndex", -1)
        if len(opts) != 4 or len(set(opts)) != 4 or not 0 <= idx < 4:
            continue  # schema can't express "exactly four, distinct" — enforce here
        if q["prompt"].strip().lower() in seen:
            continue
        out.append({**q, "options": opts})
    return out
