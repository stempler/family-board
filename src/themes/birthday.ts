import { timing } from '../draw/anim';
import { createSketch, num, type Sketch } from '../draw/sketch';
import { at, moved, placement, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A birthday table, drawn in "party units": bunting hangs across the top, a balloon on a string floats
// beside a big three-tier cake with icing in the kid colour. Candles stand in tidy rows on the tiers:
// 5 on the top tier, then 10 and 15 on the lower ones, in groups of five. Wrapped presents with a bow
// stack up on the table beside the cake and stand in a row on the floor in front of it.
const MID = 170;
const UNITS_W = 340;
const UNITS_H = 270;
const UNITS: Units = { mid: MID, top: 0, w: UNITS_W, h: UNITS_H, fill: 0.92 };

const WALL = '#fdeedd';
const FLOOR = '#e2b98a';
const FLOOR_DARK = '#c49565';
const CLOTH = '#d8eef8';
const CLOTH_DARK = '#a9cfe2';
const LEG = '#a5703f';
const PLATE = '#ffffff';
const SPONGE = '#f8deb3';
const SPONGE_DARK = '#e4bf86';
const FLAME = '#ffad33';
const FLAME_CORE = '#fff1a1';
const BALLOON = '#f2c14e';
const STRING = '#8a7a6a';
const PENNANTS = ['#f2c14e', '#6fb7e0', '#8cc66b', '#f49ac1'];
const CANDLES = ['#f49ac1', '#6fb7e0', '#8cc66b', '#f2c14e', '#b59ae0'];
const WRAPS: [string, string][] = [['#6fb7e0', '#ffffff'], ['#f49ac1', '#f2c14e'], ['#8cc66b', '#ffffff'], ['#b59ae0', '#f2c14e'], ['#f2a35a', '#ffffff']];

const TABLE_TOP = 214; // the table board's top
const PLATE_TOP = 211;
const FLOOR_Y = 260;

/** The cake's tiers, top first: left, right, top edge and bottom edge in units. */
const TIERS: [number, number, number, number][] = [
  [137, 203, 104, 138],
  [111, 229, 138, 174],
  [85, 255, 174, PLATE_TOP],
];

const CANDLE_W = 7; // a candle with its flame: 7 x 24 units, standing on its base
const CANDLE_H = 24;
const PRESENT_W = 26; // a present with its bow: 26 x 25 units
const PRESENT_H = 25;
const LIT = 8; // only the first candles' flames flicker

/** `n` candles on a tier whose top edge is at `base`, 10 apart in groups of five (18 between groups), centred on the cake. */
const candleRow = (n: number, base: number): Pt[] => {
  const xs = Array.from({ length: n }, (_, i) => 10 * i + 8 * Math.floor(i / 5));
  const half = xs[n - 1] / 2;
  return xs.map((x): Pt => [MID - half + x, base - CANDLE_H / 2]);
};

/** Candle spots (footprint centres), top tier first, left to right in each row. */
const CANDLE_SPOTS: Pt[] = [...candleRow(5, TIERS[0][2]), ...candleRow(10, TIERS[1][2]), ...candleRow(15, TIERS[2][2])];

const CAPACITY = CANDLE_SPOTS.length;

/** One row of presents on the table, two either side of the cake, inner ones first; rows are 27 apart. */
const tableRow = (y: number): Pt[] => [[56, y], [284, y], [26, y], [314, y]];
/** The row of presents on the floor in front of the table, 30 apart, centre outwards. */
const FLOOR_ROW: Pt[] = Array.from({ length: 11 }, (_, i): Pt => [20 + 30 * i, FLOOR_Y + 9 - PRESENT_H / 2])
  .sort((a, b) => Math.abs(a[0] - MID) - Math.abs(b[0] - MID) || a[0] - b[0]);

/**
 * Present spots (footprint centres): the two lowest table rows, the floor row, then three more table rows
 * stacked on top. 31 spots: more than the 30 presents the grouping can ask for, so none ever lands on the cake.
 */
const PRESENT_SPOTS: Pt[] = [
  ...tableRow(TABLE_TOP - PRESENT_H / 2), ...tableRow(TABLE_TOP - PRESENT_H / 2 - 27),
  ...FLOOR_ROW,
  ...[2, 3, 4].flatMap((r) => tableRow(TABLE_TOP - PRESENT_H / 2 - 27 * r)),
];

export interface Spot { kind: 'big' | 'small'; x: number; y: number } // party units, centre of the footprint

/** Where the items go: presents first on their own spots beside the cake, then candles on the tiers in order. */
export function spots(big: number, small: number): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < big && i < PRESENT_SPOTS.length; i++) out.push({ kind: 'big', x: PRESENT_SPOTS[i][0], y: PRESENT_SPOTS[i][1] });
  for (let i = 0; i < small && i < CANDLE_SPOTS.length; i++) out.push({ kind: 'small', x: CANDLE_SPOTS[i][0], y: CANDLE_SPOTS[i][1] });
  return out;
}

