#!/usr/bin/env bash
# install.sh — download the latest GitHub RichCard release and load it in Chrome/Arc/Brave
#
# Run on your LOCAL machine (not the dev server):
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh)
#
# Options:
#   --browser "Arc"      explicit browser name (skips interactive prompt)
#   --version v0.1.1     install a specific release tag (default: latest)
#   --dir ~/my/path      custom install directory (default: ~/.github-richcard)
#   --no-interact        fail instead of prompting; requires --browser to be set

set -euo pipefail

REPO="xinbenlv/github-richcard"
INSTALL_DIR="${GITHUB_RICHCARD_DIR:-$HOME/.github-richcard}"
VERSION=""
BROWSER=""
NO_INTERACT=false

# ── parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)     VERSION="$2";      shift 2 ;;
    --dir)         INSTALL_DIR="$2";  shift 2 ;;
    --browser)     BROWSER="$2";      shift 2 ;;
    --no-interact) NO_INTERACT=true;  shift   ;;
    *) echo "Unknown option: $1" >&2; exit 1  ;;
  esac
done

# ── colors ────────────────────────────────────────────────────────────────────
B="\033[1m"; C="\033[36m"; G="\033[32m"; R="\033[31m"; Y="\033[33m"; N="\033[0m"
log() { echo -e "${C}▶${N} $*"; }
ok()  { echo -e "${G}✔${N} $*"; }
die() { echo -e "${R}✖${N} $*" >&2; exit 1; }
warn(){ echo -e "${Y}⚠${N} $*"; }

# ── detect OS ─────────────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux)  OS=linux ;;
  *)      die "Unsupported OS: $(uname -s). Install manually." ;;
esac

# ── browser registry ──────────────────────────────────────────────────────────
# Each entry: "Display Name|/path/to/binary"
# Order = preference when auto-detecting / display order in the menu.

mac_browsers=(
  "Chromium for Dev|/Applications/Chromium for Dev.app/Contents/MacOS/Chromium for Dev"
  "Arc|/Applications/Arc.app/Contents/MacOS/Arc"
  "Google Chrome Dev|/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev"
  "Google Chrome Canary|/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
  "Google Chrome Beta|/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"
  "Google Chrome|/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "Brave Browser|/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  "Chromium|/Applications/Chromium.app/Contents/MacOS/Chromium"
)

linux_cmds=(
  "chromium-for-dev|chromium-for-dev"
  "google-chrome-unstable|google-chrome-unstable"
  "google-chrome-beta|google-chrome-beta"
  "google-chrome|google-chrome"
  "chromium-browser|chromium-browser"
  "chromium|chromium"
  "brave-browser|brave-browser"
)

# Returns list of installed browser display names
installed_browsers() {
  local found=()
  if [[ $OS == mac ]]; then
    for entry in "${mac_browsers[@]}"; do
      local name="${entry%%|*}"
      local bin="${entry##*|}"
      [[ -x "$bin" ]] && found+=("$name")
    done
  else
    for entry in "${linux_cmds[@]}"; do
      local name="${entry%%|*}"
      local cmd="${entry##*|}"
      command -v "$cmd" &>/dev/null && found+=("$name")
    done
  fi
  printf '%s\n' "${found[@]}"
}

# Returns binary path for a given display name
browser_bin() {
  local target="$1"
  if [[ $OS == mac ]]; then
    for entry in "${mac_browsers[@]}"; do
      local name="${entry%%|*}"
      local bin="${entry##*|}"
      [[ "$name" == "$target" ]] && echo "$bin" && return
    done
  else
    for entry in "${linux_cmds[@]}"; do
      local name="${entry%%|*}"
      local cmd="${entry##*|}"
      [[ "$name" == "$target" ]] && echo "$cmd" && return
    done
  fi
  die "Unknown browser: '$target'. Use --browser with one of the names shown in the menu."
}

# ── browser selection ─────────────────────────────────────────────────────────
if [[ -z "$BROWSER" ]]; then
  mapfile -t AVAILABLE < <(installed_browsers)

  if [[ ${#AVAILABLE[@]} -eq 0 ]]; then
    die "No supported Chromium-based browser found. Pass --browser <name>."
  fi

  if $NO_INTERACT; then
    echo -e "${R}✖${N} --no-interact set but --browser not specified." >&2
    echo    "  Installed browsers:" >&2
    for b in "${AVAILABLE[@]}"; do echo "    --browser \"$b\"" >&2; done
    exit 1
  fi

  if [[ ${#AVAILABLE[@]} -eq 1 ]]; then
    BROWSER="${AVAILABLE[0]}"
    ok "Only one browser found, using: $BROWSER"
  else
    echo -e "\n${B}Select a browser:${N}"
    for i in "${!AVAILABLE[@]}"; do
      echo -e "  ${C}$((i+1))${N}) ${AVAILABLE[$i]}"
    done
    echo ""
    while true; do
      read -rp "Enter number [1-${#AVAILABLE[@]}]: " choice
      if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#AVAILABLE[@]} )); then
        BROWSER="${AVAILABLE[$((choice-1))]}"
        break
      fi
      warn "Invalid choice, try again."
    done
  fi
fi

ok "Browser: $BROWSER"
BIN="$(browser_bin "$BROWSER")"
[[ -x "$BIN" ]] || die "Binary not found or not executable: $BIN"

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
curl -fsSL -o "$TMP_ZIP" "$ZIP_URL" \
  || die "Download failed. Check that $VERSION exists at github.com/${REPO}/releases"
ok "Downloaded"

# ── unzip ─────────────────────────────────────────────────────────────────────
log "Unzipping to ${EXT_DIR}…"
unzip -qo "$TMP_ZIP" -d "$EXT_DIR"
rm "$TMP_ZIP"

# WXT zips into a subdirectory — flatten if manifest.json isn't at root
INNER=$(find "$EXT_DIR" -maxdepth 2 -name "manifest.json" | head -1 | xargs dirname)
if [[ "$INNER" != "$EXT_DIR" && -n "$INNER" ]]; then
  cp -r "$INNER"/. "$EXT_DIR"/
fi
ok "Unzipped to ${EXT_DIR}"

# ── symlink ───────────────────────────────────────────────────────────────────
LATEST_LINK="${INSTALL_DIR}/latest"
ln -sfn "$EXT_DIR" "$LATEST_LINK"
ok "Symlink: ${LATEST_LINK} → ${EXT_DIR}"

# ── launch ────────────────────────────────────────────────────────────────────
log "Launching ${BROWSER}…"

browser_is_running() {
  pgrep -f "$1" &>/dev/null
}

print_manual_steps() {
  echo ""
  warn "Browser is already running — --load-extension only works at launch time."
  echo "  Load the extension manually:"
  echo -e "  ${C}1.${N} Go to  chrome://extensions  (or arc://extensions)"
  echo -e "  ${C}2.${N} Enable Developer mode (top-right toggle)"
  echo -e "  ${C}3.${N} Click 'Load unpacked' and select:"
  echo -e "     ${B}${EXT_DIR}${N}"
}

if browser_is_running "$BROWSER"; then
  print_manual_steps
else
  "$BIN" --load-extension="$EXT_DIR" --no-first-run &
  ok "Browser launched with extension pre-loaded."
fi

echo ""
echo -e "${G}${B}✓ GitHub RichCard ${VERSION} installed!${N}"
echo -e "  Extension dir: ${B}${EXT_DIR}${N}"
