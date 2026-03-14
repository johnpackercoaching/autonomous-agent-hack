import { useEffect, useState, useCallback, useRef } from 'react';
import { ref, onValue, get, set } from 'firebase/database';
import { rtdb } from '../firebase';
import './AgentsPage.css';

// ── Types ──
interface AgentDef {
  id: string;
  name: string;
  role: string;
  persona: string;
  team: string;
}

interface AgentRTDB {
  status: 'idle' | 'active' | 'debating' | 'planning' | 'executing' | 'proving' | 'researching' | 'reviewing' | 'error';
  lastActivity: number | null;
  meta?: AgentMeta;
}

interface AgentMeta {
  description: string;
  systemPrompt: string;
  tools: string;
  model: string;
  color: string;
}

type AgentLiveData = Record<string, AgentRTDB>;

// ── System Agents (5) ──
const SYSTEM_AGENTS: AgentDef[] = [
  { id: 'hack-leader', name: 'hack-leader', role: 'Hackathon Leader', persona: '', team: 'System' },
  { id: 'hack-cos', name: 'hack-cos', role: 'Chief of Staff', persona: '', team: 'System' },
  { id: 'hack-judge-quality', name: 'hack-judge-quality', role: 'Quality Judge', persona: '', team: 'System' },
  { id: 'hack-judge-distinct', name: 'hack-judge-distinct', role: 'Distinctiveness Judge', persona: '', team: 'System' },
  { id: 'hack-judge-calibrator', name: 'hack-judge-calibrator', role: 'Calibration Judge', persona: '', team: 'System' },
];

// ── Team Data ──
interface TeamAgentGroup {
  teamId: string;
  teamName: string;
  jpRocksTeam: number;
  colorClass: string;
  agents: AgentDef[];
}

