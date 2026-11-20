// Capture the TaskMate sensor states from the local Home Assistant into tests/fixtures/taskmate-<version>.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rest } from './ha-client.mjs';

const BASE = 'http://localhost:8123';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const token = readFileSync(join(root, 'dev/ha/.token'), 'utf8').trim();
const version = readFileSync(join(root, 'taskmate.version'), 'utf8').trim();
const IDS = ['sensor.taskmate_overview', 'sensor.taskmate_rewards'];

const states = {};
for (const id of IDS) {
  const { state, attributes } = await rest(BASE, token, 'GET', `/api/states/${id}`);
  states[id] = { state, attributes };
}

const file = join(root, `tests/fixtures/taskmate-${version}.json`);
writeFileSync(file, JSON.stringify(states, null, 2) + '\n');
console.log(`[capture] wrote ${file}`);
