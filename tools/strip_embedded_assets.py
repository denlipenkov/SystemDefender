# -*- coding: utf-8 -*-
"""Remove TRACK_BASE64 and LOGO_DATA_URL single-line consts from src/index.html."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
path = ROOT / "src" / "index.html"
s = path.read_text(encoding="utf-8")
before = len(s)
s = re.sub(r"const TRACK_BASE64 = '[^']*';\r?\n", "", s, count=1)
s = re.sub(
    r"const LOGO_DATA_URL = 'data:image/png;base64,[^']*';\r?\n", "", s, count=1
)
if len(s) == before:
    raise SystemExit("Nothing removed — check patterns")
path.write_text(s, encoding="utf-8")
print("OK removed", before - len(s), "chars")
