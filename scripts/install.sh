#!/usr/bin/env bash
# install.sh — download the latest GitHub RichCard release and load it in a Chromium browser
#
# Run on your LOCAL machine (not the dev server):
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh)
#
# Options:
#   --browser "Arc"                explicit browser name from the interactive menu
#   --browser-path /path/to/bin   use any Chromium binary directly (e.g. Chrome for Testing)
#   --version v0.1.1              install a specific release tag (default: latest)
#   --dir ~/my/path               custom install directory (default: ~/.github-richcard)
#   --no-interact                 fail instead of prompting; requires --browser or --browser-path
#
# Chrome for Testing (not in /Applications) example:
#   bash <(curl -fsSL ...) -- \
#     --browser-path ~/Downloads/chrome-mac-x64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing

set -euo pipefail

REPO="xinbenlv/github-richcard"
INSTALL_DIR="${GITHUB_RICHCARD_DIR:-$HOME/.github-richcard}"
VERSION=""
BROWSER=""
BROWSER_PATH=""
NO_INTERACT=false

# ── parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)      VERSION="$2";       shift 2 ;;
    --dir)          INSTALL_DIR="$2";   shift 2 ;;
    --browser)      BROWSER="$2";       shift 2 ;;
    --browser-path) BROWSER_PATH="$2";  shift 2 ;;
    --no-interact)  NO_INTERACT=true;   shift   ;;
    *) echo "Unknown option: $1" >&2; exit 1    ;;
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
  *)      die "Unsupported OS: $(uname -s). Use --browser-path to specify a binary." ;;
esac

# ── browser detection (macOS) ─────────────────────────────────────────────────
# Priority keywords — apps matching earlier entries sort first in the menu.
mac_priority=("Chromium" "Testing" "Dev" "Canary" "Beta" "Arc" "Brave" "Chrome")

linux_cmds=(
  "chromium-for-dev|chromium-for-dev"
  "google-chrome-unstable|google-chrome-unstable"
  "google-chrome-beta|google-chrome-beta"
  "google-chrome|google-chrome"
  "chromium-browser|chromium-browser"
  "chromium|chromium"
  "brave-browser|brave-browser"
)

priority_score() {
  local name="$1" i=0
  for kw in "${mac_priority[@]}"; do
    [[ "$name" == *"$kw"* ]] && echo "$i" && return
    (( i++ ))
  done
  echo "$i"
}

# Scan /Applications and ~/Applications for any Chromium-family .app
scan_mac_browsers() {
  local pattern='Chrome|Chromium|Arc|Brave|Vivaldi|Opera'
  local hits=()
  for dir in "/Applications" "$HOME/Applications"; do
    [[ -d "$dir" ]] || continue
    while IFS= read -r app; do
      local name bin
      name="$(basename "$app" .app)"
      bin="$app/Contents/MacOS/$name"
      [[ -x "$bin" ]] && hits+=("$name")
    done < <(find "$dir" -maxdepth 1 -name "*.app" | grep -E "$pattern")
  done
  # Insertion sort by priority score
  local sorted=()
  for name in "${hits[@]}"; do
    local inserted=false
    for i in "${!sorted[@]}"; do
      if (( $(priority_score "$name") < $(priority_score "${sorted[$i]}") )); then
        sorted=("${sorted[@]:0:$i}" "$name" "${sorted[@]:$i}")
        inserted=true
        break
      fi
    done
    $inserted || sorted+=("$name")
  done
  printf '%s\n' "${sorted[@]}"
}

installed_browsers() {
  if [[ $OS == mac ]]; then
    scan_mac_browsers
  else
    local found=()
    for entry in "${linux_cmds[@]}"; do
      local name="${entry%%|*}" cmd="${entry##*|}"
      command -v "$cmd" &>/dev/null && found+=("$name")
    done
    printf '%s\n' "${found[@]}"
  fi
}

