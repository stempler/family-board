import { rand, timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { at, moved, placement, points, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// Below the surface, drawn in "sea units": open water above, a sandy sea floor from y 142 down to the
// bottom (y 240). Shells lie on the floor in three rows of ten; open shells with a pearl in them sit in a row of five at
// the back of the floor, then take the shell rows from the back. A coral on a rock grows at the left, seaweed sways at the right, bubbles rise
// and now and then a fish in the kid colour swims across.
const MID = 160;
const UNITS_W = 320;
const UNITS_H = 240;
const UNITS: Units = { mid: MID, top: 0, w: UNITS_W, h: UNITS_H, fill: 0.92 };
const FLOOR = 142;

const WATER = '#9fd6ec';
const WATER_LIGHT = '#c4e7f4';
const SAND = '#f1dca6';
const SAND_DARK = '#d4b36e';
const ROCK = '#8f9aa5';
const ROCK_DARK = '#6b7682';
const CORAL = '#f2756a';
const CORAL_DARK = '#c94f45';
const WEED = '#4fae6a';
const WEED_DARK = '#2f7d47';
const SHELL = '#f8c9a4';
const SHELL_DARK = '#c9875f';
const CLAM = '#d9c2ec';
const CLAM_INSIDE = '#fbe6ef';
const CLAM_DARK = '#9a7db5';
const PEARL = '#ffffff';
const BUBBLE = '#eefaff';

const SHELL_W = 18; // a shell lying on the floor: 18 x 14 units
const SHELL_H = 14;
const CLAM_W = 32; // an open shell with a pearl: 32 x 24 units
const CLAM_H = 24;
const ON_ROW = 0.875; // scale of an open shell on a shell spot: 28 x 21, more than twice a shell's area

/** Open-shell spots at the back of the floor, between the coral and the seaweed: 36 apart, so no two touch. */
const CLAMS: Pt[] = [[162, 156], [126, 156], [198, 156], [90, 156], [234, 156]];

/** The x of the ten spots in a row, left to right, at a pitch of 30: room for an open shell at ON_ROW. */
const ROW_X = Array.from({ length: 10 }, (_, i) => 25 + 30 * i);
const FRONT = 229;
const MIDDLE = 206; // 23 apart between rows: room for an open shell at ON_ROW
const BACK = 183;

/** Shell spots: the front row centre outwards, then the middle and the back row left to right. */
const SHELLS: Pt[] = [
  ...[...ROW_X].sort((a, b) => Math.abs(a - MID) - Math.abs(b - MID) || a - b).map((x): Pt => [x, FRONT]),
  ...ROW_X.map((x): Pt => [x, MIDDLE]),
  ...ROW_X.map((x): Pt => [x, BACK]),
];

const CAPACITY = SHELLS.length;

/**
 * Shell spots the open shells take after their own five, in order: the back, the middle and the front row, each
 * right to left. With n open shells there are at most CAPACITY - n shells, and these spots are taken from the end of
 * the shell order, so a shell spot under an open shell is never in use by a shell at the same time.
 */
const ROWS_BIG: Pt[] = [BACK, MIDDLE, FRONT].flatMap((y) => [...ROW_X].reverse().map((x): Pt => [x, y]));

export interface Spot { kind: 'big' | 'small'; x: number; y: number; k: number } // sea units; k scales the drawing

/**
 * Where the items go: open shells first on their own spots at the back, then (a little smaller, still more than
 * twice a shell) on the shell rows from the back right; shells on the shell spots in order. No item ever moves when
 * one is added.
 */
export function spots(big: number, small: number): Spot[] {
  const b = Math.max(0, Math.min(big, CAPACITY));
  const own = CLAMS.slice(0, b).map(([x, y]): Spot => ({ kind: 'big', x, y, k: 1 }));
  const rows = ROWS_BIG.slice(0, b - own.length).map(([x, y]): Spot => ({ kind: 'big', x, y, k: ON_ROW }));
  const shells = SHELLS.slice(0, Math.max(0, Math.min(small, CAPACITY - b))).map(([x, y]): Spot => ({ kind: 'small', x, y, k: 1 }));
  return [...own, ...rows, ...shells];
}

/** The box a drawn item covers, in sea units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [w, h] = s.kind === 'big' ? [CLAM_W, CLAM_H] : [SHELL_W, SHELL_H];
  return [s.x - (w / 2) * s.k, s.y - (h / 2) * s.k, s.x + (w / 2) * s.k, s.y + (h / 2) * s.k];
}

/** A fan shell lying on the floor at (x, y) in units, hinge down, with three ridges. */
function shell(sk: Sketch, p: Placement, x: number, y: number): string {
  const [w, h, f] = [SHELL_W / 2, SHELL_H / 2, SHELL_W / 14]; // f: the shell's details were drawn for a 14-unit shell
  const body = sk.path(moved(p, `M ${x - 2.5 * f} ${y + h} L ${x - w} ${y - 0.5 * f} Q ${x - w + f} ${y - h} ${x} ${y - h} Q ${x + w - f} ${y - h} ${x + w} ${y - 0.5 * f} L ${x + 2.5 * f} ${y + h} Z`), { fill: SHELL, stroke: SHELL_DARK, strokeWidth: 1.4, roughness: 0.4 });
  const ridges = ([[-4, -3.5], [0, -4.5], [4, -3.5]] as Pt[]).map(([dx, dy]) => {
    const [x0, y0] = at(p, x, y + h - f);
    const [x1, y1] = at(p, x + dx * f, y + dy * f);
    return `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}" stroke="${SHELL_DARK}" stroke-width="${num(Math.max(0.7, f * 0.8 * p.s))}" stroke-linecap="round"/>`;
  }).join('');
  return body + ridges;
}

/** An open shell at (x, y) in units, scaled by `k`: the upper half stands open behind a white pearl in the lower half. */
function clam(sk: Sketch, p: Placement, x: number, y: number, k: number): string {
  const [w, h] = [(CLAM_W / 2) * k, (CLAM_H / 2) * k];
  const lid = sk.path(moved(p, `M ${x - w + 2 * k} ${y + 1 * k} Q ${x} ${y - 2 * h - 1 * k} ${x + w - 2 * k} ${y + 1 * k} Z`), { fill: CLAM_INSIDE, stroke: CLAM_DARK, strokeWidth: 1.6, roughness: 0.4 });
  const [px, py] = at(p, x, y - 2 * k);
  const pearl = `<circle cx="${num(px)}" cy="${num(py)}" r="${num(5.5 * k * p.s)}" fill="${PEARL}" stroke="${CLAM_DARK}" stroke-width="${num(Math.max(0.8, 1 * p.s))}"/>` +
    `<circle cx="${num(px - 1.8 * k * p.s)}" cy="${num(py - 1.8 * k * p.s)}" r="${num(1.6 * k * p.s)}" fill="#e6f4ff"/>`;
  const bowl = sk.path(moved(p, `M ${x - w} ${y + 2 * k} Q ${x} ${y + 2 * h - 2 * k} ${x + w} ${y + 2 * k} Z`), { fill: CLAM, stroke: CLAM_DARK, strokeWidth: 1.6, roughness: 0.4 });
  const ridges = [-7, 0, 7].map((dx) => {
    const [x0, y0] = at(p, x + dx * k * 0.9, y + 4 * k);
    const [x1, y1] = at(p, x + dx * k * 0.5, y + h - 1.5 * k);
    return `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}" stroke="${CLAM_DARK}" stroke-width="${num(Math.max(0.6, 0.9 * k * p.s))}" stroke-linecap="round"/>`;
  }).join('');
  return lid + pearl + bowl + ridges;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) =>
    s.kind === 'big' ? item('big', i, ctx, clam(sk, p, s.x, s.y, s.k)) : item('small', i, ctx, shell(sk, p, s.x, s.y)),
  ).join('');
}

