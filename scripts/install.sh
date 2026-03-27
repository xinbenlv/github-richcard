#!/usr/bin/env bash
# install.sh — download the latest GitHub RichCard release and load it in Chrome/Arc/Brave
#
# Run on your LOCAL machine (not the dev server):
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh)
#
# Or, if you have the repo cloned locally:
#   bash scripts/install.sh
#
# Options:
#   --version v0.1.1   install a specific release tag (default: latest)
#   --dir ~/my/path    custom install directory       (default: ~/.github-richcard)
#   --browser arc|chrome|brave|chromium  (default: auto-detect)

set -euo pipefail

REPO="xinbenlv/github-richcard"
INSTALL_DIR="${GITHUB_RICHCARD_DIR:-$HOME/.github-richcard}"
VERSION=""
BROWSER=""

# ── parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --dir)     INSTALL_DIR="$2"; shift 2 ;;
    --browser) BROWSER="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── colors ────────────────────────────────────────────────────────────────────
B="\033[1m"; C="\033[36m"; G="\033[32m"; R="\033[31m"; N="\033[0m"
log() { echo -e "${C}▶${N} $*"; }
ok()  { echo -e "${G}✔${N} $*"; }
die() { echo -e "${R}✖${N} $*" >&2; exit 1; }

# ── detect OS ─────────────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux)  OS=linux ;;
  *)      die "Unsupported OS: $(uname -s). Install manually." ;;
esac

# ── detect browser ────────────────────────────────────────────────────────────
detect_browser() {
  if [[ $OS == mac ]]; then
    for name in "Arc" "Google Chrome" "Brave Browser" "Chromium"; do
      [[ -d "/Applications/${name}.app" ]] && echo "$name" && return
    done
  else
    for cmd in google-chrome chromium-browser chromium brave-browser; do
      command -v "$cmd" &>/dev/null && echo "$cmd" && return
    done
  fi
  echo ""
}

browser_bin() {
  local name="$1"
  if [[ $OS == mac ]]; then
    case "$name" in
      Arc)             echo "/Applications/Arc.app/Contents/MacOS/Arc" ;;
      "Google Chrome") echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ;;
      "Brave Browser") echo "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" ;;
      Chromium)        echo "/Applications/Chromium.app/Contents/MacOS/Chromium" ;;
      *)               die "Unknown browser: $name" ;;
    esac
  else
    echo "$name"
  fi
}

if [[ -z "$BROWSER" ]]; then
  BROWSER="$(detect_browser)"
  [[ -z "$BROWSER" ]] && die "No Chromium-based browser found. Pass --browser <name>."
fi
ok "Browser: $BROWSER"

# ── resolve version ───────────────────────────────────────────────────────────
if [[ -z "$VERSION" ]]; then
  log "Fetching latest release…"
  VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  [[ -z "$VERSION" ]] && die "Could not determine latest version. Pass --version vX.Y.Z."
fi
ok "Version: $VERSION"

# ── download ──────────────────────────────────────────────────────────────────
ZIP_NAME="github-richcard-${VERSION#v}-chrome.zip"
ZIP_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ZIP_NAME}"
EXT_DIR="${INSTALL_DIR}/${VERSION}"

mkdir -p "$EXT_DIR"
TMP_ZIP="$(mktemp).zip"

log "Downloading ${ZIP_URL}…"
curl -fsSL -o "$TMP_ZIP" "$ZIP_URL" || die "Download failed. Check that $VERSION exists at github.com/${REPO}/releases"
ok "Downloaded to $TMP_ZIP"

# ── unzip ─────────────────────────────────────────────────────────────────────
log "Unzipping to ${EXT_DIR}…"
unzip -qo "$TMP_ZIP" -d "$EXT_DIR"
rm "$TMP_ZIP"

# WXT zips the extension into a sub-directory; flatten if needed
INNER=$(find "$EXT_DIR" -maxdepth 2 -name "manifest.json" | head -1 | xargs dirname)
if [[ "$INNER" != "$EXT_DIR" && -n "$INNER" ]]; then
  cp -r "$INNER"/. "$EXT_DIR"/
fi
ok "Unzipped to ${EXT_DIR}"

# ── update symlink ────────────────────────────────────────────────────────────
LATEST_LINK="${INSTALL_DIR}/latest"
ln -sfn "$EXT_DIR" "$LATEST_LINK"
ok "Symlink: ${LATEST_LINK} → ${EXT_DIR}"

# ── launch browser with extension ────────────────────────────────────────────
BIN="$(browser_bin "$BROWSER")"
log "Launching ${BROWSER} with extension loaded…"

if [[ $OS == mac ]]; then
  # macOS: use 'open' so a new window/profile works even if browser is running
  # --load-extension only works when passed directly to the binary (not via open -a)
  if pgrep -xq "${BROWSER}" 2>/dev/null || pgrep -f "${BROWSER}" 2>/dev/null; then
    echo ""
    echo -e "${B}Browser is already running.${N}"
    echo "  --load-extension only works at launch time in Chromium."
    echo "  To load the extension manually:"
    echo -e "  ${C}1.${N} Open  chrome://extensions  (or arc://extensions)"
    echo -e "  ${C}2.${N} Enable Developer mode"
    echo -e "  ${C}3.${N} Click 'Load unpacked' and select:"
    echo -e "     ${B}${EXT_DIR}${N}"
  else
    "$BIN" --load-extension="$EXT_DIR" --no-first-run &
    ok "Browser launched with extension."
  fi
else
  # Linux: launch in background
  "$BIN" --load-extension="$EXT_DIR" --no-first-run &
  ok "Browser launched with extension."
fi

echo ""
echo -e "${G}${B}✓ GitHub RichCard ${VERSION} installed!${N}"
echo -e "  Extension dir: ${B}${EXT_DIR}${N}"
echo ""
echo "If the browser was already open, load unpacked from:"
echo -e "  ${B}${EXT_DIR}${N}"
