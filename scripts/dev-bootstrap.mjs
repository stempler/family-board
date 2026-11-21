// Idempotently bootstrap the local dev Home Assistant: onboarding, token, TaskMate, card resource, demo data, dashboard.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, rest } from './ha-client.mjs';

const BASE = 'http://localhost:8123';
const CLIENT_ID = `${BASE}/`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokenFile = join(root, 'dev/ha/.token');
const RESOURCE_URL = '/local/family-board/family-board-card.js';
const DASHBOARD = 'family-board';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[bootstrap] ${msg}`);

async function waitFor(what, check, timeoutMs = 180_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await check();
      if (value) return value;
    } catch {
      // not ready yet
    }
    if (Date.now() > until) throw new Error(`Timed out waiting for ${what}`);
    await sleep(1000);
  }
}

// 0. Home Assistant is up far enough to answer the onboarding API. The HTTP server answers /api/ (401) early in
// startup, while /api/onboarding is still 404 until the onboarding integration has loaded, so wait for that one.
const steps = await waitFor('Home Assistant onboarding API', async () => {
  const res = await fetch(`${BASE}/api/onboarding`);
  return res.ok ? res.json() : null;
});

// 1. Onboarding.
const done = (step) => steps.find((s) => s.step === step)?.done === true;
let token = existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : '';
let sessionToken = '';

if (!done('user')) {
  log('onboarding: creating user dev/dev');
  const { auth_code } = await rest(BASE, undefined, 'POST', '/api/onboarding/users', {
    client_id: CLIENT_ID,
    name: 'Dev',
    username: 'dev',
    password: 'dev',
    language: 'de',
  });
  const res = await fetch(`${BASE}/auth/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'authorization_code', code: auth_code, client_id: CLIENT_ID }),
  });
  if (!res.ok) throw new Error(`/auth/token -> ${res.status}: ${await res.text()}`);
  sessionToken = (await res.json()).access_token;
} else if (!token) {
  throw new Error('Onboarding is already done but dev/ha/.token is missing. Run `mise run ha:reset` and then `mise run ha:up`.');
}

const authToken = () => token || sessionToken;
for (const [step, path, body] of [
  ['core_config', '/api/onboarding/core_config', {}],
  ['analytics', '/api/onboarding/analytics', {}],
  ['integration', '/api/onboarding/integration', { client_id: CLIENT_ID, redirect_uri: `${BASE}/?auth_callback=1` }],
]) {
  if (done(step)) continue;
  log(`onboarding: ${step}`);
  await rest(BASE, authToken(), 'POST', path, body);
}

// 2. Long-lived token.
if (!token) {
  const ws = await connect(BASE, sessionToken);
  token = await ws.call({ type: 'auth/long_lived_access_token', client_name: 'family-board-dev', lifespan: 3650 });
  ws.close();
  writeFileSync(tokenFile, token + '\n', { mode: 0o600 });
  log('wrote dev/ha/.token');
}

// 3. TaskMate config entry.
const entries = await rest(BASE, token, 'GET', '/api/config/config_entries/entry?domain=taskmate');
if (entries.length === 0) {
  log('adding TaskMate integration');
  const flow = await rest(BASE, token, 'POST', '/api/config/config_entries/flow', { handler: 'taskmate' });
  const result = await rest(BASE, token, 'POST', `/api/config/config_entries/flow/${flow.flow_id}`, {});
  if (result.type !== 'create_entry') throw new Error(`TaskMate config flow did not finish: ${JSON.stringify(result)}`);
}
const state = (entityId) => rest(BASE, token, 'GET', `/api/states/${entityId}`);
await waitFor('sensor.taskmate_overview', async () => Array.isArray((await state('sensor.taskmate_overview')).attributes.children));
await waitFor('sensor.taskmate_rewards', async () => Array.isArray((await state('sensor.taskmate_rewards')).attributes.rewards));

