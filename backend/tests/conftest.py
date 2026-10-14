import os
import sys
import tempfile
from pathlib import Path

# Isolate every test run in its own data directory before the app is imported.
_tmp = tempfile.mkdtemp(prefix="slack-test-")
os.environ["SLACK_DATA_DIR"] = _tmp
os.environ["SLACK_DISABLE_CLAUDE"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
