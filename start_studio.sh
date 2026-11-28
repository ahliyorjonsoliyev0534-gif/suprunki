#!/usr/bin/env bash
# Sprunki Core Studio — macOS/Linux
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
python3 -c "import PySide6" 2>/dev/null || python3 -m pip install -r studio/requirements.txt
exec python3 studio/app.py