const TEAM_GROUPS: TeamAgentGroup[] = [
  {
    teamId: 'T01', teamName: 'First Light', jpRocksTeam: 3, colorClass: 'agents-section--t01',
    agents: [
      { id: 'hack-t01-coord', name: 'hack-t01-coord', role: 'Coordinator', persona: '', team: 'T01' },
      { id: 'hack-t01-architect', name: 'hack-t01-architect', role: 'Architect', persona: 'Feynman', team: 'T01' },
      { id: 'hack-t01-builder', name: 'hack-t01-builder', role: 'Builder', persona: 'Dieter Rams', team: 'T01' },
      { id: 'hack-t01-strategist', name: 'hack-t01-strategist', role: 'Strategist', persona: 'Sun Tzu', team: 'T01' },
    ],
  },
  {
    teamId: 'T02', teamName: 'Grain', jpRocksTeam: 4, colorClass: 'agents-section--t02',
    agents: [
      { id: 'hack-t02-coord', name: 'hack-t02-coord', role: 'Coordinator', persona: '', team: 'T02' },
      { id: 'hack-t02-architect', name: 'hack-t02-architect', role: 'Architect', persona: 'Charles Eames', team: 'T02' },
      { id: 'hack-t02-builder', name: 'hack-t02-builder', role: 'Builder', persona: 'Isamu Noguchi', team: 'T02' },
      { id: 'hack-t02-strategist', name: 'hack-t02-strategist', role: 'Strategist', persona: 'Nassim Taleb', team: 'T02' },
    ],
  },
  {
    teamId: 'T03', teamName: 'Terraform', jpRocksTeam: 5, colorClass: 'agents-section--t03',
    agents: [
      { id: 'hack-t03-coord', name: 'hack-t03-coord', role: 'Coordinator', persona: '', team: 'T03' },
      { id: 'hack-t03-architect', name: 'hack-t03-architect', role: 'Architect', persona: 'Donella Meadows', team: 'T03' },
      { id: 'hack-t03-builder', name: 'hack-t03-builder', role: 'Builder', persona: 'Wangari Maathai', team: 'T03' },
      { id: 'hack-t03-strategist', name: 'hack-t03-strategist', role: 'Strategist', persona: 'Andy Grove', team: 'T03' },
    ],
  },
  {
    teamId: 'T04', teamName: 'Parallax', jpRocksTeam: 6, colorClass: 'agents-section--t04',
    agents: [
      { id: 'hack-t04-coord', name: 'hack-t04-coord', role: 'Coordinator', persona: '', team: 'T04' },
      { id: 'hack-t04-architect', name: 'hack-t04-architect', role: 'Architect', persona: 'Ada Lovelace', team: 'T04' },
      { id: 'hack-t04-builder', name: 'hack-t04-builder', role: 'Builder', persona: 'Don Norman', team: 'T04' },
      { id: 'hack-t04-strategist', name: 'hack-t04-strategist', role: 'Strategist', persona: 'Coco Chanel', team: 'T04' },
    ],
  },
  {
    teamId: 'T05', teamName: 'Signal Fire', jpRocksTeam: 7, colorClass: 'agents-section--t05',
    agents: [
      { id: 'hack-t05-coord', name: 'hack-t05-coord', role: 'Coordinator', persona: '', team: 'T05' },
      { id: 'hack-t05-architect', name: 'hack-t05-architect', role: 'Architect', persona: 'Marie Curie', team: 'T05' },
      { id: 'hack-t05-builder', name: 'hack-t05-builder', role: 'Builder', persona: 'Buckminster Fuller', team: 'T05' },
      { id: 'hack-t05-strategist', name: 'hack-t05-strategist', role: 'Strategist', persona: 'Ed Catmull', team: 'T05' },
    ],
  },
  {
    teamId: 'T06', teamName: 'Groundwork', jpRocksTeam: 8, colorClass: 'agents-section--t06',
    agents: [
      { id: 'hack-t06-coord', name: 'hack-t06-coord', role: 'Coordinator', persona: '', team: 'T06' },
      { id: 'hack-t06-architect', name: 'hack-t06-architect', role: 'Architect', persona: 'Jane Jacobs', team: 'T06' },
      { id: 'hack-t06-builder', name: 'hack-t06-builder', role: 'Builder', persona: 'Aristotle', team: 'T06' },
      { id: 'hack-t06-strategist', name: 'hack-t06-strategist', role: 'Strategist', persona: 'Harriet Tubman', team: 'T06' },
    ],
  },
  {
    teamId: 'T07', teamName: 'Threshold', jpRocksTeam: 9, colorClass: 'agents-section--t07',
    agents: [
      { id: 'hack-t07-coord', name: 'hack-t07-coord', role: 'Coordinator', persona: '', team: 'T07' },
      { id: 'hack-t07-architect', name: 'hack-t07-architect', role: 'Architect', persona: 'Claude Shannon', team: 'T07' },
      { id: 'hack-t07-builder', name: 'hack-t07-builder', role: 'Builder', persona: 'Konosuke Matsushita', team: 'T07' },
      { id: 'hack-t07-strategist', name: 'hack-t07-strategist', role: 'Strategist', persona: 'Virgil Abloh', team: 'T07' },
    ],
  },
  {
    teamId: 'T08', teamName: 'Undertow', jpRocksTeam: 10, colorClass: 'agents-section--t08',
    agents: [
      { id: 'hack-t08-coord', name: 'hack-t08-coord', role: 'Coordinator', persona: '', team: 'T08' },
      { id: 'hack-t08-architect', name: 'hack-t08-architect', role: 'Architect', persona: 'Feynman', team: 'T08' },
      { id: 'hack-t08-builder', name: 'hack-t08-builder', role: 'Builder', persona: 'Eames', team: 'T08' },
      { id: 'hack-t08-strategist', name: 'hack-t08-strategist', role: 'Strategist', persona: 'Grove', team: 'T08' },
    ],
  },
  {
    teamId: 'T09', teamName: 'Meridian', jpRocksTeam: 11, colorClass: 'agents-section--t09',
    agents: [
      { id: 'hack-t09-coord', name: 'hack-t09-coord', role: 'Coordinator', persona: '', team: 'T09' },
      { id: 'hack-t09-architect', name: 'hack-t09-architect', role: 'Architect', persona: 'Meadows', team: 'T09' },
      { id: 'hack-t09-builder', name: 'hack-t09-builder', role: 'Builder', persona: 'Rams', team: 'T09' },
      { id: 'hack-t09-strategist', name: 'hack-t09-strategist', role: 'Strategist', persona: 'Taleb', team: 'T09' },
    ],
  },
  {
    teamId: 'T10', teamName: 'Sightline', jpRocksTeam: 12, colorClass: 'agents-section--t10',
    agents: [
      { id: 'hack-t10-coord', name: 'hack-t10-coord', role: 'Coordinator', persona: '', team: 'T10' },
      { id: 'hack-t10-architect', name: 'hack-t10-architect', role: 'Architect', persona: 'Lovelace', team: 'T10' },
      { id: 'hack-t10-builder', name: 'hack-t10-builder', role: 'Builder', persona: 'Noguchi', team: 'T10' },
      { id: 'hack-t10-strategist', name: 'hack-t10-strategist', role: 'Strategist', persona: 'Tubman', team: 'T10' },
    ],
  },
];

