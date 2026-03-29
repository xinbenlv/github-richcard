export interface RepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  language: string | null;
  license: string | null;
  topics: string[];
  homepage: string | null;
  createdAt: string;
  pushedAt: string;
  defaultBranch: string;
  isArchived: boolean;
  isFork: boolean;
  htmlUrl: string;
}

export interface ParsedGithubRepo {
  owner: string;
  repo: string;
}

/** Parse owner/repo from a GitHub URL. Returns null if not a repo page. */
export function parseGithubRepo(url: string): ParsedGithubRepo | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('github.com')) return null;
    const parts = u.pathname.replace(/^\//, '').split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    // Exclude special paths
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, '');
    const skip = ['settings', 'notifications', 'explore', 'login', 'marketplace', 'topics'];
    if (skip.includes(owner)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export async function fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const d = await res.json();
  return {
    owner,
    repo,
    fullName: d.full_name,
    description: d.description,
    stars: d.stargazers_count,
    forks: d.forks_count,
    openIssues: d.open_issues_count,
    watchers: d.subscribers_count,
    language: d.language,
    license: d.license?.spdx_id ?? null,
    topics: d.topics ?? [],
    homepage: d.homepage || null,
    createdAt: d.created_at,
    pushedAt: d.pushed_at,
    defaultBranch: d.default_branch,
    isArchived: d.archived,
    isFork: d.fork,
    htmlUrl: d.html_url,
  };
}

export function deepwikiUrl(owner: string, repo: string): string {
  return `https://deepwiki.com/${owner}/${repo}`;
}

/**
 * Fetch the full list of users that `me` is following.
 * Results are cached in sessionStorage to avoid repeat API calls / rate limits.
 */
export async function fetchFollowing(me: string): Promise<Set<string>> {
  const cacheKey = `grc:following:${me}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      return new Set(JSON.parse(cached) as string[]);
    } catch {
      // corrupted cache, refetch
    }
  }

  const logins: string[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `https://api.github.com/users/${me}/following?per_page=${perPage}&page=${page}`,
      {
        headers: { Accept: 'application/vnd.github.v3+json' },
        credentials: 'include',
      },
    );
    if (!res.ok) {
      // On rate limit or error, return whatever we have so far
      console.warn(`[GRC] fetchFollowing page ${page} failed: ${res.status}`);
      break;
    }
    const data: { login: string }[] = await res.json();
    if (data.length === 0) break;
    for (const u of data) logins.push(u.login);
    if (data.length < perPage) break;
    page++;
  }

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(logins));
  } catch {
    // sessionStorage full — that's fine, we still have the in-memory set
  }

  return new Set(logins);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
