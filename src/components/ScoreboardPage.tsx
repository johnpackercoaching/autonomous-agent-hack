import { useEffect, useState, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import './ScoreboardPage.css';

// ── Types ──
interface TeamScores {
  strategicFit: number;
  impactEvidence: number;
  feasibility: number;
  documentation: number;
  execution: number;
  originality: number;
}

interface ScoreboardEntry {
  teamId: string;
  teamName: string;
  pattern: string;
  scores: TeamScores;
  weightedTotal: number;
  gateStatus: 'green' | 'amber' | 'red' | 'none';
}

type ScoreboardData = Record<string, Omit<ScoreboardEntry, 'teamId'>>;

// ── Weight config ──
const WEIGHTS = {
  strategicFit: 0.20,
  impactEvidence: 0.25,
  feasibility: 0.15,
  documentation: 0.15,
  execution: 0.15,
  originality: 0.10,
};

const SCORE_COLUMNS: { key: keyof TeamScores; label: string; weight: string }[] = [
  { key: 'strategicFit', label: 'Strategic Fit', weight: '20%' },
  { key: 'impactEvidence', label: 'Impact Evidence', weight: '25%' },
  { key: 'feasibility', label: 'Feasibility', weight: '15%' },
  { key: 'documentation', label: 'Documentation', weight: '15%' },
  { key: 'execution', label: 'Execution', weight: '15%' },
  { key: 'originality', label: 'Originality', weight: '10%' },
];

// Default team mapping for when no RTDB data exists
const DEFAULT_TEAMS: { id: string; name: string; pattern: string }[] = [
  { id: 'T01', name: 'Team 01', pattern: 'A' },
  { id: 'T02', name: 'Team 02', pattern: 'A' },
  { id: 'T03', name: 'Team 03', pattern: 'A' },
  { id: 'T04', name: 'Team 04', pattern: 'B' },
  { id: 'T05', name: 'Team 05', pattern: 'B' },
  { id: 'T06', name: 'Team 06', pattern: 'B' },
  { id: 'T07', name: 'Team 07', pattern: 'C' },
  { id: 'T08', name: 'Team 08', pattern: 'C' },
  { id: 'T09', name: 'Team 09', pattern: 'D' },
  { id: 'T10', name: 'Team 10', pattern: 'D' },
];

const EMPTY_SCORES: TeamScores = {
  strategicFit: 0,
  impactEvidence: 0,
  feasibility: 0,
  documentation: 0,
  execution: 0,
  originality: 0,
};

function computeWeightedTotal(scores: TeamScores): number {
  return (
    scores.strategicFit * WEIGHTS.strategicFit +
    scores.impactEvidence * WEIGHTS.impactEvidence +
    scores.feasibility * WEIGHTS.feasibility +
    scores.documentation * WEIGHTS.documentation +
    scores.execution * WEIGHTS.execution +
    scores.originality * WEIGHTS.originality
  );
}

function gateClass(status: string): string {
  switch (status) {
    case 'green': return 'scoreboard__gate--green';
    case 'amber': return 'scoreboard__gate--amber';
    case 'red': return 'scoreboard__gate--red';
    default: return 'scoreboard__gate--none';
  }
}

function patternBadgeClass(pattern: string): string {
  switch (pattern) {
    case 'A': return 'scoreboard__pattern--a';
    case 'B': return 'scoreboard__pattern--b';
    case 'C': return 'scoreboard__pattern--c';
    case 'D': return 'scoreboard__pattern--d';
    default: return '';
  }
}

export function ScoreboardPage() {
  const [scoreData, setScoreData] = useState<ScoreboardData>({});
  const [summaryStats, setSummaryStats] = useState({ totalHours: 0, totalArtifacts: 0, totalDebates: 0, activeBatch: 0 });
  const prevTotals = useRef<Record<string, number>>({});

  // Subscribe to scoreboard data
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

  // Subscribe to summary stats
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
      return {
        teamId: def.id,
        teamName: data.teamName || def.name,
        pattern: data.pattern || def.pattern,
        scores: data.scores || EMPTY_SCORES,
        weightedTotal: data.weightedTotal ?? computeWeightedTotal(data.scores || EMPTY_SCORES),
        gateStatus: data.gateStatus || 'none',
      };
    }
    return {
      teamId: def.id,
      teamName: def.name,
      pattern: def.pattern,
      scores: EMPTY_SCORES,
      weightedTotal: 0,
      gateStatus: 'none' as const,
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
          Real-time leaderboard across all 10 teams
        </p>
      </div>

      {/* Summary stats */}
      <div className="scoreboard-summary">
        <div className="scoreboard-summary__item">
          <span className="scoreboard-summary__value">{summaryStats.totalHours}</span>
          <span className="scoreboard-summary__label">Hours Completed</span>
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
            <span className="scoreboard-cell scoreboard-cell--pattern" role="columnheader">Pattern</span>
            <span className="scoreboard-cell scoreboard-cell--gate" role="columnheader">Gate</span>
            {SCORE_COLUMNS.map((col) => (
              <span
                key={col.key}
                className="scoreboard-cell scoreboard-cell--score"
                role="columnheader"
                title={`${col.label} (${col.weight})`}
              >
                {col.label}
                <span className="scoreboard-cell__weight">{col.weight}</span>
              </span>
            ))}
            <span className="scoreboard-cell scoreboard-cell--total" role="columnheader">Total</span>
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
                {entry.teamName}
              </span>
              <span className={`scoreboard-cell scoreboard-cell--pattern ${patternBadgeClass(entry.pattern)}`} role="cell">
                {entry.pattern}
              </span>
              <span className="scoreboard-cell scoreboard-cell--gate" role="cell">
                <span
                  className={`scoreboard__gate ${gateClass(entry.gateStatus)}`}
                  aria-label={`Gate status: ${entry.gateStatus}`}
                />
              </span>
              {SCORE_COLUMNS.map((col) => (
                <span
                  key={col.key}
                  className="scoreboard-cell scoreboard-cell--score"
                  role="cell"
                >
                  {entry.scores[col.key].toFixed(1)}
                </span>
              ))}
              <span className="scoreboard-cell scoreboard-cell--total" role="cell">
                {entry.weightedTotal.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScoreboardPage;
