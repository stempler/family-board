import { rand, timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { seasonKid, seasonPlacement } from '../draw/season';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { at, placement, points, SCENE_BOTTOM, SCENE_TOP, starPoints, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A St. Martin lantern walk at dusk, drawn in "street units": the kid's lantern stick (in the kid
// colour) stands at the left, a narrow tall house at the right; four lines run between them. Five big
// round lanterns with a sun or a moon on them hang on the top line, small paper lanterns in three
// rows of ten on the lines below; further round lanterns, medium sized, take the small spots from the last one back. Behind them a row of dark houses with lit windows stands on the
// street (y 228 down to 240), a moon and a few stars are in the sky. The half itself stays a pale
// dusk lilac so the board's dark header and jar labels stay readable; only the scene band is dark.
const MID = 160;
const UNITS_W = 320;
const UNITS_H = 240;
const UNITS: Units = { mid: MID, top: 0, w: UNITS_W, h: UNITS_H, fill: 0.92 };
const GROUND = 228;

const DUSK = '#ddd5ee';
const NIGHT = '#33407a';
const NIGHT_EDGE = '#1d2550';
const HORIZON = '#5b4f8e';
const HOUSE = '#1f2547';
const ROOF = '#171c3a';
const WINDOW = '#d9b765'; // dimmer than any lantern, so a window never reads as one
const WINDOW_DARK = '#39416f';
const STREET = '#3a3452';
const MOON = '#fbf0b8';
const STAR = '#fff3b0';
const DOT = '#dfe6ff';
const STRING = '#d9cba3';
const CAP = '#5a4632';
const GLOW = '#ffb03a';
const GLOW_CORE = '#ffe08a';
const PAPER = ['#ff8a3d', '#ffd23f', '#ff5d5d', '#ff9fc4', '#ffb347', '#f4e04d'];

const POLE_X = 14; // the kid's lantern stick
const TOWER_X = 298; // the left wall of the tall house the lines are tied to
const LINES = [34, 86, 136, 186]; // where each line meets the stick; the top one holds the big lanterns
const SAG = 10; // control-point drop of a line; it hangs half of that lower in the middle
const RIG_MID = (POLE_X + TOWER_X) / 2;

const SMALL_W = 14; // a small paper lantern: 14 x 20 units with its caps
const SMALL_H = 20;
const SMALL_DROP = 15; // from the line down to a small lantern's centre
const BIG_R = 15; // a round lantern at scale 1: 30 x 36 units with its caps
const BIG_DROP = 22;
const BIG = 1.15; // the five on the top line: 34.5 x 41.4, five times a small lantern's area
const MEDIUM = 0.85; // the rest, on small spots: 25.5 x 30.6, almost three times a small lantern's area
const GLOWING = 8; // only the first lanterns flicker

/** The height of line `row` at x, in units. */
function lineY(row: number, x: number): number {
  const t = (x - POLE_X) / (TOWER_X - POLE_X);
  return LINES[row] + 2 * t * (1 - t) * SAG;
}

/** Big lantern spots on the top line, centre outwards, 56 apart. */
const BIGS = [0, -56, 56, -112, 112].map((dx) => RIG_MID + dx);

/** The centre of the rows of ten: a medium lantern at either end keeps the same room to the stick and to the house. */
const ROW_MID = 157.25;

/** Small lantern spots: ten per line, 28 apart, the upper line first, left to right. */
const SMALLS: Pt[] = [1, 2, 3].flatMap((row) => Array.from({ length: 10 }, (_, i): Pt => [ROW_MID + (i - 4.5) * 28, row]));

const CAPACITY = SMALLS.length;

/** street units; k scales the drawing; hang is where its string meets the line; slot is the small spot, -1 on a big spot. */
export interface Spot { kind: 'big' | 'small'; x: number; y: number; k: number; hang: number; slot: number }

function smallSpot(kind: 'big' | 'small', slot: number): Spot {
  const [x, row] = SMALLS[slot];
  const hang = lineY(row, x);
  return kind === 'big' ? { kind, x, y: hang + BIG_DROP * MEDIUM, k: MEDIUM, hang, slot } : { kind, x, y: hang + SMALL_DROP, k: 1, hang, slot };
}

/**
 * Where the items go: big lanterns first on the top line, then (medium sized) on the small spots from the last one
 * back; small lanterns on the small spots in order. With n big lanterns there are at most CAPACITY - n small ones, so
 * a small spot under a medium lantern is never in use by a small one at the same time, and no item ever moves.
 */
export function spots(big: number, small: number): Spot[] {
  const b = Math.max(0, Math.min(big, CAPACITY));
  const own = BIGS.slice(0, b).map((x): Spot => {
    const hang = lineY(0, x);
    return { kind: 'big', x, y: hang + BIG_DROP * BIG, k: BIG, hang, slot: -1 };
  });
  const medium = Array.from({ length: b - own.length }, (_, i) => smallSpot('big', CAPACITY - 1 - i));
  const smalls = Array.from({ length: Math.max(0, Math.min(small, CAPACITY - b)) }, (_, i) => smallSpot('small', i));
  return [...own, ...medium, ...smalls];
}

/** The box a drawn lantern covers (caps included, string and glow not), in street units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [hw, hh] = s.kind === 'big' ? [BIG_R, BIG_R + 3] : [SMALL_W / 2, SMALL_H / 2];
  return [s.x - hw * s.k, s.y - hh * s.k, s.x + hw * s.k, s.y + hh * s.k];
}

const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number) =>
  `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${stroke}" stroke-width="${num(w)}" stroke-linecap="round"/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${fill}" stroke="${INK}" stroke-width="0.8"/>`;
const pane = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${fill}" opacity="0.6"/>`;

/** The warm glow behind a lantern at (x, y), radius r px (a medium lantern on a small spot glows only a little wider than a small one, so the glows stay apart); it flickers when `key` is given. Never the counted item itself. */
function glow(x: number, y: number, r: number, key: string | null): string {
  const anim = key ? ` class="fb-anim fb-martin-flicker" style="${timing(key, [2.2, 3.4])}"` : '';
  return `<g${anim}><circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${GLOW}" fill-opacity="0.3"/>` +
    `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r * 0.75)}" fill="${GLOW_CORE}" fill-opacity="0.7"/></g>`;
}

/** A small paper lantern centred at (x, y) px, hanging from `hang`, `s` px per unit. */
function paperLantern(sk: Sketch, x: number, y: number, hang: number, s: number, colour: string): string {
  const string = line(x, hang, x, y - 10 * s, STRING, Math.max(0.7, 1.1 * s));
  const body = sk.ellipse(x, y, SMALL_W * s, 16 * s, { fill: colour, strokeWidth: 1.4, roughness: 0.4 });
  const ribs = `<path d="M ${num(x - 3 * s)} ${num(y - 7 * s)} Q ${num(x - 5.5 * s)} ${num(y)} ${num(x - 3 * s)} ${num(y + 7 * s)} M ${num(x + 3 * s)} ${num(y - 7 * s)} Q ${num(x + 5.5 * s)} ${num(y)} ${num(x + 3 * s)} ${num(y + 7 * s)}" ` +
    `stroke="${INK}" stroke-opacity="0.35" stroke-width="${num(Math.max(0.6, 0.9 * s))}" fill="none"/>`;
  const shine = `<ellipse cx="${num(x - 2.6 * s)}" cy="${num(y - 3 * s)}" rx="${num(1.5 * s)}" ry="${num(3 * s)}" fill="#fff" opacity="0.55"/>`;
  return `<g data-part="lantern">${string}${body}${ribs}${shine}${rect(x - 4.5 * s, y - 10 * s, 9 * s, 3 * s, CAP)}${rect(x - 4 * s, y + 7 * s, 8 * s, 3 * s, CAP)}</g>`;
}

/** A big round lantern in the kid colour centred at (x, y) px, hanging from `hang`, `s` px per unit, with a sun or a moon on it. */
function roundLantern(sk: Sketch, x: number, y: number, hang: number, s: number, colour: string, sun: boolean): string {
  const r = BIG_R * s;
  const string = line(x, hang, x, y - r - 3 * s, STRING, Math.max(0.8, 1.3 * s));
  const body = sk.circle(x, y, 2 * r, { fill: colour, strokeWidth: 1.8, roughness: 0.5 });
  const ribs = `<ellipse cx="${num(x)}" cy="${num(y)}" rx="${num(r * 0.5)}" ry="${num(r * 0.97)}" stroke="${INK}" stroke-opacity="0.3" stroke-width="${num(Math.max(0.6, 1 * s))}" fill="none"/>`;
  let face: string;
  if (sun) {
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      rays += `M ${num(x + Math.cos(a) * r * 0.5)} ${num(y + Math.sin(a) * r * 0.5)} L ${num(x + Math.cos(a) * r * 0.72)} ${num(y + Math.sin(a) * r * 0.72)} `;
    }
    face = `<path d="${rays.trim()}" stroke="${STAR}" stroke-width="${num(Math.max(1, 2 * s))}" stroke-linecap="round" fill="none"/>` +
      `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r * 0.36)}" fill="${STAR}" stroke="${INK}" stroke-width="0.8"/>`;
  } else {
    const [tx, ty, by] = [x + r * 0.15, y - r * 0.5, y + r * 0.5];
    face = `<path d="M ${num(tx)} ${num(ty)} A ${num(r * 0.55)} ${num(r * 0.55)} 0 1 0 ${num(tx)} ${num(by)} A ${num(r * 0.62)} ${num(r * 0.62)} 0 0 1 ${num(tx)} ${num(ty)} Z" fill="${STAR}" stroke="${INK}" stroke-width="0.8"/>`;
  }
  return `<g data-part="lantern">${string}${body}${ribs}${face}${rect(x - 6 * s, y - r - 3 * s, 12 * s, 4 * s, CAP)}${rect(x - 5 * s, y + r - 1 * s, 10 * s, 4 * s, CAP)}</g>`;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) => {
    const [x, y] = at(p, s.x, s.y);
    const [, hang] = at(p, s.x, s.hang);
    const k = s.k * p.s;
    const key = i < GLOWING ? `${ctx.seedKey}:flicker:${i}` : null;
    if (s.kind === 'big') return item('big', i, ctx, glow(x, y, (s.slot < 0 ? 26 : 14) * p.s, key) + roundLantern(sk, x, y, hang, k, ctx.kid.colour, i % 2 === 0));
    return item('small', i, ctx, glow(x, y, 12 * p.s, key) + paperLantern(sk, x, y, hang, k, PAPER[s.slot % PAPER.length]));
  }).join('');
}