// Total agents: 5 system + 10 coordinators + 30 team members = 45
const TOTAL_AGENTS = SYSTEM_AGENTS.length + TEAM_GROUPS.reduce((acc, g) => acc + g.agents.length, 0);

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'No activity';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusLabel(status: string): string {
  switch (status) {
    case 'debating': return 'Debating';
    case 'planning': return 'Planning';
    case 'executing': return 'Executing';
    case 'proving': return 'Proving';
    case 'researching': return 'Researching';
    case 'reviewing': return 'Reviewing';
    case 'active': return 'Active';
    case 'error': return 'Error';
    default: return 'Idle';
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case 'active':
    case 'executing':
    case 'proving':
      return 'agent-card__status-dot--active';
    case 'debating':
      return 'agent-card__status-dot--debating';
    case 'planning':
    case 'researching':
      return 'agent-card__status-dot--planning';
    case 'reviewing':
      return 'agent-card__status-dot--reviewing';
    case 'error':
      return 'agent-card__status-dot--error';
    default:
      return 'agent-card__status-dot--idle';
  }
}

function roleIcon(role: string): string {
  switch (role) {
    case 'Architect': return 'A';
    case 'Builder': return 'B';
    case 'Strategist': return 'S';
    case 'Coordinator': return 'C';
    default: return role[0].toUpperCase();
  }
}

// ── Color mapping for agent meta.color ──
function colorToCss(color: string): string {
  const map: Record<string, string> = {
    gold: '#f0a000',
    blue: '#71b2f4',
    lime: '#84cc16',
    green: '#22c55e',
    red: '#ef4444',
    purple: '#8b5cf6',
    orange: '#f97316',
    cyan: '#06b6d4',
    pink: '#ec4899',
    yellow: '#eab308',
    teal: '#14b8a6',
    indigo: '#6366f1',
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e',
    slate: '#64748b',
  };
  return map[color?.toLowerCase()] || '#6b7280';
}

