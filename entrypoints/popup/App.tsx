import { useEffect, useState } from 'react';
import {
  fetchRepoInfo,
  parseGithubRepo,
  deepwikiUrl,
  formatNumber,
  timeAgo,
  type RepoInfo,
} from '../../utils/github';
import { VERSION_LABEL } from '../../utils/version';

type State =
  | { phase: 'loading' }
  | { phase: 'not-github' }
  | { phase: 'not-repo' }
  | { phase: 'fetching'; owner: string; repo: string }
  | { phase: 'ready'; info: RepoInfo }
  | { phase: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0]?.url ?? '';
      const parsed = parseGithubRepo(url);
      if (!url.includes('github.com')) {
        setState({ phase: 'not-github' });
        return;
      }
      if (!parsed) {
        setState({ phase: 'not-repo' });
        return;
      }
      setState({ phase: 'fetching', ...parsed });
      try {
        const info = await fetchRepoInfo(parsed.owner, parsed.repo);
        setState({ phase: 'ready', info });
      } catch (e: unknown) {
        setState({ phase: 'error', message: (e as Error).message });
      }
    });
  }, []);

  function toggleSidebar() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const id = tabs[0]?.id;
      if (id) chrome.tabs.sendMessage(id, { type: 'TOGGLE_SIDEBAR' });
    });
  }

  return (
    <div className="w-80 bg-white flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-3 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-sky-400 flex-shrink-0">
          <rect width="20" height="20" rx="4" fill="currentColor" />
          <text x="4" y="14" fontSize="11" fill="white" fontWeight="bold" fontFamily="monospace">GH</text>
        </svg>
        <span className="text-white font-semibold text-sm">GitHub RichCard</span>
      </div>

      <div className="flex-1 p-4">
        {state.phase === 'loading' && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            Loading…
          </div>
        )}

        {state.phase === 'not-github' && (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">Navigate to a GitHub repository to see rich info.</p>
          </div>
        )}

        {state.phase === 'not-repo' && (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">Open a repository page (e.g. github.com/owner/repo) to see info.</p>
          </div>
        )}

        {state.phase === 'fetching' && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            Fetching {state.owner}/{state.repo}…
          </div>
        )}

        {state.phase === 'error' && (
          <div className="py-4 text-center text-red-500 text-sm">{state.message}</div>
        )}

        {state.phase === 'ready' && <RepoView info={state.info} onToggle={toggleSidebar} />}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-mono">{VERSION_LABEL}</span>
        <a
          href="https://github.com/xinbenlv/github-richcard"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-gray-400 hover:text-sky-500 transition-colors"
        >
          Source
        </a>
      </div>
    </div>
  );
}

function RepoView({ info, onToggle }: { info: RepoInfo; onToggle: () => void }) {
  return (
    <div className="space-y-4">
      {/* Repo title */}
      <div>
        <a
          href={info.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gray-900 hover:text-sky-600 transition-colors text-sm break-all"
        >
          {info.fullName}
        </a>
        {info.isArchived && (
          <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded">archived</span>
        )}
        {info.isFork && (
          <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">fork</span>
        )}
        {info.description && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{info.description}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <Stat icon="★" label="Stars" value={formatNumber(info.stars)} />
        <Stat icon="⑂" label="Forks" value={formatNumber(info.forks)} />
        <Stat icon="●" label="Issues" value={formatNumber(info.openIssues)} />
        <Stat icon="◎" label="Watch" value={formatNumber(info.watchers)} />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {info.language && (
          <Badge text={info.language} color="bg-sky-100 text-sky-700" />
        )}
        {info.license && (
          <Badge text={info.license} color="bg-green-100 text-green-700" />
        )}
        {info.topics.slice(0, 4).map((t) => (
          <Badge key={t} text={t} color="bg-gray-100 text-gray-600" />
        ))}
      </div>

      {/* Updated */}
      <p className="text-[11px] text-gray-400">
        Last push {timeAgo(info.pushedAt)} · Created {timeAgo(info.createdAt)}
      </p>

      {/* Primary CTA — DeepWiki */}
      <a
        href={deepwikiUrl(info.owner, info.repo)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M7 3v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Open in DeepWiki
      </a>

      {/* Secondary links */}
      <div className="grid grid-cols-2 gap-2">
        <LinkButton
          href={`${info.htmlUrl}/issues`}
          label="Issues"
          count={info.openIssues}
        />
        <LinkButton
          href={`${info.htmlUrl}/pulls`}
          label="Pull Requests"
        />
      </div>

      {/* Toggle sidebar */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 border border-gray-200 hover:border-sky-300 hover:bg-sky-50 text-gray-600 text-xs rounded-lg transition-colors"
      >
        Toggle sidebar on page →
      </button>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg">
      <span className="text-base leading-none">{icon}</span>
      <span className="font-semibold text-gray-900 text-xs mt-1">{value}</span>
      <span className="text-[9px] text-gray-400">{label}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>{text}</span>
  );
}

function LinkButton({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] text-gray-600 border border-gray-200 rounded-lg hover:border-sky-300 hover:text-sky-600 transition-colors"
    >
      {label}
      {count !== undefined && (
        <span className="bg-gray-100 text-gray-500 px-1 rounded text-[10px]">{formatNumber(count)}</span>
      )}
    </a>
  );
}