/** The kid's lantern stick in the kid colour and the four lines from it to the tall house. */
function rig(sk: Sketch, p: Placement, colour: string): string {
  const u = (x: number, y: number) => at(p, x, y).map(num).join(' ');
  const strings = LINES.map((y) => `M ${u(POLE_X, y)} Q ${u(RIG_MID, y + SAG)} ${u(TOWER_X, y)}`).join(' ');
  const lines = `<path d="${strings}" stroke="${STRING}" stroke-width="${num(Math.max(0.8, 1.4 * p.s))}" fill="none"/>`;
  const stick = sk.line(...at(p, POLE_X, GROUND + 4), ...at(p, POLE_X, 24), { stroke: colour, strokeWidth: Math.max(2, 5 * p.s), roughness: 0.5 });
  const knob = sk.circle(...at(p, POLE_X, 22), 9 * p.s, { fill: colour, strokeWidth: 1.4, roughness: 0.4 });
  return `<g data-part="line">${stick}${knob}${lines}</g>`;
}

/** The narrow tall house at the right the lines are tied to, with a pointed roof and lit windows. */
function tower(sk: Sketch, p: Placement): string {
  const [x0, top] = at(p, TOWER_X, 30);
  const [x1, base] = at(p, 318, GROUND);
  const body = sk.rect(x0, top, x1 - x0, base - top, { fill: HOUSE, stroke: NIGHT_EDGE, strokeWidth: 1.6, roughness: 0.6 });
  const roof = sk.polygon([[x0, top], at(p, 308, 10), [x1, top]], { fill: ROOF, stroke: NIGHT_EDGE, strokeWidth: 1.4, roughness: 0.5 });
  const windows = [60, 110, 160].map((y) => {
    const [wx, wy] = at(p, 304, y);
    return pane(wx, wy, 8 * p.s, 11 * p.s, WINDOW);
  }).join('');
  return `<g data-part="tower">${body}${roof}${windows}</g>`;
}

