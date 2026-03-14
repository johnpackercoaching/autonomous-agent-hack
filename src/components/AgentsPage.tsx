import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import './AgentsPage.css';

// ── Types ──
interface AgentDef {
  id: string;
  name: string;
  role: string;
  team: string;
}

interface AgentRTDB {
  status: 'idle' | 'active' | 'debating' | 'planning' | 'executing' | 'proving' | 'error';
  lastActivity: number | null;
}

type AgentLiveData = Record<string, AgentRTDB>;

// ── 45 Hack Agents ──
const SYSTEM_AGENTS: AgentDef[] = [
  { id: 'hack-leader', name: 'hack-leader', role: 'Hackathon Leader', team: 'System' },
  { id: 'hack-cos', name: 'hack-cos', role: 'Chief of Staff', team: 'System' },
  { id: 'hack-judge-quality', name: 'hack-judge-quality', role: 'Quality Judge', team: 'System' },
  { id: 'hack-judge-distinct', name: 'hack-judge-distinct', role: 'Distinctiveness Judge', team: 'System' },
  { id: 'hack-judge-calibrator', name: 'hack-judge-calibrator', role: 'Calibration Judge', team: 'System' },
];

const PATTERN_A_TEAMS: AgentDef[] = [
  // T01
  { id: 'hack-t01-expander', name: 'hack-t01-expander', role: 'Expander', team: 'T01' },
  { id: 'hack-t01-challenger', name: 'hack-t01-challenger', role: 'Challenger', team: 'T01' },
  { id: 'hack-t01-integrator', name: 'hack-t01-integrator', role: 'Integrator', team: 'T01' },
  // T02
  { id: 'hack-t02-expander', name: 'hack-t02-expander', role: 'Expander', team: 'T02' },
  { id: 'hack-t02-challenger', name: 'hack-t02-challenger', role: 'Challenger', team: 'T02' },
  { id: 'hack-t02-integrator', name: 'hack-t02-integrator', role: 'Integrator', team: 'T02' },
  // T03
  { id: 'hack-t03-expander', name: 'hack-t03-expander', role: 'Expander', team: 'T03' },
  { id: 'hack-t03-challenger', name: 'hack-t03-challenger', role: 'Challenger', team: 'T03' },
  { id: 'hack-t03-integrator', name: 'hack-t03-integrator', role: 'Integrator', team: 'T03' },
];

const PATTERN_B_TEAMS: AgentDef[] = [
  // T04
  { id: 'hack-t04-advocate', name: 'hack-t04-advocate', role: 'Advocate', team: 'T04' },
  { id: 'hack-t04-builder', name: 'hack-t04-builder', role: 'Builder', team: 'T04' },
  { id: 'hack-t04-skeptic', name: 'hack-t04-skeptic', role: 'Skeptic', team: 'T04' },
  // T05
  { id: 'hack-t05-advocate', name: 'hack-t05-advocate', role: 'Advocate', team: 'T05' },
  { id: 'hack-t05-builder', name: 'hack-t05-builder', role: 'Builder', team: 'T05' },
  { id: 'hack-t05-skeptic', name: 'hack-t05-skeptic', role: 'Skeptic', team: 'T05' },
  // T06
  { id: 'hack-t06-advocate', name: 'hack-t06-advocate', role: 'Advocate', team: 'T06' },
  { id: 'hack-t06-builder', name: 'hack-t06-builder', role: 'Builder', team: 'T06' },
  { id: 'hack-t06-skeptic', name: 'hack-t06-skeptic', role: 'Skeptic', team: 'T06' },
];

const PATTERN_C_TEAMS: AgentDef[] = [
  // T07
  { id: 'hack-t07-proponent', name: 'hack-t07-proponent', role: 'Proponent', team: 'T07' },
  { id: 'hack-t07-redteam', name: 'hack-t07-redteam', role: 'Red Team', team: 'T07' },
  { id: 'hack-t07-arbiter', name: 'hack-t07-arbiter', role: 'Arbiter', team: 'T07' },
  // T08
  { id: 'hack-t08-proponent', name: 'hack-t08-proponent', role: 'Proponent', team: 'T08' },
  { id: 'hack-t08-redteam', name: 'hack-t08-redteam', role: 'Red Team', team: 'T08' },
  { id: 'hack-t08-arbiter', name: 'hack-t08-arbiter', role: 'Arbiter', team: 'T08' },
];

