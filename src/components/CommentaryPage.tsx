import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import './CommentaryPage.css';

interface CommentaryEntry {
  audioUrl: string;
  generatedAt: number;
  teamName: string;
  hourNumber: number;
  duration?: number;
  status?: string;
}

interface TeamDef {
  id: string;
  code: string;
  name: string;
  accent: string;
}

const TEAMS: TeamDef[] = [
  { id: 'team_01', code: 'T01', name: 'First Light',  accent: '#f0a000' },
  { id: 'team_02', code: 'T02', name: 'Grain',        accent: '#ff3369' },
  { id: 'team_03', code: 'T03', name: 'Terraform',    accent: '#10b981' },
  { id: 'team_04', code: 'T04', name: 'Parallax',     accent: '#a78bfa' },
  { id: 'team_05', code: 'T05', name: 'Signal Fire',  accent: '#ef4444' },
  { id: 'team_06', code: 'T06', name: 'Groundwork',   accent: '#71b2f4' },
  { id: 'team_07', code: 'T07', name: 'Threshold',    accent: '#fbbf24' },
  { id: 'team_08', code: 'T08', name: 'Undertow',     accent: '#1c469c' },
  { id: 'team_09', code: 'T09', name: 'Meridian',     accent: '#f97316' },
  { id: 'team_10', code: 'T10', name: 'Sightline',    accent: '#06b6d4' },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommentaryPage() {
  const [entries, setEntries] = useState<(CommentaryEntry & { key: string; teamId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAudio, setActiveAudio] = useState<string | null>(null);

  useEffect(() => {
    const commentaryRef = ref(rtdb, 'hackathon/commentary');
    const unsubscribe = onValue(
      commentaryRef,
      (snapshot) => {
        const val = snapshot.val();
        const list: (CommentaryEntry & { key: string; teamId: string })[] = [];
        if (val && typeof val === 'object') {
          for (const teamId of Object.keys(val)) {
            const teamData = val[teamId];
            if (teamData && typeof teamData === 'object') {
              for (const hourId of Object.keys(teamData)) {
                const entry = teamData[hourId] as CommentaryEntry;
                if (entry && entry.audioUrl) {
                  list.push({ ...entry, key: `${teamId}/${hourId}`, teamId });
                }
              }
            }
          }
        }
        list.sort((a, b) => b.generatedAt - a.generatedAt);
        setEntries(list);
        setLoading(false);
      },
      (err) => {
        console.error('Commentary RTDB error:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const getTeam = (teamId: string): TeamDef | undefined =>
    TEAMS.find((t) => t.id === teamId);

  if (loading) {
    return (
      <div className="commentary-page">
        <div className="commentary-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="commentary-page">
      <div className="commentary-header">
        <p className="commentary-label">NotebookLM</p>
        <h2>Audio Commentary</h2>
        <p className="commentary-desc">
          AI-generated podcast-style commentary on each team's hourly output
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="commentary-empty">
          <div className="commentary-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <p className="commentary-empty-text">No commentary episodes yet</p>
          <p className="commentary-empty-hint">
            Commentary is generated after each hour completes.
            Run <code>python scripts/generate-commentary.py --team team_01 --hour 1</code> to generate.
          </p>
        </div>
      ) : (
        <div className="commentary-list">
          {entries.map((entry) => {
            const team = getTeam(entry.teamId);
            const isPlaying = activeAudio === entry.key;
            return (
              <div key={entry.key} className="commentary-episode">
                <div className="commentary-episode-header">
                  <span
                    className="commentary-team-badge"
                    style={{ borderColor: team?.accent || '#666' }}
                  >
                    {team?.code || entry.teamId}
                  </span>
                  <span className="commentary-episode-title">
                    {team?.name || entry.teamName} / Hour {entry.hourNumber}
                  </span>
                  {entry.duration && (
                    <span className="commentary-duration">
                      {formatDuration(entry.duration)}
                    </span>
                  )}
                </div>
                <div className="commentary-player">
                  <audio
                    src={entry.audioUrl}
                    controls
                    preload="none"
                    onPlay={() => setActiveAudio(entry.key)}
                    onPause={() => {
                      if (isPlaying) setActiveAudio(null);
                    }}
                    onEnded={() => {
                      if (isPlaying) setActiveAudio(null);
                    }}
                  />
                </div>
                <div className="commentary-episode-meta">
                  <span className="commentary-date">{formatDate(entry.generatedAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CommentaryPage;