export function AgentsPage() {
  const [liveData, setLiveData] = useState<AgentLiveData>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Drawer state
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);
  const [drawerMeta, setDrawerMeta] = useState<AgentMeta | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const agentsRef = ref(rtdb, 'agents');
    const unsubscribe = onValue(
      agentsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setLiveData(snapshot.val() as AgentLiveData);
        }
      },
      (err) => {
        console.error('Agents RTDB listener error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  const toggleSection = (sectionId: string) => {
    setCollapsed((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const getAgentStatus = (agentId: string): AgentRTDB => {
    return liveData[agentId] || { status: 'idle', lastActivity: null };
  };

  const totalActive = Object.values(liveData).filter(
    (a) => a.status && a.status !== 'idle'
  ).length;

  // ── Drawer Logic ──
  const openDrawer = useCallback(async (agent: AgentDef) => {
    setSelectedAgent(agent);
    setDrawerLoading(true);
    setDrawerMeta(null);
    setSaveMessage(null);

    const metaRef = ref(rtdb, `agents/${agent.id}/meta`);
    const snapshot = await get(metaRef);

    if (snapshot.exists()) {
      const meta = snapshot.val() as AgentMeta;
      setDrawerMeta(meta);
      setEditDescription(meta.description || '');
      setEditSystemPrompt(meta.systemPrompt || '');
    } else {
      setDrawerMeta({ description: '', systemPrompt: '', tools: '', model: '', color: '' });
      setEditDescription('');
      setEditSystemPrompt('');
    }
    setDrawerLoading(false);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedAgent(null);
    setDrawerMeta(null);
    setSaveMessage(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedAgent || !drawerMeta) return;
    setSaving(true);
    setSaveMessage(null);

    const metaRef = ref(rtdb, `agents/${selectedAgent.id}/meta`);
    const updatedMeta: AgentMeta = {
      ...drawerMeta,
      description: editDescription,
      systemPrompt: editSystemPrompt,
    };

    try {
      await set(metaRef, updatedMeta);
      setDrawerMeta(updatedMeta);
      setSaveMessage({ type: 'success', text: 'Saved successfully' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveMessage({ type: 'error', text: 'Failed to save. Check console for details.' });
    } finally {
      setSaving(false);
    }
  }, [selectedAgent, drawerMeta, editDescription, editSystemPrompt]);

  // Escape key handler
  useEffect(() => {
    if (!selectedAgent) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedAgent, closeDrawer]);

  // Focus trap: focus drawer when it opens
  useEffect(() => {
    if (selectedAgent && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [selectedAgent]);

  // ── Render helper for agent cards ──
  const renderAgentCard = (agent: AgentDef, isTeamAgent: boolean) => {
    const live = getAgentStatus(agent.id);
    return (
      <button
        key={agent.id}
        className="agent-card agent-card--clickable"
        role="listitem"
        aria-label={`${agent.name} - ${agent.role}. Click to view details.`}
        onClick={() => openDrawer(agent)}
        type="button"
      >
        <div
          className={`agent-card__avatar${isTeamAgent ? ` agent-card__avatar--${agent.role.toLowerCase()}` : ''}`}
          aria-hidden="true"
        >
          {isTeamAgent ? roleIcon(agent.role) : agent.role[0]}
        </div>
        <div className="agent-card__body">
          <p className="agent-card__name">{agent.name}</p>
          <p className="agent-card__role">
            {agent.role}
            {agent.persona && (
              <span className="agent-card__persona"> -- {agent.persona}</span>
            )}
          </p>
        </div>
        <div className="agent-card__status">
          <span className={`agent-card__status-dot ${statusDotClass(live.status)}`} aria-hidden="true" />
          <span className="agent-card__status-label">{statusLabel(live.status)}</span>
        </div>
        <span className="agent-card__time">{formatRelativeTime(live.lastActivity)}</span>
      </button>
    );
  };

  // ── Determine if description or prompt have been edited ──
  const hasChanges = drawerMeta
    ? editDescription !== (drawerMeta.description || '') || editSystemPrompt !== (drawerMeta.systemPrompt || '')
    : false;

  return (
    <div className="agents-page" role="region" aria-label="Hackathon Agents">
      <div className="agents-header">
        <h2>Hackathon Agents</h2>
        <p className="agents-subtitle">
          {TOTAL_AGENTS} autonomous agents across 10 teams -- Architect / Builder / Strategist
        </p>
        <div className="agents-stats">
          <span className="agents-stat">
            <span className="agents-stat__dot agents-stat__dot--active" aria-hidden="true" />
            {totalActive} active
          </span>
          <span className="agents-stat">
            <span className="agents-stat__dot agents-stat__dot--idle" aria-hidden="true" />
            {TOTAL_AGENTS - totalActive} idle
          </span>
        </div>
      </div>

      {/* System Agents */}
      <div className="agents-section agents-section--system">
        <button
          className="agents-section__header"
          onClick={() => toggleSection('system')}
          aria-expanded={!collapsed['system']}
          aria-controls="agents-section-system"
        >
          <div className="agents-section__title-group">
            <h3 className="agents-section__title">System Agents</h3>
            <span className="agents-section__subtitle">5 agents -- leadership, staff, and judging panel</span>
          </div>
          <svg
            className={`agents-section__chevron ${collapsed['system'] ? 'agents-section__chevron--collapsed' : ''}`}
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {!collapsed['system'] && (
          <div id="agents-section-system" className="agents-grid" role="list" aria-label="System agent list">
            {SYSTEM_AGENTS.map((agent) => renderAgentCard(agent, false))}
          </div>
        )}
      </div>

      {/* Team Agent Groups */}
      {TEAM_GROUPS.map((group) => {
        const sectionId = group.teamId;
        const isCollapsed = !!collapsed[sectionId];
        return (
          <div key={sectionId} className={`agents-section ${group.colorClass}`}>
            <button
              className="agents-section__header"
              onClick={() => toggleSection(sectionId)}
              aria-expanded={!isCollapsed}
              aria-controls={`agents-section-${sectionId}`}
            >
              <div className="agents-section__title-group">
                <h3 className="agents-section__title">
                  {group.teamId}: {group.teamName}
                </h3>
                <span className="agents-section__subtitle">
                  {group.agents.length} agents -- JP Rocks Team {group.jpRocksTeam}
                </span>
              </div>
              <svg
                className={`agents-section__chevron ${isCollapsed ? 'agents-section__chevron--collapsed' : ''}`}
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {!isCollapsed && (
              <div id={`agents-section-${sectionId}`} className="agents-grid" role="list" aria-label={`${group.teamName} agent list`}>
                {group.agents.map((agent) => renderAgentCard(agent, true))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Agent Detail Drawer ── */}
      {selectedAgent && (
        <>
          <div
            className="drawer-overlay"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div
            className="drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedAgent.name} details`}
            tabIndex={-1}
          >
            {/* Drawer Header */}
            <div className="drawer__header">
              <div className="drawer__header-top">
                <div className="drawer__header-info">
                  <h3 className="drawer__title">{selectedAgent.name}</h3>
                  <div className="drawer__badges">
                    <span className="drawer__badge drawer__badge--role">{selectedAgent.role}</span>
                    {selectedAgent.persona && (
                      <span className="drawer__badge drawer__badge--persona">{selectedAgent.persona}</span>
                    )}
                    <span className="drawer__badge drawer__badge--team">{selectedAgent.team}</span>
                    {(() => {
                      const live = getAgentStatus(selectedAgent.id);
                      return (
                        <span className="drawer__status-inline">
                          <span className={`agent-card__status-dot ${statusDotClass(live.status)}`} aria-hidden="true" />
                          <span>{statusLabel(live.status)}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <button
                  className="drawer__close"
                  onClick={closeDrawer}
                  aria-label="Close drawer"
                  type="button"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="drawer__body">
              {drawerLoading ? (
                <div className="drawer__loading">
                  <div className="drawer__spinner" aria-label="Loading agent data" />
                  <p>Loading agent data...</p>
                </div>
              ) : drawerMeta ? (
                <>
                  {/* Metadata strip */}
                  <div className="drawer__meta-strip">
                    <div className="drawer__meta-item">
                      <span className="drawer__meta-label">Model</span>
                      <span className="drawer__meta-value">{drawerMeta.model || 'N/A'}</span>
                    </div>
                    <div className="drawer__meta-item">
                      <span className="drawer__meta-label">Color</span>
                      <span className="drawer__meta-value">
                        <span
                          className="drawer__color-swatch"
                          style={{ background: colorToCss(drawerMeta.color) }}
                          aria-hidden="true"
                        />
                        {drawerMeta.color || 'N/A'}
                      </span>
                    </div>
                    <div className="drawer__meta-item drawer__meta-item--tools">
                      <span className="drawer__meta-label">Tools</span>
                      <span className="drawer__meta-value drawer__meta-tools">
                        {(drawerMeta.tools || 'None').split(',').map((tool) => (
                          <span key={tool.trim()} className="drawer__tool-tag">{tool.trim()}</span>
                        ))}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="drawer__section">
                    <label className="drawer__section-label" htmlFor="drawer-description">
                      Description
                    </label>
                    <textarea
                      id="drawer-description"
                      className="drawer__textarea drawer__textarea--description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Agent description..."
                      rows={4}
                    />
                  </div>

                  {/* System Prompt */}
                  <div className="drawer__section drawer__section--grow">
                    <label className="drawer__section-label" htmlFor="drawer-system-prompt">
                      System Prompt
                    </label>
                    <textarea
                      id="drawer-system-prompt"
                      className="drawer__textarea drawer__textarea--prompt"
                      value={editSystemPrompt}
                      onChange={(e) => setEditSystemPrompt(e.target.value)}
                      placeholder="System prompt..."
                    />
                  </div>
                </>
              ) : (
                <div className="drawer__empty">
                  <p>No metadata found for this agent.</p>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            {drawerMeta && !drawerLoading && (
              <div className="drawer__footer">
                {saveMessage && (
                  <span className={`drawer__save-message drawer__save-message--${saveMessage.type}`}>
                    {saveMessage.text}
                  </span>
                )}
                <div className="drawer__footer-actions">
                  <button
                    className="drawer__btn drawer__btn--cancel"
                    onClick={closeDrawer}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="drawer__btn drawer__btn--save"
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AgentsPage;