/** Light falling in from the surface: a few pale bands across the water. */
function light(p: Placement): string {
  return ([[70, 20, 110, 130], [180, 10, 210, 120], [262, 24, 292, 112]] as [number, number, number, number][]).map(([x0, y0, x1, y1]) => {
    const pts = [at(p, x0, y0), at(p, x0 + 14, y0), at(p, x1 + 14, y1), at(p, x1, y1)];
    return `<polygon points="${points(pts)}" fill="${WATER_LIGHT}" opacity="0.6"/>`;
  }).join('');
}

/** The sandy sea floor from a gently waved edge down to the bottom of the scene, across the whole half. */
function floor(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  const [, edge] = at(p, 0, FLOOR);
  const [, bottom] = at(p, 0, UNITS_H);
  const n = Math.max(2, Math.round(box.w / 70));
  const step = box.w / n;
  let d = `M ${num(box.x)} ${num(edge)}`;
  for (let i = 0; i < n; i++) d += ` Q ${num(box.x + (i + 0.5) * step)} ${num(edge + (i % 2 ? 4 : -4) * p.s)} ${num(box.x + (i + 1) * step)} ${num(edge)}`;
  const fill = `<path d="${d} L ${num(box.x + box.w)} ${num(bottom)} L ${num(box.x)} ${num(bottom)} Z" fill="${SAND}"/>`;
  const line = sk.line(box.x + 3, edge, box.x + box.w - 3, edge, { stroke: SAND_DARK, strokeWidth: 1.8, roughness: 0.8 });
  return `<g data-part="floor">${fill}${line}</g>`;
}

