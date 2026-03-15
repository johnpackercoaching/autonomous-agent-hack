import { useEffect, useState, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import './LiveViewPage.css';

// ──────────────────────────────────────────────────────
// Live View — Mission Control: 10 Teams
// Real-time RTDB data, big readable cards
// ──────────────────────────────────────────────────────

interface TeamDef {
  id: string;
  code: string;
  name: string;
  agents: string[];
  accent: string;
  accentDim: string;
}

const TEAMS: TeamDef[] = [
  { id: 't01', code: 'T01', name: 'First Light',  agents: ['Feynman', 'Rams', 'Sun Tzu'],       accent: '#f0a000', accentDim: 'rgba(240,160,0,0.15)' },
  { id: 't02', code: 'T02', name: 'Grain',        agents: ['Eames', 'Noguchi', 'Taleb'],         accent: '#ff3369', accentDim: 'rgba(255,51,105,0.15)' },
  { id: 't03', code: 'T03', name: 'Terraform',    agents: ['Meadows', 'Maathai', 'Grove'],       accent: '#10b981', accentDim: 'rgba(16,185,129,0.15)' },
  { id: 't04', code: 'T04', name: 'Parallax',     agents: ['Lovelace', 'Norman', 'Chanel'],      accent: '#a78bfa', accentDim: 'rgba(167,139,250,0.15)' },
  { id: 't05', code: 'T05', name: 'Signal Fire',  agents: ['Curie', 'Fuller', 'Catmull'],        accent: '#ef4444', accentDim: 'rgba(239,68,68,0.15)' },
  { id: 't06', code: 'T06', name: 'Groundwork',   agents: ['Jacobs', 'Aristotle', 'Tubman'],     accent: '#71b2f4', accentDim: 'rgba(113,178,244,0.15)' },
  { id: 't07', code: 'T07', name: 'Threshold',    agents: ['Shannon', 'Matsushita', 'Abloh'],    accent: '#fbbf24', accentDim: 'rgba(251,191,36,0.15)' },
  { id: 't08', code: 'T08', name: 'Undertow',     agents: ['Feynman-E', 'Eames-P', 'Grove-O'],   accent: '#1c469c', accentDim: 'rgba(28,70,156,0.15)' },
  { id: 't09', code: 'T09', name: 'Meridian',     agents: ['Meadows-M', 'Rams-F', 'Taleb-A'],    accent: '#f97316', accentDim: 'rgba(249,115,22,0.15)' },
  { id: 't10', code: 'T10', name: 'Sightline',    agents: ['Lovelace-V', 'Noguchi-C', 'Tubman-M'], accent: '#06b6d4', accentDim: 'rgba(6,182,212,0.15)' },
];

interface TerminalLine {
  text: string;
  time: string;
  type: 'phase' | 'agent' | 'output' | 'success' | 'error' | 'info';
}

interface FileEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  size?: number;
  additions?: number;
  deletions?: number;
}

interface TeamState {
  status: 'active' | 'idle' | 'completed';
  phase: string;
  hour: number;
  terminal: TerminalLine[];
  files: FileEntry[];
  problem?: string;
  score?: number;
  prototypeUrl?: string;
}

// ── Terminal Panel ──

