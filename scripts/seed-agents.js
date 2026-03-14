#!/usr/bin/env node

/**
 * seed-agents.js
 *
 * Reads all hack-*.md agent files from ~/.claude/agents/,
 * parses YAML frontmatter and markdown body,
 * outputs a JSON file that can be pushed to Firebase RTDB.
 *
 * Usage:
 *   node scripts/seed-agents.js
 *   firebase database:set /agents --data "$(cat /tmp/agents-seed.json)" --project autonomous-agent-hack --instance autonomous-agent-hack-default-rtdb
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const AGENTS_DIR = join(homedir(), '.claude', 'agents');
const OUTPUT_FILE = '/tmp/agents-seed.json';

function parseFrontmatter(content) {
  const fmRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(fmRegex);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = match[1];
  const body = match[2].trim();
  const frontmatter = {};

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

function main() {
  const files = readdirSync(AGENTS_DIR).filter(f => f.startsWith('hack-') && f.endsWith('.md'));
  console.log(`Found ${files.length} hack agent files`);

  const agentsData = {};

  for (const file of files) {
    const filePath = join(AGENTS_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    const agentId = basename(file, '.md');

    // Build the meta object
    agentsData[agentId] = agentsData[agentId] || {};
    agentsData[agentId].meta = {
      description: frontmatter.description || '',
      systemPrompt: body,
      tools: frontmatter.tools || '',
      model: frontmatter.model || '',
      color: frontmatter.color || '',
    };

    console.log(`  Parsed: ${agentId} (${frontmatter.description ? frontmatter.description.slice(0, 60) + '...' : 'no description'})`);
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(agentsData, null, 2));
  console.log(`\nWrote ${Object.keys(agentsData).length} agents to ${OUTPUT_FILE}`);
  console.log(`\nNext step: Run the following to push to RTDB:`);
  console.log(`  firebase database:update / --data @${OUTPUT_FILE} --project autonomous-agent-hack --instance autonomous-agent-hack-default-rtdb`);
}

main();
