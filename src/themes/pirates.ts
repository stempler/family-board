import { timing } from '../draw/anim';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { at, moved, placement, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A beach in front of the sea, drawn in "beach units": the horizon is at y 70, the sand starts at the
// shore (y 140) and runs to the bottom (y 240). An open treasure chest stands in the middle (x 106..194),
// its lid up; gold coins heap up in its opening and then lie on the sand in front of it. Gold bars are
// stacked beside the chest and pile up on the sand in front of the stacks. A small sailing ship with a
// plain pennant in the kid colour bobs on the sea, a palm leans in from the left. Generic pirates: no
// skull, no flag logo.
const MID = 160;
const UNITS_W = 320;
const UNITS_H = 240;
const UNITS: Units = { mid: MID, top: 0, w: UNITS_W, h: UNITS_H, fill: 0.92 };
const HORIZON = 70;
const SHORE = 140;

const SKY = '#c4e6f5';
const SEA = '#4aa3d6';
const SEA_DARK = '#2f7fb0';
const FOAM = '#eef8ff';
const SAND = '#f3d99b';
const SAND_DARK = '#d9b46a';
const WOOD = '#a5703f';
const WOOD_DARK = '#6e4423';
const HOLD = '#3b2414';
const GOLD = '#f2c12e';
const GOLD_DARK = '#c9971a';
const HULL = '#8b5a2b';
const SAIL = '#fffaf0';
const TRUNK = '#a67c52';
const LEAF = '#5cb85c';
const COCONUT = '#6b4423';

const COIN_W = 16; // a coin lies flat: 16 x 9 units
const COIN_H = 9;
const BAR_W = 26; // a gold bar: 26 units at the bottom, 18 at the top, 12 tall
const BAR_H = 12;

/**
 * Bar spots, one for every bar the grouping can ask for (at most one per coin spot), 29 apart in a row and
 * 14 between rows, so no two bars touch: a stack of 4-4-3-2-1 right of the chest (bottom row first), a pyramid
 * of 3-2-1 left of it, then a small pile on the sand in front of each, beside the coin rows.
 */
const BARS: Pt[] = [
  [214, 202], [243, 202], [272, 202], [301, 202],
  [214, 188], [243, 188], [272, 188], [301, 188],
  [228.5, 174], [257.5, 174], [286.5, 174],
  [243, 160], [272, 160],
  [257.5, 146],
  [90, 202], [61, 202], [32, 202],
  [75.5, 188], [46.5, 188],
  [61, 174],
  [243, 216], [272, 216], [301, 216],
  [256, 230], [285, 230],
  [57, 216], [47, 230],
];

/** The two rows of coins in front of the chest, centre outwards: at the coin pitch of 20, so they never touch. */
const outward = (y: number, xs: number[]): Pt[] => [...xs].sort((a, b) => Math.abs(a - 150) - Math.abs(b - 150) || a - b).map((x): Pt => [x, y]);

/**
 * Coin spots, 20 apart in a row and 12 apart between rows: a heap in the chest's opening (bottom row first),
 * then the sand in front of the chest.
 */
const COINS: Pt[] = [
  [120, 158], [140, 158], [160, 158], [180, 158],
  [130, 146], [150, 146], [170, 146],
  [140, 134], [160, 134],
  [150, 122],
  ...outward(230, [70, 90, 110, 130, 150, 170, 190, 210, 230]),
  ...outward(218, [80, 100, 120, 140, 160, 180, 200, 220]),
];

const CAPACITY = COINS.length;

export interface Spot { kind: 'big' | 'small'; x: number; y: number } // beach units

/** Where the items go: bars on their own spots, coins on the coin spots in order. Never more items than coin spots. */
export function spots(big: number, small: number): Spot[] {
  const bars = BARS.slice(0, Math.min(big, CAPACITY)).map(([x, y]): Spot => ({ kind: 'big', x, y }));
  const coins = COINS.slice(0, Math.max(0, Math.min(small, CAPACITY - bars.length))).map(([x, y]): Spot => ({ kind: 'small', x, y }));
  return [...bars, ...coins];
}

/** The box a drawn item covers, in beach units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [w, h] = s.kind === 'big' ? [BAR_W, BAR_H] : [COIN_W, COIN_H];
  return [s.x - w / 2, s.y - h / 2, s.x + w / 2, s.y + h / 2];
}

/** A gold coin lying flat at (x, y) in units, with a rim. */
function coin(sk: Sketch, p: Placement, x: number, y: number): string {
  const [cx, cy] = at(p, x, y);
  const body = sk.ellipse(cx, cy, COIN_W * p.s, COIN_H * p.s, { fill: GOLD, stroke: GOLD_DARK, strokeWidth: 1.4, roughness: 0.4 });
  const rim = `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(4.6 * p.s)}" ry="${num(2.3 * p.s)}" fill="none" stroke="${GOLD_DARK}" stroke-width="${num(Math.max(0.8, 0.9 * p.s))}"/>`;
  return body + rim;
}

/** A gold bar at (x, y) in units: a trapezoid with a shine along its top. */
function bar(sk: Sketch, p: Placement, x: number, y: number): string {
  const [bw, tw, h] = [BAR_W / 2, BAR_W / 2 - 4, BAR_H / 2];
  const body = sk.polygon([at(p, x - bw, y + h), at(p, x + bw, y + h), at(p, x + tw, y - h), at(p, x - tw, y - h)], { fill: GOLD, stroke: INK, strokeWidth: 1.6, roughness: 0.4 });
  const [x0, y0] = at(p, x - tw + 2, y - h + 3);
  const [x1] = at(p, x + tw - 6, y);
  const shine = `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y0)}" stroke="#fff6c2" stroke-width="${num(Math.max(1, 1.6 * p.s))}" stroke-linecap="round" opacity="0.9"/>`;
  return body + shine;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) =>
    s.kind === 'big' ? item('big', i, ctx, bar(sk, p, s.x, s.y)) : item('small', i, ctx, coin(sk, p, s.x, s.y)),
  ).join('');
}

