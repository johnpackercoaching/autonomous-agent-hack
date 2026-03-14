import { useEffect, useState, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import './ScoreboardPage.css';

// ── Types ──
interface TeamScores {
  strategicLockIn: number;
  revenueMechanism: number;
  userImpact: number;
  lastMileProof: number;
  enterpriseReadiness: number;
  craftFinish: number;
}

interface ScoreboardEntry {
  teamId: string;
  teamName: string;
  scores: TeamScores;
  weightedTotal: number;
  scoringGuide: string;
}

type ScoreboardData = Record<string, Omit<ScoreboardEntry, 'teamId'>>;

// ── Weight config -- matches judging rubric ──
const WEIGHTS = {
  strategicLockIn: 0.25,
  revenueMechanism: 0.20,
  userImpact: 0.20,
  lastMileProof: 0.15,
  enterpriseReadiness: 0.10,
  craftFinish: 0.10,
};

const SCORE_COLUMNS: { key: keyof TeamScores; label: string; weight: string; description: string }[] = [
  {
    key: 'strategicLockIn',
    label: 'Strategic Lock-In',
    weight: '25%',
    description: 'Creates switching costs competitors cannot replicate. Infrastructure, not appware.',
  },
  {
    key: 'revenueMechanism',
    label: 'Revenue Mechanism',
    weight: '20%',
    description: 'Clear path to monetization. New buyer persona? Expansion driver?',
  },
  {
    key: 'userImpact',
    label: 'User Impact',
    weight: '20%',
    description: 'Real user gets measurably better at their job. Pain point users have actually articulated.',
  },
  {
    key: 'lastMileProof',
    label: 'Last Mile Proof',
    weight: '15%',
    description: 'Proves platform + agents = outcomes neither achieves alone. Documented processes + agents = measurable enterprise value.',
  },
  {
    key: 'enterpriseReadiness',
    label: 'Enterprise Ready',
    weight: '10%',
    description: 'Governance, permissions, audit trail, compliance. CISO-approvable. Data boundary respect.',
  },
  {
    key: 'craftFinish',
    label: 'Craft & Finish',
    weight: '10%',
    description: 'Does it work? Demo polished? One thing finished > five things half-built.',
  },
];

// ── Scoring guide thresholds ──
function scoringGuide(total: number): string {
  if (total >= 9) return 'Fund within 90 days';
  if (total >= 7) return 'Strong -- needs refinement';
  if (total >= 5) return 'Interesting but no needle moved';
  if (total >= 3) return 'Technically works, strategically disconnected';
  if (total > 0) return 'Does not ship or does not matter';
  return 'Not scored';
}

// Default team mapping
const DEFAULT_TEAMS: { id: string; name: string }[] = [
  { id: 'T01', name: 'First Light' },
  { id: 'T02', name: 'Grain' },
  { id: 'T03', name: 'Terraform' },
  { id: 'T04', name: 'Parallax' },
  { id: 'T05', name: 'Signal Fire' },
  { id: 'T06', name: 'Groundwork' },
  { id: 'T07', name: 'Threshold' },
  { id: 'T08', name: 'Undertow' },
  { id: 'T09', name: 'Meridian' },
  { id: 'T10', name: 'Sightline' },
];

const EMPTY_SCORES: TeamScores = {
  strategicLockIn: 0,
  revenueMechanism: 0,
  userImpact: 0,
  lastMileProof: 0,
  enterpriseReadiness: 0,
  craftFinish: 0,
};

function computeWeightedTotal(scores: TeamScores): number {
  return (
    scores.strategicLockIn * WEIGHTS.strategicLockIn +
    scores.revenueMechanism * WEIGHTS.revenueMechanism +
    scores.userImpact * WEIGHTS.userImpact +
    scores.lastMileProof * WEIGHTS.lastMileProof +
    scores.enterpriseReadiness * WEIGHTS.enterpriseReadiness +
    scores.craftFinish * WEIGHTS.craftFinish
  );
}

function scoreColor(score: number): string {
  if (score >= 9) return 'scoreboard__score--excellent';
  if (score >= 7) return 'scoreboard__score--strong';
  if (score >= 5) return 'scoreboard__score--moderate';
  if (score >= 3) return 'scoreboard__score--weak';
  if (score > 0) return 'scoreboard__score--poor';
  return '';
}

export function ScoreboardPage() {
  const [scoreData, setScoreData] = useState<ScoreboardData>({});
  const [summaryStats, setSummaryStats] = useState({ totalHours: 0, totalArtifacts: 0, totalDebates: 0, activeBatch: 0 });
  const prevTotals = useRef<Record<string, number>>({});

  useEffect(() => {
    const scoreRef = ref(rtdb, 'scoreboard');
    const unsubscribe = onValue(
      scoreRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setScoreData(snapshot.val() as ScoreboardData);
        }
      },
      (err) => {
        console.error('Scoreboard RTDB listener error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const teamsRef = ref(rtdb, 'teams');
    const unsubscribe = onValue(
      teamsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, { currentHour?: number; batchActive?: boolean; activity?: Record<string, unknown> }>;
          let totalHours = 0;
          let totalArtifacts = 0;
          let totalDebates = 0;
          let activeBatch = 0;

          Object.values(data).forEach((team) => {
            if (team.currentHour) totalHours += team.currentHour;
            if (team.batchActive) activeBatch++;
            if (team.activity) {
              const activities = Object.values(team.activity) as { type?: string }[];
              totalArtifacts += activities.length;
              totalDebates += activities.filter((a) => a.type === 'debate' || a.type === 'dissent').length;
            }
          });

          setSummaryStats({ totalHours, totalArtifacts, totalDebates, activeBatch });
        }
      },
      (err) => {
        console.error('Summary stats RTDB listener error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Build sorted entries
  const entries: ScoreboardEntry[] = DEFAULT_TEAMS.map((def) => {
    const data = scoreData[def.id];
    if (data) {
      const scores = data.scores || EMPTY_SCORES;
      const total = data.weightedTotal ?? computeWeightedTotal(scores);
      return {
        teamId: def.id,
        teamName: data.teamName || def.name,
        scores,
        weightedTotal: total,
        scoringGuide: scoringGuide(total),
      };
    }
    return {
      teamId: def.id,
      teamName: def.name,
      scores: EMPTY_SCORES,
      weightedTotal: 0,
      scoringGuide: 'Not scored',
    };
  }).sort((a, b) => b.weightedTotal - a.weightedTotal);

  // Track which scores changed for animation
  const changedTeams = new Set<string>();
  entries.forEach((entry) => {
    const prev = prevTotals.current[entry.teamId];
    if (prev !== undefined && prev !== entry.weightedTotal) {
      changedTeams.add(entry.teamId);
    }
    prevTotals.current[entry.teamId] = entry.weightedTotal;
  });

  const hasAnyScores = entries.some((e) => e.weightedTotal > 0);

  return (
    <div className="scoreboard-page" role="region" aria-label="Hackathon Scoreboard">
      <div className="scoreboard-header">
        <h2>Scoreboard</h2>
        <p className="scoreboard-subtitle">
          Real-time leaderboard -- 200-hour hackathon -- 6 weighted criteria
        </p>
      </div>

      {/* Scoring guide legend */}
      <div className="scoreboard-legend">
        <span className="scoreboard-legend__item"><strong>9-10:</strong> Fund within 90 days</span>
        <span className="scoreboard-legend__item"><strong>7-8:</strong> Strong, needs refinement</span>
        <span className="scoreboard-legend__item"><strong>5-6:</strong> Interesting, no needle moved</span>
        <span className="scoreboard-legend__item"><strong>3-4:</strong> Works but disconnected</span>
        <span className="scoreboard-legend__item"><strong>1-2:</strong> Does not ship or matter</span>
      </div>

      {/* Summary stats */}
      <div className="scoreboard-summary">
        <div className="scoreboard-summary__item">
          <span className="scoreboard-summary__value">{summaryStats.totalHours}</span>
          <span className="scoreboard-summary__label">Hours Completed (of 2,000)</span>
        </div>
        <div className="scoreboard-summary__item">
          <span className="scoreboard-summary__value">{summaryStats.totalArtifacts}</span>
          <span className="scoreboard-summary__label">Artifacts Produced</span>
        </div>
        <div className="scoreboard-summary__item">
          <span className="scoreboard-summary__value">{summaryStats.totalDebates}</span>
          <span className="scoreboard-summary__label">Debates</span>
        </div>
        <div className="scoreboard-summary__item">
          <span className="scoreboard-summary__value">{summaryStats.activeBatch}</span>
          <span className="scoreboard-summary__label">Active Batch</span>
        </div>
      </div>

      {!hasAnyScores && (
        <div className="scoreboard-awaiting">
          Awaiting first scores -- the hackathon has not produced scored results yet.
        </div>
      )}

      {/* Table */}
      <div className="scoreboard-table-wrap" role="table" aria-label="Team scores">
        <div className="scoreboard-table">
          {/* Header */}
          <div className="scoreboard-row scoreboard-row--header" role="row">
            <span className="scoreboard-cell scoreboard-cell--rank" role="columnheader">Rank</span>
            <span className="scoreboard-cell scoreboard-cell--team" role="columnheader">Team</span>
            {SCORE_COLUMNS.map((col) => (
              <span
                key={col.key}
                className="scoreboard-cell scoreboard-cell--score"
                role="columnheader"
                title={col.description}
              >
                {col.label}
                <span className="scoreboard-cell__weight">{col.weight}</span>
              </span>
            ))}
            <span className="scoreboard-cell scoreboard-cell--total" role="columnheader">Total</span>
            <span className="scoreboard-cell scoreboard-cell--guide" role="columnheader">Rating</span>
          </div>

          {/* Rows */}
          {entries.map((entry, idx) => (
            <div
              key={entry.teamId}
              className={`scoreboard-row ${changedTeams.has(entry.teamId) ? 'scoreboard-row--updated' : ''} ${idx === 0 && entry.weightedTotal > 0 ? 'scoreboard-row--leader' : ''}`}
              role="row"
            >
              <span className="scoreboard-cell scoreboard-cell--rank" role="cell">
                {idx + 1}
              </span>
              <span className="scoreboard-cell scoreboard-cell--team" role="cell">
                <span className="scoreboard__team-id">{entry.teamId}</span>
                <span className="scoreboard__team-name">{entry.teamName}</span>
              </span>
              {SCORE_COLUMNS.map((col) => (
                <span
                  key={col.key}
                  className={`scoreboard-cell scoreboard-cell--score ${scoreColor(entry.scores[col.key])}`}
                  role="cell"
                  title={`${col.label}: ${entry.scores[col.key].toFixed(1)} (${col.weight})`}
                >
                  {entry.scores[col.key].toFixed(1)}
                </span>
              ))}
              <span className="scoreboard-cell scoreboard-cell--total" role="cell">
                {entry.weightedTotal.toFixed(2)}
              </span>
              <span className="scoreboard-cell scoreboard-cell--guide" role="cell">
                {entry.scoringGuide}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Anti-patterns reminder */}
      <div className="scoreboard-antipatterns">
        <h4>What Scores Low</h4>
        <ul>
          <li>Technical novelty for its own sake</li>
          <li>Breadth over depth -- five features half-built loses to one finished</li>
          <li>AI wrapper -- agent that just calls an LLM and formats output</li>
          <li>No connection to a documented gap or user pain point</li>
          <li>Could be built on any platform -- not strategically differentiated</li>
          <li>Speed of generation over governance -- fast but ungovernable</li>
        </ul>
      </div>
    </div>
  );
}

export default ScoreboardPage;