/** The box a drawn item covers, in party units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [w, h] = s.kind === 'big' ? [PRESENT_W, PRESENT_H] : [CANDLE_W, CANDLE_H];
  return [s.x - w / 2, s.y - h / 2, s.x + w / 2, s.y + h / 2];
}

/** A striped candle whose footprint is centred on (x, y), with its flame on top; the flame flickers when `flicker` is a seed key. */
function candle(sk: Sketch, p: Placement, x: number, y: number, colour: string, flicker?: string): string {
  const base = y + CANDLE_H / 2;
  const body = sk.rect(...at(p, x - 3, base - 15), 6 * p.s, 15 * p.s, { fill: colour, strokeWidth: 1.2, roughness: 0.3 });
  const stripes = [5, 10].map((dy) => {
    const [x0, y0] = at(p, x - 3, base - dy + 2);
    const [x1, y1] = at(p, x + 3, base - dy - 2);
    return `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}" stroke="#ffffff" stroke-width="${num(Math.max(0.8, 1.4 * p.s))}" opacity="0.85"/>`;
  }).join('');
  const [wx, wy0] = at(p, x, base - 15);
  const [, wy1] = at(p, x, base - 17);
  const wick = `<line x1="${num(wx)}" y1="${num(wy0)}" x2="${num(wx)}" y2="${num(wy1)}" stroke="#3a2f28" stroke-width="${num(Math.max(0.6, 0.9 * p.s))}"/>`;
  const outer = sk.path(moved(p, `M ${x} ${base - 16} Q ${x - 3.5} ${base - 18} ${x} ${base - 24} Q ${x + 3.5} ${base - 18} ${x} ${base - 16} Z`), { fill: FLAME, stroke: 'none', roughness: 0.2 });
  const core = sk.path(moved(p, `M ${x} ${base - 16.5} Q ${x - 1.6} ${base - 18} ${x} ${base - 21} Q ${x + 1.6} ${base - 18} ${x} ${base - 16.5} Z`), { fill: FLAME_CORE, stroke: 'none', roughness: 0.1 });
  const flame = flicker ? `<g class="fb-anim fb-birthday-flame" style="${timing(flicker, [2, 2.8])}">${outer}${core}</g>` : `<g>${outer}${core}</g>`;
  return `<g data-part="candle">${body}${stripes}${wick}</g>${flame}`;
}

