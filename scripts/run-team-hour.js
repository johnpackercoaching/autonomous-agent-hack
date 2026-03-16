#!/usr/bin/env node

/**
 * Per-Team-Per-Hour Pipeline
 *
 * Runs ONE team for ONE hour through the 11-phase cycle.
 * Uses streaming JSON output from Claude CLI for real-time terminal updates.
 *
 * Usage:
 *   node scripts/run-team-hour.js --team T01 --hour 1
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Configuration ---

const PROJECT_ROOT = resolve(__dirname, '..');
const HACKATHON_ROOT = '/Users/johnye/agent-hackathon';
const AGENTS_DIR = '/Users/johnye/.claude/agents';
const EXECUTION_ROOT = resolve(HACKATHON_ROOT, 'execution/teams');
const HOUR_PLAN_PATH = resolve(HACKATHON_ROOT, 'process/200-hour-plan.md');
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || '/Users/johnye/Downloads/autonomous-agent-hack-firebase-adminsdk-fbsvc-bcbaf3d705.json';
const RTDB_URL = 'https://autonomous-agent-hack-default-rtdb.firebaseio.com';

const ACTIVE_PHASE_MARKER = resolve(PROJECT_ROOT, '.active-phase');

// Team persona names — maps team IDs to named personas for terminal output
const TEAM_PERSONAS = {
  T01: { architect: 'Feynman', builder: 'Dieter Rams', strategist: 'Sun Tzu', coordinator: 'First Light Coord' },
  T02: { architect: 'Eames', builder: 'Noguchi', strategist: 'Taleb', coordinator: 'Grain Coord' },
  T03: { architect: 'Meadows', builder: 'Maathai', strategist: 'Grove', coordinator: 'Terraform Coord' },
  T04: { architect: 'Lovelace', builder: 'Norman', strategist: 'Chanel', coordinator: 'Parallax Coord' },
  T05: { architect: 'Curie', builder: 'Fuller', strategist: 'Catmull', coordinator: 'Signal Fire Coord' },
  T06: { architect: 'Jacobs', builder: 'Aristotle', strategist: 'Tubman', coordinator: 'Groundwork Coord' },
  T07: { architect: 'Shannon', builder: 'Matsushita', strategist: 'Abloh', coordinator: 'Threshold Coord' },
  T08: { architect: 'Feynman', builder: 'Eames', strategist: 'Grove', coordinator: 'Undertow Coord' },
  T09: { architect: 'Meadows', builder: 'Rams', strategist: 'Taleb', coordinator: 'Meridian Coord' },
  T10: { architect: 'Lovelace', builder: 'Noguchi', strategist: 'Tubman', coordinator: 'Sightline Coord' },
};

function getPersonas(teamId) {
  return TEAM_PERSONAS[teamId] || { architect: 'Architect', builder: 'Builder', strategist: 'Strategist', coordinator: 'Coordinator' };
}

// Design firms available for teams to choose during Hour 7 (advisory) and Hardening + Polish hours (full critique)
const DESIGN_FIRMS = {
  'paul-rand': {
    name: 'Paul Rand Design Studio',
    agent: 'paul-rand-agent',
    style: 'Form and content must be inseparable. Six-pass critique: Honesty, Cover Test, Conviction, Economy, Hierarchy, Art. Bold colors, clear hierarchy, intentional typography.',
  },
  'studio-rand': {
    name: 'The Studio (Full Design Team)',
    agent: 'studio-director-rand',
    style: 'Five-person design team: Wit (concepts), Formalist (visual systems), Reductionist (simplification), Colorist (strategic color), Critic (quality gate). Iterative critique cycle until the Critic approves.',
  },
};

// 11-phase cycle with time budgets (minutes)
const PHASES = [
  { id: 1,  name: 'Debate',             duration: 8,  lead: 'architect' },
  { id: 2,  name: 'Research',            duration: 7,  lead: 'all' },
  { id: 3,  name: 'Informed Debate',     duration: 5,  lead: 'strategist' },
  { id: 4,  name: 'Decision',            duration: 3,  lead: 'architect' },
  { id: 5,  name: 'Mockups/Plans',       duration: 7,  lead: 'builder' },
  { id: 6,  name: 'Test Mockups',        duration: 5,  lead: 'strategist' },
  { id: 7,  name: 'Debate Mockups',      duration: 5,  lead: 'all' },
  { id: 8,  name: 'Execute Decision',    duration: 2,  lead: 'coordinator' },
  { id: 9,  name: 'JP Rocks Execution',  duration: 12, lead: 'jp-rocks' },
  { id: 10, name: 'Review Results',      duration: 3,  lead: 'all' },
  { id: 11, name: 'Judge Presentation',  duration: 3,  lead: 'strategist' },
];

// Arc phases
const ARC_PHASES = [
  { name: 'Discovery',          start: 1,  end: 2  },
  { name: 'Foundation',         start: 3,  end: 4  },
  { name: 'Core Build',         start: 5,  end: 7  },
  { name: 'Hardening + Polish', start: 8,  end: 9  },
  { name: 'Ship',               start: 10, end: 10 },
];

// --- Firebase Setup ---

let db;

function initFirebase() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: RTDB_URL,
    });
  }
  db = getDatabase();
}

// --- Helpers ---

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--team' && args[i + 1]) {
      parsed.team = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--hour' && args[i + 1]) {
      parsed.hour = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return parsed;
}

function getArcPhase(hour) {
  for (const phase of ARC_PHASES) {
    if (hour >= phase.start && hour <= phase.end) {
      return phase.name;
    }
  }
  return 'Unknown';
}

function padHour(hour) {
  return String(hour).padStart(3, '0');
}

function teamIdToNum(teamId) {
  return teamId.replace('T', '').padStart(2, '0');
}

function getTeamDir(teamId) {
  const num = teamIdToNum(teamId);
  return resolve(EXECUTION_ROOT, `team_${num}`);
}

function getHourDir(teamId, hour) {
  const teamDir = getTeamDir(teamId);
  return resolve(teamDir, 'hours', `H-${padHour(hour)}`);
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadPreviousHourSummaries(teamId, hour) {
  const memoryDir = resolve(getTeamDir(teamId), 'memory');

  // PRIMARY: Load cumulative team memory (structured system)
  const teamMemoryPath = resolve(memoryDir, 'team-memory.md');
  if (existsSync(teamMemoryPath)) {
    const teamMemory = readFileSync(teamMemoryPath, 'utf-8');
    if (teamMemory.length <= 4000) {
      return teamMemory;
    }
    return truncateTeamMemory(teamMemory, 4000);
  }

  // FALLBACK: Old system for hours that ran before cumulative memory existed
  const summaries = [];
  for (let h = 1; h < hour; h++) {
    const summaryPath = resolve(memoryDir, `hour-${h}-summary.md`);
    if (existsSync(summaryPath)) {
      const content = readFileSync(summaryPath, 'utf-8');
      summaries.push(`### Hour ${h}\n${content.slice(0, 500)}`);
    }
  }
  return summaries.join('\n\n');
}

// --- Cumulative Team Memory System ---

function summarizeDecision(text) {
  if (!text) return '';
  const lines = text.split('\n');
  // Look for decision markers
  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (lower.startsWith('decision:') || lower.startsWith('what we build:') ||
        lower.startsWith('## decision') || lower.startsWith('**decision')) {
      // Return this line plus next few lines for rationale, capped at 300 chars
      const idx = lines.indexOf(line);
      const block = lines.slice(idx, idx + 4).join(' ').trim();
      return block.slice(0, 300);
    }
  }
  // No marker found — use first substantive line
  for (const line of lines) {
    if (line.trim().length > 20 && !line.startsWith('#')) {
      return line.trim().slice(0, 300);
    }
  }
  return text.slice(0, 300);
}

function extractDebateHighlights(debate, informedDebate) {
  if (!debate && !informedDebate) return '';
  const combined = (debate + '\n' + informedDebate).split('\n');
  const highlights = [];
  const patterns = [/disagree/i, /rejected/i, /accepted/i, /consensus/i, /resolved/i,
                    /\[architect\]/i, /\[builder\]/i, /\[strategist\]/i,
                    /key tension/i, /critical point/i, /we agreed/i, /open question/i];
  for (const line of combined) {
    if (line.trim().length < 10) continue;
    if (patterns.some(p => p.test(line))) {
      highlights.push(line.trim());
      if (highlights.length >= 5) break;
    }
  }
  return highlights.join('\n');
}

function extractLessons(previousOutputs) {
  const lessons = [];
  // Phase 10 = Review, Phase 11 = Judge scoring
  const reviewPhases = previousOutputs.filter(o => o.phase >= 10);
  for (const phaseOut of reviewPhases) {
    const lines = (phaseOut.output || '').split('\n');
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('lesson') || lower.includes('insight') || lower.includes('takeaway') ||
          lower.includes('learned') || lower.includes('improvement') || lower.includes('next time')) {
        lessons.push(line.trim());
        if (lessons.length >= 3) break;
      }
    }
    if (lessons.length >= 3) break;
  }
  return lessons.join('\n');
}

function buildTeamMemoryEntry(teamId, hour, hourObjective, previousOutputs) {
  // Extract decision from Phase 4 output (full text, not truncated)
  const decisionOutput = previousOutputs.find(o => o.phase === 4);
  const decision = summarizeDecision(decisionOutput?.output || '');

  // Scan artifact directory for key files
  const artifactDir = resolve(getHourDir(teamId, hour), 'artifacts');
  const artifacts = [];
  if (existsSync(artifactDir)) {
    try {
      for (const file of readdirSync(artifactDir)) {
        const fullPath = resolve(artifactDir, file);
        const stats = statSync(fullPath);
        if (stats.isFile()) {
          artifacts.push({
            name: file,
            path: `hours/H-${padHour(hour)}/artifacts/${file}`,
            size: stats.size,
          });
        }
      }
    } catch (err) {
      console.error(`  WARNING: Could not scan artifacts: ${err.message}`);
    }
  }

  // Extract debate highlights from Phase 1 (Debate) and Phase 3 (Informed Debate)
  const debateOutput = previousOutputs.find(o => o.phase === 1);
  const informedDebateOutput = previousOutputs.find(o => o.phase === 3);

  return {
    hour,
    arcPhase: hourObjective.arcPhase,
    decision,
    artifacts,
    debateHighlights: extractDebateHighlights(debateOutput?.output || '', informedDebateOutput?.output || ''),
    lessonsLearned: extractLessons(previousOutputs),
  };
}

function parseTeamMemory(text) {
  const result = { decisions: [], artifacts: [], debates: [], lessons: [] };

  // Parse decisions table rows: | Hour | Decision | Rationale/Impact |
  const decisionRows = text.match(/^\|\s*(\d+)\s*\|(.+)\|(.+)\|(.+)\|$/gm);
  if (decisionRows) {
    for (const row of decisionRows) {
      const cols = row.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cols.length >= 3 && /^\d+$/.test(cols[0])) {
        result.decisions.push({
          hour: parseInt(cols[0], 10),
          arcPhase: cols.length >= 4 ? cols[1] : '',
          decision: cols.length >= 4 ? cols[2] : cols[1],
        });
      }
    }
  }

  // Parse artifact table rows: | Hour | Artifact | Path | Description |
  const artifactSection = text.match(/## Artifact Trail[\s\S]*?(?=\n## |$)/);
  if (artifactSection) {
    const artRows = artifactSection[0].match(/^\|\s*(\d+)\s*\|(.+)\|(.+)\|(.+)\|$/gm);
    if (artRows) {
      for (const row of artRows) {
        const cols = row.split('|').filter(c => c.trim()).map(c => c.trim());
        if (cols.length >= 4 && /^\d+$/.test(cols[0])) {
          result.artifacts.push({
            hour: parseInt(cols[0], 10),
            name: cols[1],
            path: cols[2],
            size: cols[3],
          });
        }
      }
    }
  }

  // Parse debates section
  const debateSection = text.match(/## Active Debates[\s\S]*?(?=\n## |$)/);
  if (debateSection) {
    const lines = debateSection[0].split('\n').filter(l => l.startsWith('- '));
    if (lines.length > 0) {
      result.debates.push({ hour: 0, highlights: lines.join('\n') });
    }
  }

  // Parse lessons section
  const lessonsSection = text.match(/## Lessons Learned[\s\S]*?(?=\n## |$)/);
  if (lessonsSection) {
    const lines = lessonsSection[0].split('\n').filter(l => l.startsWith('- '));
    if (lines.length > 0) {
      result.lessons.push({ hour: 0, lessons: lines.join('\n') });
    }
  }

  return result;
}

function renderTeamMemory(teamId, hour, data) {
  const teamNum = teamIdToNum(teamId);
  let md = `# Team Memory — ${teamId} (team_${teamNum})\nLast updated: Hour ${hour}\n\n`;

  // Key Decisions table
  md += `## Key Decisions (cumulative)\n`;
  md += `| Hour | Arc Phase | Decision |\n`;
  md += `|------|-----------|----------|\n`;
  for (const d of data.decisions) {
    const decision = (d.decision || '').replace(/\|/g, '/').replace(/\n/g, ' ');
    const arcPhase = (d.arcPhase || '').replace(/\|/g, '/');
    md += `| ${d.hour} | ${arcPhase} | ${decision} |\n`;
  }
  md += `\n`;

  // Artifact Trail table
  md += `## Artifact Trail\n`;
  md += `| Hour | Artifact | Path | Size |\n`;
  md += `|------|----------|------|------|\n`;
  for (const a of data.artifacts) {
    const size = typeof a.size === 'number' ? `${Math.round(a.size / 1024)}KB` : a.size;
    md += `| ${a.hour} | ${a.name} | ${a.path} | ${size} |\n`;
  }
  md += `\n`;

  // Active Debates — only keep latest entries (last 5)
  md += `## Active Debates & Open Questions\n`;
  const allDebates = data.debates
    .filter(d => d.highlights && d.highlights.trim())
    .flatMap(d => d.highlights.split('\n').filter(l => l.trim()));
  const recentDebates = allDebates.slice(-5);
  for (const line of recentDebates) {
    md += line.startsWith('- ') ? `${line}\n` : `- ${line}\n`;
  }
  md += `\n`;

  // Lessons Learned — keep last 5
  md += `## Lessons Learned\n`;
  const allLessons = data.lessons
    .filter(l => l.lessons && l.lessons.trim())
    .flatMap(l => l.lessons.split('\n').filter(line => line.trim()));
  const recentLessons = allLessons.slice(-5);
  for (const line of recentLessons) {
    md += line.startsWith('- ') ? `${line}\n` : `- ${line}\n`;
  }

  return md;
}

function truncateTeamMemory(text, maxLen) {
  // Preserve header + decisions + artifact trail (most valuable), trim debates + lessons
  const sections = text.split(/(?=\n## )/);
  let result = '';

  for (const section of sections) {
    if (section.includes('## Key Decisions') || section.includes('## Artifact Trail') ||
        section.startsWith('# Team Memory')) {
      result += section;
    }
  }

  if (result.length < maxLen) {
    // Add debates/lessons if space remains
    for (const section of sections) {
      if (!section.includes('## Key Decisions') && !section.includes('## Artifact Trail') &&
          !section.startsWith('# Team Memory')) {
        if (result.length + section.length <= maxLen) {
          result += section;
        }
      }
    }
  }

  return result.slice(0, maxLen);
}

function updateTeamMemory(teamId, hour, entry) {
  const memoryDir = resolve(getTeamDir(teamId), 'memory');
  const memoryPath = resolve(memoryDir, 'team-memory.md');
  ensureDir(memoryDir);

  let existing = { decisions: [], artifacts: [], debates: [], lessons: [] };
  if (existsSync(memoryPath)) {
    existing = parseTeamMemory(readFileSync(memoryPath, 'utf-8'));
  }

  // Append new hour's decision
  if (entry.decision) {
    existing.decisions.push({
      hour: entry.hour,
      arcPhase: entry.arcPhase || '',
      decision: entry.decision,
    });
  }

  // Append artifacts
  for (const art of entry.artifacts) {
    existing.artifacts.push({
      hour: entry.hour,
      name: art.name,
      path: art.path,
      size: art.size,
    });
  }

  // Append debate highlights
  if (entry.debateHighlights) {
    existing.debates.push({ hour: entry.hour, highlights: entry.debateHighlights });
  }

  // Append lessons
  if (entry.lessonsLearned) {
    existing.lessons.push({ hour: entry.hour, lessons: entry.lessonsLearned });
  }

  // Write updated memory file
  const markdown = renderTeamMemory(teamId, hour, existing);
  writeFileSync(memoryPath, markdown, 'utf-8');
}

function getAgentSystemPrompt(agentName) {
  const agentPath = resolve(AGENTS_DIR, `${agentName}.md`);
  if (!existsSync(agentPath)) {
    console.error(`WARNING: Agent file not found: ${agentPath}`);
    return '';
  }

  const content = readFileSync(agentPath, 'utf-8');

  // Strip YAML frontmatter
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  if (frontmatterMatch) {
    return content.slice(frontmatterMatch[0].length).trim();
  }
  return content.trim();
}

function getHourObjective(hour) {
  const configPath = resolve(__dirname, 'hour-configs', `H-${padHour(hour)}.json`);
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }

  const plan = readFileSync(HOUR_PLAN_PATH, 'utf-8');
  const hourRegex = new RegExp(`## Hour ${hour} -- ([^\\n]+)\\n([\\s\\S]*?)(?=## Hour ${hour + 1}|# PHASE|$)`);
  const match = plan.match(hourRegex);

  if (match) {
    const title = match[1].trim();
    const body = match[2];
    const objectiveMatch = body.match(/\*\*Objective\*\*:\s*(.+)/);
    const deliverableMatch = body.match(/\*\*Expected Deliverable\*\*:\s*(.+)/);
    const keyQuestionMatch = body.match(/\*\*Key Question\*\*:\s*(.+)/);
    const riskMatch = body.match(/\*\*Risk\*\*:\s*(.+)/);
    const doNotMatch = body.match(/\*\*DO NOT\*\*:\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);

    return {
      hour,
      arcPhase: getArcPhase(hour),
      objective: objectiveMatch ? objectiveMatch[1] : title,
      expectedDeliverable: deliverableMatch ? deliverableMatch[1] : '',
      keyQuestion: keyQuestionMatch ? keyQuestionMatch[1] : '',
      risk: riskMatch ? riskMatch[1] : '',
      doNot: doNotMatch ? doNotMatch[1].trim() : '',
    };
  }

  return {
    hour,
    arcPhase: getArcPhase(hour),
    objective: `Hour ${hour}`,
    expectedDeliverable: '',
    keyQuestion: '',
    risk: '',
    doNot: '',
  };
}

// --- Streaming Claude Execution ---

function runClaudeStreaming(systemPrompt, userMessage, maxTurns = 20, terminalLines = [], onTerminalUpdate = null, agentLabel = '', isDiscoveryHour = false, timeoutMs = 15 * 60 * 1000) {
  return new Promise((promiseResolve, promiseReject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    delete env.CLAUDE_CODE_PARENT;

    // Tool gating for Discovery hours
    let effectiveSystemPrompt = systemPrompt;
    if (isDiscoveryHour) {
      effectiveSystemPrompt = `CRITICAL TOOL RESTRICTION: This is a DISCOVERY hour. You are STRICTLY FORBIDDEN from using the following tools: Write (for code files), Edit (for code files), Bash (for running code). You may ONLY use: Read, Glob, Grep, Task, and Write ONLY for markdown/yaml/text documents (NOT .html, .js, .ts, .css, .json code files). Any attempt to write code files will violate the hackathon rules and result in disqualification.\n\n${systemPrompt}`;
    }

    const child = spawn('claude', [
      '-p', userMessage,
      '--system-prompt', effectiveSystemPrompt,
      '--max-turns', String(maxTurns),
      '--output-format', 'stream-json',
      '--verbose',
      '--model', 'claude-opus-4-6',
      '--dangerously-skip-permissions',
    ], { cwd: PROJECT_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });

    let accumulatedText = '';
    let currentToolName = '';
    let currentToolInput = '';
    let lineBuffer = '';
    let lastFlush = Date.now();
    let linesSinceFlush = 0;

    const flushUpdate = () => {
      if (onTerminalUpdate && linesSinceFlush > 0) {
        onTerminalUpdate(terminalLines);
        linesSinceFlush = 0;
        lastFlush = Date.now();
      }
    };

    const formatToolCall = (toolName, toolInput) => {
      switch (toolName) {
        case 'Read': {
          const fp = toolInput?.file_path || '';
          return `Reading ${fp.split('/').pop() || fp}`;
        }
        case 'Write': {
          const fp = toolInput?.file_path || '';
          return `Writing ${fp.split('/').pop() || fp}`;
        }
        case 'Edit': {
          const fp = toolInput?.file_path || '';
          return `Editing ${fp.split('/').pop() || fp}`;
        }
        case 'Glob': {
          return `Searching files: ${toolInput?.pattern || ''}`;
        }
        case 'Grep': {
          return `Searching for: ${toolInput?.pattern || ''}`;
        }
        case 'Bash': {
          const cmd = toolInput?.command || '';
          return `Running: ${cmd.slice(0, 80)}${cmd.length > 80 ? '...' : ''}`;
        }
        case 'Task': {
          const agentType = toolInput?.subagent_type || toolInput?.agent_type || '';
          const desc = toolInput?.description || '';
          const agentLabel = agentType
            .replace(/^hack-t\d+-/, '')
            .replace(/-agent$/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
          return `[${agentLabel || 'Agent'}] ${desc || 'Spawning sub-agent...'}`;
        }
        case 'TodoWrite':
          return 'Updating task list...';
        default:
          return `${toolName}: ${JSON.stringify(toolInput || {}).slice(0, 100)}`;
      }
    };

    const pushLine = (text, type = 'output') => {
      const prefix = agentLabel ? `[${agentLabel}] ` : '';
      terminalLines.push({
        text: `${prefix}${String(text).slice(0, 500)}`,
        time: new Date().toISOString(),
        type,
      });
      linesSinceFlush++;
      if (linesSinceFlush >= 10 || Date.now() - lastFlush > 5000) {
        flushUpdate();
      }
    };

    child.stdout.on('data', (chunk) => {
      lineBuffer += chunk.toString('utf-8');
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }

        // Claude CLI stream-json --verbose event types:
        //   system  — session init (model, tools, etc.)
        //   assistant — full assistant message (text + tool_use blocks)
        //   tool    — tool execution result
        //   result  — final accumulated result
        //   rate_limit_event — rate limit info (ignored)

        if (event.type === 'system' && event.subtype === 'init') {
          const model = event.model || 'claude';
          pushLine(`Session started (model: ${model})`, 'info');
        } else if (event.type === 'assistant') {
          const content = event.message?.content || [];
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              accumulatedText = block.text;
              const textLines = block.text.split('\n');
              for (const tl of textLines) {
                if (tl.trim()) pushLine(tl.trim(), 'output');
              }
            } else if (block.type === 'tool_use') {
              currentToolName = block.name || 'unknown';
              const formatted = formatToolCall(currentToolName, block.input);
              pushLine(formatted, currentToolName === 'Task' ? 'agent' : 'info');
            }
          }
          // No "-- turn complete --" noise
        } else if (event.type === 'tool') {
          // Tool results are verbose — skip them.
          // The assistant's next text response will summarize what it found.
        } else if (event.type === 'result') {
          if (event.result) {
            accumulatedText = typeof event.result === 'string' ? event.result : JSON.stringify(event.result);
          }
          pushLine('-- phase complete --', 'info');
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf-8').trim();
      if (text) pushLine(`[stderr] ${text}`, 'info');
    });

    // Configurable timeout (default 15 min, Phase 9 build hours get 30 min)
    const timeoutMinutes = Math.round(timeoutMs / 60000);
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      pushLine(`TIMEOUT: phase exceeded ${timeoutMinutes} minutes`, 'error');
      flushUpdate();
      cleanup();
      promiseReject(new Error(`Phase timeout after ${timeoutMinutes} minutes`));
    }, timeoutMs);

    const cleanup = () => {
      // No temp files to clean up — args passed directly to spawn
    };

    child.on('close', (code) => {
      clearTimeout(timeout);
      // Process remaining buffer
      if (lineBuffer.trim()) {
        try {
          const event = JSON.parse(lineBuffer);
          if (event.type === 'result' && event.result) {
            accumulatedText = typeof event.result === 'string' ? event.result : JSON.stringify(event.result);
          }
        } catch { /* ignore */ }
      }
      flushUpdate();
      cleanup();
      if (code !== 0 && !accumulatedText) {
        promiseReject(new Error(`Claude exited with code ${code}`));
      } else {
        promiseResolve(accumulatedText || `(no output, exit code ${code})`);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      cleanup();
      promiseReject(err);
    });
  });
}

