import { timing } from '../draw/anim';
import { createSketch, esc, INK, num, type Sketch } from '../draw/sketch';
import { at, moved, placement, SCENE_TOP, type Placement, type Pt, type Units } from '../draw/units';
import { de } from '../i18n';
import { item, type HalfContext, type Theme } from './types';

// A birthday table, drawn in "party units": a banner with the greeting hangs across the top, a small
// two-tier cake with icing in the kid colour stands in the middle of the table. The candles on the cake
// show the kid's age (not counted items): up to 10 in one row on the top tier, 11 to 20 in two rows, the
// second on the ledge of the lower tier; without a known age a cherry sits on top instead. The points are
// balloons, each on its string, in columns of five left and right of the cake; presents (the big items)
// stand in a row of big boxes on the floor in front of the table and then stack up on the table from below,
// smaller, taking the place of the balloons.
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
const STRING = '#8a7a6a';
const BANNER = '#fff4c7';
const CHERRY = '#d7263d';
const CREAM = '#fffaf2';
const CANDLES = ['#f49ac1', '#6fb7e0', '#8cc66b', '#f2c14e', '#b59ae0'];
const BALLOONS = ['#e84d5b', '#f2c14e', '#6fb7e0', '#8cc66b', '#b59ae0', '#f49ac1', '#f2a35a'];
const WRAPS: [string, string][] = [['#6fb7e0', '#ffffff'], ['#f49ac1', '#f2c14e'], ['#8cc66b', '#ffffff'], ['#b59ae0', '#f2c14e'], ['#f2a35a', '#ffffff']];

const TABLE_TOP = 214; // the table board's top
const PLATE_TOP = 211;
const FLOOR_Y = 260;

/** A cake tier: left, right, the centre of its top ellipse, its bottom edge and the top ellipse's half-height, in units. */
interface Tier { l: number; r: number; t: number; b: number; ry: number }
const TOP_TIER: Tier = { l: 118, r: 222, t: 146, b: 178, ry: 6 };
const LOW_TIER: Tier = { l: 106, r: 234, t: 176, b: PLATE_TOP - 3, ry: 9 };

const CANDLE_H = 24; // a candle with its flame, standing on its base
const CANDLE_W = 5;
const MAX_CANDLES = 20;
const ROW = 10; // candles in one row
const LIT = 8; // only the first candles' flames flicker

const BALLOON_W = 16; // a balloon with its string: 16 x 26 units
const BALLOON_H = 26;
const PRESENT = 26; // a present stacked on the table: a 26 x 26 box with a lid, a ribbon and a flat bow
const FLOOR_W = 44; // a present on the floor: a 44 x 50 box, about two balloons tall, so it reads as "ten"
const FLOOR_H = 50;
const PITCH = 28; // the grid of balloon and stacked present spots beside the cake

/** The grid beside the cake, three columns either side, five rows from the table up; columns inner ones first, alternating sides. */
const COLUMNS = [78, 262, 50, 290, 22, 318];
const ROWS = Array.from({ length: 5 }, (_, i) => TABLE_TOP - PRESENT / 2 - PITCH * i); // bottom row first

/** Balloon spots: column by column (five each, top down), inner columns first. */
const BALLOON_CELLS: { x: number; y: number; slot: number }[] = COLUMNS.flatMap((x, c) =>
  [...ROWS].reverse().map((y, r) => ({ x, y, slot: c * ROWS.length + r })));

/** Presents stacked on the table: the bottom row first (inner columns first), then the rows above; they take balloon cells. */
const STACK_CELLS = ROWS.flatMap((y) => COLUMNS.map((x) => BALLOON_CELLS.find((c) => c.x === x && c.y === y)!));

/** The row of big presents on the floor in front of the table, 46 apart, centre outwards, standing on the bottom edge. */
const FLOOR_ROW: Pt[] = Array.from({ length: 7 }, (_, i): Pt => [MID + 46 * (i - 3), UNITS_H - 1 - FLOOR_H / 2])
  .sort((a, b) => Math.abs(a[0] - MID) - Math.abs(b[0] - MID) || a[0] - b[0]);

