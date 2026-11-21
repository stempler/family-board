import { timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { seasonKid, seasonPlacement } from '../draw/season';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { at, moved, placement, SCENE_BOTTOM, starPoints, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A sunny summer beach, drawn in "beach units": a warm sky with a big sun at the top left, a narrow
// turquoise sea from the horizon (y 64) to the shore (y 100), then warm sand down to the bottom (y 240).
// A bucket in the kid colour with a spade stands at the left, a sandcastle with a flag in the kid colour
// at the right. Starfish lie on the sand beside the castle, shells in three rows of ten in front, starting
// at the bucket. No palm, no ship: that is the pirate beach.
const MID = 160;
const UNITS_W = 320;
const UNITS_H = 240;
const UNITS: Units = { mid: MID, top: 0, w: UNITS_W, h: UNITS_H, fill: 0.92 };
const HORIZON = 64;
const SHORE = 100;

const SKY = '#ffefbf';
const SUN = '#ffcf3f';
const SUN_DARK = '#f0a020';
const RAY = '#ffb627';
const SEA = '#35c3c1';
const SEA_DARK = '#1e9a9b';
const FOAM = '#f2fffd';
const SAND = '#f7cf7d';
const SAND_DARK = '#dba653';
const CASTLE = '#e9b864';
const CASTLE_DARK = '#a8752f';
const DOOR = '#8a5a25';
const HANDLE = '#b9824a';
const STARFISH = '#f2683a';
const STARFISH_DOT = '#ffd2b0';
const SHELLS = ['#fff7ec', '#ffb3c6', '#ffa98a', '#dcbcff']; // white, pink, coral, lilac: all stand out from the sand
const SHELL_LINE = '#94603e';

const SHELL_W = 18; // a snail shell lying on the sand: 18 x 13 units
const SHELL_H = 13;
const STAR_R = 15; // a starfish: 30 x 30 units (counted as its full square)
const SPILL = 0.66; // scale of a starfish lying on a shell spot, so it fits the shell pitch

/** Own starfish spots beside the castle, the ones closest to it first: 36 apart in a row, 34 between rows. */
const STARS: Pt[] = [[194, 158], [158, 158], [122, 158], [86, 158], [176, 124], [140, 124], [104, 124]];

/** Shell spots: three rows of ten, 30 apart, 22 between rows; the row next to the bucket first, left to right. */
const SHELL_SPOTS: Pt[] = [186, 208, 230].flatMap((y) => Array.from({ length: 10 }, (_, i): Pt => [25 + 30 * i, y]));

const CAPACITY = SHELL_SPOTS.length;

export interface Spot { kind: 'big' | 'small'; x: number; y: number; k: number; slot: number } // beach units; k scales the drawing; slot is the shell spot, -1 on an own starfish spot

/** Where the items go: starfish first on their own spots, then on shell spots (smaller); shells fill the remaining shell spots in order. */
export function spots(big: number, small: number): Spot[] {
  const out: Spot[] = [];
  let slot = 0;
  for (let i = 0; i < big && slot < SHELL_SPOTS.length; i++) {
    if (i < STARS.length) out.push({ kind: 'big', x: STARS[i][0], y: STARS[i][1], k: 1, slot: -1 });
    else out.push({ kind: 'big', x: SHELL_SPOTS[slot][0], y: SHELL_SPOTS[slot][1], k: SPILL, slot: slot++ });
  }
  for (let i = 0; i < small && slot < SHELL_SPOTS.length; i++, slot++) out.push({ kind: 'small', x: SHELL_SPOTS[slot][0], y: SHELL_SPOTS[slot][1], k: 1, slot });
  return out;
}

/** The box a drawn item covers, in beach units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [hw, hh] = s.kind === 'big' ? [STAR_R, STAR_R] : [SHELL_W / 2, SHELL_H / 2];
  return [s.x - hw * s.k, s.y - hh * s.k, s.x + hw * s.k, s.y + hh * s.k];
}

/** A snail shell lying on the sand at (x, y) in units: a round whorl with a spiral and a pointed tip to the right. */
function shell(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const body = sk.path(moved(p, `M ${x + 9} ${y + 1} Q ${x + 4} ${y - 6.5} ${x - 2} ${y - 6.5} Q ${x - 9} ${y - 6.5} ${x - 9} ${y} Q ${x - 9} ${y + 6.5} ${x - 2} ${y + 6.5} Q ${x + 4} ${y + 6.5} ${x + 9} ${y + 1} Z`), { fill: colour, stroke: SHELL_LINE, strokeWidth: 1.4, roughness: 0.4 });
  const spiral = `<path d="${moved(p, `M ${x + 4} ${y} Q ${x + 3} ${y - 4.5} ${x - 2} ${y - 4.5} Q ${x - 6.5} ${y - 4.5} ${x - 6.5} ${y} Q ${x - 6.5} ${y + 4} ${x - 2.5} ${y + 4} Q ${x + 1} ${y + 4} ${x + 1} ${y} Q ${x + 1} ${y - 2} ${x - 2} ${y - 2} Q ${x - 4} ${y - 2} ${x - 4} ${y}`)}" ` +
    `fill="none" stroke="${SHELL_LINE}" stroke-width="${num(Math.max(0.7, 1 * p.s))}" stroke-linecap="round"/>`;
  return body + spiral;
}

/** A starfish at (x, y) in units, scaled by `k`, with a few light dots on it. */
function starfish(sk: Sketch, p: Placement, x: number, y: number, k: number): string {
  const [cx, cy] = at(p, x, y + 1.5 * k);
  const r = STAR_R * k * p.s;
  const body = sk.polygon(starPoints(cx, cy, r).map(([px, py], i): Pt => i % 2 ? [cx + (px - cx) * 1.15, cy + (py - cy) * 1.15] : [px, py]), { fill: STARFISH, strokeWidth: 1.6, roughness: 0.4 });
  const dots = [[0, -0.5], [-0.35, 0.05], [0.35, 0.05], [-0.22, 0.45], [0.22, 0.45], [0, 0]].map(([dx, dy]) =>
    `<circle cx="${num(cx + dx * r)}" cy="${num(cy + dy * r)}" r="${num(Math.max(0.6, 1.3 * k * p.s))}" fill="${STARFISH_DOT}"/>`).join('');
  return body + dots;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) =>
    s.kind === 'big' ? item('big', i, ctx, starfish(sk, p, s.x, s.y, s.k)) : item('small', i, ctx, shell(sk, p, s.x, s.y, SHELLS[s.slot % SHELLS.length])),
  ).join('');
}