function TerminalPanel({ terminal, accent, status }: { terminal: TerminalLine[]; accent: string; status: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminal]);

  const lineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'phase': return accent;
      case 'agent': return '#71b2f4';
      case 'output': return 'rgba(255,255,255,0.65)';
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'info': return '#a78bfa';
    }
  };

  if (!terminal || terminal.length === 0) {
    return (
      <div className="lv-terminal">
        <div className="lv-panel-label">
          <span>Terminal</span>
        </div>
        <div className="lv-terminal-body lv-terminal-empty">
          <span className="lv-waiting" style={{ color: accent }}>
            {status === 'idle' ? 'Waiting to start...' : 'No output yet'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-terminal">
      <div className="lv-panel-label">
        <span>Terminal</span>
        <span className="lv-line-count">{terminal.length} lines</span>
      </div>
      <div className="lv-terminal-body" ref={scrollRef}>
        {terminal.map((line, i) => (
          <div key={i} className="lv-term-line">
            <span className="lv-term-time">{line.time}</span>
            <span className="lv-term-text" style={{ color: lineColor(line.type) }}>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Files Panel ──

function FilesPanel({ files, accent }: { files: FileEntry[]; accent: string }) {
  if (!files || files.length === 0) {
    return (
      <div className="lv-files-panel">
        <div className="lv-panel-label"><span>Artifacts</span></div>
        <div className="lv-files-body lv-files-empty">
          <span className="lv-waiting">No files yet</span>
        </div>
      </div>
    );
  }

  const added = files.filter(f => f.status === 'added').length;

  return (
    <div className="lv-files-panel">
      <div className="lv-panel-label">
        <span>Artifacts</span>
        <span className="lv-file-count" style={{ color: accent }}>{added} files</span>
      </div>
      <div className="lv-files-body">
        {files.map((f, i) => (
          <div key={i} className="lv-file-row">
            <span className="lv-file-icon" style={{ color: accent }}>+</span>
            <span className="lv-file-path">{f.path}</span>
            {f.size ? <span className="lv-file-size">{(f.size / 1024).toFixed(1)}KB</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Prototype Preview ──

function PreviewPanel({ prototypeUrl, accent, teamName }: { prototypeUrl?: string; accent: string; teamName: string }) {
  if (!prototypeUrl) {
    return (
      <div className="lv-preview-panel">
        <div className="lv-panel-label"><span>Prototype</span></div>
        <div className="lv-preview-body lv-preview-empty">
          <span className="lv-waiting">No prototype yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-preview-panel">
      <div className="lv-panel-label">
        <span>Prototype</span>
        <a href={prototypeUrl} target="_blank" rel="noopener noreferrer" className="lv-preview-open" style={{ color: accent }}>
          Open
        </a>
      </div>
      <div className="lv-preview-body">
        <iframe
          src={prototypeUrl}
          title={`${teamName} prototype`}
          className="lv-preview-iframe"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}

// ── Team Card ──

function TeamCard({ team, state }: { team: TeamDef; state: TeamState }) {
  const statusLabel = state.status === 'active' ? 'RUNNING' : state.status === 'idle' ? 'IDLE' : 'DONE';

  return (
    <div className={`lv-card lv-card--${state.status}`} style={{ '--team-accent': team.accent, '--team-accent-dim': team.accentDim } as React.CSSProperties}>
      {/* Title bar */}
      <div className="lv-titlebar">
        <div className="lv-title-left">
          <span className="lv-team-code" style={{ color: team.accent }}>{team.code}</span>
          <span className="lv-team-name">{team.name}</span>
          {state.problem && <span className="lv-team-problem">{state.problem}</span>}
        </div>
        <div className="lv-title-right">
          {state.hour > 0 && <span className="lv-hour-badge">H{state.hour}</span>}
          {state.score && <span className="lv-score-badge" style={{ color: team.accent, background: team.accentDim }}>{state.score}/10</span>}
          <span className={`lv-status-badge lv-status-badge--${state.status}`} style={state.status !== 'idle' ? { background: team.accentDim, color: team.accent, borderColor: team.accent } : undefined}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Three-panel layout: Terminal + Files + Prototype Preview */}
      <div className={`lv-panels ${state.prototypeUrl ? 'lv-panels--with-preview' : ''}`}>
        <TerminalPanel terminal={state.terminal} accent={team.accent} status={state.status} />
        <FilesPanel files={state.files} accent={team.accent} />
        {(state.prototypeUrl || state.status !== 'idle') && (
          <PreviewPanel prototypeUrl={state.prototypeUrl} accent={team.accent} teamName={team.name} />
        )}
      </div>
    </div>
  );
}

// ── Live View Page ──

export function LiveViewPage() {
  const [teamStates, setTeamStates] = useState<Record<string, TeamState>>(() => {
    const initial: Record<string, TeamState> = {};
    TEAMS.forEach((team) => {
      initial[team.id] = {
        status: 'idle',
        phase: 'Waiting',
        hour: 0,
        terminal: [],
        files: [],
      };
    });
    return initial;
  });

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    try {
      // Listen for hour data (terminal, files, etc.)
      const hoursRef = ref(rtdb, 'hackathon/hours');
      unsubs.push(onValue(hoursRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        setTeamStates(prev => {
          const next = { ...prev };
          Object.keys(data).forEach(hourKey => {
            const hd = data[hourKey];
            if (!hd?.teams) return;
            Object.keys(hd.teams).forEach(teamId => {
              const td = hd.teams[teamId];
              if (!next[teamId]) return;
              // Convert terminal from RTDB (may be object with numeric keys)
              let terminal = td.terminal || [];
              if (terminal && !Array.isArray(terminal)) {
                terminal = Object.values(terminal);
              }
              // Convert files from RTDB
              let files = td.files || [];
              if (files && !Array.isArray(files)) {
                files = Object.values(files);
              }
              next[teamId] = {
                ...next[teamId],
                hour: parseInt(hourKey.replace('hour', ''), 10) || next[teamId].hour,
                phase: td.phase || next[teamId].phase,
                status: td.status || next[teamId].status,
                terminal: terminal.length > 0 ? terminal : next[teamId].terminal,
                files: files.length > 0 ? files : next[teamId].files,
                problem: td.problem || next[teamId].problem,
                score: td.score || next[teamId].score,
              };
            });
          });
          return next;
        });
      }, { onlyOnce: false }));

      // Listen for team metadata
      const teamsRef = ref(rtdb, 'teams');
      unsubs.push(onValue(teamsRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        setTeamStates(prev => {
          const next = { ...prev };
          Object.keys(data).forEach(teamId => {
            const td = data[teamId];
            if (!next[teamId] || !td) return;
            next[teamId] = {
              ...next[teamId],
              status: td.status || next[teamId].status,
              phase: td.currentPhase || next[teamId].phase,
              hour: td.hour || next[teamId].hour,
              problem: td.problem || next[teamId].problem,
              score: td.score || next[teamId].score,
            };
          });
          return next;
        });
      }, { onlyOnce: false }));
    } catch {
      // Firebase not configured
    }

    return () => unsubs.forEach(u => u());
  }, []);

  const activeCount = Object.values(teamStates).filter(s => s.status === 'active').length;
  const doneCount = Object.values(teamStates).filter(s => s.status === 'completed').length;

  return (
    <div className="lv-page">
      <div className="lv-page-header">
        <div>
          <h2 className="lv-page-title">Live View</h2>
          <span className="lv-page-subtitle">
            {activeCount} running, {doneCount} completed, {10 - activeCount - doneCount} idle
          </span>
        </div>
        <span className="lv-live-indicator">
          <span className="lv-live-dot-big" />
          LIVE
        </span>
      </div>

      <div className="lv-grid">
        {TEAMS.map((team) => (
          <TeamCard key={team.id} team={team} state={teamStates[team.id]} />
        ))}
      </div>
    </div>
  );
}

export default LiveViewPage;
