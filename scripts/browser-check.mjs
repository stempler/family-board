// Look at the board in a real browser inside the local Home Assistant and take screenshots.
// Runs inside the official Playwright image (see the `ha:screenshot` mise task); needs `mise run ha:up` first.
// Usage: node scripts/browser-check.mjs <out-dir>
//
// Screenshots (1280x800):
//   ha-board.png        the board after login
//   ha-aufgaben.png     after tapping Mia's half (must land on /family-board/aufgaben)
//   ha-board-after.png  ~1s after taskmate.add_points (Mia, 1 point, reason "Test")
//   ha-board-season.png with a christmas season covering today; then a tap on a tree must navigate too
//   ha-theme-<id>.png   both kids on each favourite theme (no season scene), seasons off
//   ha-season-<id>.png  each season theme (christmas, halloween, easter) as a season covering today
// The dashboard config is restored at the end. Note: every run gives Mia one more point.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { connect, rest } from './ha-client.mjs';

const BASE = process.env.HA_URL ?? 'http://localhost:8123';
const DASHBOARD = 'family-board';
const BOARD = `/${DASHBOARD}/board`;
const TASKS = `/${DASHBOARD}/aufgaben`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? join(root, 'dev/screenshots'));
const token = process.env.FB_HA_TOKEN || readFileSync(join(root, 'dev/ha/.token'), 'utf8').trim();
mkdirSync(out, { recursive: true });

const log = (msg) => console.log(`[browser-check] ${msg}`);
const failures = [];
const check = (ok, msg) => {
  log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};