browser_bin() {
  local target="$1"
  if [[ $OS == mac ]]; then
    for dir in "/Applications" "$HOME/Applications"; do
      local bin="$dir/${target}.app/Contents/MacOS/${target}"
      [[ -x "$bin" ]] && echo "$bin" && return
    done
    die "Could not find '${target}.app' in /Applications or ~/Applications.
  If it's elsewhere, use:  --browser-path /path/to/binary"
  else
    for entry in "${linux_cmds[@]}"; do
      local name="${entry%%|*}" cmd="${entry##*|}"
      [[ "$name" == "$target" ]] && echo "$cmd" && return
    done
    die "Unknown browser: '$target'."
  fi
}

# ── resolve browser binary ────────────────────────────────────────────────────
if [[ -n "$BROWSER_PATH" ]]; then
  # Explicit path — use as-is
  BROWSER_PATH="${BROWSER_PATH/#\~/$HOME}"          # expand leading ~
  [[ -x "$BROWSER_PATH" ]] || die "Not executable: $BROWSER_PATH"
  BROWSER="$(basename "$BROWSER_PATH")"
  BIN="$BROWSER_PATH"
  ok "Browser (path): $BIN"
else
  if [[ -z "$BROWSER" ]]; then
    AVAILABLE=()
    while IFS= read -r line; do
      [[ -n "$line" ]] && AVAILABLE+=("$line")
    done < <(installed_browsers)

    if [[ ${#AVAILABLE[@]} -eq 0 ]]; then
      die "No Chromium-based browser found in /Applications.
  Use --browser-path to point directly at a binary (e.g. Chrome for Testing)."
    fi

    if $NO_INTERACT; then
      echo -e "${R}✖${N} --no-interact requires --browser or --browser-path." >&2
      echo    "  Detected browsers:" >&2
      for b in "${AVAILABLE[@]}"; do echo "    --browser \"$b\"" >&2; done
      echo    "  Or use: --browser-path /path/to/binary" >&2
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
      echo -e "  ${C}$((${#AVAILABLE[@]}+1))${N}) Other (enter path manually)"
      echo ""
      while true; do
        read -rp "Enter number [1-$((${#AVAILABLE[@]}+1))]: " choice
        if [[ "$choice" =~ ^[0-9]+$ ]]; then
          if (( choice == ${#AVAILABLE[@]}+1 )); then
            read -rp "Binary path: " BROWSER_PATH
            BROWSER_PATH="${BROWSER_PATH/#\~/$HOME}"
            [[ -x "$BROWSER_PATH" ]] || die "Not executable: $BROWSER_PATH"
            BROWSER="$(basename "$BROWSER_PATH")"
            BIN="$BROWSER_PATH"
            break
          elif (( choice >= 1 && choice <= ${#AVAILABLE[@]} )); then
            BROWSER="${AVAILABLE[$((choice-1))]}"
            break
          fi
        fi
        warn "Invalid choice, try again."
      done
    fi
  fi

  if [[ -z "${BIN:-}" ]]; then
    BIN="$(browser_bin "$BROWSER")"
  fi
  [[ -x "$BIN" ]] || die "Binary not found or not executable: $BIN"
  ok "Browser: $BROWSER"
fi

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
  || die "Download failed. Does $VERSION exist at github.com/${REPO}/releases?"
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

print_manual_steps() {
  echo ""
  warn "Browser is already running — --load-extension only works at launch time."
  echo "  Load the extension manually:"
  echo -e "  ${C}1.${N} Go to  chrome://extensions"
  echo -e "  ${C}2.${N} Enable Developer mode (top-right toggle)"
  echo -e "  ${C}3.${N} Click 'Load unpacked' and select:"
  echo -e "     ${B}${EXT_DIR}${N}"
}

if pgrep -f "$BROWSER" &>/dev/null; then
  print_manual_steps
else
  "$BIN" --load-extension="$EXT_DIR" --no-first-run &
  ok "Browser launched with extension pre-loaded."
fi

echo ""
echo -e "${G}${B}✓ GitHub RichCard ${VERSION} installed!${N}"
echo -e "  Extension dir: ${B}${EXT_DIR}${N}"
