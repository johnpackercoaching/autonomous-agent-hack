#!/usr/bin/env node

/**
 * Hackathon Pipeline Orchestrator
 *
 * Master orchestrator for the Autonomous Agent Hackathon.
 * Manages 10 teams x 200 hours of work cycles.
 *
 * Usage:
 *   node scripts/hackathon-orchestrator.js --hour 1
 *   node scripts/hackathon-orchestrator.js --start-hour 1 --end-hour 10
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Configuration ---

const PROJECT_ROOT = resolve(__dirname, '..');
const HACKATHON_ROOT = '/Users/johnye/agent-hackathon';
const EXECUTION_ROOT = resolve(HACKATHON_ROOT, 'execution/teams');
const HOUR_PLAN_PATH = resolve(HACKATHON_ROOT, 'process/200-hour-plan.md');
const HOUR_CONFIGS_DIR = resolve(__dirname, 'hour-configs');
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || '/Users/johnye/Downloads/autonomous-agent-hack-firebase-adminsdk-fbsvc-bcbaf3d705.json';
const RTDB_URL = 'https://autonomous-agent-hack-default-rtdb.firebaseio.com';

// Marker file paths
const ACTIVE_HOUR_MARKER = resolve(PROJECT_ROOT, '.active-hour');
const ACTIVE_TEAM_MARKER = resolve(PROJECT_ROOT, '.active-team');
const ACTIVE_PHASE_MARKER = resolve(PROJECT_ROOT, '.active-phase');

// Batch schedule: which teams belong to which batch
const BATCH_SCHEDULE = {
  1: ['T01', 'T02', 'T03'],
  2: ['T04', 'T05', 'T06'],
  3: ['T07', 'T08'],
  4: ['T09', 'T10'],
};

// Arc phases with hour ranges
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
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
  const app = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: RTDB_URL,
  });
  db = getDatabase(app);
}

// --- Helpers ---

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hour' && args[i + 1]) {
      parsed.hour = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--start-hour' && args[i + 1]) {
      parsed.startHour = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--end-hour' && args[i + 1]) {
      parsed.endHour = parseInt(args[i + 1], 10);
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

function getActiveTeams(hour) {
  const arcPhase = getArcPhase(hour);

  // During Discovery (1-10), progressively activate batches
  if (arcPhase === 'Discovery') {
    if (hour <= 3) return BATCH_SCHEDULE[1];
    if (hour <= 6) return [...BATCH_SCHEDULE[1], ...BATCH_SCHEDULE[2]];
    if (hour <= 8) return [...BATCH_SCHEDULE[1], ...BATCH_SCHEDULE[2], ...BATCH_SCHEDULE[3]];
    return [...BATCH_SCHEDULE[1], ...BATCH_SCHEDULE[2], ...BATCH_SCHEDULE[3], ...BATCH_SCHEDULE[4]];
  }

  // Foundation onwards: all teams active
  return Object.values(BATCH_SCHEDULE).flat();
}

function getHourObjective(hour) {
  // Check for pre-built config first
  const configPath = resolve(HOUR_CONFIGS_DIR, `H-${String(hour).padStart(3, '0')}.json`);
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }

  // Parse from 200-hour plan
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
    objective: `Hour ${hour} objectives`,
    expectedDeliverable: '',
    keyQuestion: '',
    risk: '',
  };
}

function padHour(hour) {
  return String(hour).padStart(3, '0');
}

function writeMarker(path, value) {
  writeFileSync(path, String(value), 'utf-8');
}

function clearMarkers() {
  for (const marker of [ACTIVE_HOUR_MARKER, ACTIVE_TEAM_MARKER, ACTIVE_PHASE_MARKER]) {
    if (existsSync(marker)) {
      writeFileSync(marker, '', 'utf-8');
    }
  }
}

// --- Core Orchestration ---

async function runTeamHour(teamId, hour, hourObjective) {
  const hourPadded = padHour(hour);

  console.log(`\n=== Starting ${teamId} for Hour ${hour} (${hourObjective.arcPhase}: ${hourObjective.objective}) ===\n`);

  writeMarker(ACTIVE_TEAM_MARKER, teamId);

  const runTeamScript = resolve(__dirname, 'run-team-hour.js');

  try {
    execSync(
      `node "${runTeamScript}" --team ${teamId} --hour ${hour}`,
      {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        timeout: 60 * 60 * 1000, // 60 minute timeout per team-hour
        env: {
          ...process.env,
          GOOGLE_APPLICATION_CREDENTIALS: SERVICE_ACCOUNT_PATH,
        },
      }
    );

    return { teamId, hour, status: 'completed' };
  } catch (error) {
    console.error(`ERROR: ${teamId} Hour ${hour} failed:`, error.message);
    return { teamId, hour, status: 'failed', error: error.message };
  }
}

async function writeProgressToFirebase(hour, teamId, status, hourObjective) {
  if (!db) return;

  const hourPadded = padHour(hour);
  const ref = db.ref(`hackathon/hours/H-${hourPadded}/${teamId}`);

  await ref.set({
    status,
    arcPhase: hourObjective.arcPhase,
    objective: hourObjective.objective,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

async function updateProgressInFirebase(hour, teamId, status) {
  if (!db) return;

  const hourPadded = padHour(hour);
  const ref = db.ref(`hackathon/hours/H-${hourPadded}/${teamId}`);

  await ref.update({
    status,
    updatedAt: new Date().toISOString(),
  });
}

async function runHour(hour) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`HOUR ${hour} - ${getArcPhase(hour)}`);
  console.log(`${'='.repeat(60)}\n`);

  writeMarker(ACTIVE_HOUR_MARKER, hour);

  const hourObjective = getHourObjective(hour);
  const activeTeams = getActiveTeams(hour);

  console.log(`Arc Phase: ${hourObjective.arcPhase}`);
  console.log(`Objective: ${hourObjective.objective}`);
  console.log(`Active Teams: ${activeTeams.join(', ')}`);
  console.log(`Expected Deliverable: ${hourObjective.expectedDeliverable}`);
  console.log(`Key Question: ${hourObjective.keyQuestion}`);
  console.log(`Risk: ${hourObjective.risk}`);
  console.log('');

  const results = [];

  for (const teamId of activeTeams) {
    await writeProgressToFirebase(hour, teamId, 'running', hourObjective);

    const result = await runTeamHour(teamId, hour, hourObjective);
    results.push(result);

    await updateProgressInFirebase(hour, teamId, result.status);
  }

  // Write hour summary to Firebase
  if (db) {
    const hourPadded = padHour(hour);
    const summaryRef = db.ref(`hackathon/hours/H-${hourPadded}/_summary`);
    await summaryRef.set({
      hour,
      arcPhase: hourObjective.arcPhase,
      objective: hourObjective.objective,
      activeTeams,
      completedAt: new Date().toISOString(),
      results: results.map(r => ({ team: r.teamId, status: r.status })),
    });
  }

  console.log(`\n--- Hour ${hour} Complete ---`);
  for (const r of results) {
    console.log(`  ${r.teamId}: ${r.status}`);
  }

  return results;
}

// --- Main ---

async function main() {
  const args = parseArgs();

  if (!args.hour && !args.startHour) {
    console.error('Usage:');
    console.error('  node scripts/hackathon-orchestrator.js --hour N');
    console.error('  node scripts/hackathon-orchestrator.js --start-hour N --end-hour M');
    process.exit(1);
  }

  // Initialize Firebase
  try {
    initFirebase();
    console.log('Firebase initialized successfully.');
  } catch (error) {
    console.error('WARNING: Firebase initialization failed. Progress will not be persisted.');
    console.error(error.message);
  }

  // Determine hour range
  const startHour = args.hour || args.startHour;
  const endHour = args.hour || args.endHour || args.startHour;

  if (startHour < 1 || endHour > 200 || startHour > endHour) {
    console.error(`Invalid hour range: ${startHour}-${endHour}. Must be 1-200.`);
    process.exit(1);
  }

  console.log(`\nHackathon Pipeline Orchestrator`);
  console.log(`Hours: ${startHour} to ${endHour}`);
  console.log(`Total hours to run: ${endHour - startHour + 1}\n`);

  const allResults = [];

  for (let hour = startHour; hour <= endHour; hour++) {
    const results = await runHour(hour);
    allResults.push({ hour, results });
  }

  // Final summary
  clearMarkers();
  console.log(`\n${'='.repeat(60)}`);
  console.log('ORCHESTRATION COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`Hours run: ${startHour}-${endHour}`);

  let totalCompleted = 0;
  let totalFailed = 0;
  for (const { results } of allResults) {
    for (const r of results) {
      if (r.status === 'completed') totalCompleted++;
      else totalFailed++;
    }
  }
  console.log(`Total team-hours completed: ${totalCompleted}`);
  console.log(`Total team-hours failed: ${totalFailed}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  clearMarkers();
  process.exit(1);
});