const CAPACITY = BALLOON_CELLS.length;

export interface Spot { kind: 'big' | 'small'; x: number; y: number; slot: number } // party units, centre of the footprint; slot is the grid cell, -1 on the floor (a big present)

/**
 * Where the items go: presents on the floor first, then stacked on the table from below; balloons fill the
 * grid cells the presents left free, column by column. 37 present spots, more than the 30 the grouping can ask for.
 */
export function spots(big: number, small: number): Spot[] {
  const out: Spot[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < big && i < FLOOR_ROW.length + STACK_CELLS.length; i++) {
    if (i < FLOOR_ROW.length) out.push({ kind: 'big', x: FLOOR_ROW[i][0], y: FLOOR_ROW[i][1], slot: -1 });
    else {
      const c = STACK_CELLS[i - FLOOR_ROW.length];
      taken.add(c.slot);
      out.push({ kind: 'big', x: c.x, y: c.y, slot: c.slot });
    }
  }
  const free = BALLOON_CELLS.filter((c) => !taken.has(c.slot));
  for (let i = 0; i < small && i < free.length; i++) out.push({ kind: 'small', x: free[i].x, y: free[i].y, slot: free[i].slot });
  return out;
}

/** Width and height of a spot's item: a balloon, a big present on the floor or a present stacked on the table. */
const size = (s: Spot): [number, number] => (s.kind === 'small' ? [BALLOON_W, BALLOON_H] : s.slot < 0 ? [FLOOR_W, FLOOR_H] : [PRESENT, PRESENT]);

/** The box a drawn item covers, in party units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [w, h] = size(s);
  return [s.x - w / 2, s.y - h / 2, s.x + w / 2, s.y + h / 2];
}

/** A balloon whose footprint is centred on (x, y): a round body with a knot and a shine, its string dangling below. */
function balloon(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const top = y - BALLOON_H / 2;
  const body = sk.ellipse(...at(p, x, top + 8.5), BALLOON_W * p.s, 17 * p.s, { fill: colour, strokeWidth: 1.6, roughness: 0.4 });
  const knot = sk.polygon([at(p, x, top + 16.5), at(p, x - 2, top + 19), at(p, x + 2, top + 19)], { fill: colour, strokeWidth: 1, roughness: 0.2 });
  const string = sk.path(moved(p, `M ${x} ${top + 19} Q ${x + 2.5} ${top + 22.5} ${x} ${top + BALLOON_H}`), { stroke: STRING, strokeWidth: 1.1, roughness: 0.3 });
  const shine = sk.path(moved(p, `M ${x - 4.5} ${top + 7} Q ${x - 4} ${top + 3.5} ${x - 1} ${top + 2.5}`), { stroke: '#ffffff', strokeWidth: 1.8 * p.s, roughness: 0.2 });
  return `<g data-part="balloon">${string}${knot}${body}${shine}</g>`;
}

/**
 * A wrapped present whose `w` x `h` footprint is centred on (x, y): a box with a lid, a ribbon down the front and a
 * bow on the lid; the bow sits inside the footprint's top, the lid below it.
 */
