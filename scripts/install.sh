#!/usr/bin/env bash
# install.sh — download GitHub RichCard and load it in a Chromium browser
#
# Run on your LOCAL machine:
#   bash <(curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh)
#
# Options:
#   --browser "Arc"              pick browser by name (skips menu)
#   --browser-path /path/to/bin  use any binary directly
#   --version v0.1.2             specific release (default: latest)
#   --dir ~/my/path              install directory (default: ~/.github-richcard)
#   --no-interact                fail if --browser/--browser-path not set

set -euo pipefail

REPO="xinbenlv/github-richcard"
INSTALL_DIR="${GITHUB_RICHCARD_DIR:-$HOME/.github-richcard}"
VERSION=""
BROWSER=""
BROWSER_PATH=""
NO_INTERACT=false

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

B="\033[1m"; C="\033[36m"; G="\033[32m"; R="\033[31m"; Y="\033[33m"; DIM="\033[2m"; N="\033[0m"
log() { echo -e "${C}▶${N} $*"; }
ok()  { echo -e "${G}✔${N} $*"; }
die() { echo -e "${R}✖${N} $*" >&2; exit 1; }
warn(){ echo -e "${Y}⚠${N} $*"; }

case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux)  OS=linux ;;
  *) die "Unsupported OS. Use --browser-path." ;;
esac

# ── browser registry ──────────────────────────────────────────────────────────
# Format: "Display Name|macOS app name|brew cask|install method"
# install method: brew | cft (Chrome for Testing direct download) | manual
mac_registry=(
  "Chromium|Chromium|chromium|brew"
  "Google Chrome for Testing|Google Chrome for Testing||cft"
  "Arc|Arc|arc|brew"
  "Google Chrome Dev|Google Chrome Dev|google-chrome@dev|brew"
  "Google Chrome Canary|Google Chrome Canary|google-chrome@canary|brew"
  "Google Chrome Beta|Google Chrome Beta|google-chrome@beta|brew"
  "Google Chrome|Google Chrome|google-chrome|brew"
  "Brave Browser|Brave Browser|brave-browser|brew"
)

linux_registry=(
  "Chromium|chromium|chromium|apt"
  "Google Chrome|google-chrome|google-chrome-stable|manual"
  "Brave Browser|brave-browser|brave-browser|manual"
)

reg_field() { # reg_field "entry" N  → Nth pipe-delimited field (1-based)
  local entry="$1" n="$2" i=1 f
  while IFS= read -r f; do
    [[ $i -eq $n ]] && echo "$f" && return
    (( i++ ))
  done < <(echo "$entry" | tr '|' '\n')
}

# Check if a browser is installed
is_installed_mac() {
  local app_name="$1"
  for dir in "/Applications" "$HOME/Applications"; do
    [[ -x "$dir/${app_name}.app/Contents/MacOS/${app_name}" ]] && return 0
  done
  # Also check via dynamic scan in case app name differs slightly
  local pattern='Chrome|Chromium|Arc|Brave|Vivaldi'
  for dir in "/Applications" "$HOME/Applications"; do
    [[ -d "$dir" ]] || continue
    while IFS= read -r app; do
      local found_name bin
      found_name="$(basename "$app" .app)"
      bin="$app/Contents/MacOS/$found_name"
      [[ "$found_name" == "$app_name" && -x "$bin" ]] && return 0
    done < <(find "$dir" -maxdepth 1 -name "*.app" 2>/dev/null | grep -E "$pattern" || true)
  done
  return 1
}

browser_bin_mac() {
  local app_name="$1"
  for dir in "/Applications" "$HOME/Applications"; do
    local bin="$dir/${app_name}.app/Contents/MacOS/${app_name}"
    [[ -x "$bin" ]] && echo "$bin" && return
  done
  return 1
}

# ── install helpers ───────────────────────────────────────────────────────────

install_via_brew() {
  local cask="$1" display="$2"
  if ! command -v brew &>/dev/null; then
    warn "Homebrew not found. Install it from https://brew.sh, then run:"
    echo "  brew install --cask $cask"
    return 1
  fi
  log "Installing ${display} via Homebrew…"
  brew install --cask "$cask"
}

