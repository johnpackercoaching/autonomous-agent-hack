import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import './TeamsPage.css';

// ── Types ──
type Phase =
  | 'debate'
  | 'research'
  | 'informed_debate'
  | 'decisions'
  | 'mockups'
  | 'test_mockups'
  | 'debate_mockups'
  | 'execute_decision'
  | 'jp_rocks_execution'
  | 'review'
  | 'judge_presentation'
  | 'idle';

interface ActivityEvent {
  id: string;
  agent: string;
  type: string;
  summary: string;
  timestamp: number;
}

interface TeamRTDB {
  currentPhase: Phase;
  currentHour: number;
  batchActive: boolean;
  activity?: Record<string, Omit<ActivityEvent, 'id'>>;
}

interface TeamDef {
  id: string;
  name: string;
  jpRocksTeam: number;
  colorClass: string;
  agents: { id: string; role: string; persona: string }[];
  coordinator: string;
}

// ── 10 Teams with Architect / Builder / Strategist ──
const TEAMS: TeamDef[] = [
  {
    id: 'T01', name: 'First Light', jpRocksTeam: 3, colorClass: 'team-card--t01',
    agents: [
      { id: 'hack-t01-architect', role: 'Architect', persona: 'Feynman' },
      { id: 'hack-t01-builder', role: 'Builder', persona: 'Dieter Rams' },
      { id: 'hack-t01-strategist', role: 'Strategist', persona: 'Sun Tzu' },
    ],
    coordinator: 'hack-t01-coord',
  },
  {
    id: 'T02', name: 'Grain', jpRocksTeam: 4, colorClass: 'team-card--t02',
    agents: [
      { id: 'hack-t02-architect', role: 'Architect', persona: 'Charles Eames' },
      { id: 'hack-t02-builder', role: 'Builder', persona: 'Isamu Noguchi' },
      { id: 'hack-t02-strategist', role: 'Strategist', persona: 'Nassim Taleb' },
    ],
    coordinator: 'hack-t02-coord',
  },
  {
    id: 'T03', name: 'Terraform', jpRocksTeam: 5, colorClass: 'team-card--t03',
    agents: [
      { id: 'hack-t03-architect', role: 'Architect', persona: 'Donella Meadows' },
      { id: 'hack-t03-builder', role: 'Builder', persona: 'Wangari Maathai' },
      { id: 'hack-t03-strategist', role: 'Strategist', persona: 'Andy Grove' },
    ],
    coordinator: 'hack-t03-coord',
  },
  {
    id: 'T04', name: 'Parallax', jpRocksTeam: 6, colorClass: 'team-card--t04',
    agents: [
      { id: 'hack-t04-architect', role: 'Architect', persona: 'Ada Lovelace' },
      { id: 'hack-t04-builder', role: 'Builder', persona: 'Don Norman' },
      { id: 'hack-t04-strategist', role: 'Strategist', persona: 'Coco Chanel' },
    ],
    coordinator: 'hack-t04-coord',
  },
  {
    id: 'T05', name: 'Signal Fire', jpRocksTeam: 7, colorClass: 'team-card--t05',
    agents: [
      { id: 'hack-t05-architect', role: 'Architect', persona: 'Marie Curie' },
      { id: 'hack-t05-builder', role: 'Builder', persona: 'Buckminster Fuller' },
      { id: 'hack-t05-strategist', role: 'Strategist', persona: 'Ed Catmull' },
    ],
    coordinator: 'hack-t05-coord',
  },
  {
    id: 'T06', name: 'Groundwork', jpRocksTeam: 8, colorClass: 'team-card--t06',
    agents: [
      { id: 'hack-t06-architect', role: 'Architect', persona: 'Jane Jacobs' },
      { id: 'hack-t06-builder', role: 'Builder', persona: 'Aristotle' },
      { id: 'hack-t06-strategist', role: 'Strategist', persona: 'Harriet Tubman' },
    ],
    coordinator: 'hack-t06-coord',
  },
  {
    id: 'T07', name: 'Threshold', jpRocksTeam: 9, colorClass: 'team-card--t07',
    agents: [
      { id: 'hack-t07-architect', role: 'Architect', persona: 'Claude Shannon' },
      { id: 'hack-t07-builder', role: 'Builder', persona: 'Konosuke Matsushita' },
      { id: 'hack-t07-strategist', role: 'Strategist', persona: 'Virgil Abloh' },
    ],
    coordinator: 'hack-t07-coord',
  },
  {
    id: 'T08', name: 'Undertow', jpRocksTeam: 10, colorClass: 'team-card--t08',
    agents: [
      { id: 'hack-t08-architect', role: 'Architect', persona: 'Feynman' },
      { id: 'hack-t08-builder', role: 'Builder', persona: 'Eames' },
      { id: 'hack-t08-strategist', role: 'Strategist', persona: 'Grove' },
    ],
    coordinator: 'hack-t08-coord',
  },
  {
    id: 'T09', name: 'Meridian', jpRocksTeam: 11, colorClass: 'team-card--t09',
    agents: [
      { id: 'hack-t09-architect', role: 'Architect', persona: 'Meadows' },
      { id: 'hack-t09-builder', role: 'Builder', persona: 'Rams' },
      { id: 'hack-t09-strategist', role: 'Strategist', persona: 'Taleb' },
    ],
    coordinator: 'hack-t09-coord',
  },
  {
    id: 'T10', name: 'Sightline', jpRocksTeam: 12, colorClass: 'team-card--t10',
    agents: [
      { id: 'hack-t10-architect', role: 'Architect', persona: 'Lovelace' },
      { id: 'hack-t10-builder', role: 'Builder', persona: 'Noguchi' },
      { id: 'hack-t10-strategist', role: 'Strategist', persona: 'Tubman' },
    ],
    coordinator: 'hack-t10-coord',
  },
];

