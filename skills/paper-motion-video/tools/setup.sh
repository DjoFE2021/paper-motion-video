#!/usr/bin/env bash
# One-time environment setup for paper-motion-video (idempotent, ~3-6 min the first time).
# Installs a private Python venv + the Kokoro voice model under $PMV_HOME (default ~/.cache/paper-motion-video).
set -euo pipefail
PMV_HOME="${PMV_HOME:-$HOME/.cache/paper-motion-video}"
VENV="$PMV_HOME/venv"
mkdir -p "$PMV_HOME"
log() { printf '\033[1;34m[pmv setup]\033[0m %s\n' "$*" >&2; }

pick_python() {
  for c in python3.12 python3.11 python3.10 python3; do
    if command -v "$c" >/dev/null 2>&1; then
      v=$("$c" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || echo 0)
      case "$v" in 3.10|3.11|3.12) echo "$c"; return 0 ;; esac
    fi
  done
  return 1
}

if [ ! -x "$VENV/bin/python" ]; then
  if PY=$(pick_python); then
    log "creating venv with $PY"
    "$PY" -m venv "$VENV"
  elif command -v uv >/dev/null 2>&1; then
    log "creating venv with uv (Python 3.12)"
    uv venv --seed --python 3.12 "$VENV"
  else
    echo "paper-motion-video needs Python 3.10-3.12 (the Kokoro voice model does not support 3.13 yet)." >&2
    echo "Install one, e.g. 'brew install python@3.12' or 'uv python install 3.12', then re-run." >&2
    exit 1
  fi
fi
PY="$VENV/bin/python"
"$PY" -m pip install -q --upgrade pip

# Platform-specific pins
CONSTRAINTS="$PMV_HOME/constraints.txt"
: > "$CONSTRAINTS"
OS=$(uname -s); ARCH=$(uname -m)
if [ "$OS" = "Darwin" ] && [ "$ARCH" = "x86_64" ]; then
  log "Intel Mac: pinning the last PyTorch build for x86_64 macOS"
  printf 'torch==2.2.2\nnumpy<2\ntransformers<4.46\nscipy<1.14\n' > "$CONSTRAINTS"
  "$PY" -m pip install -q -c "$CONSTRAINTS" torch numpy transformers scipy
elif [ "$OS" = "Linux" ]; then
  log "Linux: installing CPU-only PyTorch"
  "$PY" -m pip install -q torch --index-url https://download.pytorch.org/whl/cpu
fi
log "installing Python packages"
"$PY" -m pip install -q -c "$CONSTRAINTS" kokoro soundfile scipy numpy playwright imageio-ffmpeg pyloudnorm pillow pymupdf

# Browser: prefer the installed Google Chrome, else download Playwright's Chromium
log "checking for a headless browser"
if ! "$PY" - <<'EOF' 2>/dev/null
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    p.chromium.launch(channel="chrome", headless=True).close()
EOF
then
  log "Google Chrome not found, installing Playwright Chromium"
  "$PY" -m playwright install chromium
  if [ "$OS" = "Linux" ]; then log "if Chromium fails to start, run: sudo $PY -m playwright install-deps chromium"; fi
fi

# Warm up the voice model (downloads ~330 MB of Kokoro weights and the spaCy English model once)
log "downloading the Kokoro voice model"
HF_HOME="$PMV_HOME/hf" "$PY" - <<'EOF'
import warnings; warnings.filterwarnings("ignore")
from kokoro import KPipeline
p = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
for r in p("Setup complete.", voice="af_heart"):
    pass
print("voice model ok")
EOF
touch "$PMV_HOME/.ready"
log "ready ($PMV_HOME)"