install_chrome_for_testing() {
  local arch
  arch="$(uname -m)"
  local platform
  [[ "$arch" == "arm64" ]] && platform="mac-arm64" || platform="mac-x64"

  log "Fetching latest Chrome for Testing version…"
  local ver
  ver=$(curl -fsSL "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_STABLE")
  [[ -z "$ver" ]] && die "Could not fetch Chrome for Testing version."
  ok "Latest stable: $ver"

  local zip_url="https://storage.googleapis.com/chrome-for-testing-public/${ver}/${platform}/chrome-${platform}.zip"
  local tmp_dir
  tmp_dir="$(mktemp -d)"

  log "Downloading Chrome for Testing ${ver} (${platform})…"
  curl -fsSL --progress-bar -o "${tmp_dir}/cft.zip" "$zip_url" \
    || die "Download failed: $zip_url"

  log "Extracting…"
  unzip -q "${tmp_dir}/cft.zip" -d "${tmp_dir}"
  rm "${tmp_dir}/cft.zip"

  local app_src
  app_src="$(find "${tmp_dir}" -maxdepth 3 -name "Google Chrome for Testing.app" | head -1)"
  [[ -z "$app_src" ]] && die "Could not find Google Chrome for Testing.app in the downloaded zip."

  local dest_dir="$HOME/Applications"
  mkdir -p "$dest_dir"
  local dest="${dest_dir}/Google Chrome for Testing.app"
  [[ -d "$dest" ]] && rm -rf "$dest"
  cp -r "$app_src" "$dest"
  rm -rf "$tmp_dir"

  ok "Installed to ${dest}"
}

install_browser() {
  local entry="$1"
  local display app_name cask method
  display="$(reg_field "$entry" 1)"
  app_name="$(reg_field "$entry" 2)"
  cask="$(reg_field "$entry" 3)"
  method="$(reg_field "$entry" 4)"

  echo ""
  echo -e "${B}Install ${display}?${N}"

  case "$method" in
    brew)
      if [[ -n "$cask" ]]; then
        echo -e "  Will run: ${C}brew install --cask ${cask}${N}"
      else
        echo -e "  ${Y}No brew cask known — manual install required.${N}"
        method="manual"
      fi
      ;;
    cft)
      echo -e "  Will download directly from Google's Chrome for Testing endpoint."
      ;;
    manual)
      ;;
  esac

  if [[ "$method" == "manual" ]]; then
    warn "Cannot auto-install ${display}."
    echo "  Please install it manually, then re-run this script."
    return 1
  fi

  read -rp "  Proceed? [Y/n] " yn
  [[ "$yn" =~ ^[Nn] ]] && return 1

  case "$method" in
    brew) install_via_brew "$cask" "$display" ;;
    cft)  install_chrome_for_testing ;;
  esac
}

# ── build the full browser menu ───────────────────────────────────────────────

build_menu() {
  # Returns lines: "display_name|installed" (installed=1 or 0)
  if [[ $OS == mac ]]; then
    for entry in "${mac_registry[@]}"; do
      local display app_name
      display="$(reg_field "$entry" 1)"
      app_name="$(reg_field "$entry" 2)"
      if is_installed_mac "$app_name"; then
        echo "${display}|1"
      else
        echo "${display}|0"
      fi
    done
  else
    for entry in "${linux_registry[@]}"; do
      local display cmd
      display="$(reg_field "$entry" 1)"
      cmd="$(reg_field "$entry" 2)"
      if command -v "$cmd" &>/dev/null; then
        echo "${display}|1"
      else
        echo "${display}|0"
      fi
    done
  fi
  echo "Other (enter path manually)|1"
}

# ── resolve browser binary ────────────────────────────────────────────────────
BIN=""

if [[ -n "$BROWSER_PATH" ]]; then
  BROWSER_PATH="${BROWSER_PATH/#\~/$HOME}"
  [[ -x "$BROWSER_PATH" ]] || die "Not executable: $BROWSER_PATH"
  BROWSER="$(basename "$BROWSER_PATH")"
  BIN="$BROWSER_PATH"
  ok "Browser (custom path): $BIN"

elif [[ -n "$BROWSER" ]]; then
  # Named browser — look up in registry
  if [[ $OS == mac ]]; then
    matched=""
    for entry in "${mac_registry[@]}"; do
      [[ "$(reg_field "$entry" 1)" == "$BROWSER" ]] && matched="$entry" && break
    done
    [[ -z "$matched" ]] && die "Unknown browser name '$BROWSER'. Run without --browser to see the menu."
    app_name="$(reg_field "$matched" 2)"
    if ! is_installed_mac "$app_name"; then
      $NO_INTERACT && die "'$BROWSER' is not installed. Install it first."
      install_browser "$matched" || die "Installation cancelled."
    fi
    BIN="$(browser_bin_mac "$app_name")" || die "Could not find binary for $BROWSER after install."
  fi