/** A wrapped present whose footprint is centred on (x, y): a box with a lid, a ribbon and a bow on top. */
function present(sk: Sketch, p: Placement, x: number, y: number, [wrap, ribbon]: [string, string]): string {
  const b = y + PRESENT_H / 2; // the bottom of the box
  const box = sk.rect(...at(p, x - 12, b - 15), 24 * p.s, 15 * p.s, { fill: wrap, strokeWidth: 1.6, roughness: 0.4 });
  const lid = sk.rect(...at(p, x - 13, b - 18), 26 * p.s, 4 * p.s, { fill: wrap, strokeWidth: 1.6, roughness: 0.4 });
  const band = sk.rect(...at(p, x - 2, b - 18), 4 * p.s, 18 * p.s, { fill: ribbon, strokeWidth: 1, roughness: 0.2 });
  const loops = sk.path(moved(p, `M ${x} ${b - 18} C ${x - 9} ${b - 26} ${x - 11} ${b - 18} ${x} ${b - 18} Z`), { fill: ribbon, strokeWidth: 1.2, roughness: 0.3 }) +
    sk.path(moved(p, `M ${x} ${b - 18} C ${x + 9} ${b - 26} ${x + 11} ${b - 18} ${x} ${b - 18} Z`), { fill: ribbon, strokeWidth: 1.2, roughness: 0.3 });
  const knot = sk.circle(...at(p, x, b - 18.5), 3.6 * p.s, { fill: ribbon, strokeWidth: 1, roughness: 0.2 });
  return box + lid + band + loops + knot;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  let candles = 0;
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) => {
    if (s.kind === 'big') return item('big', i, ctx, present(sk, p, s.x, s.y, WRAPS[i % WRAPS.length]));
    const n = candles++;
    return item('small', i, ctx, candle(sk, p, s.x, s.y, CANDLES[n % CANDLES.length], n < LIT ? `${ctx.seedKey}:flame:${n}` : undefined));
  }).join('');
}

/** The floor strip below the table, across the whole half. */
function floor(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  const [, top] = at(p, 0, FLOOR_Y - 6);
  const [, bottom] = at(p, 0, UNITS_H);
  const fill = `<rect x="${num(box.x)}" y="${num(top)}" width="${num(box.w)}" height="${num(bottom - top)}" fill="${FLOOR}"/>`;
  const line = sk.line(box.x + 3, top, box.x + box.w - 3, top, { stroke: FLOOR_DARK, strokeWidth: 1.8, roughness: 0.6 });
  return `<g data-part="floor">${fill}${line}</g>`;
}

/** A line of pennants across the top of the scene, sagging in the middle; every fifth pennant is in the kid colour. */
function bunting(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const sag = (x: number) => { const t = (x - 4) / 332; return 6 + 40 * t * (1 - t); };
  const rope = sk.path(moved(p, 'M 4 6 Q 170 26 336 6'), { stroke: STRING, strokeWidth: 1.4, roughness: 0.4 });
  const flags = Array.from({ length: 12 }, (_, i) => {
    const cx = 19 + 27.5 * i;
    const colour = i % 5 === 2 ? ctx.kid.colour : PENNANTS[i % PENNANTS.length];
    return sk.polygon([at(p, cx - 10, sag(cx - 10)), at(p, cx + 10, sag(cx + 10)), at(p, cx, sag(cx) + 17)], { fill: colour, strokeWidth: 1.4, roughness: 0.4 });
  }).join('');
  return `<g data-part="bunting">${rope}${flags}</g>`;
}

/** One balloon floating beside the cake; its string runs down behind the cake to the table. It sways on its string. */
function balloon(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const string = sk.path(moved(p, `M 236 83 Q 230 120 240 150 Q 248 180 240 ${TABLE_TOP}`), { stroke: STRING, strokeWidth: 1.3, roughness: 0.4 });
  const body = sk.ellipse(...at(p, 236, 60), 30 * p.s, 38 * p.s, { fill: BALLOON, strokeWidth: 1.8, roughness: 0.5 });
  const knot = sk.polygon([at(p, 236, 78), at(p, 232, 84), at(p, 240, 84)], { fill: BALLOON, strokeWidth: 1.2, roughness: 0.3 });
  const shine = sk.path(moved(p, 'M 228 52 Q 229 46 234 44'), { stroke: '#ffffff', strokeWidth: 2.4 * p.s, roughness: 0.2 });
  return `<g data-part="balloon"><g class="fb-anim fb-birthday-sway" style="${timing(`${ctx.seedKey}:sway`, [4, 5.5])}">${string}${knot}${body}${shine}</g></g>`;
}

