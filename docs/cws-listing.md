# Chrome Web Store listing — paste-ready content

This document contains every text field and image you need to populate the
github-richcard CWS draft (extension ID `ehpaamakfflbhfeklicfimdoplkhnfhm`).

The CWS Publish API does not expose listing metadata, so all of this must be
entered manually in https://chrome.google.com/webstore/devconsole/.
The package zip side is automated — see `pnpm deploy:cws`.

---

## 1. Store listing → Product details

### Title  *(45 chars max)*
```
GitHub RichCard
```

### Summary / Short description  *(132 chars max)*
```
Extended info for GitHub repos — one-click DeepWiki, contributor graph, follow badges, and a slide-in sidebar. Free & open source.
```
(128 chars — under the limit.)

### Detailed description  *(16,000 chars max)*

Paste the block below verbatim:

```
GitHub RichCard adds a slide-in sidebar to every GitHub repository page with the
context you actually want when you're sizing up a project: a one-click jump to
DeepWiki, live stats, recent activity, a D3-powered contributor collaboration
graph, and green checkmark badges that highlight the people you already follow.

✦ Features

  • One-click DeepWiki — open the AI-generated wiki for any repo without leaving the page.
  • Repo stats at a glance — stars, forks, open issues, default branch, license,
    primary language, and topic chips, all in the sidebar.
  • Contributor collaboration graph — D3 force-directed visualization of who
    contributes alongside whom across recent commits, click any node to jump to
    that person's profile.
  • Followed-user badges — green checkmark on avatars of people you already
    follow, so you can spot familiar faces in PRs, issues, and contributor lists.
  • Slide-in animation — a tasteful slide-from-right panel that doesn't block
    the page and remembers its position.
  • Private-repo support — uses your existing GitHub session cookie, no token
    setup required.

✦ Privacy

  • All data fetched comes directly from github.com / api.github.com using your
    existing logged-in session. No third-party servers are involved.
  • The extension does not collect, store, or transmit any analytics, telemetry,
    or personal data.
  • Source code is fully open: https://github.com/xinbenlv/github-richcard

✦ Permissions explained

  • storage   — remembers your sidebar preferences (open/closed, last-used tab).
  • activeTab — lets the sidebar inject its UI into the current GitHub page.
  • host_permissions on github.com & api.github.com — required to fetch repo
    metadata and to read your followed-users list. The extension never touches
    any other domain.

✦ Open source & feedback

The project is MIT-licensed and developed in the open. File bugs or feature
requests at https://github.com/xinbenlv/github-richcard/issues.
```

### Category
```
Developer Tools
```

### Language
```
English (en)
```

---

## 2. Store listing → Graphic assets

| Asset | Dimensions | Required? | Source |
|-------|-----------|-----------|--------|
| Store icon | 128×128 | ✅ required | `public/icon-128.png` (auto-bundled in zip) |
| Small promo tile | 440×280 | ✅ required | `docs/cws-assets/promo-440x280-small.png` |
| Marquee promo tile | 1400×560 | optional but recommended | `docs/cws-assets/promo-1400x560-marquee.png` |
| Screenshots | 1280×800 *or* 640×400 | ✅ at least 1, up to 5 | `docs/cws-assets/screenshots/01-sidebar-on-react.png`, `02-sidebar-on-richcard.png` |

---

## 3. Privacy practices

### Single purpose
```
Display extended information about GitHub repositories — one-click DeepWiki access, repo statistics, contributor collaboration graph, and follow indicators — directly on github.com pages.
```

### Permission justifications

**`storage`**
```
Persists user UI preferences (sidebar open/closed state, last-active tab) across browser sessions. No remote storage, no analytics.
```

**`activeTab`**
```
Required to inject the sidebar UI into the GitHub repository page the user is currently viewing. Used only when the user clicks the extension icon or navigates to a github.com page.
```

**Host permission `https://github.com/*`**
```
Required to read the GitHub repository page DOM (to anchor the sidebar) and to read the user's followed-users list (used by the green-checkmark feature). Limited strictly to github.com.
```

**Host permission `https://api.github.com/*`**
```
Required to fetch public repository metadata (stars, forks, contributors, topics, license) and — when authenticated — private repo data, using the user's existing GitHub session. No third-party API is called.
```

### Are you using remote code?
```
No
```

### Data usage disclosures
- ❌ Does NOT collect personally identifiable information
- ❌ Does NOT collect health information
- ❌ Does NOT collect financial / payment information
- ❌ Does NOT collect authentication information
- ❌ Does NOT collect personal communications
- ❌ Does NOT collect location data
- ❌ Does NOT collect web history
- ❌ Does NOT collect user activity
- ❌ Does NOT collect website content

### Certifications (check all)
- ✅ I do not sell or transfer user data to third parties, apart from the approved use cases
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

---

## 4. Distribution

| Field | Value |
|-------|-------|
| Visibility | Public |
| Distribution | All regions |
| Pricing | Free |
| Trader status | (your preference — Non-trader is fine for an OSS hobby project) |

### URLs

| Field | Value |
|-------|-------|
| Homepage URL | `https://github.com/xinbenlv/github-richcard` |
| Support URL  | `https://github.com/xinbenlv/github-richcard/issues` |

---

## 5. Screenshots

Two captured at exactly **1280×800** (CWS requirement):

| File | Subject |
|------|---------|
| `docs/cws-assets/screenshots/01-sidebar-on-react.png` | facebook/react with sidebar — 244k stars, topics, MIT license, full link panel |
| `docs/cws-assets/screenshots/02-sidebar-on-richcard.png` | xinbenlv/github-richcard — dogfood / project's own listing |

Optional follow-ups (not required for submission):
- A screenshot of the contributor collaboration graph rendered (currently blocked by
  the CORS bug tracked in #17 — once fixed, capture facebook/react with
  the graph tab expanded).
- A screenshot of the green-checkmark follow badges on a contributor list page
  (requires being logged into github.com).

---

## 6. Final checklist before clicking "Submit for review"

- [ ] Package: v0.2.2 zip uploaded (`pnpm deploy:cws`)
- [ ] Title + summary + detailed description pasted
- [ ] Category = Developer Tools
- [ ] 128×128 icon shows correctly (auto from zip)
- [ ] Small promo tile (440×280) uploaded
- [ ] Marquee tile (1400×560) uploaded — optional
- [ ] At least 1 screenshot uploaded
- [ ] Single-purpose statement set
- [ ] Permission justifications set for storage / activeTab / github.com / api.github.com
- [ ] "No remote code" selected
- [ ] All "data usage" boxes left unchecked (we collect nothing)
- [ ] All 3 certification checkboxes ticked
- [ ] Visibility = Public, all regions, free
- [ ] Homepage URL + Support URL filled