/** A foam line at (x, y) in units that rolls to and fro. */
function wave(sk: Sketch, p: Placement, x: number, y: number, key: string): string {
  const line = sk.path(moved(p, `M ${x - 12} ${y} Q ${x - 6} ${y - 4} ${x} ${y} Q ${x + 6} ${y + 4} ${x + 12} ${y}`), { stroke: FOAM, strokeWidth: 2.2, roughness: 0.4 });
  return `<g class="fb-anim fb-summer-wave" style="${timing(key, [3, 4.5])}">${line}</g>`;
}

/** The sea from `top` to `bottom` px across x0..x1 px, with a horizon line. */
function water(sk: Sketch, x0: number, x1: number, top: number, bottom: number): string {
  const fill = `<rect x="${num(x0)}" y="${num(top)}" width="${num(x1 - x0)}" height="${num(bottom - top)}" fill="${SEA}"/>`;
  return fill + sk.line(x0 + 3, top, x1 - 3, top, { stroke: SEA_DARK, strokeWidth: 2, roughness: 0.6 });
}

/** The sand from a gently curved shore line at `shore` px down to `bottom` px, across x0..x1 px; `s` px per unit. */
function beach(sk: Sketch, x0: number, x1: number, shore: number, bottom: number, s: number): string {
  const n = Math.max(2, Math.round((x1 - x0) / 80));
  const step = (x1 - x0) / n;
  let edge = `M ${num(x0)} ${num(shore)}`;
  for (let i = 0; i < n; i++) edge += ` Q ${num(x0 + (i + 0.5) * step)} ${num(shore + (i % 2 ? 4 : -4) * s)} ${num(x0 + (i + 1) * step)} ${num(shore)}`;
  const fill = `<path d="${edge} L ${num(x1)} ${num(bottom)} L ${num(x0)} ${num(bottom)} Z" fill="${SAND}"/>`;
  const foam = `<path d="${edge}" fill="none" stroke="${FOAM}" stroke-width="${num(Math.max(1.5, 3 * s))}" stroke-linecap="round"/>`;
  const line = sk.line(x0 + 3, shore + 2 * s, x1 - 3, shore + 2 * s, { stroke: SAND_DARK, strokeWidth: 1.6, roughness: 0.8 });
  return `<g data-part="sand">${fill}${foam}${line}</g>`;
}

