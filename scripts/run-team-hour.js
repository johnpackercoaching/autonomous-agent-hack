#!/usr/bin/env node

/**
 * Per-Team-Per-Hour Pipeline
 *
 * Runs ONE team for ONE hour through the 11-phase cycle.
 *
 * Usage:
 *   node scripts/run-team-hour.js --team T01 --hour 1
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
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
  { name: 'Discovery',   start: 1,   end: 10  },
  { name: 'Foundation',  start: 11,  end: 30  },
  { name: 'Core Build',  start: 31,  end: 80  },
  { name: 'Depth',       start: 81,  end: 130 },
  { name: 'Hardening',   start: 131, end: 170 },
  { name: 'Polish',      start: 171, end: 190 },
  { name: 'Ship',        start: 191, end: 200 },
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

    return {
      hour,
      arcPhase: getArcPhase(hour),
      objective: objectiveMatch ? objectiveMatch[1] : title,
      expectedDeliverable: deliverableMatch ? deliverableMatch[1] : '',
      keyQuestion: keyQuestionMatch ? keyQuestionMatch[1] : '',
      risk: riskMatch ? riskMatch[1] : '',
    };
  }

  return {
    hour,
    arcPhase: getArcPhase(hour),
    objective: `Hour ${hour}`,
    expectedDeliverable: '',
    keyQuestion: '',
    risk: '',
  };
}

function runClaude(systemPromptFile, userMessage, maxTurns = 20) {
  // Write system prompt to temp file to avoid shell escaping issues
  const tmpPromptPath = resolve(PROJECT_ROOT, '.tmp-system-prompt.md');
  const tmpMessagePath = resolve(PROJECT_ROOT, '.tmp-user-message.md');

  writeFileSync(tmpPromptPath, systemPromptFile, 'utf-8');
  writeFileSync(tmpMessagePath, userMessage, 'utf-8');

  const cmd = `claude --print --system-prompt "$(cat '${tmpPromptPath}')" "$(cat '${tmpMessagePath}')" --max-turns ${maxTurns}`;

  try {
    const output = execSync(cmd, {
      cwd: PROJECT_ROOT,
      timeout: 15 * 60 * 1000, // 15 minute timeout per phase
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: (() => {
        const env = { ...process.env };
        // Remove ALL Claude Code session markers to allow nested invocation
        delete env.CLAUDECODE;
        delete env.CLAUDE_CODE;
        delete env.CLAUDE_CODE_ENTRYPOINT;
        delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
        delete env.CLAUDE_CODE_PARENT;
        return env;
      })(),
    });
    return output.toString('utf-8');
  } catch (error) {
    console.error(`Claude execution failed: ${error.message}`);
    return `ERROR: ${error.message}`;
  } finally {
    // Cleanup temp files
    try {
      if (existsSync(tmpPromptPath)) writeFileSync(tmpPromptPath, '', 'utf-8');
      if (existsSync(tmpMessagePath)) writeFileSync(tmpMessagePath, '', 'utf-8');
    } catch (_) { /* ignore cleanup errors */ }
  }
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
  const hourPadded = padHour(hour);
  const teamNum = teamIdToNum(teamId);
  const liveTeamId = `t${teamNum}`;

  // Original path (keep for backward compat)
  const phaseRef = db.ref(`hackathon/hours/H-${hourPadded}/${teamId}/phases/${phaseId}`);
  await phaseRef.set({
    name: phaseName,
    status,
    updatedAt: new Date().toISOString(),
  });

  // LiveView-compatible path: hackathon/hours/hour{N}/teams/t{NN}/
  const liveHourRef = db.ref(`hackathon/hours/hour${hour}/teams/${liveTeamId}`);
  await liveHourRef.update({
    phase: phaseName,
    status: 'active',
    terminal: terminalLines || [],
    problem: hourObjective?.objective || '',
  });

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

