"""One-time environment setup (idempotent, ~3-6 min the first time), run by the pmv launchers with the venv's Python.
Installs the Python packages, a headless browser and the Kokoro voice model under PMV_HOME (default ~/.cache/paper-motion-video)."""
import os
import platform
import subprocess
import sys
from pathlib import Path

PMV_HOME = Path(os.environ.get("PMV_HOME", Path.home() / ".cache" / "paper-motion-video"))
PY = sys.executable

CHROME = """
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    p.chromium.launch(channel="chrome", headless=True).close()
"""
VOICE = """
import warnings; warnings.filterwarnings("ignore")
from kokoro import KPipeline
p = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
for r in p("Setup complete.", voice="af_heart"):
    pass
print("voice model ok")
"""


def log(msg):
    print(f"\033[1;34m[pmv setup]\033[0m {msg}" if os.name == "posix" else f"[pmv setup] {msg}", file=sys.stderr, flush=True)


def pip(*args):
    subprocess.run([PY, "-m", "pip", "install", "-q", *map(str, args)], check=True)


def main():
    pip("--upgrade", "pip")

    # Platform-specific pins
    constraints = PMV_HOME / "constraints.txt"
    constraints.write_text("", encoding="utf-8")
    system = platform.system()
    if system == "Darwin" and platform.machine() == "x86_64":
        log("Intel Mac: pinning the last PyTorch build for x86_64 macOS")
        constraints.write_text("torch==2.2.2\nnumpy<2\ntransformers<4.46\nscipy<1.14\n", encoding="utf-8")
        pip("-c", constraints, "torch", "numpy", "transformers", "scipy")
    elif system in ("Linux", "Windows"):
        log(f"{system}: installing CPU-only PyTorch")
        pip("torch", "--index-url", "https://download.pytorch.org/whl/cpu")
    log("installing Python packages")
    pip("-c", constraints, "kokoro", "soundfile", "scipy", "numpy", "playwright", "imageio-ffmpeg", "pyloudnorm", "pillow", "pymupdf")

    # Browser: prefer the installed Google Chrome, else download Playwright's Chromium
    log("checking for a headless browser")
    if subprocess.run([PY, "-c", CHROME], capture_output=True).returncode:
        log("Google Chrome not found, installing Playwright Chromium")
        subprocess.run([PY, "-m", "playwright", "install", "chromium"], check=True)
        if system == "Linux":
            log(f"if Chromium fails to start, run: sudo {PY} -m playwright install-deps chromium")

    # Warm up the voice model (downloads ~330 MB of Kokoro weights and the spaCy English model once)
    log("downloading the Kokoro voice model")
    subprocess.run([PY, "-c", VOICE], check=True, env={**os.environ, "HF_HOME": str(PMV_HOME / "hf")})
    (PMV_HOME / ".ready").touch()
    log(f"ready ({PMV_HOME})")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f"pmv setup failed (exit code {e.returncode}); fix the error above, then run: pmv setup")