/** The sea across the whole half from the horizon to the shore, with waves that roll to and fro. */
function sea(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  const [, top] = at(p, 0, HORIZON);
  const [, bottom] = at(p, 0, SHORE + 8);
  const water = `<rect x="${num(box.x)}" y="${num(top)}" width="${num(box.w)}" height="${num(bottom - top)}" fill="${SEA}"/>`;
  const horizon = sk.line(box.x + 3, top, box.x + box.w - 3, top, { stroke: SEA_DARK, strokeWidth: 2, roughness: 0.6 });
  const waves = ([[96, 100], [190, 86], [220, 126]] as Pt[]).map(([x, y], i) => {
    const line = sk.path(moved(p, `M ${x - 12} ${y} Q ${x - 6} ${y - 4} ${x} ${y} Q ${x + 6} ${y + 4} ${x + 12} ${y}`), { stroke: FOAM, strokeWidth: 2, roughness: 0.4 });
    return `<g class="fb-anim fb-pirates-wave" style="${timing(`${ctx.seedKey}:wave:${i}`, [3, 4.5])}">${line}</g>`;
  }).join('');
  return `<g data-part="sea">${water}${horizon}${waves}</g>`;
}

/** The sand from a gently curved shore line down to the bottom of the scene, across the whole half. */
function sand(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  const [, shore] = at(p, 0, SHORE);
  const [, bottom] = at(p, 0, UNITS_H);
  const n = Math.max(2, Math.round(box.w / 80));
  const step = box.w / n;
  let edge = `M ${num(box.x)} ${num(shore)}`;
  for (let i = 0; i < n; i++) edge += ` Q ${num(box.x + (i + 0.5) * step)} ${num(shore + (i % 2 ? 5 : -5) * p.s)} ${num(box.x + (i + 1) * step)} ${num(shore)}`;
  const fill = `<path d="${edge} L ${num(box.x + box.w)} ${num(bottom)} L ${num(box.x)} ${num(bottom)} Z" fill="${SAND}"/>`;
  const line = sk.line(box.x + 3, shore, box.x + box.w - 3, shore, { stroke: SAND_DARK, strokeWidth: 1.8, roughness: 0.8 });
  return `<g data-part="sand">${fill}${line}</g>`;
}

/** A palm leaning in from the left, its crown over the sea. */
function palm(sk: Sketch, p: Placement): string {
  const trunk = sk.path(moved(p, 'M 2 238 Q 6 150 34 66 L 44 68 Q 18 150 16 238 Z'), { fill: TRUNK, strokeWidth: 2, roughness: 0.6 });
  let rings = '';
  for (const y of [210, 180, 150, 120, 92]) rings += sk.line(...at(p, 4 + (238 - y) * 0.16, y), ...at(p, 16 + (238 - y) * 0.17, y - 2), { stroke: '#7d5a37', strokeWidth: 1.2, roughness: 0.4 });
  const leaves = [
    'M 40 64 C 28 48 10 54 2 82 C 14 70 28 72 40 64 Z',
    'M 40 64 C 36 44 20 34 4 42 C 18 46 28 62 40 64 Z',
    'M 40 64 C 42 42 56 30 72 38 C 58 42 50 56 40 64 Z',
    'M 40 64 C 54 46 74 46 90 62 C 74 58 58 62 40 64 Z',
    'M 40 64 C 58 62 74 70 80 92 C 68 80 54 74 40 64 Z',
  ].map((d) => sk.path(moved(p, d), { fill: LEAF, strokeWidth: 1.8, roughness: 0.5 })).join('');
  const nuts = sk.circle(...at(p, 36, 70), 9 * p.s, { fill: COCONUT, strokeWidth: 1.4, roughness: 0.4 }) +
    sk.circle(...at(p, 45, 71), 9 * p.s, { fill: COCONUT, strokeWidth: 1.4, roughness: 0.4 });
  return `<g data-part="palm">${trunk}${rings}${leaves}${nuts}</g>`;
}

