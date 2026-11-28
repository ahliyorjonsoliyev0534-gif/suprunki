"""Sprunki Core Studio: AI video yaratish va avtomatlashtirish uchun ish stoli dasturi (PySide6).

Ishga tushirish:  python studio/app.py   (yoki Windows'da start_studio.bat)
Dvigatel: Node.js + Remotion (pipeline/), yakuniy ishlov: FFmpeg.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path

from PySide6.QtCore import QProcess, QProcessEnvironment, Qt, QUrl
from PySide6.QtGui import QColor, QDesktopServices, QFont, QIcon, QPixmap, QPainter
from PySide6.QtWidgets import (
    QAbstractItemView, QApplication, QCheckBox, QComboBox, QFileDialog, QFormLayout, QFrame, QGridLayout,
    QHBoxLayout, QHeaderView, QLabel, QLineEdit, QListWidget, QListWidgetItem, QMainWindow, QMessageBox,
    QPlainTextEdit, QPushButton, QSlider, QSplitter, QStackedWidget, QTableWidget, QTableWidgetItem,
    QTabWidget, QVBoxLayout, QWidget,
)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CHAR_FILE = DATA / "characters.json"
STUDIO_FILE = DATA / "studio_settings.json"
ENV_FILE = ROOT / ".env"
WIN = sys.platform.startswith("win")

CATEGORIES = ["adventure", "friendship", "mystery", "comedy", "musical", "emotional", "twist", "battle"]
SHORT_SECONDS = ["15", "30", "45", "60"]
LONG_MINUTES = ["3", "10", "20", "30", "60"]
EMOTIONS = ["happy", "excited", "sad", "angry", "shock", "scared", "calm", "funny"]
ACTIONS = ["none", "jump", "dance", "shake", "spin", "walkIn", "bow", "float"]
SFX = ["", "whoosh", "pop", "boing", "ding", "drum", "thunder", "magic", "crash", "cheer", "gasp"]
LOCATIONS = ["stage", "forest", "city", "space", "beach", "castle", "cave", "studio", "candy"]
CAMERAS = ["wide", "closeup", "pan", "zoomIn", "zoomOut", "shake"]
MOODS = ["happy", "tense", "sad", "epic", "funny", "mystery"]
TRANSITIONS = ["fade", "wipe", "iris", "flash"]
EDGE_VOICES = [
    "en-US-AnaNeural", "en-US-JennyNeural", "en-US-AriaNeural", "en-US-GuyNeural", "en-US-ChristopherNeural",
    "en-US-EricNeural", "en-US-RogerNeural", "en-US-BrianNeural", "en-US-SteffanNeural", "en-US-AndrewMultilingualNeural",
    "en-GB-RyanNeural", "en-GB-SoniaNeural", "en-GB-MaisieNeural", "en-GB-ThomasNeural", "en-AU-NatashaNeural",
    "en-AU-WilliamNeural", "en-NZ-MitchellNeural", "en-IN-PrabhatNeural", "en-IE-ConnorNeural", "en-CA-LiamNeural",
]
OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"]

QSS = """
* { font-family: 'Segoe UI', 'Inter', sans-serif; font-size: 13px; color: #E9E6FF; }
QMainWindow, QWidget#page { background: #0E0B1E; }
QWidget { background: transparent; }
QListWidget#nav { background: #140F2E; border: none; border-right: 2px solid #2A2160; padding: 8px; }
QListWidget#nav::item { padding: 11px 12px; border-radius: 10px; margin: 2px 0; }
QListWidget#nav::item:selected { background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 #FF3DB4, stop:1 #7B2FF7); color: white; font-weight: 700; }
QListWidget#nav::item:hover:!selected { background: #221a4a; }
QLabel#h1 { font-size: 26px; font-weight: 800; color: #3DF2FF; }
QLabel#sub { color: #9C95C9; }
QFrame#card { background: #17123A; border: 1px solid #2E2470; border-radius: 16px; }
QLabel#big { font-size: 30px; font-weight: 800; color: #FFE14D; }
QPushButton { background: #251c55; border: 1px solid #3c2f8a; border-radius: 10px; padding: 9px 16px; font-weight: 600; }
QPushButton:hover { background: #33277a; border-color: #3DF2FF; }
QPushButton#primary { background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 #FF3DB4, stop:1 #7B2FF7); border: none; color: white; font-size: 15px; padding: 12px 22px; }
QPushButton#primary:hover { background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 #ff5cc4, stop:1 #9150ff); }
QPushButton:disabled { color: #6b6496; background: #1a1540; }
QLineEdit, QComboBox, QPlainTextEdit, QTableWidget, QListWidget { background: #120E2A; border: 1px solid #2E2470; border-radius: 8px; padding: 6px; selection-background-color: #7B2FF7; }
QLineEdit:focus, QComboBox:focus, QPlainTextEdit:focus { border-color: #3DF2FF; }
QComboBox QAbstractItemView { background: #17123A; border: 1px solid #3c2f8a; }
QHeaderView::section { background: #1d1648; border: none; padding: 6px; color: #3DF2FF; font-weight: 700; }
QTableWidget { gridline-color: #2A2160; }
QPlainTextEdit#log { font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 12px; color: #9DFFCB; background: #07051a; }
QTabWidget::pane { border: 1px solid #2E2470; border-radius: 10px; }
QTabBar::tab { background: #17123A; padding: 8px 16px; border-top-left-radius: 8px; border-top-right-radius: 8px; }
QTabBar::tab:selected { background: #7B2FF7; }
QCheckBox::indicator { width: 18px; height: 18px; }
QSlider::groove:horizontal { height: 6px; background: #2A2160; border-radius: 3px; }
QSlider::handle:horizontal { background: #3DF2FF; width: 16px; margin: -6px 0; border-radius: 8px; }
"""


# ---------------------------------------------------------------- yordamchilar
def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def write_env(updates: dict[str, str]) -> None:
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    done = set()
    for i, line in enumerate(lines):
        if "=" in line and not line.strip().startswith("#"):
            k = line.split("=", 1)[0].strip()
            if k in updates:
                lines[i] = f"{k}={updates[k]}"
                done.add(k)
    lines += [f"{k}={v}" for k, v in updates.items() if k not in done]
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def output_dir() -> Path:
    out = read_env().get("OUTPUT_DIR") or os.environ.get("OUTPUT_DIR") or "output"
    p = Path(out)
    return p if p.is_absolute() else ROOT / p


def crew_colors() -> dict[str, str]:
    src = (ROOT / "src" / "crew" / "characters.ts").read_text(encoding="utf-8")
    return dict(re.findall(r'id: "(\w+)", name: "\w+", color: "(#[0-9A-Fa-f]{6})"', src))


def studio_settings() -> dict:
    return {"askPaid": True, "musicVolume": 14, "sfx": True, "subtitles": True, "voice": "auto", "writer": "auto",
            **load_json(STUDIO_FILE, {})}


def card(*widgets: QWidget, title: str | None = None) -> QFrame:
    f = QFrame()
    f.setObjectName("card")
    lay = QVBoxLayout(f)
    lay.setContentsMargins(18, 14, 18, 14)
    if title:
        t = QLabel(title)
        t.setStyleSheet("font-size: 16px; font-weight: 700; color: #FF8AD8;")
        lay.addWidget(t)
    for w in widgets:
        lay.addWidget(w)
    return f


def header(title: str, sub: str) -> QWidget:
    w = QWidget()
    lay = QVBoxLayout(w)
    lay.setContentsMargins(0, 0, 0, 8)
    a = QLabel(title)
    a.setObjectName("h1")
    b = QLabel(sub)
    b.setObjectName("sub")
    b.setWordWrap(True)
    lay.addWidget(a)
    lay.addWidget(b)
    return w


def combo(items: list[str], current: str | None = None) -> QComboBox:
    c = QComboBox()
    c.addItems(items)
    if current and current in items:
        c.setCurrentText(current)
    return c


def jobs() -> list[Path]:
    out = output_dir()
    if not out.exists():
        return []
    return sorted([p for p in out.iterdir() if (p / "script.json").exists() or (p / "video.mp4").exists()], reverse=True)


def job_title(p: Path) -> str:
    meta = load_json(p / "script.json", {})
    return meta.get("title") or p.name


# ---------------------------------------------------------------- ishga tushiruvchi (Node pipeline)
class Runner:
    """pipeline/cli.ts ni QProcess orqali ishga tushiradi va logni ko'rsatadi."""

    def __init__(self, window: "Studio"):
        self.w = window
        self.proc: QProcess | None = None
        self.on_done = None

    def busy(self) -> bool:
        return self.proc is not None and self.proc.state() != QProcess.NotRunning

    def run(self, args: list[str], on_done=None, extra_env: dict[str, str] | None = None) -> None:
        if self.busy():
            QMessageBox.information(self.w, "Band", "Boshqa vazifa ishlayapti. Tugashini kuting.")
            return
        s = studio_settings()
        env = QProcessEnvironment.systemEnvironment()
        env.insert("STORY_MUSIC_VOLUME", str(s["musicVolume"] / 100))
        env.insert("STORY_SFX", "1" if s["sfx"] else "0")
        for k, v in (extra_env or {}).items():
            env.insert(k, v)
        self.proc = QProcess(self.w)
        self.proc.setWorkingDirectory(str(ROOT))
        self.proc.setProcessEnvironment(env)
        self.proc.setProcessChannelMode(QProcess.MergedChannels)
        self.proc.readyReadStandardOutput.connect(self._read)
        self.proc.finished.connect(self._finished)
        self.on_done = on_done
        program = "npx.cmd" if WIN else "npx"
        full = ["tsx", "pipeline/cli.ts", *args]
        self.w.log(f"\n▶ npx {' '.join(full)}")
        self.w.set_busy(True)
        self.proc.start(program, full)

    def stop(self) -> None:
        if self.busy():
            self.proc.kill()
            self.w.log("⏹ To'xtatildi")

    def _read(self) -> None:
        text = bytes(self.proc.readAllStandardOutput()).decode("utf-8", "replace")
        for line in text.splitlines():
            if "memory" in line.lower() and "cgroup" in line.lower():
                continue
            if line.strip():
                self.w.log(line)

    def _finished(self, code: int, _status) -> None:
        self.w.set_busy(False)
        self.w.log("✅ Tayyor" if code == 0 else f"❌ Xato (kod {code})")
        if code == 0 and self.on_done:
            self.on_done()
        self.w.refresh()


def confirm_paid(parent: QWidget, what: str) -> bool:
    """Pullik API (OpenAI) ishlatishdan oldin doim so'raydi."""
    if not studio_settings()["askPaid"]:
        return True
    r = QMessageBox.question(
        parent, "Pullik API",
        f"{what} uchun OpenAI (pullik) ishlatiladi.\nTaxminiy narx: 1 daqiqalik video uchun bir necha sent.\n\nDavom etaymi?",
    )
    return r == QMessageBox.Yes


def writer_voice_args(parent: QWidget, writer: str, voice: str) -> list[str] | None:
    key = bool(read_env().get("OPENAI_API_KEY", "").startswith("sk-"))
    paid = (writer == "openai") or (writer == "auto" and key) or voice == "openai"
    if paid and not confirm_paid(parent, "Ssenariy/ovoz"):
        writer = "offline"
        voice = "auto" if voice == "openai" else voice
    return ["--writer", writer, "--voice", voice]


# ---------------------------------------------------------------- sahifalar
class Page(QWidget):
    def __init__(self, studio: "Studio"):
        super().__init__()
        self.setObjectName("page")
        self.studio = studio
        self.lay = QVBoxLayout(self)
        self.lay.setContentsMargins(26, 22, 26, 16)
        self.lay.setSpacing(12)

    def refresh(self) -> None:  # sahifa ochilganda
        pass


class Dashboard(Page):
    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("Sprunki Core Studio", "AI video studiyasi: mavzu yozing, davomiylikni tanlang, qolganini studiya o'zi qiladi."))
        grid = QGridLayout()
        self.stats = []
        for i, name in enumerate(["Videolar", "Ssenariylar", "Qahramonlar", "Ovoz rejimi"]):
            v = QLabel("0")
            v.setObjectName("big")
            l = QLabel(name)
            l.setObjectName("sub")
            grid.addWidget(card(v, l), 0, i)
            self.stats.append(v)
        self.lay.addLayout(grid)
        row = QHBoxLayout()
        for text, idx in [("⚡ Yangi Short", 3), ("🎬 Uzun video", 4), ("✍️ Ssenariy", 1), ("🧑‍🎤 Qahramonlar", 2)]:
            b = QPushButton(text)
            b.setObjectName("primary" if idx == 3 else "")
            b.clicked.connect(lambda _=False, i=idx: s.go(i))
            row.addWidget(b)
        self.lay.addLayout(row)
        self.recent = QListWidget()
        self.recent.itemDoubleClicked.connect(lambda it: QDesktopServices.openUrl(QUrl.fromLocalFile(it.data(Qt.UserRole))))
        self.lay.addWidget(card(self.recent, title="So'nggi ishlar (ikki marta bosing: papkani ochish)"), 1)

    def refresh(self):
        js = jobs()
        self.stats[0].setText(str(sum(1 for j in js if (j / "video.mp4").exists())))
        self.stats[1].setText(str(sum(1 for j in js if (j / "script.json").exists())))
        self.stats[2].setText(str(len([k for k in load_json(CHAR_FILE, {}) if not k.startswith("_") and k != "narrator"])))
        self.stats[3].setText({"auto": "Bepul", "edge": "Edge", "openai": "OpenAI", "babble": "Oflayn"}.get(studio_settings()["voice"], "Bepul"))
        self.recent.clear()
        for j in js[:40]:
            it = QListWidgetItem(("🎞  " if (j / "video.mp4").exists() else "📝  ") + job_title(j) + f"   ·   {j.name}")
            it.setData(Qt.UserRole, str(j))
            self.recent.addItem(it)


class StoryGenerator(Page):
    """Mavzu -> ssenariy (sahnalar, dialoglar, his-tuyg'ular, promptlar, musiqa/SFX ko'rsatmalari)."""

    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("AI Story Generator", "Hook, qiziq o'rta qism, kulminatsiya va yakun bilan original hikoya. Har sahna uchun rasm/video promptlari ham yoziladi."))
        form = QFormLayout()
        self.topic = QLineEdit()
        self.topic.setPlaceholderText("Masalan: the lost golden microphone")
        self.category = combo(CATEGORIES)
        self.kind = combo(["Short (9:16)", "Long (16:9)"])
        self.duration = combo(SHORT_SECONDS)
        self.kind.currentIndexChanged.connect(self._kind)
        self.writer = combo(["auto", "openai", "offline"], studio_settings()["writer"])
        self.cast = QListWidget()
        self.cast.setMaximumHeight(110)
        self.cast.setFlow(QListWidget.LeftToRight)
        self.cast.setWrapping(True)
        for cid, p in load_json(CHAR_FILE, {}).items():
            if cid.startswith("_") or cid == "narrator":
                continue
            it = QListWidgetItem(p["name"])
            it.setData(Qt.UserRole, cid)
            it.setFlags(it.flags() | Qt.ItemIsUserCheckable)
            it.setCheckState(Qt.Unchecked)
            self.cast.addItem(it)
        form.addRow("Mavzu", self.topic)
        form.addRow("Kategoriya", self.category)
        form.addRow("Format", self.kind)
        form.addRow("Davomiylik", self.duration)
        form.addRow("Yozuvchi", self.writer)
        form.addRow("Qahramonlar (ixtiyoriy)", self.cast)
        w = QWidget()
        w.setLayout(form)
        self.lay.addWidget(card(w))
        row = QHBoxLayout()
        gen = QPushButton("✍️ Ssenariy yozish")
        gen.setObjectName("primary")
        gen.clicked.connect(self.generate)
        self.render_btn = QPushButton("🎬 Shu ssenariydan video")
        self.render_btn.clicked.connect(self.render)
        self.save_btn = QPushButton("💾 Saqlash")
        self.save_btn.clicked.connect(self.save)
        row.addWidget(gen)
        row.addWidget(self.save_btn)
        row.addWidget(self.render_btn)
        self.lay.addLayout(row)
        self.editor = QPlainTextEdit()
        self.editor.setPlaceholderText("Ssenariy (JSON) shu yerda chiqadi; tahrirlash mumkin.")
        self.lay.addWidget(self.editor, 1)
        self.current: Path | None = None

    def _kind(self):
        self.duration.clear()
        self.duration.addItems(SHORT_SECONDS if self.kind.currentIndex() == 0 else LONG_MINUTES)

    def args(self) -> list[str] | None:
        long = self.kind.currentIndex() == 1
        a = ["make", "--format", "story", "--kind", "long" if long else "short",
             "--minutes" if long else "--seconds", self.duration.currentText(),
             "--topic", self.topic.text().strip() or "the lost golden beat", "--category", self.category.currentText()]
        cast = [self.cast.item(i).data(Qt.UserRole) for i in range(self.cast.count()) if self.cast.item(i).checkState() == Qt.Checked]
        if cast:
            a += ["--cast", ",".join(cast)]
        wv = writer_voice_args(self, self.writer.currentText(), studio_settings()["voice"])
        return a + wv

    def generate(self):
        a = self.args()
        folder = output_dir() / f"script-{QApplicationTime.stamp()}"
        self.current = folder
        self.studio.runner.run(a + ["--script-only", "--out", str(folder)], on_done=self.load)

    def load(self):
        if self.current and (self.current / "script.json").exists():
            self.editor.setPlainText((self.current / "script.json").read_text(encoding="utf-8"))

    def save(self) -> bool:
        if not self.current:
            self.current = output_dir() / f"script-{QApplicationTime.stamp()}"
        try:
            data = json.loads(self.editor.toPlainText())
        except json.JSONDecodeError as e:
            QMessageBox.warning(self, "JSON xato", str(e))
            return False
        save_json(self.current / "script.json", data)
        self.studio.log(f"💾 Saqlandi: {self.current / 'script.json'}")
        return True

    def render(self):
        if not self.editor.toPlainText().strip() or not self.save():
            return
        voice = studio_settings()["voice"]
        if voice == "openai" and not confirm_paid(self, "Ovoz"):
            voice = "auto"
        folder = output_dir() / f"story-{QApplicationTime.stamp()}"
        self.studio.runner.run(["make", "--format", "story", "--script", str(self.current / "script.json"), "--voice", voice, "--out", str(folder)])


class QApplicationTime:
    @staticmethod
    def stamp() -> str:
        from datetime import datetime
        return datetime.now().strftime("%Y%m%d-%H%M%S")


class CharacterStudio(Page):
    COLS = ["id", "name", "personality", "speakingStyle", "catchphrase", "behavior", "edge", "rate", "pitch", "openai", "instructions"]

    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("Character Studio", "Coree Crew: har birining o'z ko'rinishi, xarakteri, gapirish uslubi va ovozi bor. Ovozlar bir-biridan farq qiladi."))
        self.table = QTableWidget()
        self.table.setColumnCount(len(self.COLS))
        self.table.setHorizontalHeaderLabels(["", "Ism", "Xarakter", "Gapirish uslubi", "Iborasi", "Harakati", "Edge ovoz (bepul)", "Tezlik", "Ohang", "OpenAI ovoz", "Ovoz ko'rsatmasi"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Interactive)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.verticalHeader().setDefaultSectionSize(40)
        self.lay.addWidget(self.table, 1)
        row = QHBoxLayout()
        b = QPushButton("💾 Saqlash")
        b.setObjectName("primary")
        b.clicked.connect(self.save)
        row.addWidget(b)
        row.addStretch()
        self.lay.addLayout(row)

    def refresh(self):
        data = load_json(CHAR_FILE, {})
        colors = crew_colors()
        rows = [(k, v) for k, v in data.items() if not k.startswith("_")]
        self.table.setRowCount(len(rows))
        for r, (cid, p) in enumerate(rows):
            vals = [cid, p.get("name", ""), p.get("personality", ""), p.get("speakingStyle", ""), p.get("catchphrase", ""), p.get("behavior", ""),
                    p["voice"].get("edge", ""), p["voice"].get("rate", ""), p["voice"].get("pitch", ""), p["voice"].get("openai", ""), p["voice"].get("instructions", "")]
            for c, v in enumerate(vals):
                if c == 6:
                    w = combo(EDGE_VOICES, v)
                    self.table.setCellWidget(r, c, w)
                    continue
                if c == 9:
                    self.table.setCellWidget(r, c, combo(OPENAI_VOICES, v))
                    continue
                it = QTableWidgetItem(v)
                if c == 0:
                    it.setFlags(it.flags() & ~Qt.ItemIsEditable)
                    pm = QPixmap(22, 22)
                    pm.fill(Qt.transparent)
                    painter = QPainter(pm)
                    painter.setBrush(QColor(colors.get(cid, "#999999")))
                    painter.drawRoundedRect(1, 1, 20, 20, 8, 8)
                    painter.end()
                    it.setIcon(QIcon(pm))
                self.table.setItem(r, c, it)
        self.table.resizeColumnsToContents()
        for c in (2, 3, 10):
            self.table.setColumnWidth(c, 260)

    def save(self):
        data = load_json(CHAR_FILE, {})
        for r in range(self.table.rowCount()):
            cid = self.table.item(r, 0).text()
            p = data.get(cid, {"voice": {}})
            txt = lambda c: self.table.item(r, c).text() if self.table.item(r, c) else ""
            p.update(name=txt(1), personality=txt(2), speakingStyle=txt(3), catchphrase=txt(4), behavior=txt(5))
            p["voice"].update(edge=self.table.cellWidget(r, 6).currentText(), rate=txt(7), pitch=txt(8),
                              openai=self.table.cellWidget(r, 9).currentText(), instructions=txt(10))
            data[cid] = p
        # bir xil ovoz bo'lmasligi uchun tekshiruv
        seen: dict[tuple, str] = {}
        for cid, p in data.items():
            if cid.startswith("_"):
                continue
            key = (p["voice"].get("edge"), p["voice"].get("pitch"), p["voice"].get("rate"))
            if key in seen:
                QMessageBox.warning(self, "Bir xil ovoz", f"{p['name']} va {data[seen[key]]['name']} ovozi bir xil. Ohang yoki tezlikni o'zgartiring.")
                return
            seen[key] = cid
        save_json(CHAR_FILE, data)
        self.studio.log("💾 Qahramonlar saqlandi")


class Generator(Page):
    """Shorts yoki uzun video: bitta tugma bilan to'liq avtomatik."""

    def __init__(self, s, long: bool):
        super().__init__(s)
        self.long = long
        self.lay.addWidget(header(
            "Long Video Generator" if long else "Shorts Generator",
            "16:9 to'liq epizod: ko'p sahna, har qahramonning o'z ovozi, musiqa, subtitr. 1080p yoki 4K." if long
            else "9:16 vertikal: kuchli hook, tez hikoya, dialog, avtomatik subtitr. YouTube Shorts uchun tayyor.",
        ))
        form = QFormLayout()
        self.topic = QLineEdit()
        self.topic.setPlaceholderText("Video mavzusi")
        self.category = combo(CATEGORIES)
        self.duration = combo(LONG_MINUTES if long else SHORT_SECONDS, "10" if long else "30")
        self.uhd = QCheckBox("4K eksport (3840×2160)")
        self.count = combo(["1", "2", "3", "5"])
        form.addRow("Mavzu", self.topic)
        form.addRow("Kategoriya", self.category)
        form.addRow("Davomiylik (" + ("daqiqa" if long else "soniya") + ")", self.duration)
        form.addRow("Nechta video", self.count)
        if long:
            form.addRow("", self.uhd)
        w = QWidget()
        w.setLayout(form)
        self.lay.addWidget(card(w))
        b = QPushButton("🚀 To'liq avtomatik yaratish")
        b.setObjectName("primary")
        b.clicked.connect(self.go)
        self.lay.addWidget(b)
        tip = QLabel("Jarayon: ssenariy → qahramonlar ovozi → animatsiya → musiqa va effektlar → subtitr → FFmpeg eksport.\n"
                     "Uzun videolar ko'p vaqt oladi (10 daqiqa ≈ 15-40 daqiqa render, kompyuterga bog'liq).")
        tip.setObjectName("sub")
        tip.setWordWrap(True)
        self.lay.addWidget(tip)
        self.lay.addStretch()
        self.queue: list[list[str]] = []

    def go(self):
        st = studio_settings()
        wv = writer_voice_args(self, st["writer"], st["voice"])
        base = ["make", "--format", "story", "--kind", "long" if self.long else "short",
                "--minutes" if self.long else "--seconds", self.duration.currentText(),
                "--topic", self.topic.text().strip() or "a surprise concert", "--category", self.category.currentText(), *wv]
        if self.long and self.uhd.isChecked():
            base.append("--4k")
        if not st["subtitles"]:
            base.append("--no-subtitles")
        self.queue = [base for _ in range(int(self.count.currentText()))]
        self.next()

    def next(self):
        if self.queue:
            self.studio.runner.run(self.queue.pop(0), on_done=self.next)


class VoiceStudio(Page):
    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("AI Voice Studio", "Har qahramon uchun alohida ingliz ovozi. Edge ovozlari bepul; OpenAI ovozlari pullik (ishlatishdan oldin so'raladi); internet bo'lmasa oflayn ovoz."))
        form = QFormLayout()
        st = studio_settings()
        self.provider = combo(["auto", "edge", "openai", "babble"], st["voice"])
        self.provider.setToolTip("auto = bepul Edge, ishlamasa oflayn")
        self.provider.currentTextChanged.connect(self.save_provider)
        self.char = QComboBox()
        for cid, p in load_json(CHAR_FILE, {}).items():
            if not cid.startswith("_"):
                self.char.addItem(p["name"], cid)
        self.emotion = combo(EMOTIONS)
        self.text = QLineEdit("Hi! I'm ready for a brand new adventure!")
        form.addRow("Ovoz manbasi", self.provider)
        form.addRow("Qahramon", self.char)
        form.addRow("His-tuyg'u", self.emotion)
        form.addRow("Matn", self.text)
        w = QWidget()
        w.setLayout(form)
        self.lay.addWidget(card(w))
        b = QPushButton("🔊 Ovozni sinash")
        b.setObjectName("primary")
        b.clicked.connect(self.test)
        self.lay.addWidget(b)
        self.lay.addStretch()

    def save_provider(self, v: str):
        st = studio_settings()
        st["voice"] = v
        save_json(STUDIO_FILE, st)

    def test(self):
        voice = self.provider.currentText()
        if voice == "openai" and not confirm_paid(self, "Ovoz sinovi"):
            return
        out = output_dir() / "voice-tests"
        args = ["voice-test", "--cast", self.char.currentData(), "--topic", self.text.text(), "--category", self.emotion.currentText(),
                "--voice", voice, "--out", str(out)]

        def play():
            files = sorted(out.glob("**/*.*"), key=lambda p: p.stat().st_mtime)
            if files:
                QDesktopServices.openUrl(QUrl.fromLocalFile(str(files[-1])))
        self.studio.runner.run(args, on_done=play)


class AnimationStudio(Page):
    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("Animation Studio", "Sahnalarni kadrma-kadr ko'rish (Remotion Studio): silliq harakat, lip-sync, his-tuyg'ular, kamera harakatlari, o'tishlar, yorug'lik."))
        self.list = QListWidget()
        self.lay.addWidget(card(self.list, title="Video loyihalar"), 1)
        b = QPushButton("🎞 Tanlangan loyihani Studio'da ochish")
        b.setObjectName("primary")
        b.clicked.connect(self.open)
        self.lay.addWidget(b)
        info = QLabel("Joylar: " + ", ".join(LOCATIONS) + "\nKamera: " + ", ".join(CAMERAS) + "\nHarakatlar: " + ", ".join(ACTIONS) +
                      "\nHis-tuyg'ular: " + ", ".join(EMOTIONS) + "\nO'tishlar: " + ", ".join(TRANSITIONS))
        info.setObjectName("sub")
        info.setWordWrap(True)
        self.lay.addWidget(card(info, title="Animatsiya imkoniyatlari"))

    def refresh(self):
        self.list.clear()
        for j in jobs():
            if (j / "props.json").exists():
                it = QListWidgetItem(job_title(j))
                it.setData(Qt.UserRole, str(j))
                self.list.addItem(it)

    def open(self):
        it = self.list.currentItem()
        if not it:
            return
        self.studio.runner.run(["preview", it.data(Qt.UserRole)])


class VideoEditor(Page):
    """Sahnalar va gaplarni tahrirlash, tartibini o'zgartirish, qayta render."""

    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("Video Editor", "Sahnalarni joylashtirish, dialoglarni tahrirlash, his-tuyg'u, harakat, effekt va o'tishlarni tanlash; keyin qayta render."))
        top = QHBoxLayout()
        self.pick = QComboBox()
        self.pick.currentIndexChanged.connect(self.load)
        top.addWidget(QLabel("Loyiha:"))
        top.addWidget(self.pick, 1)
        self.lay.addLayout(top)
        split = QSplitter(Qt.Vertical)
        self.scenes = QTableWidget()
        self.scenes.setColumnCount(7)
        self.scenes.setHorizontalHeaderLabels(["Joy", "Vaqt", "Kamera", "Kayfiyat", "O'tish", "Qahramonlar", "Tavsif"])
        self.scenes.horizontalHeader().setStretchLastSection(True)
        self.scenes.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.scenes.currentCellChanged.connect(lambda r, *_: self.show_lines(r))
        self.lines = QTableWidget()
        self.lines.setColumnCount(5)
        self.lines.setHorizontalHeaderLabels(["Kim", "Matn", "His-tuyg'u", "Harakat", "SFX"])
        self.lines.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        split.addWidget(self.scenes)
        split.addWidget(self.lines)
        self.lay.addWidget(split, 1)
        row = QHBoxLayout()
        for text, fn in [("⬆", lambda: self.move(-1)), ("⬇", lambda: self.move(1)), ("🗑 Sahna", self.delete_scene),
                         ("➕ Gap", self.add_line), ("🗑 Gap", self.delete_line), ("💾 Saqlash", self.save)]:
            b = QPushButton(text)
            b.clicked.connect(fn)
            row.addWidget(b)
        rr = QPushButton("🎬 Qayta render")
        rr.setObjectName("primary")
        rr.clicked.connect(self.rerender)
        row.addWidget(rr)
        self.lay.addLayout(row)
        self.data: dict | None = None
        self.path: Path | None = None
        self.cur = -1

    def refresh(self):
        self.pick.blockSignals(True)
        self.pick.clear()
        for j in jobs():
            if (j / "script.json").exists():
                self.pick.addItem(job_title(j), str(j))
        self.pick.blockSignals(False)
        self.load()

    def load(self):
        if self.pick.currentData() is None:
            return
        self.path = Path(self.pick.currentData()) / "script.json"
        self.data = load_json(self.path, {"scenes": []})
        self.scenes.setRowCount(len(self.data["scenes"]))
        for r, sc in enumerate(self.data["scenes"]):
            for c, (key, items) in enumerate([("location", LOCATIONS), ("time", ["day", "night"]), ("camera", CAMERAS), ("mood", MOODS), ("transition", TRANSITIONS)]):
                self.scenes.setCellWidget(r, c, combo(items, sc.get(key)))
            self.scenes.setItem(r, 5, QTableWidgetItem(",".join(sc.get("cast", []))))
            self.scenes.setItem(r, 6, QTableWidgetItem(sc.get("description", "")))
        self.cur = -1
        if self.data["scenes"]:
            self.scenes.selectRow(0)
            self.show_lines(0)

    def collect_lines(self):
        if self.data is None or not (0 <= self.cur < len(self.data["scenes"])):
            return
        out = []
        for r in range(self.lines.rowCount()):
            sfx = self.lines.cellWidget(r, 4).currentText()
            line = {"speaker": self.lines.cellWidget(r, 0).currentText(), "text": self.lines.item(r, 1).text() if self.lines.item(r, 1) else "",
                    "emotion": self.lines.cellWidget(r, 2).currentText(), "action": self.lines.cellWidget(r, 3).currentText()}
            if sfx:
                line["sfx"] = sfx
            out.append(line)
        self.data["scenes"][self.cur]["lines"] = out

    def show_lines(self, r: int):
        if self.data is None or r < 0 or r >= len(self.data["scenes"]):
            return
        if self.cur != r:
            self.collect_lines()
        self.cur = r
        speakers = ["narrator"] + [k for k in load_json(CHAR_FILE, {}) if not k.startswith("_") and k != "narrator"]
        lines = self.data["scenes"][r]["lines"]
        self.lines.setRowCount(len(lines))
        for i, l in enumerate(lines):
            self.lines.setCellWidget(i, 0, combo(speakers, l.get("speaker")))
            self.lines.setItem(i, 1, QTableWidgetItem(l.get("text", "")))
            self.lines.setCellWidget(i, 2, combo(EMOTIONS, l.get("emotion")))
            self.lines.setCellWidget(i, 3, combo(ACTIONS, l.get("action", "none")))
            self.lines.setCellWidget(i, 4, combo(SFX, l.get("sfx", "")))

    def collect_scenes(self):
        self.collect_lines()
        for r, sc in enumerate(self.data["scenes"]):
            for c, key in enumerate(["location", "time", "camera", "mood", "transition"]):
                sc[key] = self.scenes.cellWidget(r, c).currentText()
            sc["cast"] = [x.strip() for x in (self.scenes.item(r, 5).text() if self.scenes.item(r, 5) else "").split(",") if x.strip()]
            sc["description"] = self.scenes.item(r, 6).text() if self.scenes.item(r, 6) else ""

    def move(self, d: int):
        r = self.scenes.currentRow()
        if self.data is None or r < 0 or not (0 <= r + d < len(self.data["scenes"])):
            return
        self.collect_scenes()
        sc = self.data["scenes"]
        sc[r], sc[r + d] = sc[r + d], sc[r]
        save_json(self.path, self.data)
        self.load()
        self.scenes.selectRow(r + d)

    def delete_scene(self):
        r = self.scenes.currentRow()
        if self.data is None or r < 0:
            return
        self.collect_scenes()
        del self.data["scenes"][r]
        save_json(self.path, self.data)
        self.load()

    def add_line(self):
        if self.data is None or self.cur < 0:
            return
        self.collect_lines()
        self.data["scenes"][self.cur]["lines"].append({"speaker": "coree", "text": "New line", "emotion": "happy", "action": "none"})
        self.show_lines(self.cur)

    def delete_line(self):
        r = self.lines.currentRow()
        if self.data is None or self.cur < 0 or r < 0:
            return
        self.collect_lines()
        del self.data["scenes"][self.cur]["lines"][r]
        self.show_lines(self.cur)

    def save(self):
        if self.data is None:
            return
        self.collect_scenes()
        save_json(self.path, self.data)
        self.studio.log(f"💾 Saqlandi: {self.path}")

    def rerender(self):
        if self.data is None:
            return
        self.save()
        voice = studio_settings()["voice"]
        if voice == "openai" and not confirm_paid(self, "Ovoz"):
            voice = "auto"
        self.studio.runner.run(["make", "--format", "story", "--script", str(self.path), "--voice", voice,
                                "--out", str(output_dir() / f"story-{QApplicationTime.stamp()}")])


class MusicSfx(Page):
    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("Music & Sound Effects", "Musiqa va effektlar kanal uchun sintez qilinadi: mualliflik huquqi muammosi yo'q. Dialog paytida musiqa avtomatik pasayadi."))
        st = studio_settings()
        form = QFormLayout()
        self.vol = QSlider(Qt.Horizontal)
        self.vol.setRange(0, 40)
        self.vol.setValue(int(st["musicVolume"]))
        self.vol_label = QLabel(f"{st['musicVolume']}%")
        self.vol.valueChanged.connect(lambda v: self.vol_label.setText(f"{v}%"))
        vrow = QHBoxLayout()
        vrow.addWidget(self.vol, 1)
        vrow.addWidget(self.vol_label)
        vw = QWidget()
        vw.setLayout(vrow)
        self.sfx = QCheckBox("Ovoz effektlari (whoosh, pop, boing, ding, drum, thunder, magic, crash, cheer, gasp)")
        self.sfx.setChecked(st["sfx"])
        self.subs = QCheckBox("Subtitrlar videoda (har doim .srt fayl ham yaratiladi)")
        self.subs.setChecked(st["subtitles"])
        form.addRow("Musiqa balandligi", vw)
        form.addRow("", self.sfx)
        form.addRow("", self.subs)
        w = QWidget()
        w.setLayout(form)
        self.lay.addWidget(card(w))
        b = QPushButton("💾 Saqlash")
        b.setObjectName("primary")
        b.clicked.connect(self.save)
        self.lay.addWidget(b)
        self.lay.addStretch()

    def save(self):
        st = studio_settings()
        st.update(musicVolume=self.vol.value(), sfx=self.sfx.isChecked(), subtitles=self.subs.isChecked())
        save_json(STUDIO_FILE, st)
        self.studio.log("💾 Musiqa sozlamalari saqlandi")


class ExportStudio(Page):
    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("Export Studio", "Tayyor videolar: ko'rish, papkani ochish, 4K eksport (FFmpeg), YouTube sarlavha/tavsif/teglar va .srt subtitrlar."))
        split = QSplitter()
        self.list = QListWidget()
        self.list.currentItemChanged.connect(self.show)
        self.meta = QPlainTextEdit()
        self.meta.setReadOnly(True)
        split.addWidget(self.list)
        split.addWidget(self.meta)
        split.setSizes([400, 500])
        self.lay.addWidget(split, 1)
        row = QHBoxLayout()
        for text, fn in [("▶ Ko'rish", self.play), ("📂 Papka", self.folder), ("🖥 4K eksport", self.uhd), ("📋 Ma'lumotni nusxalash", self.copy)]:
            b = QPushButton(text)
            b.clicked.connect(fn)
            row.addWidget(b)
        self.lay.addLayout(row)

    def refresh(self):
        self.list.clear()
        for j in jobs():
            if (j / "video.mp4").exists():
                it = QListWidgetItem(job_title(j))
                it.setData(Qt.UserRole, str(j))
                self.list.addItem(it)

    def sel(self) -> Path | None:
        it = self.list.currentItem()
        return Path(it.data(Qt.UserRole)) if it else None

    def show(self, *_):
        j = self.sel()
        if not j:
            return
        yt = load_json(j / "youtube.json", {})
        files = ", ".join(p.name for p in j.iterdir() if p.suffix in (".mp4", ".srt"))
        self.meta.setPlainText(f"TITLE:\n{yt.get('title', job_title(j))}\n\nDESCRIPTION:\n{yt.get('description', '')}\n\nTAGS:\n{', '.join(yt.get('tags', []))}\n\nFAYLLAR: {files}")

    def play(self):
        j = self.sel()
        if j:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(j / "video.mp4")))

    def folder(self):
        j = self.sel()
        if j:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(j)))

    def copy(self):
        QApplication.clipboard().setText(self.meta.toPlainText())
        self.studio.log("📋 Nusxalandi")

    def uhd(self):
        j = self.sel()
        if not j:
            return
        if not shutil.which("ffmpeg"):
            QMessageBox.warning(self, "FFmpeg", "FFmpeg topilmadi. Settings bo'limidagi ko'rsatmaga qarang.")
            return
        meta = load_json(j / "props.json", {})
        size = "3840:2160" if meta.get("width", 1920) > meta.get("height", 1080) else "2160:3840"
        proc = QProcess(self)
        proc.setProcessChannelMode(QProcess.MergedChannels)
        proc.finished.connect(lambda code, _s: self.studio.log("✅ 4K tayyor: video_4k.mp4" if code == 0 else "❌ 4K xato"))
        self.studio.log("▶ FFmpeg 4K eksport...")
        proc.start("ffmpeg", ["-y", "-loglevel", "error", "-i", str(j / "video.mp4"), "-vf", f"scale={size}:flags=lanczos",
                              "-c:v", "libx264", "-crf", "18", "-c:a", "copy", str(j / "video_4k.mp4")])
        self._p = proc


class Settings(Page):
    def __init__(self, s):
        super().__init__(s)
        self.lay.addWidget(header("Settings", "Kalitlar faqat shu kompyuterdagi .env faylida saqlanadi (GitHub'ga yuklanmaydi). Pullik API ishlatishdan oldin doim so'raladi."))
        env = read_env()
        st = studio_settings()
        form = QFormLayout()
        self.channel = QLineEdit(env.get("CHANNEL_NAME", "Sprunki Core Studio"))
        self.key = QLineEdit(env.get("OPENAI_API_KEY", ""))
        self.key.setEchoMode(QLineEdit.Password)
        self.key.setPlaceholderText("sk-... (ixtiyoriy, pullik)")
        self.model = QLineEdit(env.get("OPENAI_MODEL", "gpt-4o-mini"))
        self.out = QLineEdit(env.get("OUTPUT_DIR", "output"))
        browse = QPushButton("…")
        browse.clicked.connect(lambda: self.out.setText(QFileDialog.getExistingDirectory(self, "Papka") or self.out.text()))
        orow = QHBoxLayout()
        orow.addWidget(self.out, 1)
        orow.addWidget(browse)
        ow = QWidget()
        ow.setLayout(orow)
        self.writer = combo(["auto", "openai", "offline"], st["writer"])
        self.ask = QCheckBox("Pullik API'dan oldin so'rash")
        self.ask.setChecked(st["askPaid"])
        form.addRow("Kanal nomi", self.channel)
        form.addRow("Til", QLabel("English"))
        form.addRow("Vizual uslub", QLabel("ORIGINAL SPRUNKI CORE (Coree Crew), horror avtomatik yoqilmaydi"))
        form.addRow("OpenAI API kaliti", self.key)
        form.addRow("OpenAI modeli", self.model)
        form.addRow("Ssenariy yozuvchi", self.writer)
        form.addRow("Natijalar papkasi", ow)
        form.addRow("", self.ask)
        w = QWidget()
        w.setLayout(form)
        self.lay.addWidget(card(w))
        b = QPushButton("💾 Saqlash")
        b.setObjectName("primary")
        b.clicked.connect(self.save)
        self.lay.addWidget(b)
        self.check = QLabel()
        self.check.setObjectName("sub")
        self.check.setWordWrap(True)
        self.lay.addWidget(card(self.check, title="Tizim tekshiruvi"))
        self.lay.addStretch()

    def refresh(self):
        ok = lambda b: "✅" if b else "❌"
        self.check.setText(
            f"{ok(shutil.which('node'))} Node.js (https://nodejs.org, LTS)\n"
            f"{ok(shutil.which('ffmpeg'))} FFmpeg (Windows: winget install ffmpeg)\n"
            f"{ok((ROOT / 'node_modules').exists())} npm paketlari (loyiha papkasida: npm install)\n"
            f"{ok(read_env().get('OPENAI_API_KEY', '').startswith('sk-'))} OpenAI kaliti (ixtiyoriy: usiz bepul rejim ishlaydi)"
        )

    def save(self):
        updates = {"CHANNEL_NAME": self.channel.text().strip(), "OPENAI_MODEL": self.model.text().strip(), "OUTPUT_DIR": self.out.text().strip()}
        if self.key.text().strip():
            updates["OPENAI_API_KEY"] = self.key.text().strip()
        write_env(updates)
        st = studio_settings()
        st.update(writer=self.writer.currentText(), askPaid=self.ask.isChecked())
        save_json(STUDIO_FILE, st)
        self.refresh()
        self.studio.log("💾 Sozlamalar saqlandi")


# ---------------------------------------------------------------- asosiy oyna
class Studio(QMainWindow):
    SECTIONS = ["🏠  Dashboard", "✍️  AI Story Generator", "🧑‍🎤  Character Studio", "⚡  Shorts Generator", "🎬  Long Video Generator",
                "🔊  AI Voice Studio", "🎞  Animation Studio", "✂️  Video Editor", "🎵  Music & Sound Effects", "📦  Export Studio", "⚙️  Settings"]

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Sprunki Core Studio")
        self.resize(1360, 860)
        self.runner = Runner(self)
        root = QWidget()
        self.setCentralWidget(root)
        h = QHBoxLayout(root)
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(0)
        side = QWidget()
        side.setFixedWidth(250)
        sv = QVBoxLayout(side)
        sv.setContentsMargins(0, 0, 0, 0)
        logo = QLabel("SPRUNKI CORE\nSTUDIO")
        logo.setAlignment(Qt.AlignCenter)
        logo.setStyleSheet("font-size: 22px; font-weight: 900; color: #FFE14D; padding: 22px 0; background: #140F2E; letter-spacing: 2px;")
        self.nav = QListWidget()
        self.nav.setObjectName("nav")
        self.nav.addItems(self.SECTIONS)
        sv.addWidget(logo)
        sv.addWidget(self.nav, 1)
        h.addWidget(side)
        right = QSplitter(Qt.Vertical)
        self.stack = QStackedWidget()
        self.pages: list[Page] = [
            Dashboard(self), StoryGenerator(self), CharacterStudio(self), Generator(self, False), Generator(self, True),
            VoiceStudio(self), AnimationStudio(self), VideoEditor(self), MusicSfx(self), ExportStudio(self), Settings(self),
        ]
        for p in self.pages:
            self.stack.addWidget(p)
        right.addWidget(self.stack)
        bottom = QWidget()
        bl = QVBoxLayout(bottom)
        bl.setContentsMargins(12, 6, 12, 10)
        bar = QHBoxLayout()
        self.status = QLabel("Tayyor")
        self.status.setStyleSheet("color: #3DF2FF; font-weight: 700;")
        stop = QPushButton("⏹ To'xtatish")
        stop.clicked.connect(self.runner.stop)
        bar.addWidget(self.status, 1)
        bar.addWidget(stop)
        self.console = QPlainTextEdit()
        self.console.setObjectName("log")
        self.console.setReadOnly(True)
        bl.addLayout(bar)
        bl.addWidget(self.console)
        right.addWidget(bottom)
        right.setSizes([640, 200])
        h.addWidget(right, 1)
        self.nav.currentRowChanged.connect(self.go)
        self.nav.setCurrentRow(0)

    def go(self, i: int) -> None:
        if self.nav.currentRow() != i:
            self.nav.setCurrentRow(i)
            return
        self.stack.setCurrentIndex(i)
        self.pages[i].refresh()

    def refresh(self) -> None:
        self.pages[self.stack.currentIndex()].refresh()

    def log(self, text: str) -> None:
        self.console.appendPlainText(text)
        if "Render:" in text or "tayyor" in text.lower():
            self.status.setText(text.split("]")[-1].strip()[:90])

    def set_busy(self, busy: bool) -> None:
        self.status.setText("⏳ Ishlayapti..." if busy else "Tayyor")


def main() -> None:
    app = QApplication(sys.argv)
    app.setApplicationName("Sprunki Core Studio")
    app.setStyleSheet(QSS)
    app.setFont(QFont("Segoe UI", 10))
    w = Studio()
    if "--screenshot" in sys.argv:
        # avtomatik test: har bo'limning skrinshoti
        out = Path(sys.argv[sys.argv.index("--screenshot") + 1])
        out.mkdir(parents=True, exist_ok=True)
        w.show()
        for i in range(len(w.pages)):
            w.go(i)
            app.processEvents()
            w.grab().save(str(out / f"{i:02d}.png"))
        return
    w.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