// --- Output Helpers ---

function truncateTerminalLinesForRTDB(terminalLines, maxTotal = 500) {
  if (terminalLines.length <= maxTotal) return terminalLines;
  return terminalLines.slice(-maxTotal);
}

function writeArtifact(hourDir, filename, content) {
  const artifactsDir = resolve(hourDir, 'artifacts');
  ensureDir(artifactsDir);
  const filePath = resolve(artifactsDir, filename);
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  Artifact saved: ${filePath}`);
  return filePath;
}

function writePhaseOutput(hourDir, filename, content) {
  ensureDir(hourDir);
  const filePath = resolve(hourDir, filename);
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  Output saved: ${filePath}`);
  return filePath;
}

async function updatePhaseInFirebase(teamId, hour, phaseId, phaseName, status, terminalLines, hourObjective) {
  if (!db) return;
  const teamNum = teamIdToNum(teamId);
  const liveTeamId = `t${teamNum}`;

  // Unified path: hackathon/hours/hour{N}/teams/t{NN}/
  const liveHourRef = db.ref(`hackathon/hours/hour${hour}/teams/${liveTeamId}`);
  await liveHourRef.update({
    phase: phaseName,
    status: 'active',
    terminal: truncateTerminalLinesForRTDB(terminalLines || []),
    problem: hourObjective?.objective || '',
  });

  // Push artifact files list and prototypeUrl
  try {
    const teamDir = `${EXECUTION_ROOT}/team_${String(teamNum).padStart(2, '0')}`;
    const hourCode = `H-${String(hour).padStart(3, '0')}`;
    const artifactsDir = resolve(teamDir, 'hours', hourCode, 'artifacts');

    if (existsSync(artifactsDir)) {
      const entries = readdirSync(artifactsDir);
      const files = entries
        .filter(name => !name.startsWith('.'))
        .map(name => {
          const st = statSync(resolve(artifactsDir, name));
          return { name, status: 'added', size: st.size, modifiedAt: st.mtimeMs };
        });

      if (files.length > 0) {
        await liveHourRef.update({ files });
      }

      // Push prototypeUrl if prototype.html exists
      const PROTOTYPE_SERVER_PORT = 8787;
      if (entries.includes('prototype.html')) {
        const prototypeUrl = `http://localhost:${PROTOTYPE_SERVER_PORT}/teams/team_${String(teamNum).padStart(2, '0')}/hours/${hourCode}/artifacts/prototype.html?t=${Date.now()}`;
        await liveHourRef.update({ prototypeUrl });
      }
    }
  } catch (filesErr) {
    // Non-fatal - do not crash the pipeline for file listing
    console.error(`WARNING: Failed to push files/prototypeUrl: ${filesErr.message}`);
  }

  // Team metadata path: teams/t{NN}/
  const teamRef = db.ref(`teams/${liveTeamId}`);
  await teamRef.update({
    status: 'active',
    currentPhase: phaseName,
    hour: hour,
    problem: hourObjective?.objective || '',
  });
}

