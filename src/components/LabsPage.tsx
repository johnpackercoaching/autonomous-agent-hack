import './LabsPage.css';

// ──────────────────────────────────────────────────────
// Labs Page — 10 Dashboard Mockup Explorations
// Each mockup is a self-contained vision for the hackathon dashboard.
// Design philosophy: Paul Rand — form and content are one.
// ──────────────────────────────────────────────────────

function Mockup1_CommandCenter() {
  const agents = [
    { name: 'hack-leader', status: 'active' as const, label: 'coordinating' },
    { name: 'hack-t01-architect', status: 'active' as const, label: 'designing' },
    { name: 'hack-t01-builder', status: 'active' as const, label: 'executing' },
    { name: 'hack-t02-coord', status: 'idle' as const, label: 'standby' },
    { name: 'hack-t03-strategist', status: 'idle' as const, label: 'standby' },
    { name: 'hack-judge-quality', status: 'error' as const, label: 'timeout' },
    { name: 'hack-t04-builder', status: 'active' as const, label: 'building' },
    { name: 'hack-cos', status: 'idle' as const, label: 'standby' },
  ];

  return (
    <div className="m1-command">
      <div className="m1-topbar">
        <span className="m1-topbar__title">HACKATHON COMMAND CENTER</span>
        <div className="m1-topbar__status">
          <span>12 active</span>
          <span>3 debating</span>
          <span>30 idle</span>
        </div>
      </div>

      <div className="m1-sidebar-panel">
        <h4>Agent Status</h4>
        {agents.map((a) => (
          <div key={a.name} className="m1-agent-row">
            <span className={`m1-agent-dot m1-agent-dot--${a.status}`} />
            <span className="m1-agent-name">{a.name}</span>
            <span className="m1-agent-status">{a.label}</span>
          </div>
        ))}
      </div>

      <div className="m1-main-panel">
        <div className="m1-log-entry m1-log-entry--success">
          <span className="m1-timestamp">14:32:07</span>
          T01-architect completed mockup review -- approved with 2 notes
        </div>
        <div className="m1-log-entry m1-log-entry--info">
          <span className="m1-timestamp">14:31:42</span>
          T03-strategist initiated competitive analysis phase
        </div>
        <div className="m1-log-entry m1-log-entry--warn">
          <span className="m1-timestamp">14:30:18</span>
          Judge-quality timeout on scoring batch -- retry queued
        </div>
        <div className="m1-log-entry m1-log-entry--info">
          <span className="m1-timestamp">14:29:55</span>
          hack-cos synced team manifests across 10 teams
        </div>
        <div className="m1-log-entry m1-log-entry--success">
          <span className="m1-timestamp">14:28:30</span>
          T04-builder deployed proof-of-concept to staging
        </div>
        <div className="m1-log-entry">
          <span className="m1-timestamp">14:27:11</span>
          System heartbeat -- all services nominal
        </div>
      </div>

      <div className="m1-right-panel">
        <div className="m1-metric-block">
          <div className="m1-metric-label">Active Agents</div>
          <div className="m1-metric-value">12 / 45</div>
          <div className="m1-metric-bar">
            <div className="m1-metric-bar__fill" style={{ width: '27%' }} />
          </div>
        </div>
        <div className="m1-metric-block">
          <div className="m1-metric-label">Tasks Completed</div>
          <div className="m1-metric-value">847</div>
          <div className="m1-metric-bar">
            <div className="m1-metric-bar__fill" style={{ width: '73%' }} />
          </div>
        </div>
        <div className="m1-metric-block">
          <div className="m1-metric-label">Hackathon Progress</div>
          <div className="m1-metric-value">68%</div>
          <div className="m1-metric-bar">
            <div className="m1-metric-bar__fill" style={{ width: '68%' }} />
          </div>
        </div>
        <div className="m1-metric-block">
          <div className="m1-metric-label">Avg Score</div>
          <div className="m1-metric-value">7.4</div>
          <div className="m1-metric-bar">
            <div className="m1-metric-bar__fill" style={{ width: '74%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Mockup2_Editorial() {
  return (
    <div className="m2-editorial">
      <div className="m2-hero">
        <div>
          <h3 className="m2-hero__headline">
            Ten Teams.<br />
            Forty-Five Agents.<br />
            One Question.
          </h3>
          <p className="m2-hero__subhead">
            The Autonomous Agent Hackathon enters hour 18. Teams are converging
            on their final architectures while judges calibrate the scoring rubric.
          </p>
        </div>
        <div>
          <p className="m2-hero__pull-quote">
            &ldquo;The best agent systems don&rsquo;t just solve problems --
            they redefine what the problem was.&rdquo;
          </p>
        </div>
      </div>

      <div className="m2-columns">
        <div className="m2-column">
          <h4>Leading Teams</h4>
          <div className="m2-stat-row">
            <span className="m2-stat-row__label">T01: First Light</span>
            <span className="m2-stat-row__value">8.2</span>
          </div>
          <div className="m2-stat-row">
            <span className="m2-stat-row__label">T05: Signal Fire</span>
            <span className="m2-stat-row__value">7.9</span>
          </div>
          <div className="m2-stat-row">
            <span className="m2-stat-row__label">T03: Terraform</span>
            <span className="m2-stat-row__value">7.6</span>
          </div>
          <div className="m2-stat-row">
            <span className="m2-stat-row__label">T07: Threshold</span>
            <span className="m2-stat-row__value">7.4</span>
          </div>
        </div>
        <div className="m2-column">
          <h4>Current Phase</h4>
          <p>
            All ten teams have progressed past the initial debate phase.
            Seven are in active execution, two are running informed debates
            on revised strategies, and one is presenting to the judge panel.
          </p>
        </div>
        <div className="m2-column">
          <h4>Key Metrics</h4>
          <div className="m2-stat-row">
            <span className="m2-stat-row__label">Tasks completed</span>
            <span className="m2-stat-row__value">847</span>
          </div>
          <div className="m2-stat-row">
            <span className="m2-stat-row__label">Debates held</span>
            <span className="m2-stat-row__value">32</span>
          </div>
          <div className="m2-stat-row">
            <span className="m2-stat-row__label">Code commits</span>
            <span className="m2-stat-row__value">1,203</span>
          </div>
          <div className="m2-stat-row">
            <span className="m2-stat-row__label">Hours elapsed</span>
            <span className="m2-stat-row__value">18.4</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mockup3_Brutalist() {
  return (
    <div className="m3-brutalist">
      <div className="m3-topstrip">
        <span>AUTONOMOUS AGENT HACKATHON</span>
        <span>HOUR 18 / LIVE</span>
      </div>

      <div className="m3-grid">
        <div className="m3-cell m3-cell--highlight">
          <span className="m3-cell__label">AGENTS ONLINE</span>
          <span className="m3-cell__value">45</span>
        </div>
        <div className="m3-cell">
          <span className="m3-cell__label">ACTIVE NOW</span>
          <span className="m3-cell__value">12</span>
        </div>
        <div className="m3-cell m3-cell--dark">
          <span className="m3-cell__label">TEAMS</span>
          <span className="m3-cell__value">10</span>
        </div>
        <div className="m3-cell">
          <span className="m3-cell__label">AVG SCORE</span>
          <span className="m3-cell__value">7.4</span>
        </div>

        <div className="m3-cell m3-cell--double m3-cell--dark">
          <span className="m3-cell__label">TOP PERFORMERS</span>
          <ul className="m3-cell__list">
            <li>T01: FIRST LIGHT -- 8.2</li>
            <li>T05: SIGNAL FIRE -- 7.9</li>
            <li>T03: TERRAFORM -- 7.6</li>
            <li>T07: THRESHOLD -- 7.4</li>
          </ul>
        </div>
        <div className="m3-cell m3-cell--highlight">
          <span className="m3-cell__label">TASKS DONE</span>
          <span className="m3-cell__value">847</span>
        </div>
        <div className="m3-cell">
          <span className="m3-cell__label">DEBATES</span>
          <span className="m3-cell__value">32</span>
        </div>
      </div>

      <div className="m3-footer-strip">
        FORM FOLLOWS FUNCTION -- NO DECORATION -- RAW DATA
      </div>
    </div>
  );
}

function Mockup4_OrganicFlow() {
  const circumference = 2 * Math.PI * 34;

  const rings = [
    { label: 'Completion', pct: 68 },
    { label: 'Quality', pct: 82 },
    { label: 'Velocity', pct: 55 },
  ];

  return (
    <div className="m4-organic">
      <div className="m4-blob m4-blob--1" />
      <div className="m4-blob m4-blob--2" />
      <div className="m4-blob m4-blob--3" />

      <div className="m4-content">
        <h3 className="m4-greeting">Good afternoon</h3>
        <p className="m4-subtitle">Hackathon is 68% complete -- 10 teams competing</p>

        <div className="m4-cards">
          <div className="m4-card">
            <div className="m4-card__icon">A</div>
            <div className="m4-card__title">Active Agents</div>
            <div className="m4-card__value">12</div>
            <div className="m4-card__trend">+3 since last hour</div>
          </div>
          <div className="m4-card">
            <div className="m4-card__icon">T</div>
            <div className="m4-card__title">Tasks Done</div>
            <div className="m4-card__value">847</div>
            <div className="m4-card__trend">+42 this hour</div>
          </div>
          <div className="m4-card">
            <div className="m4-card__icon">S</div>
            <div className="m4-card__title">Avg Score</div>
            <div className="m4-card__value">7.4</div>
            <div className="m4-card__trend">+0.3 improvement</div>
          </div>
        </div>

        <div className="m4-progress-ring">
          <div className="m4-ring-group">
            {rings.map((ring) => (
              <div key={ring.label} className="m4-ring">
                <svg viewBox="0 0 76 76">
                  <circle className="m4-ring-bg" cx="38" cy="38" r="34" />
                  <circle
                    className="m4-ring-fill"
                    cx="38"
                    cy="38"
                    r="34"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (circumference * ring.pct) / 100}
                  />
                </svg>
                <span className="m4-ring__label">{ring.label} {ring.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mockup5_SwissGrid() {
  const teams = [
    { name: 'First Light', lock: 8.5, rev: 7.8, impact: 8.0, proof: 7.5, craft: 8.2 },
    { name: 'Grain', lock: 7.2, rev: 6.5, impact: 7.8, proof: 6.0, craft: 7.0 },
    { name: 'Terraform', lock: 7.8, rev: 7.5, impact: 7.0, proof: 8.2, craft: 7.6 },
    { name: 'Parallax', lock: 6.8, rev: 7.0, impact: 6.5, proof: 7.2, craft: 6.8 },
    { name: 'Signal Fire', lock: 8.0, rev: 8.2, impact: 7.5, proof: 7.0, craft: 7.9 },
  ];

  return (
    <div className="m5-swiss">
      <div className="m5-rule m5-rule--thick" />
      <div className="m5-top-row">
        <div className="m5-date">March 14, 2026</div>
        <h3 className="m5-title">Hackathon</h3>
      </div>
      <div className="m5-rule" />

      <div className="m5-data-grid">
        <div className="m5-data-cell m5-data-cell--header">Team</div>
        <div className="m5-data-cell m5-data-cell--header">Lock-In</div>
        <div className="m5-data-cell m5-data-cell--header">Revenue</div>
        <div className="m5-data-cell m5-data-cell--header">Impact</div>
        <div className="m5-data-cell m5-data-cell--header">Proof</div>
        <div className="m5-data-cell m5-data-cell--header">Craft</div>

        {teams.map((t) => (
          <>
            <div key={`${t.name}-name`} className="m5-data-cell m5-data-cell--label">{t.name}</div>
            <div key={`${t.name}-lock`} className={`m5-data-cell${t.lock >= 8.0 ? ' m5-data-cell--accent' : ''}`}>{t.lock.toFixed(1)}</div>
            <div key={`${t.name}-rev`} className={`m5-data-cell${t.rev >= 8.0 ? ' m5-data-cell--accent' : ''}`}>{t.rev.toFixed(1)}</div>
            <div key={`${t.name}-impact`} className={`m5-data-cell${t.impact >= 8.0 ? ' m5-data-cell--accent' : ''}`}>{t.impact.toFixed(1)}</div>
            <div key={`${t.name}-proof`} className={`m5-data-cell${t.proof >= 8.0 ? ' m5-data-cell--accent' : ''}`}>{t.proof.toFixed(1)}</div>
            <div key={`${t.name}-craft`} className={`m5-data-cell${t.craft >= 8.0 ? ' m5-data-cell--accent' : ''}`}>{t.craft.toFixed(1)}</div>
          </>
        ))}
      </div>

      <div className="m5-bottom-row">
        <div className="m5-kpi">
          <div className="m5-kpi__label">Total Agents</div>
          <div className="m5-kpi__value">45</div>
        </div>
        <div className="m5-kpi">
          <div className="m5-kpi__label">Active Now</div>
          <div className="m5-kpi__value">12</div>
        </div>
        <div className="m5-kpi">
          <div className="m5-kpi__label">Tasks Done</div>
          <div className="m5-kpi__value">847</div>
        </div>
        <div className="m5-kpi">
          <div className="m5-kpi__label">Hours Left</div>
          <div className="m5-kpi__value">5.6</div>
        </div>
      </div>
    </div>
  );
}

function Mockup6_NeonDashboard() {
  const barHeights = [45, 72, 38, 85, 62, 90, 55, 78, 42, 68, 95, 50];

  return (
    <div className="m6-neon">
      <div className="m6-header-row">
        <h3>HACKATHON LIVE</h3>
        <span className="m6-header-row__time">14:32 UTC -- HOUR 18</span>
      </div>

      <div className="m6-cards-row">
        <div className="m6-stat-card m6-stat-card--cyan">
          <div className="m6-stat-card__label">Active Agents</div>
          <div className="m6-stat-card__value">12</div>
        </div>
        <div className="m6-stat-card m6-stat-card--magenta">
          <div className="m6-stat-card__label">Tasks / Hour</div>
          <div className="m6-stat-card__value">42</div>
        </div>
        <div className="m6-stat-card m6-stat-card--green">
          <div className="m6-stat-card__label">Top Score</div>
          <div className="m6-stat-card__value">8.2</div>
        </div>
        <div className="m6-stat-card m6-stat-card--yellow">
          <div className="m6-stat-card__label">Debates Live</div>
          <div className="m6-stat-card__value">3</div>
        </div>
      </div>

      <div className="m6-bottom-grid">
        <div className="m6-chart-panel">
          <div className="m6-chart-panel__title">Task Throughput (12h)</div>
          <div className="m6-bar-chart">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className={`m6-bar ${i % 2 === 0 ? 'm6-bar--cyan' : 'm6-bar--magenta'}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="m6-chart-panel">
          <div className="m6-chart-panel__title">Live Activity Feed</div>
          <div className="m6-feed">
            <div className="m6-feed-item">
              <span className="m6-feed-item__dot m6-feed-item__dot--cyan" />
              <span className="m6-feed-item__text">T01-architect completed design review</span>
              <span className="m6-feed-item__time">2m ago</span>
            </div>
            <div className="m6-feed-item">
              <span className="m6-feed-item__dot m6-feed-item__dot--magenta" />
              <span className="m6-feed-item__text">T05-strategist initiated debate round 3</span>
              <span className="m6-feed-item__time">4m ago</span>
            </div>
            <div className="m6-feed-item">
              <span className="m6-feed-item__dot m6-feed-item__dot--green" />
              <span className="m6-feed-item__text">T03-builder deployed staging build</span>
              <span className="m6-feed-item__time">7m ago</span>
            </div>
            <div className="m6-feed-item">
              <span className="m6-feed-item__dot m6-feed-item__dot--cyan" />
              <span className="m6-feed-item__text">hack-judge-quality scored T07 presentation</span>
              <span className="m6-feed-item__time">12m ago</span>
            </div>
            <div className="m6-feed-item">
              <span className="m6-feed-item__dot m6-feed-item__dot--magenta" />
              <span className="m6-feed-item__text">T02-coord triggered research phase</span>
              <span className="m6-feed-item__time">15m ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mockup7_CardDeck() {
  const cards = [
    { icon: 'T01', title: 'First Light', desc: 'Feynman-inspired architecture, Rams-level craft', count: 82, label: 'tasks done' },
    { icon: 'T02', title: 'Grain', desc: 'Eames-informed design, Taleb-driven strategy', count: 67, label: 'tasks done' },
    { icon: 'T03', title: 'Terraform', desc: 'Meadows systems thinking, Grove execution', count: 75, label: 'tasks done' },
    { icon: 'T04', title: 'Parallax', desc: 'Lovelace logic, Norman usability, Chanel style', count: 58, label: 'tasks done' },
    { icon: 'T05', title: 'Signal Fire', desc: 'Curie rigor, Fuller innovation, Catmull leadership', count: 91, label: 'tasks done' },
    { icon: 'T06', title: 'Groundwork', desc: 'Jacobs urbanism, Aristotle logic, Tubman courage', count: 44, label: 'tasks done' },
    { icon: 'T07', title: 'Threshold', desc: 'Shannon information theory, Matsushita ops', count: 73, label: 'tasks done' },
    { icon: 'T08', title: 'Undertow', desc: 'Feynman physics, Eames design, Grove strategy', count: 62, label: 'tasks done' },
    { icon: 'T09', title: 'Meridian', desc: 'Meadows dynamics, Rams economy, Taleb risk', count: 55, label: 'tasks done' },
    { icon: 'T10', title: 'Sightline', desc: 'Lovelace computation, Noguchi form, Tubman resolve', count: 48, label: 'tasks done' },
  ];

  return (
    <div className="m7-deck">
      <div className="m7-deck-header">
        <h3>Team Overview</h3>
        <div className="m7-filter-pills">
          <button className="m7-pill m7-pill--active" type="button">All</button>
          <button className="m7-pill" type="button">Active</button>
          <button className="m7-pill" type="button">Top 5</button>
        </div>
      </div>

      <div className="m7-card-grid">
        {cards.map((c) => (
          <div key={c.icon} className="m7-card">
            <span className="m7-card__emoji">{c.icon}</span>
            <div className="m7-card__title">{c.title}</div>
            <div className="m7-card__desc">{c.desc}</div>
            <div className="m7-card__footer">
              <span className="m7-card__count">{c.count}</span>
              <span className="m7-card__label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mockup8_DataVizForward() {
  const sparkData = [
    { label: 'Agents', value: '45', bars: [60, 45, 80, 35, 90, 55, 70] },
    { label: 'Active', value: '12', bars: [30, 65, 40, 85, 50, 75, 60] },
    { label: 'Tasks/hr', value: '42', bars: [50, 70, 45, 80, 60, 90, 55] },
    { label: 'Debates', value: '32', bars: [40, 55, 75, 35, 65, 50, 80] },
    { label: 'Score', value: '7.4', bars: [70, 60, 85, 50, 75, 65, 90] },
  ];

  const circumference = 2 * Math.PI * 46;

  return (
    <div className="m8-dataviz">
      <div className="m8-header-bar">
        <h3>Analytics Dashboard</h3>
        <span className="m8-live-badge">
          <span className="m8-live-dot" />
          LIVE DATA
        </span>
      </div>

      <div className="m8-viz-grid">
        <div className="m8-sparkline-row">
          {sparkData.map((s) => (
            <div key={s.label} className="m8-spark-card">
              <div className="m8-spark-card__label">{s.label}</div>
              <div className="m8-spark-card__value">{s.value}</div>
              <div className="m8-sparkline">
                {s.bars.map((h, i) => (
                  <div key={i} className="m8-sparkline__bar" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="m8-main-chart">
          <div className="m8-main-chart__title">Task Completion Over Time</div>
          <div className="m8-area-chart">
            <svg viewBox="0 0 400 140" preserveAspectRatio="none">
              <defs>
                <linearGradient id="m8-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64ffda" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#64ffda" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path
                d="M0 120 Q50 100 100 80 T200 60 T300 40 T400 20 V140 H0 Z"
                fill="url(#m8-grad)"
              />
              <path
                d="M0 120 Q50 100 100 80 T200 60 T300 40 T400 20"
                fill="none"
                stroke="#64ffda"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        <div className="m8-donut-panel">
          <div className="m8-donut-panel__title">Phase Distribution</div>
          <div className="m8-donut">
            <svg viewBox="0 0 100 100">
              <circle className="m8-donut-bg" cx="50" cy="50" r="46" />
              <circle
                className="m8-donut-seg1"
                cx="50"
                cy="50"
                r="46"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * 0.5}
                transform="rotate(-90 50 50)"
              />
              <circle
                className="m8-donut-seg2"
                cx="50"
                cy="50"
                r="46"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * 0.75}
                transform="rotate(90 50 50)"
              />
              <circle
                className="m8-donut-seg3"
                cx="50"
                cy="50"
                r="46"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * 0.85}
                transform="rotate(180 50 50)"
              />
            </svg>
          </div>
          <div className="m8-donut-legend">
            <div className="m8-legend-row">
              <span className="m8-legend-dot m8-legend-dot--1" />
              <span className="m8-legend-label">Executing</span>
              <span className="m8-legend-value">50%</span>
            </div>
            <div className="m8-legend-row">
              <span className="m8-legend-dot m8-legend-dot--2" />
              <span className="m8-legend-label">Debating</span>
              <span className="m8-legend-value">25%</span>
            </div>
            <div className="m8-legend-row">
              <span className="m8-legend-dot m8-legend-dot--3" />
              <span className="m8-legend-label">Reviewing</span>
              <span className="m8-legend-value">15%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mockup9_MinimalZen() {
  return (
    <div className="m9-zen">
      <div className="m9-zen-title">Hackathon Status</div>

      <div className="m9-zen-main">
        <div className="m9-zen-number">45</div>
        <div className="m9-zen-label">
          autonomous agents working across ten teams toward a single objective
        </div>
      </div>

      <div className="m9-zen-divider" />

      <div className="m9-zen-grid">
        <div className="m9-zen-stat">
          <div className="m9-zen-stat__value">12</div>
          <div className="m9-zen-stat__label">Active</div>
        </div>
        <div className="m9-zen-stat">
          <div className="m9-zen-stat__value">847</div>
          <div className="m9-zen-stat__label">Tasks</div>
        </div>
        <div className="m9-zen-stat">
          <div className="m9-zen-stat__value">7.4</div>
          <div className="m9-zen-stat__label">Avg Score</div>
        </div>
        <div className="m9-zen-stat">
          <div className="m9-zen-stat__value">32</div>
          <div className="m9-zen-stat__label">Debates</div>
        </div>
        <div className="m9-zen-stat">
          <div className="m9-zen-stat__value">18</div>
          <div className="m9-zen-stat__label">Hours</div>
        </div>
      </div>

      <div className="m9-zen-accent" />
    </div>
  );
}

function Mockup10_PaulRandTribute() {
  return (
    <div className="m10-rand">
      <div className="m10-shapes">
        <div className="m10-shape m10-shape--circle-red" />
        <div className="m10-shape m10-shape--rect-blue" />
        <div className="m10-shape m10-shape--circle-yellow" />
        <div className="m10-shape m10-shape--rect-green" />
        <div className="m10-shape m10-shape--triangle" />
      </div>

      <div className="m10-overlay">
        <h3 className="m10-headline">
          Agent<br />
          Hackathon
        </h3>

        <div className="m10-stat-block m10-stat-block--red">
          <div className="m10-stat-block__value">45</div>
          <div className="m10-stat-block__label">Agents</div>
        </div>
        <div className="m10-stat-block m10-stat-block--blue">
          <div className="m10-stat-block__value">10</div>
          <div className="m10-stat-block__label">Teams</div>
        </div>
        <div className="m10-stat-block m10-stat-block--yellow">
          <div className="m10-stat-block__value">847</div>
          <div className="m10-stat-block__label">Tasks</div>
        </div>
        <div className="m10-stat-block m10-stat-block--green">
          <div className="m10-stat-block__value">8.2</div>
          <div className="m10-stat-block__label">Top Score</div>
        </div>

        <div className="m10-bottom-strip">
          <span className="m10-tagline">Form and content are one</span>
          <span className="m10-mark">RAND</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Mockup metadata for rendering
// ──────────────────────────────────────────────────────
const MOCKUPS: { id: string; title: string; angle: string; Component: React.FC }[] = [
  {
    id: 'command-center',
    title: '01 -- Command Center',
    angle: 'Terminal aesthetic, dense data, monospace',
    Component: Mockup1_CommandCenter,
  },
  {
    id: 'editorial',
    title: '02 -- Editorial',
    angle: 'Magazine layout, serif typography, editorial whitespace',
    Component: Mockup2_Editorial,
  },
  {
    id: 'brutalist',
    title: '03 -- Brutalist',
    angle: 'Raw, exposed grid, system fonts, no decoration',
    Component: Mockup3_Brutalist,
  },
  {
    id: 'organic-flow',
    title: '04 -- Organic Flow',
    angle: 'Curved shapes, gradients, glassmorphism',
    Component: Mockup4_OrganicFlow,
  },
  {
    id: 'swiss-grid',
    title: '05 -- Swiss Grid',
    angle: 'International Typographic Style, mathematical precision',
    Component: Mockup5_SwissGrid,
  },
  {
    id: 'neon-dashboard',
    title: '06 -- Neon Dashboard',
    angle: 'Dark mode, neon accents, cyberpunk data viz',
    Component: Mockup6_NeonDashboard,
  },
  {
    id: 'card-deck',
    title: '07 -- Card Deck',
    angle: 'Card-based UI, tactile surfaces, warm palette',
    Component: Mockup7_CardDeck,
  },
  {
    id: 'data-viz-forward',
    title: '08 -- Data Viz Forward',
    angle: 'Charts as primary content, sparklines, progress rings',
    Component: Mockup8_DataVizForward,
  },
  {
    id: 'minimal-zen',
    title: '09 -- Minimal Zen',
    angle: 'Extreme minimalism, whisper typography, negative space',
    Component: Mockup9_MinimalZen,
  },
  {
    id: 'paul-rand-tribute',
    title: '10 -- Paul Rand Tribute',
    angle: 'Geometric shapes, primary colors on black, playful conviction',
    Component: Mockup10_PaulRandTribute,
  },
];

export function LabsPage() {
  return (
    <div className="labs-page" role="region" aria-label="Design Labs">
      <div className="labs-header">
        <h2>Labs</h2>
        <p>
          Ten explorations of the hackathon dashboard -- each one a different
          design philosophy, information hierarchy, and visual language.
          These are not incremental variations. They are distinct visions.
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