const ws = await connect(BASE, token);
try {
  // 4. Lovelace resource.
  const resources = await ws.call({ type: 'lovelace/resources' });
  if (!resources.some((r) => r.url === RESOURCE_URL)) {
    log(`adding Lovelace resource ${RESOURCE_URL}`);
    await ws.call({ type: 'lovelace/resources/create', res_type: 'module', url: RESOURCE_URL });
  }

  // 5. Demo data: kids and chores (the wizard skips names that already exist).
  const wizard = await ws.call({
    type: 'taskmate/setup_wizard/apply',
    children: [
      { ref: 'a', name: 'Mia', color: '#d9534f' },
      { ref: 'b', name: 'Ben', color: '#3b7dd8' },
    ],
    chores: [
      { name: 'Zimmer aufräumen', points: 5, icon: 'mdi:broom', assigned_to: ['a', 'b'] },
      { name: 'Tisch decken', points: 3, icon: 'mdi:silverware-fork-knife', assigned_to: ['a', 'b'] },
    ],
  });
  const mia = wizard.children.a;
  const ben = wizard.children.b;
  log(`kids: Mia=${mia}, Ben=${ben} (added ${wizard.children_added}, chores added ${wizard.chores_added})`);

  // Rewards, only those whose name doesn't exist yet.
  const rewardSpecs = [
    { name: 'Bausteine-Set', cost: 50, icon: 'mdi:toy-brick', pool_enabled: true, assigned_to: [mia] },
    { name: 'Kino', cost: 20, icon: 'mdi:movie-open', pool_enabled: true, assigned_to: [] },
    { name: 'Pizza-Abend', cost: 40, icon: 'mdi:pizza', is_jackpot: true },
    { name: '30 Min. Bildschirmzeit', cost: 10, icon: 'mdi:tablet' },
  ];
  const rewardIds = {};
  for (const r of (await state('sensor.taskmate_rewards')).attributes.rewards) rewardIds[r.name] = r.id;
  for (const spec of rewardSpecs) {
    if (rewardIds[spec.name]) continue;
    log(`adding reward ${spec.name}`);
    rewardIds[spec.name] = (await ws.call({ type: 'taskmate/add_reward', ...spec })).id;
  }

  // Points, only for kids who have never earned any (so reruns don't duplicate).
  const service = (name, data) => ws.call({ type: 'call_service', domain: 'taskmate', service: name, service_data: data });
  const plans = [
    { id: mia, spendable: 12, pools: { 'Bausteine-Set': 22, 'Pizza-Abend': 5 } },
    { id: ben, spendable: 7, pools: { 'Pizza-Abend': 8 } },
  ];
  const children = (await state('sensor.taskmate_overview')).attributes.children;
  for (const plan of plans) {
    const child = children.find((c) => c.id === plan.id);
    if (!child || child.total_points_earned !== 0) continue;
    const total = plan.spendable + Object.values(plan.pools).reduce((a, b) => a + b, 0);
    log(`giving ${child.name} ${total} points`);
    await service('add_points', { child_id: plan.id, points: total, reason: 'Demo' });
    for (const [reward, points] of Object.entries(plan.pools)) {
      await service('allocate_points_to_pool', { child_id: plan.id, reward_id: rewardIds[reward], points });
    }
  }

  // 6. Dashboard.
  const dashboards = await ws.call({ type: 'lovelace/dashboards/list' });
  if (!dashboards.some((d) => d.url_path === DASHBOARD)) {
    log(`creating dashboard /${DASHBOARD}`);
    await ws.call({ type: 'lovelace/dashboards/create', url_path: DASHBOARD, title: 'Family Board', icon: 'mdi:view-dashboard', show_in_sidebar: true });
  }
  await ws.call({
    type: 'lovelace/config/save',
    url_path: DASHBOARD,
    config: {
      views: [
        {
          title: 'Board',
          path: 'board',
          type: 'panel',
          cards: [
            {
              type: 'custom:family-board-card',
              kids: [
                { id: mia, theme: 'bricks', tap_path: `/${DASHBOARD}/aufgaben` },
                { id: ben, theme: 'dino', tap_path: `/${DASHBOARD}/aufgaben` },
              ],
            },
          ],
        },
        {
          title: 'Aufgaben',
          path: 'aufgaben',
          cards: [
            {
              type: 'button',
              name: 'Zurück',
              icon: 'mdi:arrow-left',
              tap_action: { action: 'navigate', navigation_path: `/${DASHBOARD}/board` },
            },
            {
              type: 'custom:taskmate-kiosk-card',
              entity: 'sensor.taskmate_overview',
              children: [
                { child_id: mia, require_pin: false },
                { child_id: ben, require_pin: false },
              ],
            },
          ],
        },
      ],
    },
  });
  log('dashboard saved');
} finally {
  ws.close();
}
log(`done: ${BASE}/${DASHBOARD}/board (login dev/dev)`);
