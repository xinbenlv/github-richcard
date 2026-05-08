/**
 * Collaboration graph data fetching and construction.
 *
 * Graph shape:
 *   - The current repo sits at the center, linked to every fetched contributor.
 *   - Other repos owned by those contributors are included and ranked by
 *     `sharedContributors × stars` (descending), capped to a small top‑N so
 *     the SVG stays readable.
 */

export interface ContributorNode {
  type: 'contributor';
  id: string;
  login: string;
  contributions: number;
  isOwner: boolean;
}

export interface RepoNode {
  type: 'repo';
  id: string;
  name: string;
  fullName: string;
  stars?: number;
  sharedCount?: number;
  score?: number;
  isCurrent?: boolean;
}

export type GraphNode = (ContributorNode | RepoNode) & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

export interface GraphLink {
  source: string;
  target: string;
}

export interface CollabGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface CacheEntry {
  data: CollabGraphData;
  timestamp: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const MAX_OTHER_REPOS = 12;

async function ghFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      credentials: 'include',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface GHContributor {
  login: string;
  contributions: number;
}

interface GHRepo {
  full_name: string;
  name: string;
  fork: boolean;
  stargazers_count: number;
}

export async function fetchCollabGraph(
  owner: string,
  repo: string,
): Promise<CollabGraphData> {
  // Check cache
  const cacheKey = `collab:${owner}/${repo}`;
  try {
    const stored = await chrome.storage.local.get(cacheKey);
    const entry = stored[cacheKey] as CacheEntry | undefined;
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  } catch { /* no cache available */ }

  const currentFullName = `${owner}/${repo}`;
  const currentRepoId = `repo:${currentFullName}`;

  // 1. Fetch contributors
  const contributors = await ghFetch<GHContributor[]>(
    `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=15`,
  );
  if (!contributors || contributors.length === 0) {
    return { nodes: [], links: [] };
  }

  // 2. For each contributor, fetch the repos they own (excluding forks)
  const contributorRepos = new Map<string, Set<string>>();
  const repoMeta = new Map<string, { name: string; stars: number }>();

  const fetches = contributors.map(async (c) => {
    const repos = await ghFetch<GHRepo[]>(
      `https://api.github.com/users/${c.login}/repos?type=owner&sort=updated&per_page=30`,
    );
    if (!repos) return;
    const owned = new Set<string>();
    for (const r of repos) {
      if (r.fork) continue;
      if (r.full_name === currentFullName) continue; // current repo handled separately
      owned.add(r.full_name);
      repoMeta.set(r.full_name, { name: r.name, stars: r.stargazers_count ?? 0 });
    }
    contributorRepos.set(c.login, owned);
  });
  await Promise.all(fetches);

  // 3. For each "other" repo, collect which current-repo contributors own it
  const repoContributors = new Map<string, string[]>();
  for (const [login, repos] of contributorRepos) {
    for (const fullName of repos) {
      const list = repoContributors.get(fullName) ?? [];
      list.push(login);
      repoContributors.set(fullName, list);
    }
  }

  // 4. Score = sharedCount × stars, rank desc, take top N
  const ranked = [...repoContributors.entries()]
    .map(([fullName, logins]) => {
      const meta = repoMeta.get(fullName);
      const stars = meta?.stars ?? 0;
      const sharedCount = logins.length;
      return {
        fullName,
        name: meta?.name ?? fullName.split('/')[1] ?? fullName,
        stars,
        logins,
        sharedCount,
        score: sharedCount * stars,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OTHER_REPOS);

  // 5. Build graph: current repo at center + every contributor + ranked others
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  nodes.push({
    type: 'repo',
    id: currentRepoId,
    name: repo,
    fullName: currentFullName,
    isCurrent: true,
  });

  for (const c of contributors) {
    const userId = `user:${c.login}`;
    nodes.push({
      type: 'contributor',
      id: userId,
      login: c.login,
      contributions: c.contributions,
      isOwner: c.login.toLowerCase() === owner.toLowerCase(),
    });
    links.push({ source: userId, target: currentRepoId });
  }

  for (const r of ranked) {
    const repoId = `repo:${r.fullName}`;
    nodes.push({
      type: 'repo',
      id: repoId,
      name: r.name,
      fullName: r.fullName,
      stars: r.stars,
      sharedCount: r.sharedCount,
      score: r.score,
    });
    for (const login of r.logins) {
      links.push({ source: `user:${login}`, target: repoId });
    }
  }

  const data: CollabGraphData = { nodes, links };

  try {
    await chrome.storage.local.set({
      [cacheKey]: { data, timestamp: Date.now() } satisfies CacheEntry,
    });
  } catch { /* storage write failed, non-critical */ }

  return data;
}
