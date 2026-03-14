import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import './TeamsPage.css';

// ── Types ──
type Phase = 'debate' | 'plan' | 'execute' | 'proof' | 'idle';

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
  pattern: string;
  patternLabel: string;
  colorClass: string;
  agents: { id: string; role: string }[];
  coordinator: string;
}

// ── 10 Teams ──
const TEAMS: TeamDef[] = [
  {
    id: 'T01', name: 'Team 01', pattern: 'A', patternLabel: 'Expander / Challenger / Integrator',
    colorClass: 'team-card--pattern-a',
    agents: [
      { id: 'hack-t01-expander', role: 'Expander' },
      { id: 'hack-t01-challenger', role: 'Challenger' },
      { id: 'hack-t01-integrator', role: 'Integrator' },
    ],
    coordinator: 'hack-t01-integrator',
  },
  {
    id: 'T02', name: 'Team 02', pattern: 'A', patternLabel: 'Expander / Challenger / Integrator',
    colorClass: 'team-card--pattern-a',
    agents: [
      { id: 'hack-t02-expander', role: 'Expander' },
      { id: 'hack-t02-challenger', role: 'Challenger' },
      { id: 'hack-t02-integrator', role: 'Integrator' },
    ],
    coordinator: 'hack-t02-integrator',
  },
  {
    id: 'T03', name: 'Team 03', pattern: 'A', patternLabel: 'Expander / Challenger / Integrator',
    colorClass: 'team-card--pattern-a',
    agents: [
      { id: 'hack-t03-expander', role: 'Expander' },
      { id: 'hack-t03-challenger', role: 'Challenger' },
      { id: 'hack-t03-integrator', role: 'Integrator' },
    ],
    coordinator: 'hack-t03-integrator',
  },
  {
    id: 'T04', name: 'Team 04', pattern: 'B', patternLabel: 'Advocate / Builder / Skeptic',
    colorClass: 'team-card--pattern-b',
    agents: [
      { id: 'hack-t04-advocate', role: 'Advocate' },
      { id: 'hack-t04-builder', role: 'Builder' },
      { id: 'hack-t04-skeptic', role: 'Skeptic' },
    ],
    coordinator: 'hack-t04-builder',
  },
  {
    id: 'T05', name: 'Team 05', pattern: 'B', patternLabel: 'Advocate / Builder / Skeptic',
    colorClass: 'team-card--pattern-b',
    agents: [
      { id: 'hack-t05-advocate', role: 'Advocate' },
      { id: 'hack-t05-builder', role: 'Builder' },
      { id: 'hack-t05-skeptic', role: 'Skeptic' },
    ],
    coordinator: 'hack-t05-builder',
  },
  {
    id: 'T06', name: 'Team 06', pattern: 'B', patternLabel: 'Advocate / Builder / Skeptic',
    colorClass: 'team-card--pattern-b',
    agents: [
      { id: 'hack-t06-advocate', role: 'Advocate' },
      { id: 'hack-t06-builder', role: 'Builder' },
      { id: 'hack-t06-skeptic', role: 'Skeptic' },
    ],
    coordinator: 'hack-t06-builder',
  },
  {
    id: 'T07', name: 'Team 07', pattern: 'C', patternLabel: 'Proponent / Red Team / Arbiter',
    colorClass: 'team-card--pattern-c',
    agents: [
      { id: 'hack-t07-proponent', role: 'Proponent' },
      { id: 'hack-t07-redteam', role: 'Red Team' },
      { id: 'hack-t07-arbiter', role: 'Arbiter' },
    ],
    coordinator: 'hack-t07-arbiter',
  },
  {
    id: 'T08', name: 'Team 08', pattern: 'C', patternLabel: 'Proponent / Red Team / Arbiter',
    colorClass: 'team-card--pattern-c',
    agents: [
      { id: 'hack-t08-proponent', role: 'Proponent' },
      { id: 'hack-t08-redteam', role: 'Red Team' },
      { id: 'hack-t08-arbiter', role: 'Arbiter' },
    ],
    coordinator: 'hack-t08-arbiter',
  },
  {
    id: 'T09', name: 'Team 09', pattern: 'D', patternLabel: 'Strategist / Systems / Premortem',
    colorClass: 'team-card--pattern-d',
    agents: [
      { id: 'hack-t09-strategist', role: 'Strategist' },
      { id: 'hack-t09-systems', role: 'Systems' },
      { id: 'hack-t09-premortem', role: 'Premortem' },
    ],
    coordinator: 'hack-t09-strategist',
  },
  {
    id: 'T10', name: 'Team 10', pattern: 'D', patternLabel: 'Strategist / Systems / Premortem',
    colorClass: 'team-card--pattern-d',
    agents: [
      { id: 'hack-t10-strategist', role: 'Strategist' },
      { id: 'hack-t10-systems', role: 'Systems' },
      { id: 'hack-t10-premortem', role: 'Premortem' },
    ],
    coordinator: 'hack-t10-strategist',
  },
];

const PHASES: { key: Phase; label: string }[] = [
  { key: 'debate', label: 'Debate' },
  { key: 'plan', label: 'Plan' },
  { key: 'execute', label: 'Execute' },
  { key: 'proof', label: 'Proof' },
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

  // Subscribe to teams RTDB data
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

  // Subscribe to agent statuses for avatar dots
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
          10 teams working in real-time -- 3 active per batch
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
              <h3 className="team-detail__title">{team.name}</h3>
              <span className="team-detail__pattern">Pattern {team.pattern}: {team.patternLabel}</span>
            </div>

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
                >
                  <span className="team-detail__phase-dot" aria-hidden="true" />
                  <span>{phase.label}</span>
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
                    : `Working on ${data.currentPhase} artifact -- H-${String(data.currentHour).padStart(3, '0')}`}
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
                aria-label={`${team.name} - Pattern ${team.pattern} - ${data.currentPhase === 'idle' ? 'idle' : `phase: ${data.currentPhase}`}`}
              >
                <div className="team-card__top">
                  <span className="team-card__name">{team.name}</span>
                  {data.batchActive && (
                    <span className="team-card__batch-badge" aria-label="Active in current batch">LIVE</span>
                  )}
                </div>

                <span className="team-card__pattern">Pattern {team.pattern}</span>

                {/* Agent avatars */}
                <div className="team-card__agents">
                  {team.agents.map((agent) => (
                    <div key={agent.id} className="team-card__agent" title={`${agent.role} (${agent.id})`}>
                      <span className={`team-agent-dot ${agentStatusDotClass(agent.id, agentStatuses)}`} aria-hidden="true" />
                      <span className="team-card__agent-role">{agent.role}</span>
                    </div>
                  ))}
                </div>

                {/* Phase progress */}
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
                    >
                      <span className="team-card__phase-bar" />
                      <span className="team-card__phase-label">{phase.label}</span>
                    </div>
                  ))}
                </div>

                {/* Hour + coordinator */}
                <div className="team-card__footer">
                  <span className="team-card__hour">
                    {data.currentHour > 0 ? `H-${String(data.currentHour).padStart(3, '0')}` : '--'}
                  </span>
                  <span className="team-card__coordinator" title={`Coordinator: ${team.coordinator}`}>
                    {team.coordinator.split('-').pop()}
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
