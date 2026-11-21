// Screenshot every tile of the theme gallery (dev/gallery.html on the dev server).
// Runs inside the official Playwright image (see the `gallery:shots` mise task).
// Usage: node scripts/gallery-shots.mjs <out-dir>
// Fails on console errors, on a tile without the expected [data-theme] or without a kid half.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const URL_ = process.env.GALLERY_URL ?? 'http://localhost:5173/gallery.html';
const out = resolve(process.argv[2] ?? 'dev/screenshots');
mkdirSync(out, { recursive: true });

const failures = [];
const consoleErrors = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(URL_);
  await page.locator('[data-gallery-tile]').first().waitFor({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  // Every card renders its board asynchronously; wait until each tile's shadow DOM has a kid half.
  await page
    .waitForFunction(() => [...document.querySelectorAll('[data-gallery-tile]')].every((el) => el.querySelector('family-board-card')?.shadowRoot?.querySelector('[data-kid-half]')), null, { timeout: 30_000 })
    .catch(() => console.error('[gallery-shots] timed out waiting for every tile to render; the per-tile check reports which'));

  const tiles = await page.locator('[data-gallery-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-gallery-tile')));
  for (const name of tiles) {
    const tile = page.locator(`[data-gallery-tile="${name}"]`);
    const info = await tile.evaluate((el) => {
      const root = el.querySelector('family-board-card')?.shadowRoot;
      return {
        theme: root?.querySelector('[data-theme]')?.getAttribute('data-theme') ?? null,
        halves: root?.querySelectorAll('[data-kid-half]').length ?? 0,
      };
    });
    const expected = name.replace(/^season-/, '').replace(/-points-[\d-]+$/, ''); // extra tiles: <theme>-points-<a>-<b>
    if (info.theme !== expected) failures.push(`${name}: first [data-theme] is ${info.theme}, expected ${expected}`);
    if (info.halves === 0) failures.push(`${name}: no data-kid-half`);
    await tile.screenshot({ path: join(out, `gallery-${name}.png`) });
    console.log(`[gallery-shots] ${name}: theme=${info.theme} halves=${info.halves}`);
  }
} finally {
  await browser.close();
}
if (consoleErrors.length) failures.push(...consoleErrors.map((e) => `console error: ${e}`));
if (failures.length) {
  console.error(`[gallery-shots] FAILED\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`[gallery-shots] screenshots in ${out}`);