PREVIOUS PHASE OUTPUTS THIS HOUR:
${previousOutputs.map(o => `--- Phase ${o.phase}: ${o.name} ---\n${o.output}\n`).join('\n')}

ARTIFACT DIRECTORY: ${getHourDir(teamId, hour)}/artifacts/
`.trim();
}

function runPhase1_Debate(teamId, hour, hourObjective, hourDir, previousOutputs) {
  const teamNum = teamIdToNum(teamId);
  const coordAgent = `hack-t${teamNum}-coord`;
  const systemPrompt = getAgentSystemPrompt(coordAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 1: DEBATE (8 minutes)

You are coordinating a structured debate for your team. This is Hour ${hour} of the Autonomous Agent Hackathon.

${context}

INSTRUCTIONS:
1. Frame the hour's problem and priorities based on the objective above.
2. Have your Architect present the problem definition and proposed approach.
3. Have your Builder assess technical feasibility.
4. Have your Strategist assess strategic positioning.
5. Converge on a single, testable approach through structured discussion.

Produce a debate-note.yaml with these fields:
- hour, team_id, phase, topic, architect_position, builder_position, strategist_position, consensus, dissent, next_action

Output the YAML content between \`\`\`yaml and \`\`\` markers.`;

  const output = runClaude(systemPrompt, message, 20);

  const yamlMatch = output.match(/```yaml\n([\s\S]*?)```/);
  if (yamlMatch) {
    writePhaseOutput(hourDir, 'debate-note.yaml', yamlMatch[1]);
  } else {
    writePhaseOutput(hourDir, 'debate-note.yaml', `# Phase 1 Debate Output\nhour: ${hour}\nteam_id: "${teamId}"\nraw_output: |\n  ${output.slice(0, 2000)}`);
  }

  return output;
}

function runPhase2_Research(teamId, hour, hourObjective, hourDir, previousOutputs) {
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

    const output = runClaude(systemPrompt, message, 20);
    results.push({ role, output });
    writeArtifact(hourDir, `research-${role}.md`, output);
  }

  return results.map(r => `[${r.role}]: ${r.output.slice(0, 500)}`).join('\n\n');
}

function runPhase3_InformedDebate(teamId, hour, hourObjective, hourDir, previousOutputs) {
  const teamNum = teamIdToNum(teamId);
  const coordAgent = `hack-t${teamNum}-coord`;
  const systemPrompt = getAgentSystemPrompt(coordAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 3: INFORMED DEBATE (5 minutes)

${context}

Now that research is complete, facilitate a focused debate incorporating the research findings.
The Strategist leads this phase. Key questions:
1. What did the research reveal that changes our initial position?
2. What risks were confirmed or discovered?
3. What is the refined approach?

Produce a brief informed-debate summary (max 300 words).`;

  return runClaude(systemPrompt, message, 20);
}

function runPhase4_Decision(teamId, hour, hourObjective, hourDir, previousOutputs) {
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

  const output = runClaude(systemPrompt, message, 20);

  const yamlMatch = output.match(/```yaml\n([\s\S]*?)```/);
  if (yamlMatch) {
    writePhaseOutput(hourDir, 'decision.yaml', yamlMatch[1]);
  } else {
    writePhaseOutput(hourDir, 'decision.yaml', `# Phase 4 Decision\nhour: ${hour}\nteam_id: "${teamId}"\nraw_output: |\n  ${output.slice(0, 2000)}`);
  }

  return output;
}