const pad = (n) => String(n).padStart(2, '0');
const mmdd = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** What the card shows, read from its shadow DOM. */
async function inspect(page) {
  return page.evaluate(async () => {
    const card = findDeep(document, 'family-board-card');
    function findDeep(node, sel) {
      const hit = node.querySelector?.(sel);
      if (hit) return hit;
      for (const el of node.querySelectorAll?.('*') ?? []) {
        if (el.shadowRoot) {
          const inner = findDeep(el.shadowRoot, sel);
          if (inner) return inner;
        }
      }
      return null;
    }
    if (!card?.shadowRoot) return null;
    const svg = card.shadowRoot.querySelector('svg');
    const rect = card.getBoundingClientRect();
    const halves = [...card.shadowRoot.querySelectorAll('[data-kid-half]')].map((h) => ({
      id: h.getAttribute('data-kid-half'),
      items: h.querySelectorAll('[data-item]').length,
      text: [...h.querySelectorAll('text')].map((t) => t.textContent).join(' | '),
    }));
    const icons = [...card.shadowRoot.querySelectorAll('ha-icon')].map((i) => ({
      icon: i.getAttribute('icon'),
      drawn: !!i.shadowRoot?.querySelector('ha-svg-icon')?.shadowRoot?.querySelector('path')?.getAttribute('d'),
      box: (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(i.getBoundingClientRect()),
    }));
    // document.fonts.check() can answer true for a family that was never registered, so look for a loaded FontFace.
    await document.fonts.ready;
    const fontOk = [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Patrick Hand' && f.status === 'loaded');
    return {
      card: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      viewport: { w: innerWidth, h: innerHeight },
      themes: [...card.shadowRoot.querySelectorAll('[data-theme]')].map((g) => g.getAttribute('data-theme')),
      items: svg ? svg.querySelectorAll('[data-item]').length : 0,
      halves,
      shared: [...card.shadowRoot.querySelectorAll('[data-shared-jar]')].map((j) => `${j.getAttribute('data-shared-jar')}:${[...j.querySelectorAll('[data-fill]')].map((r) => r.getAttribute('data-fill')).join('+')}`),
      jars: [...card.shadowRoot.querySelectorAll('[data-jar]')].map((j) => `${j.getAttribute('data-jar')}:${j.querySelector('[data-fill]')?.getAttribute('data-fill')}`),
      newItems: card.shadowRoot.querySelectorAll('.fb-new').length,
      icons,
      fontOk,
      text: card.shadowRoot.textContent,
    };
  });
}

async function openBoard(page, load = true) {
  if (load) await page.goto(BASE + BOARD);
  await page.locator('family-board-card [data-kid-half]').first().waitFor({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500); // ha-icon loads its paths asynchronously; let the drop animation settle
}

/** Tap a point given in board units (viewBox 800x450) of the card. */
async function tapBoard(page, x, y) {
  const box = await page.locator('family-board-card svg').first().boundingBox();
  await page.mouse.click(box.x + (x / 800) * box.width, box.y + (y / 450) * box.height);
}

const ws = await connect(BASE, token);
const overview = await rest(BASE, token, 'GET', '/api/states/sensor.taskmate_overview');
const mia = overview.attributes.children.find((c) => c.name === 'Mia');
if (!mia) throw new Error('Mia not found; run `mise run ha:seed`');
const original = await ws.call({ type: 'lovelace/config', url_path: DASHBOARD });

const browser = await chromium.launch();
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  // Login via the HA login form.
  await page.goto(BASE + BOARD);
  await page.locator('input[name="username"]').fill('dev');
  await page.locator('input[name="password"]').fill('dev');
  await page.getByRole('checkbox').first().check(); // keep me logged in, so page loads keep the session
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname === BOARD, { timeout: 30_000 });

  await openBoard(page, false); // no reload until the frontend has stored its tokens
  const board = await inspect(page);
  console.log(JSON.stringify(board, null, 2));
  await page.screenshot({ path: join(out, 'ha-board.png') });
  check(board.card.y + board.card.h <= board.viewport.h, 'board fits in the viewport under the toolbar');
  check(board.icons.every((i) => i.drawn), 'every ha-icon drew its path');
  check(board.fontOk, "handwriting font 'Patrick Hand' is loaded");

  // Tap Mia's half (left half, in the scene, away from header and jars).
  await tapBoard(page, 200, 200);
  await page.waitForURL((u) => u.pathname === TASKS, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, 'ha-aufgaben.png') });
  check(new URL(page.url()).pathname === TASKS, `tap on Mia's half navigates to ${TASKS} (got ${new URL(page.url()).pathname})`);

  // Back to the board, then add a point.
  await page.goBack();
  await page.locator('family-board-card [data-kid-half]').first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const before = await inspect(page);
  await rest(BASE, token, 'POST', '/api/services/taskmate/add_points', { child_id: mia.id, points: 1, reason: 'Test' });
  await page.waitForTimeout(1000);
  const after = await inspect(page);
  await page.screenshot({ path: join(out, 'ha-board-after.png') });
  const items = (s) => s.halves.find((h) => h.id === mia.id).items;
  log(`Mia items before ${items(before)}, after ${items(after)}, fb-new ${after.newItems}`);
  check(items(after) === items(before) + 1 || after.newItems > 0, 'a new item appears after add_points');

  // Season check: christmas covering today.
  const today = new Date();
  const from = new Date(today.getTime() - 20 * 86_400_000);
  const to = new Date(today.getTime() + 20 * 86_400_000);
  const seasonal = structuredClone(original);
  seasonal.views[0].cards[0].seasons = [{ theme: 'christmas', from: mmdd(from), to: mmdd(to) }];
  await ws.call({ type: 'lovelace/config/save', url_path: DASHBOARD, config: seasonal });
  await openBoard(page);
  const season = await inspect(page);
  console.log(JSON.stringify({ themes: season.themes, halves: season.halves, icons: season.icons }, null, 2));
  await page.screenshot({ path: join(out, 'ha-board-season.png') });
  check(season.themes.join() === 'christmas', 'season scene is christmas');
  const tree = await page.locator(`family-board-card [data-tree="${mia.id}"]`).boundingBox();
  await page.mouse.click(tree.x + tree.width / 2, tree.y + tree.height * 0.6);
  await page.waitForURL((u) => u.pathname === TASKS, { timeout: 10_000 }).catch(() => {});
  check(new URL(page.url()).pathname === TASKS, `tap on Mia's tree navigates to ${TASKS} (got ${new URL(page.url()).pathname})`);

  // Every theme: favourites per kid (seasons off), then each season scene via a rule covering today.
  const themeIds = await page.evaluate(() => customElements.get('family-board-card').themeIds);
  log(`themes: ${themeIds.join(', ')}`);
  const seasonThemes = ['christmas', 'halloween', 'easter'];
  check(seasonThemes.every((id) => themeIds.includes(id)), 'season themes are registered');
  const favourites = themeIds.filter((id) => !seasonThemes.includes(id));
  const withCard = (patch) => {
    const config = structuredClone(original);
    Object.assign(config.views[0].cards[0], patch);
    return config;
  };
  const animCount = () => page.locator('family-board-card .fb-anim').count();
  for (const id of favourites) {
    const config = withCard({ seasons: [] });
    config.views[0].cards[0].kids = config.views[0].cards[0].kids.map((k) => ({ ...k, theme: id }));
    await ws.call({ type: 'lovelace/config/save', url_path: DASHBOARD, config });
    await openBoard(page);
    const shown = await inspect(page);
    await page.screenshot({ path: join(out, `ha-theme-${id}.png`) });
    const anims = await animCount();
    log(`theme ${id}: [data-theme] ${shown.themes.join()}, fb-anim ${anims}`);
    check(shown.themes.length === 2 && shown.themes.every((t) => t === id), `theme ${id}: both halves show it`);
    check(anims >= 1, `theme ${id}: has animated elements`);
  }
  for (const id of seasonThemes) {
    await ws.call({
      type: 'lovelace/config/save',
      url_path: DASHBOARD,
      config: withCard({ seasons: [{ theme: id, from: mmdd(from), to: mmdd(to) }] }),
    });
    await openBoard(page);
    const shown = await inspect(page);
    await page.screenshot({ path: join(out, `ha-season-${id}.png`) });
    const anims = await animCount();
    const marked = await page.locator('family-board-card [data-season-kid]').count();
    log(`season ${id}: [data-theme] ${shown.themes.join()}, fb-anim ${anims}, kid objects ${marked}`);
    check(shown.themes.join() === id, `season ${id}: scene theme is ${id}`);
    check(anims >= 1 && marked === 2, `season ${id}: animated, one object per kid`);
  }
} catch (err) {
  await page.screenshot({ path: join(out, 'ha-error.png') }).catch(() => {});
  log(`failed at ${page.url()}; console errors:\n  ${consoleErrors.join('\n  ')}`);
  throw err;
} finally {
  await ws.call({ type: 'lovelace/config/save', url_path: DASHBOARD, config: original }).catch((e) => log(`restore failed: ${e.message}`));
  ws.close();
  await browser.close();
}

log(`console errors: ${consoleErrors.length ? '\n  ' + consoleErrors.join('\n  ') : 'none'}`);
log(`screenshots in ${out}`);
if (failures.length) {
  console.error(`[browser-check] ${failures.length} check(s) failed`);
  process.exit(1);
}