/** A branching coral on a rock at the left of the floor. */
function coral(sk: Sketch, p: Placement): string {
  const rock = sk.path(moved(p, 'M 6 156 Q 4 132 24 128 Q 44 120 62 134 Q 72 146 66 156 Z'), { fill: ROCK, stroke: ROCK_DARK, strokeWidth: 1.8, roughness: 0.6 });
  const branches = [
    'M 34 130 Q 30 104 18 88', 'M 34 130 Q 36 100 34 70', 'M 34 130 Q 42 108 54 92',
    'M 32 112 Q 24 106 22 98', 'M 35 98 Q 44 92 46 84', 'M 40 116 Q 50 116 56 108',
  ].map((d) => sk.path(moved(p, d), { stroke: CORAL, strokeWidth: 6 * p.s, roughness: 0.5 })).join('');
  const tips = ([[18, 88], [34, 70], [54, 92], [22, 98], [46, 84], [56, 108]] as Pt[]).map(([x, y]) => {
    const [cx, cy] = at(p, x, y);
    return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(3.4 * p.s)}" fill="${CORAL}" stroke="${CORAL_DARK}" stroke-width="${num(Math.max(0.8, 1 * p.s))}"/>`;
  }).join('');
  return `<g data-part="coral">${branches}${tips}${rock}</g>`;
}

/** Three strands of seaweed at the right of the floor, each swaying from its root. */
function weed(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const strands = ([[272, 66], [290, 52], [308, 78]] as Pt[]).map(([x, top], i) => {
    const h = FLOOR + 8 - top;
    const d = `M ${x - 3} ${FLOOR + 8} Q ${x - 10} ${top + h * 0.7} ${x} ${top + h * 0.45} Q ${x + 9} ${top + h * 0.22} ${x} ${top} ` +
      `Q ${x + 14} ${top + h * 0.22} ${x + 6} ${top + h * 0.45} Q ${x - 2} ${top + h * 0.7} ${x + 4} ${FLOOR + 8} Z`;
    const leaf = sk.path(moved(p, d), { fill: i === 1 ? WEED_DARK : WEED, stroke: WEED_DARK, strokeWidth: 1.6, roughness: 0.5 });
    return `<g class="fb-anim fb-underwater-sway" style="${timing(`${ctx.seedKey}:sway:${i}`, [3.5, 5])}">${leaf}</g>`;
  }).join('');
  return `<g data-part="weed">${strands}</g>`;
}

const BUBBLES = 8;

/** Bubbles at seeded spots over the floor; each rises 60 units and fades. At rest they hang where they start. */
function bubbles(p: Placement, ctx: HalfContext): string {
  let out = '';
  for (let i = 0; i < BUBBLES; i++) {
    const k = `${ctx.seedKey}:bubble:${i}`;
    const [cx, cy] = at(p, 76 + rand(`${k}:x`) * 186, 96 + rand(`${k}:y`) * 40);
    const r = (3 + rand(`${k}:r`) * 2.5) * p.s;
    out += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${BUBBLE}" fill-opacity="0.5" stroke="#ffffff" stroke-width="${num(Math.max(0.7, 0.9 * p.s))}" ` +
      `class="fb-anim fb-underwater-bubble" style="${timing(k, [3, 6])};--rise:${num(-60 * p.s)}px"/>`;
  }
  return `<g data-part="bubbles">${out}</g>`;
}