/** The sun at (x, y) px with radius r px; its rays turn slowly around it as one group. */
function sun(sk: Sketch, x: number, y: number, r: number, key: string): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    d += `M ${num(x + Math.cos(a) * r * 1.3)} ${num(y + Math.sin(a) * r * 1.3)} L ${num(x + Math.cos(a) * r * 1.8)} ${num(y + Math.sin(a) * r * 1.8)} `;
  }
  const rays = `<g class="fb-anim fb-summer-ray" style="${timing(key, [14, 18])}"><path d="${d.trim()}" stroke="${RAY}" stroke-width="${num(Math.max(1.5, r * 0.2))}" stroke-linecap="round" fill="none"/></g>`;
  const glow = `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r * 1.15)}" fill="${SUN}" fill-opacity="0.35"/>`;
  return `<g data-part="sun">${rays}${glow}${sk.circle(x, y, 2 * r, { fill: SUN, stroke: SUN_DARK, strokeWidth: 2, roughness: 0.5 })}</g>`;
}

/** The kid's bucket in the kid colour at the left, with a spade standing in it: the shaft and its short T-handle at the top (the blade is hidden in the bucket). */
function bucket(sk: Sketch, p: Placement, colour: string): string {
  const spade = sk.line(...at(p, 46, 140), ...at(p, 66, 104), { stroke: HANDLE, strokeWidth: Math.max(1.5, 3.5 * p.s), roughness: 0.4 }) +
    sk.line(...at(p, 60, 101), ...at(p, 72, 107), { stroke: HANDLE, strokeWidth: Math.max(1.5, 3.5 * p.s), roughness: 0.3 });
  const handle = sk.path(moved(p, 'M 14 138 Q 35 108 56 138'), { stroke: INK, strokeWidth: 1.8, roughness: 0.4 });
  const body = sk.polygon([at(p, 12, 136), at(p, 58, 136), at(p, 52, 176), at(p, 18, 176)], { fill: colour, strokeWidth: 2, roughness: 0.5 });
  const rim = sk.rect(...at(p, 10, 132), 50 * p.s, 7 * p.s, { fill: colour, strokeWidth: 1.6, roughness: 0.4 });
  const [hx, hy] = at(p, 20, 146);
  const shine = `<rect x="${num(hx)}" y="${num(hy)}" width="${num(4 * p.s)}" height="${num(22 * p.s)}" fill="#fff" opacity="0.4"/>`;
  return `<g data-part="bucket">${spade}${handle}${body}${rim}${shine}</g>`;
}

/** A tower of the sandcastle from x0 to x1 units, from `top` down to the base, with three merlons. */
function tower(sk: Sketch, p: Placement, x0: number, x1: number, top: number): string {
  const w = x1 - x0;
  const body = sk.rect(...at(p, x0, top), w * p.s, (176 - top) * p.s, { fill: CASTLE, stroke: CASTLE_DARK, strokeWidth: 1.8, roughness: 0.6 });
  const m = w / 5;
  const merlons = [0, 2, 4].map((i) => sk.rect(...at(p, x0 + i * m, top - 6), m * p.s, 6 * p.s, { fill: CASTLE, stroke: CASTLE_DARK, strokeWidth: 1.4, roughness: 0.5 })).join('');
  return body + merlons;
}

/** The sandcastle at the right: a wall between two towers, a tall middle tower with a flag in the kid colour that waves. */
function castle(sk: Sketch, p: Placement, colour: string, key: string): string {
  const wall = sk.rect(...at(p, 240, 150), 60 * p.s, 26 * p.s, { fill: CASTLE, stroke: CASTLE_DARK, strokeWidth: 1.8, roughness: 0.6 });
  const towers = tower(sk, p, 228, 250, 132) + tower(sk, p, 286, 308, 132) + tower(sk, p, 258, 278, 114);
  const door = sk.path(moved(p, 'M 262 176 L 262 167 Q 268 159 274 167 L 274 176 Z'), { fill: DOOR, stroke: CASTLE_DARK, strokeWidth: 1.2, roughness: 0.3 });
  const windows = ([[239, 146], [297, 146], [268, 128]] as Pt[]).map(([x, y]) => {
    const [wx, wy] = at(p, x, y);
    return `<rect x="${num(wx - 2.2 * p.s)}" y="${num(wy - 3.5 * p.s)}" width="${num(4.4 * p.s)}" height="${num(7 * p.s)}" fill="${DOOR}" opacity="0.8"/>`;
  }).join('');
  const pole = sk.line(...at(p, 268, 108), ...at(p, 268, 80), { stroke: INK, strokeWidth: Math.max(1, 1.6 * p.s), roughness: 0.3 });
  const flag = sk.polygon([at(p, 268.5, 80), at(p, 288, 85.5), at(p, 268.5, 91)], { fill: colour, strokeWidth: 1.4, roughness: 0.3 });
  return `<g data-part="castle">${wall}${towers}${door}${windows}${pole}<g class="fb-anim fb-summer-flag" style="${timing(key, [2.2, 3])}">${flag}</g></g>`;
}