// ── 11-Phase Hourly Cycle ──
const PHASES: { key: Phase; label: string; shortLabel: string }[] = [
  { key: 'debate', label: 'Debate', shortLabel: 'DBT' },
  { key: 'research', label: 'Research', shortLabel: 'RSH' },
  { key: 'informed_debate', label: 'Informed Debate', shortLabel: 'IDB' },
  { key: 'decisions', label: 'Decisions', shortLabel: 'DEC' },
  { key: 'mockups', label: 'Mockups', shortLabel: 'MOK' },
  { key: 'test_mockups', label: 'Test Mockups', shortLabel: 'TST' },
  { key: 'debate_mockups', label: 'Debate Mockups', shortLabel: 'DMK' },
  { key: 'execute_decision', label: 'Execute Decision', shortLabel: 'EXD' },
  { key: 'jp_rocks_execution', label: 'JP Rocks Execution', shortLabel: 'JPR' },
  { key: 'review', label: 'Review', shortLabel: 'REV' },
  { key: 'judge_presentation', label: 'Judge Presentation', shortLabel: 'JDG' },
];

function phaseIndex(phase: Phase): number {
  const idx = PHASES.findIndex((p) => p.key === phase);
  return idx >= 0 ? idx : -1;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function agentStatusDotClass(agentId: string, agentStatuses: Record<string, { status: string }>): string {
  const s = agentStatuses[agentId]?.status || 'idle';
  switch (s) {
    case 'active':
    case 'executing':
    case 'proving':
      return 'team-agent-dot--active';
    case 'debating':
      return 'team-agent-dot--debating';
    case 'planning':
    case 'researching':
      return 'team-agent-dot--planning';
    case 'error':
      return 'team-agent-dot--error';
    default:
      return 'team-agent-dot--idle';
  }
}

export function TeamsPage() {
  const [teamsData, setTeamsData] = useState<Record<string, TeamRTDB>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<string, { status: string }>>({});
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  useEffect(() => {
    const teamsRef = ref(rtdb, 'teams');
    const unsubscribe = onValue(
      teamsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setTeamsData(snapshot.val() as Record<string, TeamRTDB>);
        }
      },
      (err) => {
        console.error('Teams RTDB listener error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const agentsRef = ref(rtdb, 'agents');
    const unsubscribe = onValue(
      agentsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setAgentStatuses(snapshot.val() as Record<string, { status: string }>);
        }
      },
      (err) => {
        console.error('Agent statuses RTDB listener error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  const getTeamData = (teamId: string): TeamRTDB => {
    return teamsData[teamId] || {
      currentPhase: 'idle' as Phase,
      currentHour: 0,
      batchActive: false,
    };
  };

  const getActivities = (teamId: string): ActivityEvent[] => {
    const data = teamsData[teamId];
    if (!data?.activity) return [];
    return Object.entries(data.activity)
      .map(([key, val]) => ({ id: key, ...val }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 50);
  };

  const activeBatchCount = Object.values(teamsData).filter((t) => t.batchActive).length;

  return (
    <div className="teams-page" role="region" aria-label="Hackathon Teams">
      <div className="teams-header">
        <h2>Teams</h2>
        <p className="teams-subtitle">
          10 teams -- 200-hour hackathon -- 11-phase hourly cycle
        </p>
        <div className="teams-stats">
          <span className="teams-stat">
            <span className="teams-stat__dot teams-stat__dot--batch" aria-hidden="true" />
            {activeBatchCount} in current batch
          </span>
        </div>
      </div>

      {/* Expanded detail view */}
      {expandedTeam && (() => {
        const team = TEAMS.find((t) => t.id === expandedTeam);
        if (!team) return null;
        const data = getTeamData(team.id);
        const activities = getActivities(team.id);
        const currentIdx = phaseIndex(data.currentPhase);

        return (
          <div className="team-detail" role="dialog" aria-label={`${team.name} detail view`}>
            <div className="team-detail__header">
              <button
                className="team-detail__back"
                onClick={() => setExpandedTeam(null)}
                aria-label="Back to team grid"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
              <h3 className="team-detail__title">{team.id}: {team.name}</h3>
              <span className="team-detail__pattern">
                Architect / Builder / Strategist -- JP Rocks Team {team.jpRocksTeam}
              </span>
            </div>

            {/* Agent roster */}
            <div className="team-detail__roster">
              {team.agents.map((agent) => (
                <div key={agent.id} className="team-detail__agent">
                  <span className={`team-agent-dot ${agentStatusDotClass(agent.id, agentStatuses)}`} aria-hidden="true" />
                  <span className="team-detail__agent-role">{agent.role}</span>
                  <span className="team-detail__agent-persona">{agent.persona}</span>
                </div>
              ))}
            </div>

            {/* 11-phase progress bar */}
            <div className="team-detail__phases">
              {PHASES.map((phase, idx) => (
                <div
                  key={phase.key}
                  className={`team-detail__phase ${
                    idx < currentIdx
                      ? 'team-detail__phase--completed'
                      : idx === currentIdx
                      ? 'team-detail__phase--current'
                      : 'team-detail__phase--future'
                  }`}
                  title={phase.label}
                >
                  <span className="team-detail__phase-dot" aria-hidden="true" />
                  <span className="team-detail__phase-short">{phase.shortLabel}</span>
                </div>
              ))}
            </div>

            <div className="team-detail__body">
              <div className="team-detail__feed">
                <h4>Activity Feed</h4>
                {activities.length === 0 ? (
                  <p className="team-detail__empty">No activity recorded yet.</p>
                ) : (
                  <ul className="team-detail__feed-list" role="log" aria-live="polite">
                    {activities.map((ev) => (
                      <li key={ev.id} className="team-detail__feed-item">
                        <span className="team-detail__feed-agent">{ev.agent}</span>
                        <span className="team-detail__feed-type">{ev.type}</span>
                        <span className="team-detail__feed-summary">{ev.summary}</span>
                        {ev.timestamp && (
                          <span className="team-detail__feed-time">{formatTimestamp(ev.timestamp)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="team-detail__artifact">
                <h4>Current Artifact</h4>
                <div className="team-detail__artifact-placeholder">
                  {data.currentPhase === 'idle'
                    ? 'Waiting for hackathon to start...'
                    : `Working on ${PHASES.find(p => p.key === data.currentPhase)?.label || data.currentPhase} -- H-${String(data.currentHour).padStart(3, '0')}`}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Grid view */}
      {!expandedTeam && (
        <div className="teams-grid">
          {TEAMS.map((team) => {
            const data = getTeamData(team.id);
            const currentIdx = phaseIndex(data.currentPhase);

            return (
              <button
                key={team.id}
                className={`team-card ${team.colorClass} ${data.batchActive ? 'team-card--batch-active' : ''}`}
                onClick={() => setExpandedTeam(team.id)}
                aria-label={`${team.name} - ${data.currentPhase === 'idle' ? 'idle' : `phase: ${data.currentPhase}`}`}
              >
                <div className="team-card__top">
                  <span className="team-card__name">{team.id}: {team.name}</span>
                  {data.batchActive && (
                    <span className="team-card__batch-badge" aria-label="Active in current batch">LIVE</span>
                  )}
                </div>

                <span className="team-card__pattern">JP Rocks Team {team.jpRocksTeam}</span>

                {/* Agent avatars with persona names */}
                <div className="team-card__agents">
                  {team.agents.map((agent) => (
                    <div key={agent.id} className="team-card__agent" title={`${agent.role}: ${agent.persona} (${agent.id})`}>
                      <span className={`team-agent-dot ${agentStatusDotClass(agent.id, agentStatuses)}`} aria-hidden="true" />
                      <span className="team-card__agent-role">{agent.role}</span>
                      <span className="team-card__agent-persona">{agent.persona}</span>
                    </div>
                  ))}
                </div>

                {/* Phase progress -- compact 11-phase bar */}
                <div className="team-card__phases" aria-label={`Phase: ${data.currentPhase}`}>
                  {PHASES.map((phase, idx) => (
                    <div
                      key={phase.key}
                      className={`team-card__phase-step ${
                        idx < currentIdx
                          ? 'team-card__phase-step--completed'
                          : idx === currentIdx
                          ? 'team-card__phase-step--current'
                          : 'team-card__phase-step--future'
                      }`}
                      title={phase.label}
                    >
                      <span className="team-card__phase-bar" />
                    </div>
                  ))}
                </div>

                {/* Hour + coordinator */}
                <div className="team-card__footer">
                  <span className="team-card__hour">
                    {data.currentHour > 0 ? `H-${String(data.currentHour).padStart(3, '0')} / 200` : '-- / 200'}
                  </span>
                </div>

                {data.currentPhase === 'idle' && data.currentHour === 0 && (
                  <p className="team-card__idle-msg">Waiting for hackathon to start...</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TeamsPage;