function present(sk: Sketch, p: Placement, x: number, y: number, w: number, h: number, [wrap, ribbon]: [string, string]): string {
  const k = w / PRESENT; // ribbon and bow grow with the box
  const [l, t] = [x - w / 2, y - h / 2];
  const lidH = 6 * k;
  const box = sk.rect(...at(p, l + k, t + lidH - k), (w - 2 * k) * p.s, (h - lidH + k) * p.s, { fill: wrap, strokeWidth: 1.6, roughness: 0.4 });
  const lid = sk.rect(...at(p, l, t), w * p.s, lidH * p.s, { fill: wrap, strokeWidth: 1.6, roughness: 0.4 });
  const band = sk.rect(...at(p, x - 2 * k, t), 4 * k * p.s, h * p.s, { fill: ribbon, strokeWidth: 1, roughness: 0.2 });
  const loops = [-1, 1].map((d) => sk.path(moved(p, `M ${x} ${t + 3 * k} C ${x + d * 8 * k} ${t - 0.5 * k} ${x + d * 9 * k} ${t + 6.5 * k} ${x} ${t + 3 * k} Z`), { fill: ribbon, strokeWidth: 1.1, roughness: 0.3 })).join('');
  const knot = sk.circle(...at(p, x, t + 3 * k), 3.4 * k * p.s, { fill: ribbon, strokeWidth: 1, roughness: 0.2 });
  return `<g data-part="present">${box}${lid}${band}${loops}${knot}</g>`;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  let presents = 0;
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) => {
    if (s.kind === 'big') return item('big', i, ctx, present(sk, p, s.x, s.y, ...size(s), WRAPS[presents++ % WRAPS.length]));
    const [col, row] = [Math.floor(s.slot / ROWS.length), s.slot % ROWS.length];
    return item('small', i, ctx, balloon(sk, p, s.x, s.y, BALLOONS[(col * 3 + row) % BALLOONS.length]));
  }).join('');
}

/** The candles for `age`, each with its row and the units point its base stands on; symmetric about the cake's centre line in each row. */
function candleSpots(age: number | undefined): { row: number; x: number; base: number }[] {
  const n = Math.min(Math.max(0, Math.floor(age ?? 0)), MAX_CANDLES);
  if (n === 0) return [];
  const rows = n <= ROW ? [n] : [Math.ceil(n / 2), Math.floor(n / 2)];
  return rows.flatMap((k, row) => {
    // Top tier: on its top, a little in front of the centre. Lower tier: on the front of its ledge, following the curve.
    const [room, gap] = row === 0 ? [96, 12] : [104, 13];
    const step = k > 1 ? Math.min(gap, room / (k - 1)) : 0;
    return Array.from({ length: k }, (_, i) => {
      const dx = (i - (k - 1) / 2) * step;
      const half = (LOW_TIER.r - LOW_TIER.l) / 2;
      const base = row === 0 ? TOP_TIER.t + 1 : LOW_TIER.t + (LOW_TIER.ry - 2.5) * Math.sqrt(1 - (dx / half) ** 2);
      return { row, x: MID + dx, base };
    });
  });
}

/** A striped candle standing on (x, base) in units, with its flame on top; the flame flickers when `flicker` is a seed key. */
function candle(sk: Sketch, p: Placement, x: number, base: number, row: number, colour: string, flicker?: string): string {
  const body = sk.rect(...at(p, x - CANDLE_W / 2, base - 15), CANDLE_W * p.s, 15 * p.s, { fill: colour, strokeWidth: 1.2, roughness: 0.3 });
  const stripes = [5, 10].map((dy) => {
    const [x0, y0] = at(p, x - CANDLE_W / 2, base - dy + 2);
    const [x1, y1] = at(p, x + CANDLE_W / 2, base - dy - 2);
    return `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}" stroke="#ffffff" stroke-width="${num(Math.max(0.8, 1.4 * p.s))}" opacity="0.85"/>`;
  }).join('');
  const [wx, wy0] = at(p, x, base - 15);
  const [, wy1] = at(p, x, base - 17);
  const wick = `<line x1="${num(wx)}" y1="${num(wy0)}" x2="${num(wx)}" y2="${num(wy1)}" stroke="${INK}" stroke-width="${num(Math.max(0.6, 0.9 * p.s))}"/>`;
  const outer = sk.path(moved(p, `M ${x} ${base - 16} Q ${x - 3.5} ${base - 18} ${x} ${base - CANDLE_H} Q ${x + 3.5} ${base - 18} ${x} ${base - 16} Z`), { fill: FLAME, stroke: 'none', roughness: 0.2 });
  const core = sk.path(moved(p, `M ${x} ${base - 16.5} Q ${x - 1.6} ${base - 18} ${x} ${base - 21} Q ${x + 1.6} ${base - 18} ${x} ${base - 16.5} Z`), { fill: FLAME_CORE, stroke: 'none', roughness: 0.1 });
  const flame = flicker ? `<g class="fb-anim fb-birthday-flame" style="${timing(flicker, [2, 2.8])}">${outer}${core}</g>` : `<g>${outer}${core}</g>`;
  return `<g data-part="candle" data-row="${row}" data-cx="${num(wx)}">${body}${stripes}${wick}</g>${flame}`;
}