/** A small sailing ship on the water with a plain pennant in the kid colour; it bobs and tilts on the waves. */
function ship(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const hull = sk.path(moved(p, 'M 230 92 L 294 92 L 284 106 L 240 106 Z'), { fill: HULL, strokeWidth: 2, roughness: 0.5 });
  const stripe = sk.line(...at(p, 234, 97), ...at(p, 290, 97), { stroke: '#e8c27a', strokeWidth: 1.4, roughness: 0.3 });
  const mast = sk.rect(...at(p, 260.5, 40), 3 * p.s, 52 * p.s, { fill: WOOD_DARK, strokeWidth: 1.4, roughness: 0.3 });
  const sail = sk.path(moved(p, 'M 246 48 Q 262 52 278 48 Q 283 67 278 86 Q 262 82 246 86 Q 241 67 246 48 Z'), { fill: SAIL, strokeWidth: 1.8, roughness: 0.5 });
  const flag = sk.polygon([at(p, 263, 40), at(p, 282, 44.5), at(p, 263, 49)], { fill: ctx.kid.colour, strokeWidth: 1.4, roughness: 0.3 });
  return `<g data-part="ship"><g class="fb-anim fb-pirates-bob" style="${timing(`${ctx.seedKey}:bob`, [3.5, 4.5])}">${mast}${sail}${flag}${hull}${stripe}</g></g>`;
}

/** The open treasure chest: the lid stands up behind, coins heap up in the dark opening. */
function chest(sk: Sketch, p: Placement): string {
  const lid = sk.path(moved(p, 'M 106 162 L 110 122 Q 150 106 190 122 L 194 162 Z'), { fill: WOOD_DARK, strokeWidth: 2.2, roughness: 0.6 });
  const lidBand = sk.line(...at(p, 109, 142), ...at(p, 191, 142), { stroke: GOLD_DARK, strokeWidth: 3 * p.s, roughness: 0.4 });
  const hold = sk.ellipse(...at(p, 150, 161), 86 * p.s, 10 * p.s, { fill: HOLD, strokeWidth: 1.4, roughness: 0.4 });
  const body = sk.rect(...at(p, 106, 162), 88 * p.s, 44 * p.s, { fill: WOOD, strokeWidth: 2.4, roughness: 0.6 });
  let planks = '';
  for (const y of [177, 192]) {
    const [x0, yy] = at(p, 108, y);
    const [x1] = at(p, 192, y);
    planks += `<line x1="${num(x0)}" y1="${num(yy)}" x2="${num(x1)}" y2="${num(yy)}" stroke="${WOOD_DARK}" stroke-width="${num(1.2 * p.s)}" opacity="0.6"/>`;
  }
  const strap = (x: number) => sk.rect(...at(p, x, 162), 6 * p.s, 44 * p.s, { fill: GOLD_DARK, strokeWidth: 1.4, roughness: 0.4 });
  const lock = sk.rect(...at(p, 143, 166), 14 * p.s, 15 * p.s, { fill: GOLD, strokeWidth: 1.6, roughness: 0.4 });
  const [kx, ky] = at(p, 150, 172);
  const hole = `<circle cx="${num(kx)}" cy="${num(ky)}" r="${num(2 * p.s)}" fill="${INK}"/>`;
  return `<g data-part="chest">${lid}${lidBand}${body}${planks}${strap(116)}${strap(178)}${lock}${hole}${hold}</g>`;
}

/** A seagull, drawn after the items with its own sketch. No starfish or shells: those are Sommer's counted items. */
function extras(sk: Sketch, p: Placement): string {
  const gull = sk.path(moved(p, 'M 108 34 Q 113 27 118 34 Q 123 27 128 34'), { strokeWidth: 1.8, roughness: 0.4 });
  return `<g data-part="gull">${gull}</g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box, UNITS);
  // Items have their own sketch, and so do the extras drawn after them, so adding an item never re-wobbles the scenery.
  return `<g>${sea(sk, p, ctx)}${sand(sk, p, ctx)}${palm(sk, p)}${ship(sk, p, ctx)}${chest(sk, p)}` +
    `${items(createSketch(`${ctx.seedKey}:items`), p, ctx)}${extras(createSketch(`${ctx.seedKey}:late`), p)}</g>`;
}

const css = `
  @keyframes fb-pirates-bob {
    0%, 100% { transform: translateY(0) rotate(-2.5deg); }
    50% { transform: translateY(-6%) rotate(2.5deg); }
  }
  @keyframes fb-pirates-wave {
    0%, 100% { transform: translateX(-15%); opacity: 0.6; }
    50% { transform: translateX(15%); opacity: 1; }
  }
  .fb-pirates-bob { animation-name: fb-pirates-bob; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
  .fb-pirates-wave { animation-name: fb-pirates-wave; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
`;

export const pirates: Theme = {
  id: 'pirates',
  label: 'Piraten',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  css,
};
