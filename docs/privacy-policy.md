# Privacy Policy — GitHub RichCard

_Last updated: 2026-05-01_

GitHub RichCard ("the extension") is an open-source browser extension developed
by @xinbenlv. This policy describes what information the extension handles and
what it does not.

## TL;DR

**The extension collects nothing, transmits nothing to any third party, and
stores only your local UI preferences in your own browser.** All data shown in
the sidebar is fetched directly from GitHub on your behalf, using your existing
github.com session. No analytics, no telemetry, no tracking.

## What the extension does

When you visit a page on `github.com`, GitHub RichCard injects a sidebar that:

- Fetches public repository metadata from `https://api.github.com` (stars,
  forks, contributors, topics, license, default branch, etc.).
- For repos you have access to but are private, retries the same fetch using
  your existing browser session cookie so the API returns private-repo data.
- Reads your followed-users list from `https://api.github.com/user/following`
  to highlight people you already follow with a green checkmark badge.
- Stores your sidebar preferences (open/closed, last-active tab) in your
  browser's local extension storage so the UI remembers your last state.

## What the extension does NOT do

- It does **not** collect, store, or transmit personally identifiable information.
- It does **not** send any data to servers operated by the developer or any
  third party. The only network endpoints contacted are `github.com` and
  `api.github.com`.
- It does **not** include any analytics, telemetry, advertising, or tracking
  code.
- It does **not** read or modify pages on any domain other than `github.com`.
- It does **not** sell or share user data with anyone, ever.

## Data the extension processes

| Data | Where it comes from | Where it goes | Why |
|------|---------------------|---------------|-----|
| Public repo metadata | `api.github.com` | Rendered in the sidebar; not stored | To display stars/forks/topics/license/etc. |
| Your followed-users list | `api.github.com` | Cached in `chrome.storage.local` for 24h to avoid re-fetching | To draw the green checkmark badge on familiar avatars |
| Sidebar UI preferences | Set by you | `chrome.storage.local` | To remember your sidebar state across page loads |

All data lives only on your machine. None of it is ever sent anywhere except
back to GitHub itself when you reload a page.

## Permissions used

- **`storage`** — to remember your sidebar UI preferences locally.
- **`activeTab`** — to inject the sidebar UI into the GitHub page you're
  currently viewing.
- **Host permission `https://github.com/*`** — to read the GitHub page DOM
  (so the sidebar can anchor itself).
- **Host permission `https://api.github.com/*`** — to fetch repository
  metadata and your followed-users list.

The extension never requests host permissions for any other domain.

## Open source

The full source code is published at
<https://github.com/xinbenlv/github-richcard> under the MIT license. Anyone
can audit exactly what the extension does. If you find behavior that
contradicts this policy, please file an issue at
<https://github.com/xinbenlv/github-richcard/issues>.

## Contact

For questions about this privacy policy, open an issue or pull request at the
repository above.

## Changes to this policy

If the extension's data handling ever changes, this file will be updated and
the change will appear in the file's git history at
<https://github.com/xinbenlv/github-richcard/commits/main/docs/privacy-policy.md>.
