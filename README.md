# GitHub RichCard

A Chrome extension that shows extended info about GitHub repositories — one-click DeepWiki, stars, forks, issues, topics, and a slide-in sidebar.

Inspired by [aitdk.com](https://aitdk.com/extension/).

## Install (one-liner)

Run this on your **local machine** — it fetches the latest release, unzips it, and opens Chrome/Arc/Brave with the extension loaded:

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh)
```

Auto-detects Arc → Chrome → Brave in that order. To override:

```sh
# pick a specific browser
curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh | bash -s -- --browser "Arc"
curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh | bash -s -- --browser "Google Chrome"
curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh | bash -s -- --browser "Brave Browser"

# specific version
curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh | bash -s -- --version v0.1.1

# custom install directory
curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh | bash -s -- --dir ~/extensions/github-richcard
```

> **If your browser is already open:** the script will print the path — load it via `chrome://extensions` → Developer mode → Load unpacked.

## Features

- **Slide-in sidebar** on any `github.com/<owner>/<repo>` page
- **One-click DeepWiki** — jump straight to `deepwiki.com/<owner>/<repo>`
- Stars, forks, open issues, watchers, language, license, topics
- Quick links: Issues, PRs, Releases, Contributors, Bundlephobia, npm
- **Popup** for a quick stats glance + toggle sidebar
- Version + commit hash shown in every UI surface

## Tech Stack

- [WXT](https://wxt.dev/) — modern Chrome extension toolkit (Manifest V3)
- React 18 + TypeScript
- Tailwind CSS v3
- Vite

## Development

```bash
pnpm install
pnpm dev           # dev mode with HMR
pnpm build         # production build → .output/
pnpm zip           # package for Chrome Web Store
```

Then load `.output/chrome-mv3/` as an unpacked extension in Chrome.

## Releasing

```bash
# bump version, then:
pnpm deploy        # builds, zips, tags, creates GitHub release + uploads zip
```

## Version

Version and commit hash are injected at build time and displayed in the popup and sidebar footer.