const FISH_X0 = 176; // left end of the fish at rest (tail), in units
const FISH_X1 = 226; // right end (nose)
const FISH_Y = 80;
const FISH_MARGIN = 4; // px the fish stays beyond the half's edge while out of view

/** A fish in the kid colour, nose to the right; it crosses the half once per cycle, clipped to the half. Not a counted item. */
function fish(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const box: Box = ctx.box;
  const left = at(p, FISH_X0, 0)[0];
  const right = at(p, FISH_X1, 0)[0];
  const inPx = -(right - box.x + FISH_MARGIN); // the nose ends left of the half
  const outPx = box.x + box.w - left + FISH_MARGIN; // the tail ends right of the half
  const style = `${timing(`${ctx.seedKey}:swim`, [14, 20])};--in:${num(inPx)}px;--out:${num(outPx)}px`;
  const colour = ctx.kid.colour;
  const tail = sk.polygon([at(p, FISH_X0, FISH_Y - 10), at(p, FISH_X0 + 12, FISH_Y), at(p, FISH_X0, FISH_Y + 10)], { fill: colour, strokeWidth: 1.8, roughness: 0.4 });
  const body = sk.ellipse(...at(p, 205, FISH_Y), 42 * p.s, 24 * p.s, { fill: colour, strokeWidth: 2, roughness: 0.5 });
  const fin = sk.path(moved(p, `M 198 ${FISH_Y - 11} Q 204 ${FISH_Y - 20} 212 ${FISH_Y - 11}`), { fill: colour, strokeWidth: 1.6, roughness: 0.4 });
  const gill = sk.path(moved(p, `M 214 ${FISH_Y - 6} Q 210 ${FISH_Y} 214 ${FISH_Y + 6}`), { strokeWidth: 1.4, roughness: 0.3 });
  const [ex, ey] = at(p, 219, FISH_Y - 3);
  const eye = `<circle cx="${num(ex)}" cy="${num(ey)}" r="${num(3 * p.s)}" fill="#fff" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="${num(ex + 0.6 * p.s)}" cy="${num(ey)}" r="${num(1.4 * p.s)}" fill="${INK}"/>`;
  const clipId = `fb-underwater-clip-${ctx.seedKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const clip = `<clipPath id="${clipId}"><rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}"/></clipPath>`;
  return `<g data-part="fish">${clip}<g clip-path="url(#${clipId})"><g class="fb-anim fb-underwater-swim" style="${style}">${tail}${fin}${body}${gill}${eye}</g></g></g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box, UNITS);
  // Items have their own sketch, and so does the fish drawn after them, so adding an item never re-wobbles the scenery.
  return `<g>${light(p)}${floor(sk, p, ctx)}${coral(sk, p)}${weed(sk, p, ctx)}` +
    `${items(createSketch(`${ctx.seedKey}:items`), p, ctx)}${bubbles(p, ctx)}${fish(createSketch(`${ctx.seedKey}:late`), p, ctx)}</g>`;
}

const css = `
  @keyframes fb-underwater-bubble {
    0% { transform: translateY(0); opacity: 0; }
    15%, 80% { opacity: 0.9; }
    100% { transform: translateY(var(--rise)); opacity: 0; }
  }
  @keyframes fb-underwater-swim {
    0% { transform: translateX(var(--in)); }
    45%, 100% { transform: translateX(var(--out)); }
  }
  @keyframes fb-underwater-sway {
    0%, 100% { transform: rotate(-5deg); }
    50% { transform: rotate(5deg); }
  }
  .fb-underwater-bubble { animation-name: fb-underwater-bubble; animation-timing-function: ease-in; }
  .fb-underwater-swim { animation-name: fb-underwater-swim; animation-timing-function: linear; }
  .fb-underwater-sway { animation-name: fb-underwater-sway; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
`;

export const underwater: Theme = {
  id: 'underwater',
  label: 'Unterwasser',
  capacity: CAPACITY,
  background: WATER,
  renderHalf,
  css,
};
