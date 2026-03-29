/**
 * Collaboration graph data fetching and construction.
 * Builds a bipartite graph of contributors ↔ shared repos.
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

  // 1. Fetch contributors
  const contributors = await ghFetch<GHContributor[]>(
    `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=15`,
  );
  if (!contributors || contributors.length === 0) {
    return { nodes: [], links: [] };
  }

  // 2. For each contributor, fetch their repos
  const contributorRepos = new Map<string, Set<string>>();
  const repoFullNames = new Map<string, string>(); // fullName -> name

  const fetches = contributors.map(async (c) => {
    const repos = await ghFetch<GHRepo[]>(
      `https://api.github.com/users/${c.login}/repos?type=owner&sort=updated&per_page=30`,
    );
    if (!repos) return;
    const owned = repos
      .filter((r) => !r.fork)
      .map((r) => r.full_name);
    contributorRepos.set(c.login, new Set(owned));
    for (const r of repos) {
      if (!r.fork) repoFullNames.set(r.full_name, r.name);
    }
  });
  await Promise.all(fetches);

  // 3. Cross-reference: find repos where 2+ contributors overlap
  const repoContributorCount = new Map<string, string[]>();
  for (const [login, repos] of contributorRepos) {
    for (const fullName of repos) {
      const list = repoContributorCount.get(fullName) ?? [];
      list.push(login);
      repoContributorCount.set(fullName, list);
    }
  }

  // Filter to repos with 2+ contributors from the current repo
  const sharedRepos = new Map<string, string[]>();
  for (const [fullName, logins] of repoContributorCount) {
    if (logins.length >= 2) {
      sharedRepos.set(fullName, logins);
    }
  }

  // 4. Build graph data
  const connectedContributors = new Set<string>();
  for (const logins of sharedRepos.values()) {
    for (const l of logins) connectedContributors.add(l);
  }

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  // Add contributor nodes (only those that appear in shared repos)
  for (const c of contributors) {
    if (!connectedContributors.has(c.login)) continue;
    nodes.push({
      type: 'contributor',
      id: `user:${c.login}`,
      login: c.login,
      contributions: c.contributions,
      isOwner: c.login.toLowerCase() === owner.toLowerCase(),
    });
  }

  // Add repo nodes and edges
  for (const [fullName, logins] of sharedRepos) {
    const repoId = `repo:${fullName}`;
    nodes.push({
      type: 'repo',
      id: repoId,
      name: repoFullNames.get(fullName) ?? fullName.split('/')[1],
      fullName,
    });
    for (const login of logins) {
      links.push({ source: `user:${login}`, target: repoId });
    }
  }

  const data: CollabGraphData = { nodes, links };

  // Cache result
  try {
    await chrome.storage.local.set({
      [cacheKey]: { data, timestamp: Date.now() } satisfies CacheEntry,
    });
  } catch { /* storage write failed, non-critical */ }

  return data;
}