function runPhase5_Mockups(teamId, hour, hourObjective, hourDir, previousOutputs) {
  const teamNum = teamIdToNum(teamId);
  const builderAgent = `hack-t${teamNum}-builder`;
  const systemPrompt = getAgentSystemPrompt(builderAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 5: MOCKUPS/PLANS (7 minutes)

${context}

As the Builder, create mockups, specs, or plans for what will be built this hour.
Based on the decision from Phase 4, produce:
1. A clear implementation plan or mockup
2. Technical specifications
3. Acceptance criteria

CRITICAL REQUIREMENT -- HTML PROTOTYPES:
All prototypes MUST be built as standalone HTML files. When the team decides what to build,
the first implementation artifact must be a single self-contained .html file that demonstrates
the concept. This means:
- One .html file with inline CSS and JavaScript (no external dependencies unless via CDN)
- The file must open in a browser and show a working prototype
- Use modern HTML5, CSS3, and vanilla JS (or include libraries via CDN links)
- The prototype proves the concept visually and interactively
- Save as: {team_hour_dir}/artifacts/prototype.html

This is non-negotiable. Documents and specs are secondary -- the HTML prototype is the primary deliverable.

Save your output as a structured document.`;

  const output = runClaude(systemPrompt, message, 20);
  writeArtifact(hourDir, 'mockups-plans.md', output);
  return output;
}

function runPhase6_TestMockups(teamId, hour, hourObjective, hourDir, previousOutputs) {
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

  const output = runClaude(systemPrompt, message, 20);
  writeArtifact(hourDir, 'mockup-validation.md', output);
  return output;
}

function runPhase7_DebateMockups(teamId, hour, hourObjective, hourDir, previousOutputs) {
  const teamNum = teamIdToNum(teamId);
  const coordAgent = `hack-t${teamNum}-coord`;
  const systemPrompt = getAgentSystemPrompt(coordAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 7: DEBATE MOCKUPS (5 minutes)

${context}

Facilitate a critique session where all team members review the mockups and validation.
Focus on:
1. What needs to change before execution?
2. What is the final refined plan?
3. Any last objections?

Produce a brief summary of changes and final go/no-go for execution.`;

  return runClaude(systemPrompt, message, 20);
}

function runPhase8_ExecuteDecision(teamId, hour, hourObjective, hourDir, previousOutputs) {
  const teamNum = teamIdToNum(teamId);
  const coordAgent = `hack-t${teamNum}-coord`;
  const systemPrompt = getAgentSystemPrompt(coordAgent);
  const context = buildPhaseContext(teamId, hour, hourObjective, previousOutputs);

  const message = `PHASE 8: EXECUTE DECISION (2 minutes)

${context}

As the Coordinator, create the handoff document for the JP Rocks execution team.
This handoff must include:
1. Exactly what to build/produce -- the PRIMARY deliverable is a standalone HTML prototype
2. Acceptance criteria -- must include "prototype.html opens in browser and demonstrates the concept"
3. File paths for inputs and outputs -- prototype goes to {hourDir}/artifacts/prototype.html
4. Any constraints or requirements

MANDATORY: The handoff MUST instruct the JP Rocks team to produce a self-contained HTML prototype file.
The HTML file should use inline CSS/JS, work standalone in a browser, and visually demonstrate the concept.
This is the proof-of-work artifact that gets presented to judges.

Produce a handoff.yaml with clear, actionable instructions.
Output the YAML content between \`\`\`yaml and \`\`\` markers.`;

  const output = runClaude(systemPrompt, message, 20);

  const yamlMatch = output.match(/```yaml\n([\s\S]*?)```/);
  if (yamlMatch) {
    writePhaseOutput(hourDir, 'handoff.yaml', yamlMatch[1]);
  } else {
    writePhaseOutput(hourDir, 'handoff.yaml', `# Phase 8 Handoff\nhour: ${hour}\nteam_id: "${teamId}"\nraw_output: |\n  ${output.slice(0, 2000)}`);
  }

  return output;
}

function runPhase9_JPRocksExecution(teamId, hour, hourObjective, hourDir, previousOutputs) {
  const teamNum = teamIdToNum(teamId);
  const hourPadded = padHour(hour);
  const jpRocksTeamName = `hackathon-t${teamNum}-h${hourPadded}`;

  const handoffPath = resolve(hourDir, 'handoff.yaml');
  let handoff = '';
  if (existsSync(handoffPath)) {
    handoff = readFileSync(handoffPath, 'utf-8');
  }

  const systemPrompt = `You are a JP Rocks execution agent for the Autonomous Agent Hackathon.
Team: ${teamId}, Hour: ${hour}, JP Rocks Team: ${jpRocksTeamName}

Your job is to execute the handoff instructions precisely. Follow the JP Rocks waterfall:
1. Plan: Create a detailed implementation plan from the handoff
2. Validate: Confirm the plan is complete and actionable
3. Execute: Implement the plan with zero deviation
4. Verify: Confirm all acceptance criteria are met

Work in the team's hour directory: ${hourDir}/artifacts/
Save all outputs there.`;

  const message = `PHASE 9: JP ROCKS EXECUTION (12 minutes)

HANDOFF DOCUMENT:
${handoff}

HOUR CONTEXT:
- Team: ${teamId}
- Hour: ${hour}
- Arc Phase: ${hourObjective.arcPhase}
- Objective: ${hourObjective.objective}
- Expected Deliverable: ${hourObjective.expectedDeliverable}

Execute the handoff instructions. Produce the expected deliverable.
Save all artifacts to: ${hourDir}/artifacts/

MANDATORY -- HTML PROTOTYPE REQUIREMENT:
Your PRIMARY output must be a standalone HTML prototype file saved as: ${hourDir}/artifacts/prototype.html
- Self-contained: inline CSS and JavaScript, no external files (CDN links are OK)
- Must open in any browser and visually demonstrate the concept
- Use modern HTML5, CSS3, vanilla JS or CDN-loaded libraries
- This is the proof-of-work artifact presented to judges each hour
- Write the COMPLETE HTML file content -- do not stub or placeholder

When complete, produce a summary of what was created and whether acceptance criteria were met.`;

  const output = runClaude(systemPrompt, message, 25);
  writeArtifact(hourDir, 'jp-rocks-execution-log.md', output);
  return output;
}

function runPhase10_ReviewResults(teamId, hour, hourObjective, hourDir, previousOutputs) {
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

  return runClaude(systemPrompt, message, 20);
}

function runPhase11_JudgePresentation(teamId, hour, hourObjective, hourDir, previousOutputs) {
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

  const output = runClaude(systemPrompt, message, 20);

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
  } catch (error) {
    console.error('WARNING: Firebase init failed:', error.message);
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
    const teamNum = teamIdToNum(teamId);
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

  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    console.log(`\n--- Phase ${phase.id}: ${phase.name} (${phase.duration}min, lead: ${phase.lead}) ---`);

    writeFileSync(ACTIVE_PHASE_MARKER, `${phase.id}:${phase.name}`, 'utf-8');

    // Add terminal line for phase start
    terminalLines.push({
      text: `Phase ${phase.id}: ${phase.name} — running...`,
      time: new Date().toISOString(),
      type: 'phase',
    });

    await updatePhaseInFirebase(teamId, hour, phase.id, phase.name, 'running', terminalLines, hourObjective);

    const startTime = Date.now();

    try {
      const output = phaseRunners[i](teamId, hour, hourObjective, hourDir, previousOutputs);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      previousOutputs.push({
        phase: phase.id,
        name: phase.name,
        output: typeof output === 'string' ? output.slice(0, 1000) : JSON.stringify(output).slice(0, 1000),
      });

      // Add terminal line for phase completion
      terminalLines.push({
        text: `Phase ${phase.id}: ${phase.name} — completed (${elapsed}s)`,
        time: new Date().toISOString(),
        type: 'success',
      });

      console.log(`  Phase ${phase.id} completed in ${elapsed}s`);
      await updatePhaseInFirebase(teamId, hour, phase.id, phase.name, 'completed', terminalLines, hourObjective);
    } catch (error) {
      console.error(`  Phase ${phase.id} FAILED: ${error.message}`);

      // Add terminal line for phase failure
      terminalLines.push({
        text: `Phase ${phase.id}: ${phase.name} — FAILED: ${error.message}`,
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

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