else
  # Interactive menu
  MENU_ENTRIES=()
  MENU_INSTALLED=()
  while IFS= read -r line; do
    MENU_ENTRIES+=("${line%%|*}")
    MENU_INSTALLED+=("${line##*|}")
  done < <(build_menu)

  if $NO_INTERACT; then
    echo -e "${R}✖${N} --no-interact requires --browser or --browser-path." >&2
    echo    "  Available browsers:" >&2
    for i in "${!MENU_ENTRIES[@]}"; do
      flag=""
      [[ "${MENU_INSTALLED[$i]}" == "0" ]] && flag=" (not installed)"
      echo "    --browser \"${MENU_ENTRIES[$i]}\"${flag}" >&2
    done
    exit 1
  fi

  echo -e "\n${B}Select a browser:${N}"
  for i in "${!MENU_ENTRIES[@]}"; do
    label="${MENU_ENTRIES[$i]}"
    if [[ "${MENU_INSTALLED[$i]}" == "1" ]]; then
      echo -e "  ${C}$((i+1))${N}) ${label} ${G}✓${N}"
    else
      echo -e "  ${C}$((i+1))${N}) ${label} ${DIM}(not installed — will offer to install)${N}"
    fi
  done
  echo ""

  chosen_idx=""
  while true; do
    read -rp "Enter number [1-${#MENU_ENTRIES[@]}]: " choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#MENU_ENTRIES[@]} )); then
      chosen_idx=$(( choice - 1 ))
      break
    fi
    warn "Invalid choice, try again."
  done

  chosen_name="${MENU_ENTRIES[$chosen_idx]}"
  chosen_installed="${MENU_INSTALLED[$chosen_idx]}"

  if [[ "$chosen_name" == "Other (enter path manually)" ]]; then
    read -rp "Binary path: " BROWSER_PATH
    BROWSER_PATH="${BROWSER_PATH/#\~/$HOME}"
    [[ -x "$BROWSER_PATH" ]] || die "Not executable: $BROWSER_PATH"
    BROWSER="$(basename "$BROWSER_PATH")"
    BIN="$BROWSER_PATH"
  else
    BROWSER="$chosen_name"
    if [[ "$chosen_installed" == "0" ]]; then
      # Find registry entry and install
      reg_entry=""
      if [[ $OS == mac ]]; then
        for entry in "${mac_registry[@]}"; do
          [[ "$(reg_field "$entry" 1)" == "$BROWSER" ]] && reg_entry="$entry" && break
        done
      fi
      [[ -z "$reg_entry" ]] && die "No registry entry for '$BROWSER'."
      install_browser "$reg_entry" || die "Installation of '$BROWSER' failed or was cancelled."
    fi
    if [[ $OS == mac ]]; then
      app_name=""
      for entry in "${mac_registry[@]}"; do
        [[ "$(reg_field "$entry" 1)" == "$BROWSER" ]] && app_name="$(reg_field "$entry" 2)" && break
      done
      BIN="$(browser_bin_mac "$app_name")" || die "Binary not found for $BROWSER."
    else
      BIN="$BROWSER"
    fi
  fi
fi

[[ -x "$BIN" ]] || die "Binary not found or not executable: $BIN"
ok "Browser: $BROWSER"

# ── resolve version ───────────────────────────────────────────────────────────
if [[ -z "$VERSION" ]]; then
  log "Fetching latest release…"
  VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  [[ -z "$VERSION" ]] && die "Could not determine latest version. Pass --version vX.Y.Z."
fi
ok "Version: $VERSION"

# ── download extension ────────────────────────────────────────────────────────
ZIP_NAME="github-richcard-${VERSION#v}-chrome.zip"
ZIP_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ZIP_NAME}"
EXT_DIR="${INSTALL_DIR}/${VERSION}"
mkdir -p "$EXT_DIR"
TMP_ZIP="$(mktemp).zip"

log "Downloading extension…"
curl -fsSL -o "$TMP_ZIP" "$ZIP_URL" \
  || die "Download failed. Does $VERSION exist at github.com/${REPO}/releases?"
ok "Downloaded"

log "Unzipping to ${EXT_DIR}…"
unzip -qo "$TMP_ZIP" -d "$EXT_DIR"
rm "$TMP_ZIP"

INNER=$(find "$EXT_DIR" -maxdepth 2 -name "manifest.json" | head -1 | xargs dirname)
if [[ "$INNER" != "$EXT_DIR" && -n "$INNER" ]]; then
  cp -r "$INNER"/. "$EXT_DIR"/
fi
ok "Unzipped"

ln -sfn "$EXT_DIR" "${INSTALL_DIR}/latest"

# ── launch ────────────────────────────────────────────────────────────────────
log "Launching ${BROWSER}…"

if pgrep -f "$BIN" &>/dev/null; then
  echo ""
  warn "Browser is already running — --load-extension only works at launch time."
  echo -e "  ${C}1.${N} Go to  chrome://extensions"
  echo -e "  ${C}2.${N} Enable Developer mode (top-right toggle)"
  echo -e "  ${C}3.${N} Click 'Load unpacked' and select:"
  echo -e "     ${B}${EXT_DIR}${N}"
else
  "$BIN" --load-extension="$EXT_DIR" --no-first-run &
  ok "Browser launched with extension pre-loaded."
fi

echo ""
echo -e "${G}${B}✓ GitHub RichCard ${VERSION} installed!${N}"
echo -e "  Extension dir: ${B}${EXT_DIR}${N}"
