import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("SLACK_DATA_DIR", BACKEND_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DATABASE_URL = os.environ.get("SLACK_DATABASE_URL", f"sqlite:///{(DATA_DIR / 'slack.db').as_posix()}")

CORS_ORIGINS = os.environ.get("SLACK_CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")

# Exam dates are unknown until the student enters them; plan against this meanwhile.
DEFAULT_EXAM_DATE = os.environ.get("SLACK_DEFAULT_EXAM_DATE", "2026-11-30")

# Optional: Claude writes extra quiz questions grounded in uploaded slides.
CLAUDE_MODEL = os.environ.get("SLACK_CLAUDE_MODEL", "claude-opus-5-5")
CLAUDE_ENABLED = bool(os.environ.get("ANTHROPIC_API_KEY")) and os.environ.get("SLACK_DISABLE_CLAUDE") != "1"

MAX_UPLOAD_MB = 50