/** The kid's bucket, castle and items; the items have their own sketch, so adding one never re-wobbles the scenery. */
function kidScene(p: Placement, ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  return bucket(sk, p, ctx.kid.colour) + castle(sk, p, ctx.kid.colour, `${ctx.seedKey}:flag`) + items(createSketch(`${ctx.seedKey}:items`), p, ctx);
}

const WAVES: Pt[] = [[110, 78], [196, 88], [292, 74]];

function renderHalf(ctx: HalfContext): string {
  const { box } = ctx;
  const sk = createSketch(`${ctx.seedKey}:beach`);
  const p = placement(box, UNITS);
  const [, top] = at(p, 0, HORIZON);
  const [, shore] = at(p, 0, SHORE);
  const [, bottom] = at(p, 0, UNITS_H);
  const sea = `<g data-part="sea">${water(sk, box.x, box.x + box.w, top, shore + 6 * p.s)}${WAVES.map(([x, y], i) => wave(sk, p, x, y, `${ctx.seedKey}:wave:${i}`)).join('')}</g>`;
  return `<g>${sea}${beach(sk, box.x, box.x + box.w, shore, bottom, p.s)}${sun(sk, ...at(p, 40, 32), 15 * p.s, `${ctx.seedKey}:ray`)}${kidScene(p, ctx)}</g>`;
}

/** Waves in the season scene, as shares of the board width. */
const SEASON_WAVES = [0.12, 0.34, 0.66, 0.88];

function renderSeasonScene(halves: HalfContext[], box: Box): string {
  const key = `season:${halves.map((h) => h.seedKey).join('|')}`;
  const sk = createSketch(key);
  const placed = halves.map((ctx) => ({ ctx, ...seasonPlacement(box, ctx.box, UNITS) }));
  const s = Math.max(0.1, ...placed.map(({ p }) => p.s));
  const bottom = box.y + box.h * SCENE_BOTTOM;
  const shore = bottom - (UNITS_H - SHORE) * s;
  const top = bottom - (UNITS_H - HORIZON) * s;
  const sky = `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}" fill="${SKY}"/>`;
  const waves = SEASON_WAVES.map((fx, i) => {
    const y = top + (i % 2 ? 0.6 : 0.35) * (shore - top);
    const line = sk.path(`M ${num(box.x + fx * box.w - 12 * s)} ${num(y)} Q ${num(box.x + fx * box.w - 6 * s)} ${num(y - 4 * s)} ${num(box.x + fx * box.w)} ${num(y)} Q ${num(box.x + fx * box.w + 6 * s)} ${num(y + 4 * s)} ${num(box.x + fx * box.w + 12 * s)} ${num(y)}`, { stroke: FOAM, strokeWidth: 2.2, roughness: 0.4 });
    return `<g class="fb-anim fb-summer-wave" style="${timing(`${key}:wave:${i}`, [3, 4.5])}">${line}</g>`;
  }).join('');
  const sea = `<g data-part="sea">${water(sk, box.x, box.x + box.w, top, shore + 6 * s)}${waves}</g>`;
  const r = Math.min(26, box.h * 0.055);
  const sunny = sun(sk, box.x + box.w / 2, Math.max(box.y + box.h * 0.17 + r * 1.9, top - r * 2.2), r, `${key}:ray`);
  const kids = placed.map(({ ctx, cx, p }) => seasonKid(ctx.kid.id, cx, kidScene(p, ctx))).join('');
  return `<g>${sky}${sea}${beach(sk, box.x, box.x + box.w, shore, bottom, s)}${sunny}${kids}</g>`;
}

const css = `
  @keyframes fb-summer-flag {
    0%, 100% { transform: scaleX(1) skewY(0deg); }
    50% { transform: scaleX(0.82) skewY(-6deg); }
  }
  @keyframes fb-summer-wave {
    0%, 100% { transform: translateX(-15%); opacity: 0.6; }
    50% { transform: translateX(15%); opacity: 1; }
  }
  @keyframes fb-summer-ray {
    from { transform: rotate(0deg); }
    to { transform: rotate(36deg); }
  }
  .fb-summer-flag { animation-name: fb-summer-flag; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 0% 50%; }
  .fb-summer-wave { animation-name: fb-summer-wave; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
  .fb-summer-ray { animation-name: fb-summer-ray; animation-timing-function: linear; transform-box: fill-box; transform-origin: 50% 50%; }
`;

export const summer: Theme = {
  id: 'summer',
  label: 'Sommer',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  renderSeasonScene,
  css,
};