/** The table: a board with a hanging cloth and two legs. */
function table(sk: Sketch, p: Placement): string {
  const legs = [24, 310].map((x) => sk.rect(...at(p, x, TABLE_TOP + 8), 6 * p.s, (FLOOR_Y - TABLE_TOP - 6) * p.s, { fill: LEG, strokeWidth: 1.6, roughness: 0.4 })).join('');
  let edge = `M 6 ${TABLE_TOP} L 334 ${TABLE_TOP} L 334 ${TABLE_TOP + 14}`;
  for (let x = 334; x > 6; x -= 16.4) edge += ` Q ${x - 8.2} ${TABLE_TOP + 22} ${x - 16.4} ${TABLE_TOP + 14}`;
  const cloth = sk.path(moved(p, `${edge} Z`), { fill: CLOTH, strokeWidth: 1.8, roughness: 0.5 });
  const fold = sk.line(...at(p, 8, TABLE_TOP + 4), ...at(p, 332, TABLE_TOP + 4), { stroke: CLOTH_DARK, strokeWidth: 1.2, roughness: 0.4 });
  return `<g data-part="table">${legs}${cloth}${fold}</g>`;
}

/** The cake on its plate: three sponge tiers, each with dripping icing in the kid colour. */
function cake(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const plate = sk.ellipse(...at(p, MID, PLATE_TOP + 2), 196 * p.s, 9 * p.s, { fill: PLATE, strokeWidth: 1.6, roughness: 0.4 });
  const tiers = [...TIERS].reverse().map(([l, r, t, b]) => {
    const sponge = sk.rect(...at(p, l, t), (r - l) * p.s, (b - t) * p.s, { fill: SPONGE, strokeWidth: 2, roughness: 0.5 });
    const [x0, y0] = at(p, l + 3, b - 9);
    const [x1] = at(p, r - 3, b - 9);
    const cream = `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y0)}" stroke="${SPONGE_DARK}" stroke-width="${num(2 * p.s)}" stroke-dasharray="${num(3 * p.s)} ${num(4 * p.s)}" stroke-linecap="round"/>`;
    const n = Math.max(3, Math.round((r - l) / 14));
    const step = (r - l) / n;
    let d = `M ${l} ${t} L ${r} ${t} L ${r} ${t + 7}`;
    for (let i = n; i > 0; i--) d += ` Q ${num(l + (i - 0.5) * step)} ${t + (i % 2 ? 17 : 12)} ${num(l + (i - 1) * step)} ${t + 7}`;
    const icing = sk.path(moved(p, `${d} Z`), { fill: ctx.kid.colour, strokeWidth: 1.6, roughness: 0.4 });
    return sponge + cream + icing;
  }).join('');
  return `<g data-part="cake">${plate}${tiers}</g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box, UNITS);
  // Items come last with their own sketch, so adding an item never re-wobbles the scenery.
  return `<g>${floor(sk, p, ctx)}${bunting(sk, p, ctx)}${balloon(sk, p, ctx)}${table(sk, p)}${cake(sk, p, ctx)}` +
    `${items(createSketch(`${ctx.seedKey}:items`), p, ctx)}</g>`;
}

const css = `
  @keyframes fb-birthday-flame {
    0%, 100% { transform: scale(1, 1); opacity: 1; }
    30% { transform: scale(0.85, 1.15); opacity: 0.9; }
    55% { transform: scale(1.1, 0.88); opacity: 1; }
    80% { transform: scale(0.92, 1.08); opacity: 0.85; }
  }
  @keyframes fb-birthday-sway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }
  .fb-birthday-flame { animation-name: fb-birthday-flame; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
  .fb-birthday-sway { animation-name: fb-birthday-sway; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
`;

export const birthday: Theme = {
  id: 'birthday',
  label: 'Geburtstag',
  capacity: CAPACITY,
  background: WALL,
  renderHalf,
  css,
};
