"""Set up a workspace from your own files, through the same pipeline as uploads.

    python -m app.bootstrap --class "B.TECH SEM 3 A" --group 1 \
        "timetable.pdf" "U2S08.pptx" "U2S09.pptx"

Kinds are inferred: .pptx -> slides, a PDF with "timetable" in its name ->
timetable, other PDFs -> notes (use --kind to override for all files).
The timetable is processed first so subjects and labs exist before slides.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import uuid
from pathlib import Path

from .config import DATA_DIR, UPLOAD_DIR
from .db import SessionLocal, init_db
from . import models as m
from .services.ingest import process_source


def infer_kind(path: Path) -> str:
    name = path.name.lower()
    if path.suffix.lower() == ".pptx":
        return "slides"
    if "timetable" in name or "time table" in name:
        return "timetable"
    if "syllab" in name:
        return "syllabus"
    if any(w in name for w in ("paper", "pyq", "endsem", "end-sem", "midsem")):
        return "past_paper"
    return "notes"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--class", dest="class_label", help='Your class as printed on the timetable, e.g. "B.TECH SEM 3 A"')
    ap.add_argument("--group", type=int, choices=[1, 2], default=1, help="Your lab group")
    ap.add_argument("--hours", type=float, default=2.0, help="Study hours per day for the plan")
    ap.add_argument("--kind", help="Force one source kind for every file")
    ap.add_argument("--reset", action="store_true", help="Delete the existing database first")
    args = ap.parse_args(argv)

    missing = [f for f in args.files if not f.exists()]
    if missing:
        print("Not found:", ", ".join(map(str, missing)), file=sys.stderr)
        return 1

    if args.reset:
        db_file = DATA_DIR / "slack.db"
        for suffix in ("", "-wal", "-shm"):
            Path(f"{db_file}{suffix}").unlink(missing_ok=True)
        shutil.rmtree(UPLOAD_DIR, ignore_errors=True)
    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    p = db.get(m.Profile, 1) or m.Profile(id=1)
    if args.class_label:
        p.class_label = " ".join(args.class_label.split())
    p.lab_group, p.hours_per_day, p.rest_days = args.group, args.hours, [0]
    p.plan_generated_at = None
    db.add(p)
    db.commit()

    files = sorted(args.files, key=lambda f: infer_kind(f) != "timetable")
    ids = []
    for f in files:
        sid = uuid.uuid4().hex[:12]
        dest = UPLOAD_DIR / f"{sid}{f.suffix.lower()}"
        shutil.copyfile(f, dest)
        db.add(m.Source(id=sid, kind=args.kind or infer_kind(f), filename=f.name, path=str(dest), size_kb=max(1, f.stat().st_size // 1024)))
        db.commit()
        ids.append(sid)
    db.close()

    for sid in ids:
        process_source(sid)

    db = SessionLocal()
    ok = True
    for sid in ids:
        s = db.get(m.Source, sid)
        summary = (s.extracted or {}).get("summary", "")
        print(f"{s.status:>8}  {s.kind:<10} {s.filename}  {summary or s.error or ''}")
        ok &= s.status == "ready"
    print(f"\nSubjects: {db.query(m.Subject).count()}  Topics: {db.query(m.Topic).count()}  "
          f"Questions: {db.query(m.Question).count()}  Labs: {db.query(m.LabCourse).count()}  "
          f"Timetable slots: {db.query(m.TimetableSlot).count()}")
    db.close()
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
