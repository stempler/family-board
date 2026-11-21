import { particles, scaledCount, twinkle } from '../draw/anim';
import type { Box } from '../draw/jar';
import { seasonKid, seasonPlacement } from '../draw/season';
import { createSketch, esc, num, type Sketch } from '../draw/sketch';
import { at, moved, placement, SCENE_BOTTOM, starPoints, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// The tree is drawn in "tree units" taken from mockups/metaphor.html (A):
// the crown spans x 15..185 around the centre x 100, the star tip sits at y 12,
// the trunk ends at y 227. Everything is scaled from there.
const MID = 100;
const TOP = 12;
const BASE = 227;
const HALF_W = 85;
const UNITS_H = 240; // star tip .. snow / ribbon below the trunk
/** The tree takes at most 45% of the width it stands in, so the presents and ribbon fit beside it. */
const UNITS: Units = { mid: MID, top: TOP, w: HALF_W, h: UNITS_H, fill: 0.45 };

const NEEDLES = '#5aa469';
const TRUNK = '#8b5a2b';
const GOLD = '#f7d046';
const STAR_RED = '#d63c2f';
const SNOW = '#ffffff';
const SKY = '#d3e5f4';
const BAUBLES = ['#e74c3c', '#3b86d6', '#9b59b6', '#ef7fb0', '#ff9a3c'];

const SMALL_R = 7.5;
const BIG_R = 10;

const CROWN: [number, number][] = [
  [100, 30], [160, 110], [135, 110], [175, 170], [140, 170], [185, 205],
  [15, 205], [60, 170], [25, 170], [65, 110], [40, 110],
];
const GARLANDS = ['M 72 80 Q 102 98 128 76', 'M 64 130 Q 100 152 142 124', 'M 50 182 Q 100 202 152 176'];

/** Half-width of the crown outline at height y. */
function crownHalfWidth(y: number): number {
  if (y <= 110) return (60 * (y - 30)) / 80;
  if (y <= 170) return 35 + (40 * (y - 110)) / 60;
  return 40 + (45 * (y - 170)) / 35;
}

/** Staggered rows of ornament slots inside the crown (31 of them, capacity is 30). */
function crownSlots(): [number, number][] {
  const slots: [number, number][] = [];
  const spacing = 20;
  for (let row = 0, y = 55; y <= 190; row++, y += 16.5) {
    const usable = Math.min(crownHalfWidth(y - 4), crownHalfWidth(y + 4)) - 8;
    const offset = row % 2 ? spacing / 2 : 0;
    const first = Math.ceil((-usable - offset) / spacing);
    for (let k = first; offset + k * spacing <= usable; k++) slots.push([MID + offset + k * spacing, y]);
  }
  return slots;
}

/** Fill order that spreads ornaments over the whole tree at every count: each next slot is the one least crowded by those already placed. */
function spreadOrder(slots: [number, number][]): [number, number][] {
  const d2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const rest = [...slots];
  const centre = rest.reduce((best, s) => (d2(s, [MID, 140]) < d2(best, [MID, 140]) ? s : best));
  const order = rest.splice(rest.indexOf(centre), 1);
  while (rest.length) {
    let pick = 0;
    let least = Infinity;
    rest.forEach((s, i) => {
      const crowding = order.reduce((acc, o) => acc + 1 / d2(s, o), 0);
      if (crowding < least - 1e-12) { pick = i; least = crowding; }
    });
    order.push(rest.splice(pick, 1)[0]);
  }
  return order;
}

const SLOTS = spreadOrder(crownSlots());

function bauble(sk: Sketch, x: number, y: number, r: number, fill: string, big: boolean): string {
  const cap = sk.rect(x - r * 0.3, y - r - r * 0.35, r * 0.6, r * 0.45, { fill: '#b8b8b8', strokeWidth: 1.2, roughness: 0.5 });
  const body = sk.circle(x, y, r * 2, { fill, strokeWidth: big ? 2 : 1.6, roughness: 0.7 });
  const shine = `<ellipse cx="${num(x - r * 0.4)}" cy="${num(y - r * 0.35)}" rx="${num(r * 0.18)}" ry="${num(r * 0.3)}" fill="#fff" opacity="0.75"/>`;
  const star = big ? sk.polygon(starPoints(x, y + r * 0.05, r * 0.6), { fill: STAR_RED, strokeWidth: 1.2, roughness: 0.4 }) : '';
  return cap + body + star + shine;
}

function ornaments(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { big, small } = ctx.groups;
  let out = '';
  for (let i = 0; i < big + small && i < SLOTS.length; i++) {
    const isBig = i < big;
    const [x, y] = at(p, ...SLOTS[i]);
    const r = (isBig ? BIG_R : SMALL_R) * p.s;
    out += item(isBig ? 'big' : 'small', i, ctx, bauble(sk, x, y, r, isBig ? GOLD : BAUBLES[i % BAUBLES.length], isBig));
  }
  return out;
}

/** `late` draws what comes after the ornaments, so its wobble does not change with the ornament count. */
function tree(sk: Sketch, late: Sketch, p: Placement, ctx: HalfContext): string {
  const [tx, ty] = at(p, 88, 203);
  const trunk = sk.rect(tx, ty, 24 * p.s, (BASE - 203) * p.s, { fill: TRUNK, strokeWidth: 2.5 });
  const crown = sk.polygon(CROWN.map(([x, y]) => at(p, x, y)), { fill: NEEDLES, strokeWidth: 3, roughness: 1.1 });
  const garlands = GARLANDS.map((d) => sk.path(moved(p, d), { stroke: GOLD, strokeWidth: 2.5 * p.s, roughness: 0.8 })).join('');
  const [sx, sy] = at(p, MID, 31);
  const topStar = `<g ${twinkle(ctx.seedKey)}>${late.polygon(starPoints(sx, sy, 19 * p.s), { fill: GOLD, strokeWidth: 2, roughness: 0.6 })}</g>`;
  return trunk + crown + garlands + ornaments(sk, p, ctx) + topStar;
}

function presents(sk: Sketch, p: Placement, colour: string): string {
  const box = (x: number, y: number, w: number, h: number, fill: string, ribbon: string) => {
    const [x0, y0] = at(p, x, y);
    const [w0, h0] = [w * p.s, h * p.s];
    return sk.rect(x0, y0, w0, h0, { fill, strokeWidth: 2 }) +
      sk.line(x0 + w0 / 2, y0, x0 + w0 / 2, y0 + h0, { stroke: ribbon, strokeWidth: 3 * p.s, roughness: 0.5 }) +
      sk.ellipse(x0 + w0 / 2 - 4 * p.s, y0 - 2 * p.s, 8 * p.s, 5 * p.s, { stroke: ribbon, strokeWidth: 2, roughness: 0.5 }) +
      sk.ellipse(x0 + w0 / 2 + 4 * p.s, y0 - 2 * p.s, 8 * p.s, 5 * p.s, { stroke: ribbon, strokeWidth: 2, roughness: 0.5 });
  };
  return box(50, 209, 30, 20, colour, GOLD) + box(122, 213, 26, 16, '#f3ead2', STAR_RED);
}

function renderHalf(ctx: HalfContext): string {
  const { box } = ctx;
  const sk = createSketch(ctx.seedKey);
  const p = placement(box, UNITS);
  const [gx, gy] = at(p, MID, BASE + 2);
  const ground = sk.ellipse(gx, gy, 220 * p.s, 22 * p.s, { fill: SNOW, strokeWidth: 2, roughness: 1 });
  const late = createSketch(`${ctx.seedKey}:late`);
  // Snow is plain circles appended last, so it falls in front of the scene and touches no rough.js call index.
  return `<g>${ground}${tree(sk, late, p, ctx)}${presents(late, p, ctx.kid.colour)}${particles(`${ctx.seedKey}:snow`, box, scaledCount(13, box), 'snow')}</g>`;
}

/** The ribbon's wave below the tree: from `start` over `control` to the bow at `mid`, then on (control mirrored) to `end`. */
function ribbonPoints(p: Placement): { start: Pt; control: Pt; mid: Pt; end: Pt } {
  const start = at(p, 18, BASE + 7);
  const mid = at(p, MID, BASE + 4);
  return { start, control: [(start[0] + mid[0]) / 2, mid[1] - 8 * p.s], mid, end: at(p, 182, BASE + 7) };
}

function ribbon(sk: Sketch, p: Placement, colour: string): string {
  const { start: [x1, y1], control: [cx, cy], mid: [xm, ym], end: [x2, y2] } = ribbonPoints(p);
  const wave = sk.path(`M ${num(x1)} ${num(y1)} Q ${num(cx)} ${num(cy)} ${num(xm)} ${num(ym)} T ${num(x2)} ${num(y2)}`, { stroke: colour, strokeWidth: 6 * p.s, roughness: 0.6 });
  const w = 11 * p.s;
  const bow = sk.polygon([[xm, ym], [xm - w, ym - w * 0.6], [xm - w, ym + w * 0.6]], { fill: colour, strokeWidth: 1.6, roughness: 0.5 }) +
    sk.polygon([[xm, ym], [xm + w, ym - w * 0.6], [xm + w, ym + w * 0.6]], { fill: colour, strokeWidth: 1.6, roughness: 0.5 }) +
    sk.circle(xm, ym, w * 0.6, { fill: colour, strokeWidth: 1.6, roughness: 0.4 });
  return wave + bow;
}

function snowman(sk: Sketch, cx: number, bottom: number, size: number): string {
  const r1 = size * 0.32;
  const r2 = size * 0.22;
  const y1 = bottom - r1;
  const y2 = y1 - r1 - r2 * 0.8;
  const eye = (dx: number) => `<circle cx="${num(cx + dx)}" cy="${num(y2 - r2 * 0.2)}" r="${num(r2 * 0.1)}" fill="#3a2f28"/>`;
  return sk.circle(cx, y1, r1 * 2, { fill: SNOW, strokeWidth: 2.2 }) +
    sk.circle(cx, y2, r2 * 2, { fill: SNOW, strokeWidth: 2.2 }) +
    sk.polygon([[cx, y2], [cx + r2 * 0.9, y2 + r2 * 0.15], [cx, y2 + r2 * 0.3]], { fill: '#f39c12', strokeWidth: 1.2, roughness: 0.4 }) +
    sk.rect(cx - r2 * 0.75, y2 - r2 * 1.55, r2 * 1.5, r2 * 0.75, { fill: '#3a2f28', strokeWidth: 1.5, roughness: 0.5 }) +
    sk.line(cx - r2 * 1.05, y2 - r2 * 0.8, cx + r2 * 1.05, y2 - r2 * 0.8, { strokeWidth: 3, roughness: 0.4 }) +
    eye(-r2 * 0.35) + eye(r2 * 0.25);
}

const HILL_Y = 0.69; // share of the board height where the hill's top line meets the board edges and the centre
const HILL_RISE = 0.045; // how far the left bump rises above HILL_Y (the right dips by as much), as a share of the height
const HILL_EDGE = 12; // the hill's sides run this far past the board edge, so only its top outline shows

/** The hill's top line: a quadratic curve from p0 over c1 to p1, then on (control c2, c1 mirrored about p1) to p2. */
function hillCurve(box: Box): { p0: Pt; c1: Pt; p1: Pt; c2: Pt; p2: Pt } {
  const y = box.y + box.h * HILL_Y;
  const rise = box.h * HILL_RISE;
  return {
    p0: [box.x - HILL_EDGE, y],
    c1: [box.x + box.w * 0.25, y - rise],
    p1: [box.x + box.w / 2, y],
    c2: [box.x + box.w * 0.75, y + rise],
    p2: [box.x + box.w + HILL_EDGE, y - box.h * 0.01],
  };
}

/** y of the hill's top line at board x `x` in the season scene spanning `box`. */
export function hillTopAt(box: Box, x: number): number {
  const { p0, c1, p1, c2, p2 } = hillCurve(box);
  const [a, c, b] = x <= p1[0] ? [p0, c1, p1] : [p1, c2, p2];
  const bez = (t: number, i: 0 | 1) => (1 - t) ** 2 * a[i] + 2 * (1 - t) * t * c[i] + t ** 2 * b[i];
  // x(t) rises monotonically on both segments, so bisection finds the t for x.
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (bez(mid, 0) < x) lo = mid; else hi = mid;
  }
  return bez((lo + hi) / 2, 1);
}

