@echo off
REM Sprunki Core Studio — Windows'da ikki marta bosib ishga tushiring
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js topilmadi: https://nodejs.org dan LTS versiyani o'rnating & pause & exit /b)
where ffmpeg >nul 2>nul || (echo FFmpeg topilmadi: "winget install ffmpeg" buyrug'ini bajaring & pause & exit /b)
if not exist node_modules (echo npm paketlari o'rnatilmoqda... & call npm install)
python -c "import PySide6" 2>nul || (echo PySide6 o'rnatilmoqda... & python -m pip install -r studio\requirements.txt)
start "" pythonw studio\app.py