// --- Phase Execution ---

function buildPhaseContext(teamId, hour, hourObjective, previousOutputs) {
  const teamNum = teamIdToNum(teamId);
  const teamDir = getTeamDir(teamId);
  const charterPath = resolve(teamDir, 'memory/team-charter.md');
  let charter = '';
  if (existsSync(charterPath)) {
    charter = readFileSync(charterPath, 'utf-8');
  }

  return `
TEAM: ${teamId} (team_${teamNum})
HOUR: ${hour}
ARC PHASE: ${hourObjective.arcPhase}
OBJECTIVE: ${hourObjective.objective}
EXPECTED DELIVERABLE: ${hourObjective.expectedDeliverable}
KEY QUESTION: ${hourObjective.keyQuestion}
RISK: ${hourObjective.risk}

TEAM CHARTER:
${charter}

HOUR CONSTRAINTS (MANDATORY — VIOLATIONS WILL BE REJECTED):
${hourObjective.doNot || 'No specific constraints for this hour.'}

EXPECTED OUTPUT TYPE:
${hourObjective.expectedDeliverable || 'Deliverable type not specified.'}

PREVIOUS HOUR SUMMARIES (persistent memory from earlier hours):
${loadPreviousHourSummaries(teamId, hour) || 'This is the first hour — no previous summaries.'}

PREVIOUS PHASE OUTPUTS THIS HOUR:
${previousOutputs.map(o => `--- Phase ${o.phase}: ${o.name} ---\n${o.output}\n`).join('\n')}

ARTIFACT DIRECTORY: ${getHourDir(teamId, hour)}/artifacts/
`.trim();
}

