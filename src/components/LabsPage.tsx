import { useState } from 'react';
import './LabsPage.css';

// ──────────────────────────────────────────────────────
// Labs Page — 10 Team Observation Dashboard Mockups
// Each mockup shows THREE visuals arranged differently:
//   1. Agent Communication View (inter-agent chat)
//   2. File Directory View (file tree with changes)
//   3. Live UI Preview (what agents are building)
// ──────────────────────────────────────────────────────

// ── Shared Mock Data ──
const AGENT_MESSAGES = [
  { from: 'coordinator', to: 'all', text: 'Starting checkpoint review. Each agent report status.', time: '14:32:07', type: 'directive' as const },
  { from: 'specialist-1', to: 'coordinator', text: 'Auth module complete. 12 tests passing. Moving to API integration.', time: '14:32:15', type: 'status' as const },
  { from: 'specialist-2', to: 'specialist-1', text: 'I need the auth token format before I can wire up the dashboard fetch calls.', time: '14:32:28', type: 'request' as const },
  { from: 'specialist-1', to: 'specialist-2', text: 'JWT with { sub, role, exp } claims. Bearer prefix. Sending schema now.', time: '14:32:41', type: 'response' as const },
  { from: 'coordinator', to: 'all', text: 'Good handoff. Specialist-2, prioritize the metrics endpoint next.', time: '14:32:55', type: 'directive' as const },
  { from: 'specialist-2', to: 'coordinator', text: 'Understood. ETA 15 minutes for metrics API + component.', time: '14:33:02', type: 'status' as const },
  { from: 'specialist-1', to: 'all', text: 'Found a race condition in the WebSocket reconnect logic. Fixing now.', time: '14:33:18', type: 'alert' as const },
  { from: 'coordinator', to: 'specialist-1', text: 'Priority fix. Block other work until resolved.', time: '14:33:25', type: 'directive' as const },
];

const FILE_TREE = [
  { path: 'src/', type: 'dir' as const, status: 'unchanged' as const, depth: 0 },
  { path: 'src/App.tsx', type: 'file' as const, status: 'modified' as const, depth: 1, additions: 12, deletions: 3 },
  { path: 'src/auth/', type: 'dir' as const, status: 'unchanged' as const, depth: 1 },
  { path: 'src/auth/login.tsx', type: 'file' as const, status: 'added' as const, depth: 2, additions: 84, deletions: 0 },
  { path: 'src/auth/token.ts', type: 'file' as const, status: 'added' as const, depth: 2, additions: 42, deletions: 0 },
  { path: 'src/auth/guard.tsx', type: 'file' as const, status: 'added' as const, depth: 2, additions: 31, deletions: 0 },
  { path: 'src/api/', type: 'dir' as const, status: 'unchanged' as const, depth: 1 },
  { path: 'src/api/metrics.ts', type: 'file' as const, status: 'modified' as const, depth: 2, additions: 28, deletions: 8 },
  { path: 'src/api/websocket.ts', type: 'file' as const, status: 'modified' as const, depth: 2, additions: 15, deletions: 22 },
  { path: 'src/components/', type: 'dir' as const, status: 'unchanged' as const, depth: 1 },
  { path: 'src/components/Dashboard.tsx', type: 'file' as const, status: 'modified' as const, depth: 2, additions: 56, deletions: 14 },
  { path: 'src/components/MetricsCard.tsx', type: 'file' as const, status: 'added' as const, depth: 2, additions: 67, deletions: 0 },
  { path: 'src/components/Header.tsx', type: 'file' as const, status: 'unchanged' as const, depth: 2, additions: 0, deletions: 0 },
  { path: 'src/styles/', type: 'dir' as const, status: 'unchanged' as const, depth: 1 },
  { path: 'src/styles/dashboard.css', type: 'file' as const, status: 'modified' as const, depth: 2, additions: 34, deletions: 5 },
  { path: 'package.json', type: 'file' as const, status: 'modified' as const, depth: 0, additions: 2, deletions: 1 },
  { path: 'tests/', type: 'dir' as const, status: 'unchanged' as const, depth: 0 },
  { path: 'tests/auth.test.ts', type: 'file' as const, status: 'added' as const, depth: 1, additions: 96, deletions: 0 },
  { path: 'README.md', type: 'file' as const, status: 'deleted' as const, depth: 0, additions: 0, deletions: 45 },
];

