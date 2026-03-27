import { useEffect, useState, useCallback } from 'react';
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
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; info: RepoInfo }
  | { phase: 'error'; message: string };

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ phase: 'idle' });

  const parsed = parseGithubRepo(window.location.href);

  const load = useCallback(async () => {
    if (!parsed) return;
    setState({ phase: 'loading' });
    try {
      const info = await fetchRepoInfo(parsed.owner, parsed.repo);
      setState({ phase: 'ready', info });
    } catch (e: unknown) {
      setState({ phase: 'error', message: (e as Error).message });
    }
  }, [parsed?.owner, parsed?.repo]);

  // Auto-open and load when on a repo page
  useEffect(() => {
    if (parsed) {
      setOpen(true);
      load();
    }
  }, [parsed?.owner, parsed?.repo]);

  // Listen for toggle from popup or keyboard
  useEffect(() => {
    const handle = () => setOpen((o) => !o);
    window.addEventListener('grc:toggle', handle);
    return () => window.removeEventListener('grc:toggle', handle);
  }, []);

  // Also listen for chrome messages
  useEffect(() => {
    const listener = (msg: unknown) => {
      if ((msg as { type?: string })?.type === 'TOGGLE_SIDEBAR') {
        setOpen((o) => !o);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  if (!parsed) return null;

  return (
    <>
      {/* Toggle fab */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Toggle GitHub RichCard"
        style={{
          position: 'fixed',
          right: open ? '348px' : '0',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 2147483646,
          transition: 'right 0.3s cubic-bezier(0.4,0,0.2,1)',
          background: '#0ea5e9',
          border: 'none',
          borderRadius: '6px 0 0 6px',
          width: '28px',
          height: '60px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
          padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
          {open
            ? <path d="M9 2L4 7l5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            : <><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="white"/><rect x="1" y="6.25" width="12" height="1.5" rx="0.75" fill="white"/><rect x="1" y="10.5" width="12" height="1.5" rx="0.75" fill="white"/></>
          }
        </svg>
      </button>

      {/* Sidebar panel */}
      <div
        className="grc-sidebar"
        style={{
          position: 'fixed',
          top: 0,
          right: open ? 0 : '-360px',
          width: '348px',
          height: '100vh',
          zIndex: 2147483645,
          background: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'right 0.3s cubic-bezier(0.4,0,0.2,1)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: '13px',
          color: '#1f2937',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ background: '#111827', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GhIcon />
            <span style={{ color: '#f9fafb', fontWeight: 600, fontSize: '13px' }}>GitHub RichCard</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px', lineHeight: 1, fontSize: '16px' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
          {state.phase === 'idle' && (
            <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', paddingTop: '24px' }}>Ready.</div>
          )}
          {state.phase === 'loading' && <LoadingState repo={`${parsed.owner}/${parsed.repo}`} />}
          {state.phase === 'error' && <ErrorState message={state.message} onRetry={load} />}
          {state.phase === 'ready' && <RepoDetail info={state.info} />}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#9ca3af' }}>{VERSION_LABEL}</span>
          <a
            href="https://github.com/xinbenlv/github-richcard"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '10px', color: '#9ca3af', textDecoration: 'none' }}
          >
            Source
          </a>
        </div>
      </div>
    </>
  );
}

function GhIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect width="18" height="18" rx="4" fill="#0ea5e9" />
      <text x="3" y="13" fontSize="10" fill="white" fontWeight="bold" fontFamily="monospace">GH</text>
    </svg>
  );
}

function LoadingState({ repo }: { repo: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingTop: '48px', color: '#6b7280' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #0ea5e9', borderTopColor: 'transparent', borderRadius: '50%', animation: 'grc-spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '12px' }}>Loading {repo}…</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: '32px', color: '#ef4444' }}>
      <p style={{ fontSize: '12px', marginBottom: '12px' }}>{message}</p>
      <button
        onClick={onRetry}
        style={{ padding: '6px 12px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
      >
        Retry
      </button>
    </div>
  );
}

function RepoDetail({ info }: { info: RepoInfo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Repo name */}
      <div>
        <a href={info.htmlUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: '#111827', textDecoration: 'none', fontSize: '14px', wordBreak: 'break-all' }}>
          {info.fullName}
        </a>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {info.isArchived && <Chip text="archived" bg="#fef9c3" color="#a16207" />}
          {info.isFork && <Chip text="fork" bg="#f3f4f6" color="#4b5563" />}
          {info.language && <Chip text={info.language} bg="#e0f2fe" color="#0369a1" />}
          {info.license && <Chip text={info.license} bg="#dcfce7" color="#15803d" />}
        </div>
        {info.description && (
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', lineHeight: 1.5 }}>{info.description}</p>
        )}
        {info.homepage && (
          <a href={info.homepage} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#0ea5e9', display: 'block', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {info.homepage}
          </a>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        <StatCard icon="★" label="Stars" value={formatNumber(info.stars)} />
        <StatCard icon="⑂" label="Forks" value={formatNumber(info.forks)} />
        <StatCard icon="●" label="Issues" value={formatNumber(info.openIssues)} />
        <StatCard icon="◎" label="Watch" value={formatNumber(info.watchers)} />
      </div>

      {/* Topics */}
      {info.topics.length > 0 && (
        <div>
          <p style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Topics</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {info.topics.map((t) => (
              <a
                key={t}
                href={`https://github.com/topics/${t}`}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '20px', fontSize: '11px', textDecoration: 'none', lineHeight: 1.6 }}
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <InfoRow label="Created" value={timeAgo(info.createdAt)} />
        <InfoRow label="Last push" value={timeAgo(info.pushedAt)} />
        <InfoRow label="Branch" value={info.defaultBranch} />
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #f3f4f6' }} />

      {/* DeepWiki CTA */}
      <a
        href={deepwikiUrl(info.owner, info.repo)}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '10px 16px', background: '#0ea5e9', color: 'white', borderRadius: '8px',
          textDecoration: 'none', fontWeight: 600, fontSize: '13px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#0284c7')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#0ea5e9')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.5" />
          <path d="M4.5 7h5M7 4.5V7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Open in DeepWiki
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 9l6-6M9 9V3H3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>

      {/* More links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <OutlineLink href={`${info.htmlUrl}/issues`} label="Issues" />
        <OutlineLink href={`${info.htmlUrl}/pulls`} label="Pull Requests" />
        <OutlineLink href={`${info.htmlUrl}/releases`} label="Releases" />
        <OutlineLink href={`${info.htmlUrl}/graphs/contributors`} label="Contributors" />
        <OutlineLink href={`https://bundlephobia.com/package/${info.repo}`} label="Bundlephobia" />
        <OutlineLink href={`https://www.npmjs.com/package/${info.repo}`} label="npm" />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontWeight: 600, fontSize: '12px', color: '#111827' }}>{value}</span>
      <span style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

function Chip({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 500, background: bg, color }}>{text}</span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      <span style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function OutlineLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px',
        fontSize: '11px', color: '#374151', textDecoration: 'none', textAlign: 'center',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.color = '#0ea5e9'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
    >
      {label}
    </a>
  );
}