const PATTERN_D_TEAMS: AgentDef[] = [
  // T09
  { id: 'hack-t09-strategist', name: 'hack-t09-strategist', role: 'Strategist', team: 'T09' },
  { id: 'hack-t09-systems', name: 'hack-t09-systems', role: 'Systems', team: 'T09' },
  { id: 'hack-t09-premortem', name: 'hack-t09-premortem', role: 'Premortem', team: 'T09' },
  // T10
  { id: 'hack-t10-strategist', name: 'hack-t10-strategist', role: 'Strategist', team: 'T10' },
  { id: 'hack-t10-systems', name: 'hack-t10-systems', role: 'Systems', team: 'T10' },
  { id: 'hack-t10-premortem', name: 'hack-t10-premortem', role: 'Premortem', team: 'T10' },
];

interface AgentSectionDef {
  id: string;
  title: string;
  subtitle: string;
  colorClass: string;
  agents: AgentDef[];
}

const SECTIONS: AgentSectionDef[] = [
  { id: 'system', title: 'System Agents', subtitle: '5 agents -- leadership, staff, and judging panel', colorClass: 'agents-section--system', agents: SYSTEM_AGENTS },
  { id: 'pattern-a', title: 'Pattern A: Expander / Challenger / Integrator', subtitle: 'Teams T01-T03', colorClass: 'agents-section--pattern-a', agents: PATTERN_A_TEAMS },
  { id: 'pattern-b', title: 'Pattern B: Advocate / Builder / Skeptic', subtitle: 'Teams T04-T06', colorClass: 'agents-section--pattern-b', agents: PATTERN_B_TEAMS },
  { id: 'pattern-c', title: 'Pattern C: Proponent / Red Team / Arbiter', subtitle: 'Teams T07-T08', colorClass: 'agents-section--pattern-c', agents: PATTERN_C_TEAMS },
  { id: 'pattern-d', title: 'Pattern D: Strategist / Systems / Premortem', subtitle: 'Teams T09-T10', colorClass: 'agents-section--pattern-d', agents: PATTERN_D_TEAMS },
];

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
      return 'agent-card__status-dot--planning';
    case 'error':
      return 'agent-card__status-dot--error';
    default:
      return 'agent-card__status-dot--idle';
  }
}

export function AgentsPage() {
  const [liveData, setLiveData] = useState<AgentLiveData>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Subscribe to live agent data from RTDB
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

  return (
    <div className="agents-page" role="region" aria-label="Hackathon Agents">
      <div className="agents-header">
        <h2>Hackathon Agents</h2>
        <p className="agents-subtitle">
          45 autonomous agents across 10 teams -- 4 triad patterns
        </p>
        <div className="agents-stats">
          <span className="agents-stat">
            <span className="agents-stat__dot agents-stat__dot--active" aria-hidden="true" />
            {totalActive} active
          </span>
          <span className="agents-stat">
            <span className="agents-stat__dot agents-stat__dot--idle" aria-hidden="true" />
            {45 - totalActive} idle
          </span>
        </div>
      </div>

      {SECTIONS.map((section) => {
        const isCollapsed = !!collapsed[section.id];
        return (
          <div
            key={section.id}
            className={`agents-section ${section.colorClass}`}
          >
            <button
              className="agents-section__header"
              onClick={() => toggleSection(section.id)}
              aria-expanded={!isCollapsed}
              aria-controls={`agents-section-${section.id}`}
            >
              <div className="agents-section__title-group">
                <h3 className="agents-section__title">{section.title}</h3>
                <span className="agents-section__subtitle">{section.subtitle}</span>
              </div>
              <svg
                className={`agents-section__chevron ${isCollapsed ? 'agents-section__chevron--collapsed' : ''}`}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {!isCollapsed && (
              <div
                id={`agents-section-${section.id}`}
                className="agents-grid"
                role="list"
                aria-label={`${section.title} agent list`}
              >
                {section.agents.map((agent) => {
                  const live = getAgentStatus(agent.id);
                  return (
                    <div
                      key={agent.id}
                      className="agent-card"
                      role="listitem"
                      aria-label={`${agent.name} - ${agent.role}`}
                    >
                      <div className="agent-card__avatar" aria-hidden="true">
                        {agent.role[0].toUpperCase()}
                      </div>
                      <div className="agent-card__body">
                        <p className="agent-card__name">{agent.name}</p>
                        <p className="agent-card__role">
                          {agent.role}
                          {agent.team !== 'System' && (
                            <span className="agent-card__team"> -- {agent.team}</span>
                          )}
                        </p>
                      </div>
                      <div className="agent-card__status">
                        <span
                          className={`agent-card__status-dot ${statusDotClass(live.status)}`}
                          aria-hidden="true"
                        />
                        <span className="agent-card__status-label">
                          {statusLabel(live.status)}
                        </span>
                      </div>
                      <span className="agent-card__time">
                        {formatRelativeTime(live.lastActivity)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AgentsPage;