// ── Shared Sub-Components ──

function AgentCommPanel({ variant = 'default' }: { variant?: string }) {
  const cls = `comm-panel comm-panel--${variant}`;
  return (
    <div className={cls}>
      <div className="comm-panel__header">
        <span className="comm-panel__title">Agent Communication</span>
        <span className="comm-panel__live-dot" />
      </div>
      <div className="comm-panel__messages">
        {AGENT_MESSAGES.map((msg, i) => (
          <div key={i} className={`comm-msg comm-msg--${msg.type}`}>
            <div className="comm-msg__meta">
              <span className="comm-msg__from">{msg.from}</span>
              <span className="comm-msg__arrow">{'->'}</span>
              <span className="comm-msg__to">{msg.to}</span>
              <span className="comm-msg__time">{msg.time}</span>
            </div>
            <div className="comm-msg__text">{msg.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileTreePanel({ variant = 'default' }: { variant?: string }) {
  const cls = `filetree-panel filetree-panel--${variant}`;
  const totalAdded = FILE_TREE.filter(f => f.status === 'added').length;
  const totalModified = FILE_TREE.filter(f => f.status === 'modified').length;
  const totalDeleted = FILE_TREE.filter(f => f.status === 'deleted').length;

  return (
    <div className={cls}>
      <div className="filetree-panel__header">
        <span className="filetree-panel__title">File Directory</span>
        <div className="filetree-panel__stats">
          <span className="filetree-stat filetree-stat--added">+{totalAdded}</span>
          <span className="filetree-stat filetree-stat--modified">~{totalModified}</span>
          <span className="filetree-stat filetree-stat--deleted">-{totalDeleted}</span>
        </div>
      </div>
      <div className="filetree-panel__tree">
        {FILE_TREE.map((item, i) => (
          <div
            key={i}
            className={`filetree-item filetree-item--${item.type} filetree-item--${item.status}`}
            style={{ paddingLeft: `${item.depth * 16 + 8}px` }}
          >
            <span className="filetree-item__icon">
              {item.type === 'dir' ? (item.status === 'unchanged' ? '\u25B6' : '\u25BC') : '\u2022'}
            </span>
            <span className="filetree-item__name">
              {item.path.split('/').filter(Boolean).pop() || item.path}
            </span>
            {item.type === 'file' && item.status !== 'unchanged' && (
              <span className="filetree-item__diff">
                {item.additions ? <span className="filetree-diff--add">+{item.additions}</span> : null}
                {item.deletions ? <span className="filetree-diff--del">-{item.deletions}</span> : null}
              </span>
            )}
            {item.status !== 'unchanged' && (
              <span className={`filetree-item__badge filetree-badge--${item.status}`}>
                {item.status === 'added' ? 'A' : item.status === 'modified' ? 'M' : item.status === 'deleted' ? 'D' : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LivePreviewPanel({ variant = 'default' }: { variant?: string }) {
  const cls = `preview-panel preview-panel--${variant}`;
  return (
    <div className={cls}>
      <div className="preview-panel__header">
        <span className="preview-panel__title">Live UI Preview</span>
        <span className="preview-panel__url">localhost:5173</span>
      </div>
      <div className="preview-panel__browser-bar">
        <div className="preview-browser__dots">
          <span className="preview-dot preview-dot--red" />
          <span className="preview-dot preview-dot--yellow" />
          <span className="preview-dot preview-dot--green" />
        </div>
        <div className="preview-browser__address">
          https://team-01-app.web.app
        </div>
      </div>
      <div className="preview-panel__canvas">
        {/* Dashboard preview the agents built */}
        <div className="preview-app">
          <div className="preview-app__header">
            <div className="preview-app__logo">TeamApp</div>
            <div className="preview-app__nav">
              <span className="preview-nav-item preview-nav-item--active">Dashboard</span>
              <span className="preview-nav-item">Analytics</span>
              <span className="preview-nav-item">Settings</span>
            </div>
          </div>
          <div className="preview-app__body">
            <div className="preview-app__greeting">Welcome back</div>
            <div className="preview-app__cards">
              <div className="preview-app__card">
                <div className="preview-card__label">Users</div>
                <div className="preview-card__value">1,247</div>
                <div className="preview-card__bar"><div className="preview-card__fill" style={{ width: '72%' }} /></div>
              </div>
              <div className="preview-app__card">
                <div className="preview-card__label">Revenue</div>
                <div className="preview-card__value">$48.2k</div>
                <div className="preview-card__bar"><div className="preview-card__fill" style={{ width: '85%' }} /></div>
              </div>
              <div className="preview-app__card">
                <div className="preview-card__label">Tasks</div>
                <div className="preview-card__value">342</div>
                <div className="preview-card__bar"><div className="preview-card__fill" style={{ width: '58%' }} /></div>
              </div>
            </div>
            <div className="preview-app__chart">
              <div className="preview-chart__title">Activity</div>
              <div className="preview-chart__bars">
                {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 68].map((h, i) => (
                  <div key={i} className="preview-chart__bar" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── 10 Mockup Layouts ──

function Mockup1_Triptych() {
  return (
    <div className="m1-triptych">
      <AgentCommPanel variant="triptych" />
      <FileTreePanel variant="triptych" />
      <LivePreviewPanel variant="triptych" />
    </div>
  );
}

function Mockup2_TabbedFocus() {
  const [activeTab, setActiveTab] = useState<'comm' | 'files' | 'preview'>('comm');

  return (
    <div className="m2-tabbed">
      <div className="m2-tabbed__tabs">
        <button
          type="button"
          className={`m2-tab ${activeTab === 'comm' ? 'm2-tab--active' : ''}`}
          onClick={() => setActiveTab('comm')}
        >
          Agent Communication
        </button>
        <button
          type="button"
          className={`m2-tab ${activeTab === 'files' ? 'm2-tab--active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          File Directory
        </button>
        <button
          type="button"
          className={`m2-tab ${activeTab === 'preview' ? 'm2-tab--active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Live Preview
        </button>
      </div>
      <div className="m2-tabbed__content">
        {activeTab === 'comm' && <AgentCommPanel variant="tabbed" />}
        {activeTab === 'files' && <FileTreePanel variant="tabbed" />}
        {activeTab === 'preview' && <LivePreviewPanel variant="tabbed" />}
      </div>
    </div>
  );
}

function Mockup3_AsymmetricSplit() {
  return (
    <div className="m3-asymmetric">
      <div className="m3-asymmetric__main">
        <LivePreviewPanel variant="asymmetric" />
      </div>
      <div className="m3-asymmetric__sidebar">
        <AgentCommPanel variant="asymmetric" />
        <FileTreePanel variant="asymmetric" />
      </div>
    </div>
  );
}

function Mockup4_StackedRows() {
  return (
    <div className="m4-stacked">
      <AgentCommPanel variant="stacked" />
      <FileTreePanel variant="stacked" />
      <LivePreviewPanel variant="stacked" />
    </div>
  );
}

function Mockup5_LShape() {
  return (
    <div className="m5-lshape">
      <div className="m5-lshape__top">
        <LivePreviewPanel variant="lshape" />
      </div>
      <div className="m5-lshape__bottom">
        <AgentCommPanel variant="lshape" />
        <FileTreePanel variant="lshape" />
      </div>
    </div>
  );
}

function Mockup6_Terminal() {
  return (
    <div className="m6-terminal">
      <div className="m6-terminal__topbar">
        <span>TEAM OBSERVATION TERMINAL</span>
        <span className="m6-terminal__session">session: t01-checkpoint-18</span>
      </div>
      <div className="m6-terminal__panes">
        <AgentCommPanel variant="terminal" />
        <FileTreePanel variant="terminal" />
        <LivePreviewPanel variant="terminal" />
      </div>
    </div>
  );
}

function Mockup7_FloatingCards() {
  return (
    <div className="m7-floating">
      <div className="m7-floating__card m7-floating__card--comm">
        <AgentCommPanel variant="floating" />
      </div>
      <div className="m7-floating__card m7-floating__card--files">
        <FileTreePanel variant="floating" />
      </div>
      <div className="m7-floating__card m7-floating__card--preview">
        <LivePreviewPanel variant="floating" />
      </div>
    </div>
  );
}

function Mockup8_CommandBridge() {
  return (
    <div className="m8-bridge">
      <div className="m8-bridge__left">
        <FileTreePanel variant="bridge" />
      </div>
      <div className="m8-bridge__center">
        <LivePreviewPanel variant="bridge" />
      </div>
      <div className="m8-bridge__right">
        <AgentCommPanel variant="bridge" />
      </div>
    </div>
  );
}

function Mockup9_MinimalZen() {
  return (
    <div className="m9-zen">
      <div className="m9-zen__label">Team Observation</div>
      <div className="m9-zen__panels">
        <AgentCommPanel variant="zen" />
        <div className="m9-zen__divider" />
        <FileTreePanel variant="zen" />
        <div className="m9-zen__divider" />
        <LivePreviewPanel variant="zen" />
      </div>
    </div>
  );
}

function Mockup10_PaulRand() {
  return (
    <div className="m10-rand">
      <div className="m10-rand__shapes">
        <div className="m10-rand__shape m10-rand__shape--circle" />
        <div className="m10-rand__shape m10-rand__shape--rect" />
        <div className="m10-rand__shape m10-rand__shape--triangle" />
      </div>
      <div className="m10-rand__content">
        <div className="m10-rand__panel m10-rand__panel--comm">
          <AgentCommPanel variant="rand" />
        </div>
        <div className="m10-rand__panel m10-rand__panel--files">
          <FileTreePanel variant="rand" />
        </div>
        <div className="m10-rand__panel m10-rand__panel--preview">
          <LivePreviewPanel variant="rand" />
        </div>
      </div>
      <div className="m10-rand__tagline">
        observe -- evaluate -- iterate
      </div>
    </div>
  );
}


// ── Mockup Registry ──

const MOCKUPS: { id: string; title: string; angle: string; Component: React.FC }[] = [
  {
    id: 'triptych',
    title: '01 -- Triptych',
    angle: 'Three equal columns, balanced hierarchy, clean separation',
    Component: Mockup1_Triptych,
  },
  {
    id: 'tabbed-focus',
    title: '02 -- Tabbed Focus',
    angle: 'One panel at a time, tab navigation, decluttered observation',
    Component: Mockup2_TabbedFocus,
  },
  {
    id: 'asymmetric-split',
    title: '03 -- Asymmetric Split',
    angle: 'Preview-dominant left panel, comms + files stacked right',
    Component: Mockup3_AsymmetricSplit,
  },
  {
    id: 'stacked-rows',
    title: '04 -- Stacked Rows',
    angle: 'Full-width horizontal rows, mobile-first, scrollable',
    Component: Mockup4_StackedRows,
  },
  {
    id: 'l-shape',
    title: '05 -- L-Shape Grid',
    angle: 'Preview spans top, comms + files split bottom, newspaper grid',
    Component: Mockup5_LShape,
  },
  {
    id: 'terminal',
    title: '06 -- Terminal',
    angle: 'CLI aesthetic, monospace, dark panes, hacker observation deck',
    Component: Mockup6_Terminal,
  },
  {
    id: 'floating-cards',
    title: '07 -- Floating Cards',
    angle: 'Overlapping cards with depth, shadows, dimensional layers',
    Component: Mockup7_FloatingCards,
  },
  {
    id: 'command-bridge',
    title: '08 -- Command Bridge',
    angle: 'IDE layout: files left, preview center, comms right',
    Component: Mockup8_CommandBridge,
  },
  {
    id: 'minimal-zen',
    title: '09 -- Minimal Zen',
    angle: 'Extreme minimalism, whisper type, abundant whitespace',
    Component: Mockup9_MinimalZen,
  },
  {
    id: 'paul-rand',
    title: '10 -- Paul Rand',
    angle: 'Geometric shapes, primary colors on black, playful conviction',
    Component: Mockup10_PaulRand,
  },
];

export function LabsPage() {
  return (
    <div className="labs-page" role="region" aria-label="Design Labs">
      <div className="labs-header">
        <h2>Labs</h2>
        <p>
          Ten layout explorations for the team observation dashboard. Each mockup
          shows the same three views -- agent communication, file directory, and
          live UI preview -- arranged with a different design philosophy and
          information hierarchy. These are the visuals reported to judges at each
          hourly checkpoint.
        </p>
      </div>

      <div className="labs-grid">
        {MOCKUPS.map(({ id, title, angle, Component }) => (
          <div key={id} className="mockup-frame" id={`mockup-${id}`}>
            <div className="mockup-label">
              <span className="mockup-label__title">{title}</span>
              <span className="mockup-label__badge">{angle}</span>
            </div>
            <div className="mockup-body">
              <Component />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LabsPage;