/** A row of dark houses with gable roofs and lit windows from x0 to x1 px, standing on `base`, `s` px per unit. */
function houses(sk: Sketch, x0: number, x1: number, base: number, s: number, key: string): string {
  let out = '';
  let x = x0;
  for (let i = 0; x < x1 - 8 * s; i++) {
    const k = `${key}:house:${i}`;
    const w = Math.min((44 + rand(`${k}:w`) * 30) * s, x1 - x);
    const h = (62 + rand(`${k}:h`) * 40) * s;
    const top = base - h;
    out += sk.rect(x, top, w, h, { fill: HOUSE, stroke: NIGHT_EDGE, strokeWidth: 1.4, roughness: 0.6 });
    out += sk.polygon([[x, top], [x + w / 2, top - Math.min(0.38 * w, 26 * s)], [x + w, top]], { fill: ROOF, stroke: NIGHT_EDGE, strokeWidth: 1.2, roughness: 0.5 });
    const cols = w > 52 * s ? 2 : 1;
    const rows = h > 84 * s ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + ((c + 1) * w) / (cols + 1) - 4.5 * s;
        const wy = top + 14 * s + r * 26 * s;
        if (wx < x + 2 || wx + 9 * s > x + w - 2) continue;
        out += pane(wx, wy, 9 * s, 10 * s, rand(`${k}:lit:${r}:${c}`) < 0.6 ? WINDOW : WINDOW_DARK);
      }
    }
    x += w;
  }
  return `<g data-part="houses">${out}</g>`;
}

