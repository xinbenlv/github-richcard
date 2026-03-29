import { useEffect, useState, useRef, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import {
  fetchCollabGraph,
  type CollabGraphData,
  type GraphNode,
  type GraphLink,
} from '../../utils/collaboration';

const COLORS = {
  contributor: '#58a6ff',
  repo: '#30363d',
  owner: '#3fb950',
  bg: '#161b22',
  text: '#c9d1d9',
  textMuted: '#8b949e',
  link: '#30363d',
  border: '#21262d',
};

const WIDTH = 316;
const HEIGHT = 300;

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { source: SimNode | string; target: SimNode | string };

export function CollaborationGraph({ owner, repo }: { owner: string; repo: string }) {
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CollabGraphData | null>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hasFetched = useRef(false);

  // Fetch data when section is expanded
  useEffect(() => {
    if (collapsed || hasFetched.current) return;
    hasFetched.current = true;
    setLoading(true);
    fetchCollabGraph(owner, repo).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [collapsed, owner, repo]);

  // Set up d3-force simulation when data changes
  useEffect(() => {
    if (!data || data.nodes.length === 0) return;

    // Deep clone to avoid mutating cached data
    const simNodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = data.links.map((l) => ({ ...l }));

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(60),
      )
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide<SimNode>().radius((d) => (d.type === 'contributor' ? nodeRadius(d as GraphNode) + 4 : 20)))
      .on('tick', () => {
        // Clamp nodes within bounds
        for (const n of simNodes) {
          n.x = Math.max(20, Math.min(WIDTH - 20, n.x ?? WIDTH / 2));
          n.y = Math.max(20, Math.min(HEIGHT - 20, n.y ?? HEIGHT / 2));
        }
        setNodes([...simNodes]);
        setLinks([...simLinks]);
      });

    simRef.current = sim;
    return () => { sim.stop(); };
  }, [data]);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent, node: SimNode) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      nodeId: node.id,
      offsetX: (node.x ?? 0) - e.clientX,
      offsetY: (node.y ?? 0) - e.clientY,
    };
    node.fx = node.x;
    node.fy = node.y;
    simRef.current?.alphaTarget(0.3).restart();
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const sim = simRef.current;
    if (!sim) return;
    const node = sim.nodes().find((n) => n.id === dragRef.current!.nodeId);
    if (!node) return;

    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    node.fx = Math.max(20, Math.min(WIDTH - 20, x));
    node.fy = Math.max(20, Math.min(HEIGHT - 20, y));
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const sim = simRef.current;
    if (sim) {
      const node = sim.nodes().find((n) => n.id === dragRef.current!.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      sim.alphaTarget(0);
    }
    dragRef.current = null;
  }, []);

  const empty = data && data.nodes.length === 0;

  return (
    <div style={{ background: COLORS.bg, borderRadius: '8px', overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: COLORS.text,
          fontFamily: 'inherit',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        <span>{'\uD83D\uDD17'} Collaboration Graph</span>
        <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          ▼
        </span>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div style={{ padding: '0 12px 12px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '24px 0', color: COLORS.textMuted }}>
              <div style={{ width: '20px', height: '20px', border: `2px solid ${COLORS.contributor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'grc-spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '11px' }}>Fetching collaboration data...</span>
            </div>
          )}

          {empty && !loading && (
            <div style={{ color: COLORS.textMuted, fontSize: '11px', textAlign: 'center', padding: '16px 0' }}>
              No shared repos found among contributors.
            </div>
          )}

          {data && data.nodes.length > 0 && (
            <>
              {/* SVG Graph */}
              <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '4px', border: `1px solid ${COLORS.border}` }}>
                <svg
                  ref={svgRef}
                  width={WIDTH}
                  height={HEIGHT}
                  style={{ display: 'block', background: '#0d1117', touchAction: 'none' }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  {/* Links */}
                  {links.map((l, i) => {
                    const s = l.source as SimNode;
                    const t = l.target as SimNode;
                    if (s.x == null || t.x == null) return null;
                    return (
                      <line
                        key={i}
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={COLORS.link}
                        strokeWidth={1}
                        strokeOpacity={0.6}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {nodes.map((node) => {
                    if (node.x == null || node.y == null) return null;
                    if (node.type === 'contributor') {
                      const r = nodeRadius(node);
                      const fill = node.isOwner ? COLORS.owner : COLORS.contributor;
                      return (
                        <g
                          key={node.id}
                          style={{ cursor: 'grab' }}
                          onPointerDown={(e) => handlePointerDown(e, node)}
                        >
                          <circle cx={node.x} cy={node.y} r={r} fill={fill} fillOpacity={0.85} />
                          <text
                            x={node.x}
                            y={node.y + r + 10}
                            textAnchor="middle"
                            fill={COLORS.text}
                            fontSize="8"
                            fontFamily="inherit"
                          >
                            {truncate(node.login, 12)}
                          </text>
                        </g>
                      );
                    }
                    // Repo node — rounded rect
                    const rw = 40;
                    const rh = 16;
                    return (
                      <g
                        key={node.id}
                        style={{ cursor: 'grab' }}
                        onPointerDown={(e) => handlePointerDown(e, node)}
                        onPointerEnter={(e) => {
                          const rect = svgRef.current?.getBoundingClientRect();
                          if (rect) setTooltip({ x: e.clientX - rect.left, y: (node.y ?? 0) - 14, text: node.fullName });
                        }}
                        onPointerLeave={() => setTooltip(null)}
                      >
                        <rect
                          x={node.x - rw / 2}
                          y={node.y - rh / 2}
                          width={rw}
                          height={rh}
                          rx={4}
                          fill={COLORS.repo}
                          fillOpacity={0.85}
                        />
                        <text
                          x={node.x}
                          y={node.y + 3.5}
                          textAnchor="middle"
                          fill={COLORS.text}
                          fontSize="7"
                          fontFamily="inherit"
                        >
                          {truncate(node.name, 8)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Tooltip */}
                  {tooltip && (
                    <g>
                      <rect
                        x={tooltip.x - 4}
                        y={tooltip.y - 12}
                        width={tooltip.text.length * 5.5 + 8}
                        height={16}
                        rx={3}
                        fill="#1f2937"
                        stroke={COLORS.border}
                        strokeWidth={0.5}
                      />
                      <text x={tooltip.x} y={tooltip.y} fill={COLORS.text} fontSize="9" fontFamily="inherit">
                        {tooltip.text}
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '10px', color: COLORS.textMuted }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill={COLORS.contributor} /></svg>
                  contributor
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="10" height="8"><rect width="10" height="8" rx="2" fill={COLORS.repo} /></svg>
                  repo
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill={COLORS.owner} /></svg>
                  owner
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function nodeRadius(node: GraphNode): number {
  if (node.type !== 'contributor') return 6;
  const c = node.contributions;
  if (c > 500) return 12;
  if (c > 100) return 10;
  if (c > 20) return 8;
  return 6;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}
