import ReactDOM from 'react-dom/client';
import { Sidebar } from './Sidebar';
import sidebarStyles from './sidebar.css?inline';
import { fetchFollowing } from '../../utils/github';

export default defineContentScript({
  matches: ['https://github.com/*'],
  cssInjectionMode: 'manual',

  main() {
    // Create a host element with shadow DOM for full style isolation
    const host = document.createElement('div');
    host.id = 'github-richcard-host';
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483644; top: 0; right: 0; pointer-events: none;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = sidebarStyles;
    shadow.appendChild(styleEl);

    const mount = document.createElement('div');
    mount.style.cssText = 'pointer-events: auto;';
    shadow.appendChild(mount);

    const root = ReactDOM.createRoot(mount);
    root.render(<Sidebar />);

    // --- Following badge feature ---
    initFollowingBadges();
  },
});

/**
 * Inject CSS for the following badge into the page (not shadow DOM).
 */
function injectBadgeStyles() {
  if (document.getElementById('grc-following-badge-styles')) return;
  const style = document.createElement('style');
  style.id = 'grc-following-badge-styles';
  style.textContent = `
    .grc-following-badge {
      position: absolute;
      bottom: -1px;
      right: -1px;
      width: 10px;
      height: 10px;
      background: #22c55e;
      border-radius: 50%;
      border: 1.5px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 10;
    }
    .grc-following-badge svg {
      width: 6px;
      height: 6px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Extract the username from an avatar element.
 * GitHub avatar imgs typically have alt="@username" or are inside links to /username.
 */
function getUsernameFromAvatar(img: HTMLImageElement): string | null {
  // Check alt="@username"
  const alt = img.getAttribute('alt');
  if (alt && alt.startsWith('@')) {
    return alt.slice(1);
  }

  // Check parent <a href="/username">
  const link = img.closest('a[href]');
  if (link) {
    const href = link.getAttribute('href') || '';
    const match = href.match(/^\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)$/);
    if (match) return match[1];
  }

  // Check data-hovercard-url="/users/username/hovercard"
  const hovercard = img.closest('[data-hovercard-url]');
  if (hovercard) {
    const hcUrl = hovercard.getAttribute('data-hovercard-url') || '';
    const match = hcUrl.match(/^\/users\/([^/]+)\/hovercard/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Add a green checkmark badge to an avatar img element.
 */
function addBadge(img: HTMLImageElement) {
  if (img.dataset.grcBadged === '1') return;
  img.dataset.grcBadged = '1';

  // Ensure parent is positioned
  const parent = img.parentElement;
  if (!parent) return;
  const pos = getComputedStyle(parent).position;
  if (pos === 'static' || pos === '') {
    parent.style.position = 'relative';
  }

  const badge = document.createElement('span');
  badge.className = 'grc-following-badge';
  badge.innerHTML = '<svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  parent.appendChild(badge);
}

/**
 * Scan and badge all visible avatar images.
 */
function scanAvatars(followingSet: Set<string>, me: string) {
  const imgs = document.querySelectorAll<HTMLImageElement>(
    'img.avatar, img.avatar-user, img[data-component="Avatar"], img.CircleBadge, img[class*="avatar"]'
  );
  for (const img of imgs) {
    if (img.dataset.grcBadged === '1') continue;
    const username = getUsernameFromAvatar(img);
    if (!username) continue;
    if (username.toLowerCase() === me.toLowerCase()) continue;
    if (followingSet.has(username)) {
      addBadge(img);
    }
  }
}

/**
 * Initialize the following badge system.
 */
async function initFollowingBadges() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="user-login"]');
  const me = meta?.content?.trim();
  if (!me) return; // Not logged in

  injectBadgeStyles();

  let followingSet: Set<string>;
  try {
    followingSet = await fetchFollowing(me);
  } catch (e) {
    console.warn('[GRC] Failed to fetch following list:', e);
    return;
  }

  if (followingSet.size === 0) return;

  // Initial scan
  scanAvatars(followingSet, me);

  // Debounced observer for dynamic content
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      scanAvatars(followingSet, me);
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