function moon(sk: Sketch, x: number, y: number, r: number): string {
  return `<g data-part="moon"><circle cx="${num(x)}" cy="${num(y)}" r="${num(r * 1.6)}" fill="${MOON}" fill-opacity="0.18"/>${sk.circle(x, y, 2 * r, { fill: MOON, strokeWidth: 1.8, roughness: 0.6 })}</g>`;
}

/** A twinkling star at (x, y) px with radius r px. */
function star(x: number, y: number, r: number, key: string): string {
  return `<polygon points="${points(starPoints(x, y, r))}" fill="${STAR}" stroke="${INK}" stroke-width="0.6" class="fb-anim fb-martin-twinkle" style="${timing(key, [2.5, 4])}"/>`;
}

/** Faint still dots in the sky from x0 to x1 and y0 to y1 px. */
function dots(x0: number, x1: number, y0: number, y1: number, n: number, key: string): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const k = `${key}:dot:${i}`;
    const x = x0 + rand(`${k}:x`) * (x1 - x0);
    const y = y0 + rand(`${k}:y`) * Math.max(0, y1 - y0);
    out += `<circle cx="${num(x)}" cy="${num(y)}" r="${num(0.7 + rand(`${k}:r`) * 0.8)}" fill="${DOT}" opacity="${num(0.35 + rand(`${k}:o`) * 0.35)}"/>`;
  }
  return out;
}

/** The dark dusk band from x0 to x1 px across the scene band of `box`: night sky, a lighter purple glow above the roofs and the street from `street` down. */
function dusk(sk: Sketch, box: Box, x0: number, x1: number, glowTop: number, street: number): string {
  const y0 = box.y + box.h * SCENE_TOP;
  const y1 = box.y + box.h * SCENE_BOTTOM;
  const sky = sk.rect(x0, y0, x1 - x0, y1 - y0, { fill: NIGHT, stroke: NIGHT_EDGE, strokeWidth: 2.4, roughness: 0.6 });
  const band = `<rect x="${num(x0 + 1)}" y="${num(glowTop)}" width="${num(x1 - x0 - 2)}" height="${num(Math.max(0, street - glowTop))}" fill="${HORIZON}" opacity="0.7"/>`;
  const road = `<rect x="${num(x0 + 1)}" y="${num(street)}" width="${num(x1 - x0 - 2)}" height="${num(Math.max(0, y1 - street - 1))}" fill="${STREET}"/>`;
  return sky + band + road;
}

