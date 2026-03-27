# GitHub RichCard

A Chrome extension that shows extended info about GitHub repositories — one-click DeepWiki, stars, forks, issues, topics, and a slide-in sidebar.

Inspired by [aitdk.com](https://aitdk.com/extension/).

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

## Version

Version and commit hash are injected at build time and displayed in the popup and sidebar footer.