async function runPhase1_Debate(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);
  const isDiscovery = hourObjective.arcPhase === 'Discovery';
  const personas = getPersonas(teamId);

  // REAL multi-agent debate: each agent speaks independently with their own personality

  const designFirmContext = (hourObjective.arcPhase === 'Hardening + Polish') ? `

DESIGN FIRM RESOURCES AVAILABLE THIS HOUR:
You have access to external design firms that can critique your prototype and suggest the most impactful visual/UX improvements. During your debate, discuss which firm (if any) to bring in and why.

Available firms:
${Object.entries(DESIGN_FIRMS).map(([key, firm]) => `- **${firm.name}** (${key}): ${firm.style}`).join('\n')}

Your debate should address:
1. What are the biggest visual/UX weaknesses in our current prototype?
2. Which design firm's philosophy best matches what we need?
3. What specific aspects should we ask them to focus on?
4. How do we incorporate their feedback within the time budget?

If the team decides to use a design firm, include the decision in the handoff with the firm key and focus areas.
` : (hour === 7) ? `

DESIGN FIRM CONSULTATION AVAILABLE (ONE MAJOR PIECE OF ADVICE):
You may consult a design firm for ONE major piece of advice about your prototype's design direction. This advice should help you think about presentation quality and what will impress the judges.

This is a lighter touch than a full critique — the firm will give you their single most impactful recommendation based on their design philosophy.

Available firms:
${Object.entries(DESIGN_FIRMS).map(([key, firm]) => `- **${firm.name}** (${key}): ${firm.style}`).join('\n')}

During your debate, briefly discuss:
1. Would consulting a design firm help elevate our prototype before the final hours?
2. If so, which firm's philosophy best matches our project's needs?
3. What ONE aspect of our prototype would benefit most from expert design input?

If the team decides to consult a design firm, include the choice in the handoff with the firm key and the single focus area.
` : '';

  // Step 1: Architect opens the debate
  const architectPrompt = getAgentSystemPrompt(`hack-t${teamNum}-architect`);
  const architectMessage = `PHASE 1: DEBATE — Opening Statement (You speak FIRST)

${context}

You are your persona. Let loose. Hour ${hour}.
1. Speak as yourself — your worldview, your reputation, your taste
2. What do YOU see that nobody else in this room sees?
3. Stake out a position so specific it makes people uncomfortable
4. Challenge the objective — what is everyone getting wrong?

Your identity shapes your argument. Be who you are, loudly.
First person. Direct. Under 400 words. No YAML.${designFirmContext}`;

  terminalLines.push({ text: `--- ${personas.architect} opens the debate ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const architectOutput = await runClaudeStreaming(architectPrompt, architectMessage, 10, terminalLines, onTerminalUpdate, personas.architect, isDiscovery);

  // Step 2: Builder responds to Architect
  const builderPrompt = getAgentSystemPrompt(`hack-t${teamNum}-builder`);
  const builderMessage = `PHASE 1: DEBATE — Response to Architect

${context}

The Architect just made their opening argument:
---
${architectOutput.slice(0, 1500)}
---

You are your persona. Respond to the Architect. Hour ${hour}.
1. React as yourself — what in their argument fits your worldview?
2. Where are they wrong? Push back from who YOU are
3. What would you build and why does it matter to real people?
4. Name the one thing they're overcomplicating

Your craft and taste drive your argument. Be who you are.
First person. Direct. Under 400 words.${designFirmContext}`;

  terminalLines.push({ text: `--- ${personas.builder} responds ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const builderOutput = await runClaudeStreaming(builderPrompt, builderMessage, 10, terminalLines, onTerminalUpdate, personas.builder, isDiscovery);

  // Step 3: Strategist responds to both
  const strategistPrompt = getAgentSystemPrompt(`hack-t${teamNum}-strategist`);
  const strategistMessage = `PHASE 1: DEBATE — Strategic Assessment

${context}

Two teammates have spoken. Here are their positions:

ARCHITECT'S POSITION:
---
${architectOutput.slice(0, 1000)}
---

BUILDER'S POSITION:
---
${builderOutput.slice(0, 1000)}
---

You are your persona. Assess both positions. Hour ${hour}.
1. Who's right and who's wrong — from YOUR strategic lens?
2. What are they both blind to about winning?
3. What makes judges remember THIS over nine other teams?
4. Your one recommendation — decisive, not diplomatic

Your strategy comes from who you are. Think like yourself.
First person. Direct. Under 400 words.${designFirmContext}`;

  terminalLines.push({ text: `--- ${personas.strategist} weighs in ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const strategistOutput = await runClaudeStreaming(strategistPrompt, strategistMessage, 10, terminalLines, onTerminalUpdate, personas.strategist, isDiscovery);

  // Step 4: Coordinator synthesizes the debate
  const coordPrompt = getAgentSystemPrompt(`hack-t${teamNum}-coord`);
  const coordMessage = `PHASE 1: DEBATE — Synthesis

${context}

Your three team members have debated. Synthesize their positions:

ARCHITECT (${personas.architect}):
---
${architectOutput.slice(0, 800)}
---

BUILDER (${personas.builder}):
---
${builderOutput.slice(0, 800)}
---

STRATEGIST (${personas.strategist}):
---
${strategistOutput.slice(0, 800)}
---

Synthesize. Don't smooth over tension — capture it.
1. Where do they agree?
2. Where is genuine disagreement? Keep the friction.
3. Emerging direction
4. What must be resolved next?

Produce a debate-note.yaml with these fields:
- hour, team_id, phase, topic
- architect_position (2-3 sentences capturing ${personas.architect}'s core argument)
- builder_position (2-3 sentences capturing ${personas.builder}'s core argument)
- strategist_position (2-3 sentences capturing ${personas.strategist}'s core argument)
- consensus (what they agree on)
- dissent (where they genuinely disagree — be honest about the tension)
- next_action

Output the YAML content between \`\`\`yaml and \`\`\` markers.`;

  terminalLines.push({ text: `--- ${personas.coordinator} synthesizes ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const coordOutput = await runClaudeStreaming(coordPrompt, coordMessage, 10, terminalLines, onTerminalUpdate, personas.coordinator, isDiscovery);

  // Save the full debate transcript AND the synthesis
  const fullDebate = `# Phase 1: Debate — Hour ${hour}

## ${personas.architect} — Opening Statement
${architectOutput}

## ${personas.builder} — Response
${builderOutput}

## ${personas.strategist} — Strategic Assessment
${strategistOutput}

## ${personas.coordinator} — Synthesis
${coordOutput}
`;
  writeArtifact(hourDir, 'debate-transcript.md', fullDebate);

  const yamlMatch = coordOutput.match(/```yaml\n([\s\S]*?)```/);
  if (yamlMatch) {
    writePhaseOutput(hourDir, 'debate-note.yaml', yamlMatch[1]);
  } else {
    writePhaseOutput(hourDir, 'debate-note.yaml', `# Phase 1 Debate Output\nhour: ${hour}\nteam_id: "${teamId}"\nraw_output: |\n  ${coordOutput.slice(0, 2000)}`);
  }

  return `DEBATE RESULTS:\n\n[${personas.architect}]: ${architectOutput.slice(0, 500)}\n\n[${personas.builder}]: ${builderOutput.slice(0, 500)}\n\n[${personas.strategist}]: ${strategistOutput.slice(0, 500)}\n\n[${personas.coordinator}]: ${coordOutput.slice(0, 500)}`;
}

async function runPhase2_Research(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const agents = ['architect', 'builder', 'strategist'];
  const results = [];

  for (const role of agents) {
    const agentName = `hack-t${teamNum}-${role}`;
    const systemPrompt = getAgentSystemPrompt(agentName);
    const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

    const message = `PHASE 2: RESEARCH (7 minutes)

${context}

As the team ${role}, research the relevant aspects of this hour's objective.
Focus on your area of expertise:
${role === 'architect' ? '- Technical architecture, system design, first principles analysis' : ''}
${role === 'builder' ? '- Implementation feasibility, tools, libraries, technical constraints' : ''}
${role === 'strategist' ? '- Competitive landscape, user impact, strategic positioning' : ''}

Produce a concise research brief (max 500 words) with findings, evidence, and implications.`;

    const isDiscovery = hourObjective.arcPhase === 'Discovery';
    const output = await runClaudeStreaming(systemPrompt, message, 20, terminalLines, onTerminalUpdate, getPersonas(teamId)[role] || role.charAt(0).toUpperCase() + role.slice(1), isDiscovery);
    results.push({ role, output });
    writeArtifact(hourDir, `research-${role}.md`, output);
  }

  return results.map(r => `[${getPersonas(teamId)[r.role] || r.role}]: ${r.output.slice(0, 500)}`).join('\n\n');
}

async function runPhase3_InformedDebate(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);
  const isDiscovery = hourObjective.arcPhase === 'Discovery';
  const personas = getPersonas(teamId);

  // REAL multi-agent informed debate: Strategist leads, others respond

  // Step 1: Strategist leads with research-informed position
  const strategistPrompt = getAgentSystemPrompt(`hack-t${teamNum}-strategist`);
  const strategistMessage = `PHASE 3: INFORMED DEBATE — Strategist Opens (You Lead This Phase)

${context}

Research is complete. You've seen the findings from all team members.
As the Strategist leading this phase:
1. What did the research CHANGE about our initial debate position?
2. What new risks or opportunities did the research reveal?
3. What is your REFINED strategic recommendation?
4. Where should the team commit — and where should they cut?

Be decisive. The team needs direction, not more questions.
Speak in your authentic voice — first person, direct, opinionated.
Max 300 words.`;

  terminalLines.push({ text: `--- ${personas.strategist} leads informed debate ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const strategistOutput = await runClaudeStreaming(strategistPrompt, strategistMessage, 10, terminalLines, onTerminalUpdate, personas.strategist, isDiscovery);

  // Step 2: Architect responds
  const architectPrompt = getAgentSystemPrompt(`hack-t${teamNum}-architect`);
  const architectMessage = `PHASE 3: INFORMED DEBATE — Architect Response

${context}

The Strategist has proposed a refined direction based on research:
---
${strategistOutput.slice(0, 1000)}
---

Respond as the Architect:
1. Does this hold up to first-principles scrutiny?
2. What's technically sound vs. what's wishful thinking?
3. Your refined technical position in 2-3 sentences.

Be rigorous. Challenge anything that doesn't hold up.
Max 200 words.`;

  terminalLines.push({ text: `--- ${personas.architect} challenges ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const architectOutput = await runClaudeStreaming(architectPrompt, architectMessage, 10, terminalLines, onTerminalUpdate, personas.architect, isDiscovery);

  // Step 3: Builder responds
  const builderPrompt = getAgentSystemPrompt(`hack-t${teamNum}-builder`);
  const builderMessage = `PHASE 3: INFORMED DEBATE — Builder Response

${context}

Strategist's position:
---
${strategistOutput.slice(0, 800)}
---

Architect's response:
---
${architectOutput.slice(0, 800)}
---

Respond as the Builder:
1. Can we actually BUILD this in the time we have?
2. What needs to be cut for this to be feasible?
3. Your implementation verdict in 2-3 sentences.

Be practical. If it can't be built, say so.
Max 200 words.`;

  terminalLines.push({ text: `--- ${personas.builder} reality-checks ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const builderOutput = await runClaudeStreaming(builderPrompt, builderMessage, 10, terminalLines, onTerminalUpdate, personas.builder, isDiscovery);

  const fullDebate = `# Phase 3: Informed Debate — Hour ${hour}

## ${personas.strategist} — Lead
${strategistOutput}

## ${personas.architect} — Response
${architectOutput}

## ${personas.builder} — Response
${builderOutput}
`;
  writeArtifact(hourDir, 'informed-debate-transcript.md', fullDebate);

  return `INFORMED DEBATE:\n\n[${personas.strategist}]: ${strategistOutput.slice(0, 400)}\n\n[${personas.architect}]: ${architectOutput.slice(0, 300)}\n\n[${personas.builder}]: ${builderOutput.slice(0, 300)}`;
}

async function runPhase4_Decision(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const architectAgent = `hack-t${teamNum}-architect`;
  const systemPrompt = getAgentSystemPrompt(architectAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 4: DECISION (3 minutes)

${context}

As the Architect, you have decision authority. Lock in the decision for this hour.

Produce a decision.yaml with these fields:
- hour, team_id, decision, rationale, success_metric, tasks, risks_accepted

Output the YAML content between \`\`\`yaml and \`\`\` markers.`;

  const isDiscovery = hourObjective.arcPhase === 'Discovery';
  const output = await runClaudeStreaming(systemPrompt, message, 20, terminalLines, onTerminalUpdate, getPersonas(teamId).architect, isDiscovery);

  const yamlMatch = output.match(/```yaml\n([\s\S]*?)```/);
  if (yamlMatch) {
    writePhaseOutput(hourDir, 'decision.yaml', yamlMatch[1]);
  } else {
    writePhaseOutput(hourDir, 'decision.yaml', `# Phase 4 Decision\nhour: ${hour}\nteam_id: "${teamId}"\nraw_output: |\n  ${output.slice(0, 2000)}`);
  }

  return output;
}

async function runPhase5_Mockups(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const builderAgent = `hack-t${teamNum}-builder`;
  const systemPrompt = getAgentSystemPrompt(builderAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);
  const isDiscovery = hourObjective.arcPhase === 'Discovery';

  const deliverableInstruction = isDiscovery
    ? `CRITICAL CONSTRAINT: This is a DISCOVERY hour.
DO NOT create code, prototypes, or HTML files.
Produce ONLY: written plans, specifications, analysis documents, architecture diagrams (as text).
${hourObjective.doNot || ''}
Your output must be a written document saved as a markdown file, NOT code.`
    : `CRITICAL REQUIREMENT -- HTML PROTOTYPES:
All prototypes MUST be built as standalone HTML files. When the team decides what to build,
the first implementation artifact must be a single self-contained .html file that demonstrates
the concept. This means:
- One .html file with inline CSS and JavaScript (no external dependencies unless via CDN)
- The file must open in a browser and show a working prototype
- Use modern HTML5, CSS3, and vanilla JS (or include libraries via CDN links)
- The prototype proves the concept visually and interactively
- Save as: {team_hour_dir}/artifacts/prototype.html

This is non-negotiable. Documents and specs are secondary -- the HTML prototype is the primary deliverable.`;

  const message = `PHASE 5: MOCKUPS/PLANS (7 minutes)

${context}

As the Builder, create mockups, specs, or plans for what will be built this hour.
Based on the decision from Phase 4, produce:
1. A clear implementation plan or mockup
2. Technical specifications
3. Acceptance criteria

${deliverableInstruction}

Save your output as a structured document.`;
  const output = await runClaudeStreaming(systemPrompt, message, 20, terminalLines, onTerminalUpdate, getPersonas(teamId).builder, isDiscovery);
  writeArtifact(hourDir, 'mockups-plans.md', output);
  return output;
}

async function runPhase6_TestMockups(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const strategistAgent = `hack-t${teamNum}-strategist`;
  const systemPrompt = getAgentSystemPrompt(strategistAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 6: TEST MOCKUPS (5 minutes)

${context}

As the Strategist, validate the mockups/plans from Phase 5 against:
1. The judging rubric criteria
2. The hour's key question
3. Known risks
4. User impact

Provide a validation assessment with pass/fail for each criterion and specific improvement suggestions.`;

  const isDiscovery = hourObjective.arcPhase === 'Discovery';
  const output = await runClaudeStreaming(systemPrompt, message, 20, terminalLines, onTerminalUpdate, getPersonas(teamId).strategist, isDiscovery);
  writeArtifact(hourDir, 'mockup-validation.md', output);
  return output;
}

async function runPhase7_DebateMockups(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);
  const isDiscovery = hourObjective.arcPhase === 'Discovery';
  const personas = getPersonas(teamId);

  // REAL multi-agent mockup debate: Architect critiques, Strategist assesses, Builder gives verdict

  // Step 1: Architect critiques mockups
  const architectPrompt = getAgentSystemPrompt(`hack-t${teamNum}-architect`);
  const architectMessage = `PHASE 7: DEBATE MOCKUPS — Architect Critique (You Speak First)

${context}

The mockups and validation results are in. As the Architect, critique them:
1. Do the mockups reflect sound technical architecture? Where do they fall short?
2. What is structurally weak or over-engineered?
3. What MUST change before execution begins?

Be rigorous. If the mockups are solid, say so — but flag anything that will cause problems downstream.
Speak in your authentic voice — first person, direct, opinionated.
Max 200 words.`;

  terminalLines.push({ text: `--- ${personas.architect} critiques mockups ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const architectOutput = await runClaudeStreaming(architectPrompt, architectMessage, 10, terminalLines, onTerminalUpdate, personas.architect, isDiscovery);

  // Step 2: Strategist assesses competitiveness
  const strategistPrompt = getAgentSystemPrompt(`hack-t${teamNum}-strategist`);
  const strategistMessage = `PHASE 7: DEBATE MOCKUPS — Strategist Assessment

${context}

The Architect has critiqued the mockups:
---
${architectOutput.slice(0, 800)}
---

As the Strategist, assess the competitive positioning:
1. Will these mockups impress judges? What is the "wow factor" — or lack of it?
2. How does this compare to what top competing teams would produce?
3. What one change would most improve our competitive position?

Think about winning. Be ruthlessly strategic.
Speak in your authentic voice — first person, direct, opinionated.
Max 200 words.`;

  terminalLines.push({ text: `--- ${personas.strategist} assesses competitiveness ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const strategistOutput = await runClaudeStreaming(strategistPrompt, strategistMessage, 10, terminalLines, onTerminalUpdate, personas.strategist, isDiscovery);

  // Step 3: Builder gives final verdict and commitment
  const builderPrompt = getAgentSystemPrompt(`hack-t${teamNum}-builder`);
  const builderMessage = `PHASE 7: DEBATE MOCKUPS — Builder Final Verdict

${context}

Architect's critique:
---
${architectOutput.slice(0, 800)}
---

Strategist's assessment:
---
${strategistOutput.slice(0, 800)}
---

As the Builder, give the final verdict:
1. Can this be BUILT as specified in the time remaining? Be honest.
2. What needs to be cut or simplified for feasibility?
3. What is your COMMITMENT — what will you deliver, and what will you NOT deliver?

This is the last word before execution. Be practical and decisive.
Speak in your authentic voice — first person, direct, opinionated.
Max 200 words.`;

  terminalLines.push({ text: `--- ${personas.builder} gives final verdict ---`, time: new Date().toISOString(), type: 'phase' });
  onTerminalUpdate?.(terminalLines);

  const builderOutput = await runClaudeStreaming(builderPrompt, builderMessage, 10, terminalLines, onTerminalUpdate, personas.builder, isDiscovery);

  // Save full debate transcript
  const fullDebate = `# Phase 7: Mockup Debate — Hour ${hour}

## ${personas.architect} — Critique
${architectOutput}

## ${personas.strategist} — Competitive Assessment
${strategistOutput}

## ${personas.builder} — Final Verdict
${builderOutput}
`;

  writeArtifact(hourDir, 'mockup-debate-transcript.md', fullDebate);

  return `MOCKUP DEBATE:\n\n[${personas.architect}]: ${architectOutput.slice(0, 300)}\n\n[${personas.strategist}]: ${strategistOutput.slice(0, 300)}\n\n[${personas.builder}]: ${builderOutput.slice(0, 300)}`;
}

async function runPhase8_ExecuteDecision(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const coordAgent = `hack-t${teamNum}-coord`;
  const systemPrompt = getAgentSystemPrompt(coordAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);
  const isDiscovery = hourObjective.arcPhase === 'Discovery';

  const handoffInstruction = isDiscovery
    ? `As the Coordinator, create the handoff document for the JP Rocks execution team.
This handoff must include:
1. Exactly what to produce -- the PRIMARY deliverable is a written document (markdown)
2. Acceptance criteria -- must include "document is comprehensive, well-structured, and saved as markdown"
3. File paths for inputs and outputs -- document goes to {hourDir}/artifacts/
4. Any constraints or requirements
${hourObjective.doNot || ''}

MANDATORY: The handoff MUST instruct the JP Rocks team to produce a written document, NOT code or prototypes.
This is a DISCOVERY hour. No code, no HTML, no prototypes. Only markdown documents.`
    : `As the Coordinator, create the handoff document for the JP Rocks execution team.
This handoff must include:
1. Exactly what to build/produce -- the PRIMARY deliverable is a standalone HTML prototype
2. Acceptance criteria -- must include "prototype.html opens in browser and demonstrates the concept"
3. File paths for inputs and outputs -- prototype goes to {hourDir}/artifacts/prototype.html
4. Any constraints or requirements

MANDATORY: The handoff MUST instruct the JP Rocks team to produce a self-contained HTML prototype file.
The HTML file should use inline CSS/JS, work standalone in a browser, and visually demonstrate the concept.
This is the proof-of-work artifact that gets presented to judges.`;

  const designFirmInstruction = (hourObjective.arcPhase === 'Hardening + Polish') ? `

DESIGN FIRM INTEGRATION:
If the team's decision includes bringing in a design firm, include this in the handoff.yaml:
- design_firm_key: The firm identifier (e.g., "paul-rand" or "studio-rand")
- design_firm_focus: What aspects the firm should focus on
- design_firm_agent: The agent name to invoke (e.g., "paul-rand-agent" or "studio-director-rand")

The JP Rocks execution team will read this from the handoff and invoke the design firm as part of their execution.
` : (hour === 7) ? `

DESIGN FIRM CONSULTATION (OPTIONAL — ONE MAJOR RECOMMENDATION):
If the team chose to consult a design firm during the debate, include this in the handoff.yaml:
- design_firm_key: The firm identifier (e.g., "paul-rand" or "studio-rand")
- design_firm_focus: The ONE aspect the firm should advise on
- design_firm_agent: The agent name to invoke (e.g., "paul-rand-agent" or "studio-director-rand")
- design_firm_mode: "advisory" (one major recommendation only, not a full critique)

The JP Rocks execution team will read this and get ONE major piece of design advice before finalizing the prototype.
` : '';

  const message = `PHASE 8: EXECUTE DECISION (2 minutes)

${context}

${handoffInstruction}
${designFirmInstruction}
Produce a handoff.yaml with clear, actionable instructions.
Output the YAML content between \`\`\`yaml and \`\`\` markers.`;
  const output = await runClaudeStreaming(systemPrompt, message, 20, terminalLines, onTerminalUpdate, getPersonas(teamId).coordinator, isDiscovery);

  const yamlMatch = output.match(/```yaml\n([\s\S]*?)```/);
  if (yamlMatch) {
    writePhaseOutput(hourDir, 'handoff.yaml', yamlMatch[1]);
  } else {
    writePhaseOutput(hourDir, 'handoff.yaml', `# Phase 8 Handoff\nhour: ${hour}\nteam_id: "${teamId}"\nraw_output: |\n  ${output.slice(0, 2000)}`);
  }

  return output;
}

async function runPhase9_JPRocksExecution(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const teamNumInt = parseInt(teamNum, 10);
  const agentSuffix = teamNumInt === 1 ? '' : `-team${teamNumInt}`;
  const agents = {
    planBuilder: `plan-builder-agent${agentSuffix}`,
    planValidation: `plan-validation-agent${agentSuffix}`,
    execution: `execution-agent${agentSuffix}`,
    playwrightTest: `playwright-test-agent${agentSuffix}`,
  };

  const handoffPath = resolve(hourDir, 'handoff.yaml');
  let handoff = '';
  if (existsSync(handoffPath)) {
    handoff = readFileSync(handoffPath, 'utf-8');
  }

  const recentPhases = previousOutputs.slice(-3).map(o => `Phase ${o.phase} (${o.name}): ${o.output.slice(0, 300)}`).join('\n');

  const isDiscoveryPhase = hourObjective.arcPhase === 'Discovery';

  const primaryDeliverable = isDiscoveryPhase
    ? `written document (markdown) in ${hourDir}/artifacts/`
    : `standalone HTML prototype at ${hourDir}/artifacts/prototype.html`;

  const executionPurpose = isDiscoveryPhase
    ? `Writes documents (markdown), NOT code`
    : `Implements the plan, produces prototype.html`;

  const designFirmFromHandoff = (hourObjective.arcPhase === 'Hardening + Polish') ? `

## DESIGN FIRM (if specified in handoff)

If the handoff.yaml includes a design_firm_key and design_firm_agent, spawn that agent AFTER the execution agent finishes the prototype but BEFORE the test agent:

### Phase D.5: DESIGN FIRM CRITIQUE
Spawn the specified design firm agent via Task:
- Tell it to review and critique the prototype at: ${hourDir}/artifacts/prototype.html
- Tell it to focus on the areas specified in design_firm_focus
- Tell it the prototype must remain self-contained (inline CSS/JS)
- Tell it to suggest and implement the most impactful visual/UX improvements
- max_turns: 30

If no design_firm is specified in the handoff, skip this phase entirely.
The team's debate decided whether to bring in a firm — respect their decision.
` : (hour === 7) ? `

## DESIGN FIRM ADVISORY (if specified in handoff)

If the handoff.yaml includes a design_firm_key and design_firm_agent with design_firm_mode "advisory", spawn that agent AFTER the execution agent finishes the prototype but BEFORE the test agent:

### Phase D.5: DESIGN FIRM — ONE MAJOR RECOMMENDATION
Spawn the specified design firm agent via Task:
- Tell it to review the prototype at: ${hourDir}/artifacts/prototype.html
- Tell it to focus on the area specified in design_firm_focus
- Tell it this is an ADVISORY consultation — provide ONE major piece of design advice, not a full critique
- Tell it to identify the single most impactful design improvement and implement it
- Tell it the prototype must remain self-contained (inline CSS/JS)
- max_turns: 20

This is a lighter touch than Hours 8-9. The firm gives one high-impact recommendation to help the team think about presentation quality before the final Hardening + Polish phase.

If no design_firm is specified in the handoff, skip this phase entirely.
` : '';

  const systemPrompt = `You are the JP Rocks Coordinator for Hackathon Team ${teamId}, Hour ${hour}.

You coordinate a real JP Rocks waterfall by spawning specialized sub-agents using the Task tool.
You do NOT implement anything yourself. You ONLY coordinate.

## YOUR AGENTS (spawn via Task tool)

| Role | Agent Name (subagent_type) | Purpose |
|------|---------------------------|---------|
| Plan Builder | ${agents.planBuilder} | Creates ${isDiscoveryPhase ? 'document plan' : 'implementation plan'} from handoff |
| Plan Validator | ${agents.planValidation} | Validates plan completeness |
| Execution | ${agents.execution} | ${executionPurpose} |
| Tester | ${agents.playwrightTest} | Verifies ${isDiscoveryPhase ? 'document quality' : 'prototype works'} |

## WATERFALL — Execute in This Order

### Phase A: PLAN
Spawn ${agents.planBuilder} via Task:
- Pass the full handoff.yaml content
- Tell it the artifact directory: ${hourDir}/artifacts/
- Tell it the primary deliverable: ${primaryDeliverable}
- Tell it to produce a numbered step-by-step plan
- Budget guidance: ~15 turns should be plenty for planning

### Phase B: VALIDATE
Spawn ${agents.planValidation} via Task:
- Pass the plan from Phase A
- Tell it to check: Is the plan complete? Does it cover all acceptance criteria?
- Tell it to confirm the output path in ${hourDir}/artifacts/
- Budget guidance: ~10 turns should be enough for validation

### Phase C: EXECUTE
Spawn ${agents.execution} via Task:
- Pass the validated plan
- Tell it to implement step by step
${isDiscoveryPhase
    ? `- CRITICAL: This is a DISCOVERY hour. It MUST write markdown documents to ${hourDir}/artifacts/
- DO NOT write any code files (.html, .js, .ts, .css, .json)
- Only markdown (.md), YAML (.yaml), and text (.txt) files are permitted
${hourObjective.doNot || ''}`
    : `- CRITICAL: It MUST write ${hourDir}/artifacts/prototype.html
- The prototype must be self-contained (inline CSS/JS, CDN links OK)
- It must visually demonstrate the concept from the handoff`}
- Budget guidance: this is the heaviest phase, ~30 turns is typical but use what you need

### Phase D: TEST (if time permits)
Spawn ${agents.playwrightTest} via Task:
${isDiscoveryPhase
    ? `- Tell it to verify document files exist in ${hourDir}/artifacts/
- Verify documents are well-structured and comprehensive
- Verify no code files were accidentally created`
    : `- Tell it to open ${hourDir}/artifacts/prototype.html in Playwright
- Verify it renders without errors
- Verify basic interactivity works`}
- Budget guidance: ~20 turns is typical for testing
${designFirmFromHandoff}
## TASK TOOL SYNTAX

To spawn an agent:
Task(
  subagent_type: "${agents.planBuilder}",
  prompt: "Your detailed instructions here...",
  description: "Plan building for T${teamNum} H${hour}"
)

## TIME MANAGEMENT

Total budget: 12 minutes. Priorities if time is short:
1. EXECUTE is mandatory — ${isDiscoveryPhase ? 'documents must be written' : 'prototype.html must exist'}
2. PLAN is mandatory — execution needs a plan
3. VALIDATE is important but can be brief
4. TEST is nice-to-have — skip if under 3 minutes remaining

## EDGE CASES

If the handoff says "no implementation needed" or the hour has no deliverable:
- Still spawn the plan-builder to confirm nothing is needed
- ${isDiscoveryPhase ? 'Write a minimal summary document explaining the hour\'s status' : 'Write a minimal prototype.html that documents the hour\'s status'}
- Produce a summary explaining why no major work was done

## OUTPUT

After all agents complete, produce a structured summary:
- What was planned (1-2 sentences)
- What was executed (1-2 sentences)
- ${isDiscoveryPhase ? 'Whether documents were created (yes/no + paths)' : 'Whether prototype.html was created (yes/no + path)'}
- Test results if testing ran
- Acceptance criteria status (met/not met/partial)`;

  const message = `PHASE 9: JP ROCKS EXECUTION (12 minutes)

You are coordinating a real JP Rocks agent team. Use the Task tool to spawn your agents.

HANDOFF DOCUMENT:
${handoff}

HOUR CONTEXT:
- Team: ${teamId}
- Hour: ${hour}
- Arc Phase: ${hourObjective.arcPhase}
- Objective: ${hourObjective.objective}
- Expected Deliverable: ${hourObjective.expectedDeliverable}

PREVIOUS PHASE CONTEXT:
${recentPhases}

ARTIFACT DIRECTORY: ${hourDir}/artifacts/
PRIMARY OUTPUT: ${primaryDeliverable}

INSTRUCTIONS:
1. Read and analyze the handoff document
2. Spawn your plan-builder agent with the handoff details
3. Spawn your plan-validation agent to verify the plan
4. Spawn your execution agent to implement (MUST produce ${isDiscoveryPhase ? 'markdown documents' : 'prototype.html'})
5. If time permits, spawn your test agent to verify
6. Produce a final summary of what was accomplished

DO NOT implement anything yourself. Use the Task tool to delegate to your agents.`;

  const isDiscovery = hourObjective.arcPhase === 'Discovery';
  // Let Phase 9 run as long as needed — 60 min safety net, actively monitored
  const phase9Timeout = 60 * 60 * 1000;
  const output = await runClaudeStreaming(systemPrompt, message, 50, terminalLines, onTerminalUpdate, 'JP Rocks', isDiscovery, phase9Timeout);
  writeArtifact(hourDir, 'jp-rocks-execution-log.md', output);
  return output;
}

async function runPhase10_ReviewResults(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const coordAgent = `hack-t${teamNum}-coord`;
  const systemPrompt = getAgentSystemPrompt(coordAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 10: REVIEW RESULTS (3 minutes)

${context}

Review the output from Phase 9 (JP Rocks Execution). Assess:
1. Were the acceptance criteria met?
2. Quality of the deliverable
3. Any issues that need addressing
4. How this advances the overall project

Produce a brief review summary.`;

  const isDiscovery = hourObjective.arcPhase === 'Discovery';
  return await runClaudeStreaming(systemPrompt, message, 20, terminalLines, onTerminalUpdate, getPersonas(teamId).coordinator, isDiscovery);
}

async function runPhase11_JudgePresentation(teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate) {
  const teamNum = teamIdToNum(teamId);
  const strategistAgent = `hack-t${teamNum}-strategist`;
  const systemPrompt = getAgentSystemPrompt(strategistAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 11: JUDGE PRESENTATION (3 minutes)

${context}

As the Strategist, prepare a concise presentation of this hour's deliverable for the judge panel.
Include:
1. What was the objective
2. What was produced
3. How it aligns with the judging rubric
4. Key evidence of quality
5. What comes next

Produce a proof-packet.yaml with:
- hour, team_id, deliverable_summary, rubric_alignment, evidence, quality_score, next_hour_preview

Output the YAML content between \`\`\`yaml and \`\`\` markers.`;

  const isDiscovery = hourObjective.arcPhase === 'Discovery';
  const output = await runClaudeStreaming(systemPrompt, message, 20, terminalLines, onTerminalUpdate, getPersonas(teamId).strategist, isDiscovery);

  const yamlMatch = output.match(/```yaml\n([\s\S]*?)```/);
  if (yamlMatch) {
    writePhaseOutput(hourDir, 'proof-packet.yaml', yamlMatch[1]);
  } else {
    writePhaseOutput(hourDir, 'proof-packet.yaml', `# Phase 11 Proof Packet\nhour: ${hour}\nteam_id: "${teamId}"\nraw_output: |\n  ${output.slice(0, 2000)}`);
  }

  return output;
}

// --- Main Execution ---

async function main() {
  const args = parseArgs();

  if (!args.team || !args.hour) {
    console.error('Usage: node scripts/run-team-hour.js --team TXX --hour N');
    process.exit(1);
  }

  const { team: teamId, hour } = args;
  const teamNum = teamIdToNum(teamId);
  const hourDir = getHourDir(teamId, hour);
  const hourObjective = getHourObjective(hour);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEAM ${teamId} - HOUR ${hour} - ${hourObjective.arcPhase}`);
  console.log(`Objective: ${hourObjective.objective}`);
  console.log(`${'='.repeat(60)}\n`);

  // Ensure directories exist
  ensureDir(hourDir);
  ensureDir(resolve(hourDir, 'artifacts'));

  // Initialize Firebase
  try {
    initFirebase();
    console.log('Firebase initialized and connected.');
  } catch (error) {
    console.error('FATAL: Firebase init failed:', error.message);
    console.error('Terminal output will not be persisted. Aborting.');
    process.exit(1);
  }

  // Phase runners in order
  const phaseRunners = [
    runPhase1_Debate,
    runPhase2_Research,
    runPhase3_InformedDebate,
    runPhase4_Decision,
    runPhase5_Mockups,
    runPhase6_TestMockups,
    runPhase7_DebateMockups,
    runPhase8_ExecuteDecision,
    runPhase9_JPRocksExecution,
    runPhase10_ReviewResults,
    runPhase11_JudgePresentation,
  ];

  const previousOutputs = [];
  const terminalLines = [];

  // Set initial LiveView status
  if (db) {
    const liveTeamId = `t${teamNum}`;
    try {
      await db.ref(`teams/${liveTeamId}`).update({
        status: 'active',
        currentPhase: 'Starting',
        hour: hour,
        problem: hourObjective.objective,
      });
      await db.ref(`hackathon/hours/hour${hour}/teams/${liveTeamId}`).update({
        phase: 'Starting',
        status: 'active',
        terminal: [],
        problem: hourObjective.objective,
      });
    } catch (e) {
      console.error('WARNING: LiveView init failed:', e.message);
    }
  }

  // Streaming update callback -- pushes terminal lines to Firebase in real-time
  const onTerminalUpdate = async (lines) => {
    if (!db) return;
    try {
      const activePhase = existsSync(ACTIVE_PHASE_MARKER)
        ? readFileSync(ACTIVE_PHASE_MARKER, 'utf-8').trim()
        : '';
      const [phaseIdStr, phaseName] = activePhase.split(':');
      const phaseId = parseInt(phaseIdStr, 10) || 0;
      await updatePhaseInFirebase(teamId, hour, phaseId, phaseName || 'unknown', 'running', lines, hourObjective);
    } catch (err) { console.error(`WARNING: Firebase streaming update failed (${lines.length} lines): ${err.message}`); }
  };

  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    console.log(`\n--- Phase ${phase.id}: ${phase.name} (${phase.duration}min, lead: ${phase.lead}) ---`);

    writeFileSync(ACTIVE_PHASE_MARKER, `${phase.id}:${phase.name}`, 'utf-8');

    // Add terminal line for phase start
    terminalLines.push({
      text: `Phase ${phase.id}: ${phase.name} -- running...`,
      time: new Date().toISOString(),
      type: 'phase',
    });

    await updatePhaseInFirebase(teamId, hour, phase.id, phase.name, 'running', terminalLines, hourObjective);

    const startTime = Date.now();

    try {
      const output = await phaseRunners[i](teamId, hour, hourObjective, hourDir, previousOutputs, terminalLines, onTerminalUpdate);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      previousOutputs.push({
        phase: phase.id,
        name: phase.name,
        output: typeof output === 'string' ? output.slice(0, 1000) : JSON.stringify(output).slice(0, 1000),
      });

      // Add terminal line for phase completion
      terminalLines.push({
        text: `Phase ${phase.id}: ${phase.name} -- completed (${elapsed}s)`,
        time: new Date().toISOString(),
        type: 'success',
      });

      console.log(`  Phase ${phase.id} completed in ${elapsed}s`);
      await updatePhaseInFirebase(teamId, hour, phase.id, phase.name, 'completed', terminalLines, hourObjective);
    } catch (error) {
      console.error(`  Phase ${phase.id} FAILED: ${error.message}`);

      // Add terminal line for phase failure
      terminalLines.push({
        text: `Phase ${phase.id}: ${phase.name} -- FAILED: ${error.message}`,
        time: new Date().toISOString(),
        type: 'error',
      });

      await updatePhaseInFirebase(teamId, hour, phase.id, phase.name, 'failed', terminalLines, hourObjective);

      previousOutputs.push({
        phase: phase.id,
        name: phase.name,
        output: `FAILED: ${error.message}`,
      });
    }
  }

  // Final guaranteed write of complete terminal log to Firebase
  if (db) {
    try {
      await updatePhaseInFirebase(teamId, hour, 11, 'Complete', 'completed', terminalLines, hourObjective);
      console.log(`  Final terminal state written to Firebase (${terminalLines.length} lines)`);
    } catch (err) {
      console.error(`  WARNING: Final Firebase write failed: ${err.message}`);
    }
  }

  // Write hour summary for persistent memory
  const memoryDir = resolve(getTeamDir(teamId), 'memory');
  ensureDir(memoryDir);
  const hourSummary = `# Hour ${hour} Summary — ${hourObjective.arcPhase}
Objective: ${hourObjective.objective}
Deliverable: ${hourObjective.expectedDeliverable}

## Phase Results
${previousOutputs.map(o => `### Phase ${o.phase}: ${o.name}\n${o.output.slice(0, 200)}`).join('\n\n')}

## Key Decisions
${previousOutputs.filter(o => o.phase === 4).map(o => o.output.slice(0, 500)).join('\n') || 'No formal decision recorded.'}

Completed at: ${new Date().toISOString()}
`;
  writeFileSync(resolve(memoryDir, `hour-${hour}-summary.md`), hourSummary, 'utf-8');
  console.log(`  Hour summary saved to: ${resolve(memoryDir, `hour-${hour}-summary.md`)}`);

  // NEW: Update cumulative team memory
  try {
    const memoryEntry = buildTeamMemoryEntry(teamId, hour, hourObjective, previousOutputs);
    updateTeamMemory(teamId, hour, memoryEntry);
    console.log(`  Team memory updated: ${resolve(memoryDir, 'team-memory.md')}`);
  } catch (err) {
    console.error(`  WARNING: Team memory update failed: ${err.message}`);
  }

  // Write plan-card.yaml summary
  const planCard = `hour: ${hour}
team_id: "${teamId}"
arc_phase: "${hourObjective.arcPhase}"
objective: "${hourObjective.objective}"
phases_completed: ${previousOutputs.filter(o => !o.output.startsWith('FAILED')).length}
phases_total: 11
completed_at: "${new Date().toISOString()}"
`;
  writePhaseOutput(hourDir, 'plan-card.yaml', planCard);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEAM ${teamId} HOUR ${hour} COMPLETE`);
  console.log(`Phases completed: ${previousOutputs.filter(o => !o.output.startsWith('FAILED')).length}/11`);
  console.log(`Artifacts directory: ${hourDir}/artifacts/`);
  console.log(`${'='.repeat(60)}\n`);
}

main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