/** The candles for the kid's age, the top row first; without an age, a cherry on a dollop of cream instead. */
function candles(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const list = candleSpots(ctx.age);
  if (list.length === 0) {
    const cream = sk.ellipse(...at(p, MID, TOP_TIER.t - 1), 22 * p.s, 9 * p.s, { fill: CREAM, strokeWidth: 1.4, roughness: 0.4 });
    const stem = sk.path(moved(p, `M ${MID} ${TOP_TIER.t - 10} Q ${MID + 1} ${TOP_TIER.t - 17} ${MID + 6} ${TOP_TIER.t - 21}`), { stroke: '#4f8f3a', strokeWidth: 1.6, roughness: 0.3 });
    const cherry = sk.circle(...at(p, MID, TOP_TIER.t - 7), 13 * p.s, { fill: CHERRY, strokeWidth: 1.6, roughness: 0.4 });
    const [hx, hy] = at(p, MID - 2.5, TOP_TIER.t - 9.5);
    const shine = `<circle cx="${num(hx)}" cy="${num(hy)}" r="${num(1.8 * p.s)}" fill="#ffffff" opacity="0.8"/>`;
    return `<g data-part="topper">${cream}${stem}${cherry}${shine}</g>`;
  }
  return list.map((c, i) => candle(sk, p, c.x, c.base, c.row, CANDLES[i % CANDLES.length], i < LIT ? `${ctx.seedKey}:flame:${i}` : undefined)).join('');
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

const GLYPH_W = 0.55; // average glyph width in em, on the wide side
const MIN_TEXT = 13; // the smallest size the long greeting is written in; below it the short one is used

/**
 * The banner across the top of the scene band, as wide as the scene: a light band with the greeting and a
 * swallowtail end in the kid colour on either side; the ends wave. The long greeting when it fits at a readable
 * size, else the short one.
 */
function banner(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  const w = Math.min(UNITS_W * p.s, box.w - 8);
  const x0 = p.cx - w / 2;
  const top = box.y + box.h * SCENE_TOP + 2;
  const h = Math.min(34, Math.max(22, w * 0.1));
  const tail = h * 0.55;
  const [bl, br] = [x0 + tail, x0 + w - tail];
  const ends = ([-1, 1] as const).map((d) => {
    const [outer, inner] = d < 0 ? [x0, bl + 4] : [x0 + w, br - 4];
    const [y1, y2] = [top + h * 0.3, top + h * 1.1];
    const shape = sk.polygon([[inner, y1], [outer, y1], [outer - d * tail * 0.45, (y1 + y2) / 2], [outer, y2], [inner, y2]], { fill: ctx.kid.colour, strokeWidth: 1.6, roughness: 0.4 });
    return `<g class="fb-anim fb-birthday-tail fb-birthday-tail-${d < 0 ? 'l' : 'r'}" style="${timing(`${ctx.seedKey}:tail:${d}`, [3, 4.2])}">${shape}</g>`;
  }).join('');
  const band = sk.rect(bl, top, br - bl, h, { fill: BANNER, strokeWidth: 1.8, roughness: 0.5 });
  const avail = br - bl - h * 0.6;
  const fit = (text: string) => Math.min(h * 0.62, avail / (Array.from(text).length * GLYPH_W));
  const text = fit(de.birthdayGreeting) >= MIN_TEXT ? de.birthdayGreeting : de.birthdayGreetingShort;
  const size = fit(text);
  const label = `<text x="${num(p.cx)}" y="${num(top + h / 2 + size * 0.35)}" font-size="${num(size)}" text-anchor="middle" fill="${INK}">${esc(text)}</text>`;
  return `<g data-part="banner">${ends}${band}${label}</g>`;
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

/** One cake tier: a sponge body, icing in the kid colour on top with drips down the front. */
function tier(sk: Sketch, p: Placement, { l, r, t, b, ry }: Tier, colour: string): string {
  const sponge = sk.rect(...at(p, l, t), (r - l) * p.s, (b - t) * p.s, { fill: SPONGE, strokeWidth: 2, roughness: 0.5 });
  const [x0, y0] = at(p, l + 3, b - 8);
  const [x1] = at(p, r - 3, b - 8);
  const cream = `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y0)}" stroke="${SPONGE_DARK}" stroke-width="${num(2 * p.s)}" stroke-dasharray="${num(3 * p.s)} ${num(4 * p.s)}" stroke-linecap="round"/>`;
  const n = Math.max(3, Math.round((r - l) / 14));
  const step = (r - l) / n;
  let d = `M ${l} ${t} L ${r} ${t} L ${r} ${t + ry}`;
  for (let i = n; i > 0; i--) d += ` Q ${num(l + (i - 0.5) * step)} ${t + ry + (i % 2 ? 10 : 6)} ${num(l + (i - 1) * step)} ${t + ry}`;
  const drips = sk.path(moved(p, `${d} Z`), { fill: colour, strokeWidth: 1.6, roughness: 0.4 });
  const top = sk.ellipse(...at(p, (l + r) / 2, t), (r - l) * p.s, 2 * ry * p.s, { fill: colour, strokeWidth: 1.6, roughness: 0.4 });
  return sponge + cream + drips + top;
}

/** The small cake on its plate: two tiers, centred on the table. */
function cake(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const plate = sk.ellipse(...at(p, MID, PLATE_TOP + 2), 150 * p.s, 9 * p.s, { fill: PLATE, strokeWidth: 1.6, roughness: 0.4 });
  return `<g data-part="cake" data-cx="${num(p.cx)}">${plate}${tier(sk, p, LOW_TIER, ctx.kid.colour)}${tier(sk, p, TOP_TIER, ctx.kid.colour)}</g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box, UNITS);
  // Items come last with their own sketch, so adding an item never re-wobbles the scenery.
  return `<g>${floor(sk, p, ctx)}${table(sk, p)}${cake(sk, p, ctx)}${candles(createSketch(`${ctx.seedKey}:candles`), p, ctx)}${banner(sk, p, ctx)}` +
    `${items(createSketch(`${ctx.seedKey}:items`), p, ctx)}</g>`;
}

const css = `
  @keyframes fb-birthday-flame {
    0%, 100% { transform: scale(1, 1); opacity: 1; }
    30% { transform: scale(0.85, 1.15); opacity: 0.9; }
    55% { transform: scale(1.1, 0.88); opacity: 1; }
    80% { transform: scale(0.92, 1.08); opacity: 0.85; }
  }
  @keyframes fb-birthday-wave {
    0%, 100% { transform: rotate(-4deg); }
    50% { transform: rotate(4deg); }
  }
  .fb-birthday-flame { animation-name: fb-birthday-flame; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
  .fb-birthday-tail { animation-name: fb-birthday-wave; animation-timing-function: ease-in-out; transform-box: fill-box; }
  .fb-birthday-tail-l { transform-origin: 100% 0%; }
  .fb-birthday-tail-r { transform-origin: 0% 0%; }
`;

export const birthday: Theme = {
  id: 'birthday',
  label: 'Geburtstag',
  capacity: CAPACITY,
  background: WALL,
  ground: FLOOR,
  renderHalf,
  css,
};