/** Where a kid's tree in the season scene meets the ground: its centre, trunk base and the highest points of its ribbon. */
export function treeFoot(box: Box, half: Box): { cx: number; base: number; ribbon: Pt[] } {
  const { cx, p } = seasonPlacement(box, half, UNITS);
  const { start, control, mid, end } = ribbonPoints(p);
  // The highest point of the first wave (t = 0.5); the mirrored second wave dips below the bow.
  const peak: Pt = [0.25 * start[0] + 0.5 * control[0] + 0.25 * mid[0], 0.25 * start[1] + 0.5 * control[1] + 0.25 * mid[1]];
  return { cx, base: at(p, MID, BASE)[1], ribbon: [start, peak, mid, end] };
}

function renderSeasonScene(halves: HalfContext[], box: Box): string {
  const key = `season:${halves.map((h) => h.seedKey).join('|')}`;
  const sk = createSketch(key);
  const { p0, c1, p1, p2 } = hillCurve(box);
  const bottom = box.y + box.h + HILL_EDGE;
  const sky = `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}" fill="${SKY}"/>`;
  // The hill's sides and bottom run past the board edge, so only its top outline shows.
  const hill = sk.path(
    `M ${num(p0[0])} ${num(p0[1])} Q ${num(c1[0])} ${num(c1[1])} ${num(p1[0])} ${num(p1[1])} T ${num(p2[0])} ${num(p2[1])} L ${num(p2[0])} ${num(bottom)} L ${num(p0[0])} ${num(bottom)} Z`,
    { fill: SNOW, strokeWidth: 2, roughness: 1 },
  );
  const trees = halves.map((ctx) => {
    const { cx, p } = seasonPlacement(box, ctx.box, UNITS);
    const late = createSketch(`${ctx.seedKey}:late`);
    return seasonKid(ctx.kid.id, cx, tree(createSketch(ctx.seedKey), late, p, ctx) + ribbon(late, p, ctx.kid.colour), `data-tree="${esc(ctx.kid.id)}"`);
  }).join('');
  const man = snowman(sk, box.x + box.w / 2, box.y + box.h * SCENE_BOTTOM, Math.min(80, box.h * 0.2));
  return `<g>${sky}${hill}${trees}${man}${particles(`${key}:snow`, box, scaledCount(14, box), 'snow')}</g>`;
}

export const christmas: Theme = {
  id: 'christmas',
  label: 'Weihnachten',
  capacity: 30,
  background: SKY,
  renderHalf,
  renderSeasonScene,
};