const STARS: Pt[] = [[40, 12], [110, 7], [180, 15], [222, 7]];

function renderHalf(ctx: HalfContext): string {
  const { box } = ctx;
  const sk = createSketch(ctx.seedKey);
  const p = placement(box, UNITS);
  const [x0, x1] = [box.x + 8, box.x + box.w - 8];
  const [, street] = at(p, 0, GROUND);
  const [, glowTop] = at(p, 0, 120);
  const [, skyEnd] = at(p, 0, 28);
  const back = dusk(sk, box, x0, x1, glowTop, street) + dots(x0 + 6, x1 - 6, box.y + box.h * SCENE_TOP + 6, skyEnd, Math.round(box.w / 30), ctx.seedKey) +
    moon(sk, ...at(p, 262, 15), 12 * p.s) + STARS.map(([x, y], i) => star(...at(p, x, y), 4.5 * p.s, `${ctx.seedKey}:star:${i}`)).join('') +
    houses(sk, x0 + 2, x1 - 2, street, p.s, ctx.seedKey) + tower(sk, p);
  // Lanterns have their own sketch, so adding one never re-wobbles the scenery.
  return `<g>${back}${rig(sk, p, ctx.kid.colour)}${items(createSketch(`${ctx.seedKey}:items`), p, ctx)}</g>`;
}

/** Twinkling stars in the season scene, as shares of the board: in the sky above the lines and either side of the moon. */
const SEASON_STARS: Pt[] = [[0.08, 0.2], [0.3, 0.19], [0.535, 0.4], [0.7, 0.2], [0.93, 0.21]];

function renderSeasonScene(halves: HalfContext[], box: Box): string {
  const key = `season:${halves.map((h) => h.seedKey).join('|')}`;
  const sk = createSketch(key);
  const placed = halves.map((ctx) => ({ ctx, ...seasonPlacement(box, ctx.box, UNITS) }));
  const s = Math.max(0.1, ...placed.map(({ p }) => p.s));
  const bottom = box.y + box.h * SCENE_BOTTOM;
  const street = bottom - (UNITS_H - GROUND) * s;
  const [x0, x1] = [box.x + 6, box.x + box.w - 6];
  const sky = `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}" fill="${DUSK}"/>`;
  const top = box.y + box.h * SCENE_TOP;
  const back = dusk(sk, box, x0, x1, street - 108 * s, street) + dots(x0 + 6, x1 - 6, top + 6, top + (bottom - top) * 0.3, Math.round(box.w / 25), key) +
    moon(sk, box.x + box.w / 2, box.y + box.h * 0.27, Math.min(24, box.h * 0.05)) +
    SEASON_STARS.map(([fx, fy], i) => star(box.x + fx * box.w, box.y + fy * box.h, Math.min(6, box.h * 0.012), `${key}:star:${i}`)).join('') +
    houses(sk, x0 + 2, x1 - 2, street, s, key);
  const kids = placed.map(({ ctx, cx, p }) => {
    const ksk = createSketch(ctx.seedKey);
    return seasonKid(ctx.kid.id, cx, tower(ksk, p) + rig(ksk, p, ctx.kid.colour) + items(createSketch(`${ctx.seedKey}:items`), p, ctx));
  }).join('');
  return `<g>${sky}${back}${kids}</g>`;
}

const css = `
  @keyframes fb-martin-flicker {
    0%, 100% { opacity: 1; }
    25% { opacity: 0.55; }
    40% { opacity: 0.9; }
    65% { opacity: 0.6; }
    85% { opacity: 1; }
  }
  @keyframes fb-martin-twinkle {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(0.7); opacity: 0.35; }
  }
  .fb-martin-flicker { animation-name: fb-martin-flicker; animation-timing-function: ease-in-out; }
  .fb-martin-twinkle { animation-name: fb-martin-twinkle; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
`;

export const martin: Theme = {
  id: 'martin',
  label: 'St. Martin',
  capacity: CAPACITY,
  background: DUSK,
  renderHalf,
  renderSeasonScene,
  css,
};
