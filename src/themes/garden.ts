import { rand, timing } from '../draw/anim';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { at, moved, placement, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A garden, drawn in "garden units": a wooden picket fence on a lawn under a sunny sky, a flower bed
// in front of it from y 174 down. Small flowers in many colours grow in the bed in three staggered rows
// of ten; tall sunflowers stand in a row at the fence behind the bed (more of them than fit there grow in
// the bed, on a short stem). A watering can in the kid colour stands at the right end of the fence, a few
// tufts of grass sway at its foot and bees fly little loops above the flowers.
const MID = 160;
const UNITS_W = 320;
const UNITS_H = 260;
const UNITS: Units = { mid: MID, top: 0, w: UNITS_W, h: UNITS_H, fill: 0.92 };
const LAWN_TOP = 150;
const BED_TOP = 174;
const FENCE_TOP = 84;
const FENCE_BASE = 156;

const SKY = '#cfe9f7';
const SUN = '#ffd54a';
const SUN_DARK = '#e0a800';
const GRASS = '#8cc76a';
const GRASS_DARK = '#4f8f3a';
const SOIL = '#8a5a3b';
const SOIL_DARK = '#5e3a24';
const WOOD = '#e8cfa4';
const WOOD_DARK = '#a8834f';
const STEM = '#4c9a3c';
const STEM_DARK = '#2f6b25';
const PETAL = '#ffc81e';
const PETAL_DARK = '#d99400';
const SEEDS = '#6b3f1f';
const HEART = '#ffe066';
const BEE = '#ffd23f';
const WING = '#ffffff';
const PETALS = ['#f48fb1', '#b07cd8', '#ff8a5c', '#e84d5b', '#6f9be8', '#fdf3f8'];

const FLOWER_W = 18; // a small flower on its stem: 18 x 22 units
const FLOWER_H = 22;
const TALL_W = 28; // a sunflower at the fence: 28 wide, from its head (y 44) down to the lawn (y 168)
const TALL_TOP = 44;
const TALL_BASE = 168;
const HEAD_Y = 58;
const BED_SUN_W = 26; // a sunflower in the bed, on a short stem: 26 x 25 units
const BED_SUN_H = 25;

/** Sunflower spots at the fence, behind the bed: one row of ten, 30 apart, left to right. */
const TALL: number[] = Array.from({ length: 10 }, (_, i) => 25 + 30 * i);

/** Flower spots in the bed: three rows of ten, 30 apart, the front row first; the middle row is staggered by half a step. */
const BED: Pt[] = ([[242, 18], [215, 33], [188, 18]] as Pt[]).flatMap(([y, x0]) => Array.from({ length: 10 }, (_, i): Pt => [x0 + 30 * i, y]));

const CAPACITY = BED.length;

export interface Spot { kind: 'big' | 'small'; x: number; y: number; tall: boolean; slot: number } // garden units, centre of the footprint; slot is the bed spot, -1 at the fence

/** Where the items go: sunflowers at the fence first, then in the bed; flowers fill the remaining bed spots in order. */
export function spots(big: number, small: number): Spot[] {
  const out: Spot[] = [];
  let slot = 0;
  for (let i = 0; i < big && slot < BED.length; i++) {
    if (i < TALL.length) out.push({ kind: 'big', x: TALL[i], y: (TALL_TOP + TALL_BASE) / 2, tall: true, slot: -1 });
    else out.push({ kind: 'big', x: BED[slot][0], y: BED[slot][1], tall: false, slot: slot++ });
  }
  for (let i = 0; i < small && slot < BED.length; i++, slot++) out.push({ kind: 'small', x: BED[slot][0], y: BED[slot][1], tall: false, slot });
  return out;
}

/** The box a drawn item covers, in garden units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [w, h] = s.kind === 'small' ? [FLOWER_W, FLOWER_H] : s.tall ? [TALL_W, TALL_BASE - TALL_TOP] : [BED_SUN_W, BED_SUN_H];
  return [s.x - w / 2, s.y - h / 2, s.x + w / 2, s.y + h / 2];
}

/** A line from a to b in units, `w` px wide at scale 1. */
function stroke(p: Placement, a: Pt, b: Pt, colour: string, w: number): string {
  const [x0, y0] = at(p, ...a);
  const [x1, y1] = at(p, ...b);
  return `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}" stroke="${colour}" stroke-width="${num(Math.max(0.6, w * p.s))}" stroke-linecap="round"/>`;
}

/** A plain circle at (x, y) in units with radius r units. */
function dot(p: Placement, x: number, y: number, r: number, fill: string, edge?: string): string {
  const [cx, cy] = at(p, x, y);
  const line = edge ? ` stroke="${edge}" stroke-width="${num(Math.max(0.6, 1 * p.s))}"` : '';
  return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r * p.s)}" fill="${fill}"${line}/>`;
}

/** A leaf from the stem at (x, y) in units, pointing left (dir -1) or right (dir 1), `len` units long. */
function leaf(sk: Sketch, p: Placement, x: number, y: number, dir: number, len: number): string {
  const [tx, ty] = [x + dir * len, y - len * 0.5];
  return sk.path(moved(p, `M ${x} ${y} Q ${x + dir * len * 0.4} ${y - len * 0.75} ${tx} ${ty} Q ${x + dir * len * 0.6} ${y + len * 0.1} ${x} ${y} Z`), { fill: STEM, stroke: STEM_DARK, strokeWidth: 1.2, roughness: 0.4 });
}

/** A sunflower head centred on (x, y) in units: a ring of 12 pointed petals around a brown seed disc, `r` units to the petal tips. */
function head(sk: Sketch, p: Placement, x: number, y: number, r: number): string {
  const ring: Pt[] = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    const rr = i % 2 ? r * 0.62 : r;
    return at(p, x + rr * Math.cos(a), y + rr * Math.sin(a));
  });
  const petals = sk.polygon(ring, { fill: PETAL, stroke: PETAL_DARK, strokeWidth: 1.4, roughness: 0.4 });
  const disc = sk.circle(...at(p, x, y), r * 0.92 * p.s, { fill: SEEDS, stroke: '#3f240f', strokeWidth: 1.3, roughness: 0.4 });
  return petals + disc + dot(p, x - r * 0.15, y - r * 0.15, r * 0.12, '#9a6232');
}

/** A tall sunflower at the fence at x in units: a stem from the lawn up past the fence, two leaves and a big head. */
function tallSunflower(sk: Sketch, p: Placement, x: number): string {
  const stem = stroke(p, [x, TALL_BASE], [x, HEAD_Y + 6], STEM_DARK, 3.4);
  return stem + leaf(sk, p, x, 134, -1, 12) + leaf(sk, p, x, 112, 1, 12) + head(sk, p, x, HEAD_Y, 14);
}

/** A sunflower in the bed, its footprint centred on (x, y) in units: a big head on a short stem. */
function bedSunflower(sk: Sketch, p: Placement, x: number, y: number): string {
  const b = y + BED_SUN_H / 2;
  const stem = stroke(p, [x, b], [x, y], STEM_DARK, 2.6);
  return stem + leaf(sk, p, x, b - 2, 1, 8) + head(sk, p, x, y - 1.5, 11);
}

/** A small flower, its footprint centred on (x, y) in units: five round petals in `colour` around a yellow heart, on a short stem with a leaf. */
function flower(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const b = y + FLOWER_H / 2;
  const [hx, hy] = [x, y - 3.8];
  const stem = stroke(p, [x, b], [hx, hy], STEM_DARK, 1.8);
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return dot(p, hx + 3.9 * Math.cos(a), hy + 3.9 * Math.sin(a), 3.6, colour, INK);
  }).join('');
  const heart = sk.circle(...at(p, hx, hy), 5 * p.s, { fill: HEART, stroke: PETAL_DARK, strokeWidth: 1, roughness: 0.3 });
  return stem + leaf(sk, p, x, b - 3, 1, 6) + petals + heart;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) => {
    if (s.kind === 'big') return item('big', i, ctx, s.tall ? tallSunflower(sk, p, s.x) : bedSunflower(sk, p, s.x, s.y));
    const [col, row] = [s.slot % 10, Math.floor(s.slot / 10)];
    return item('small', i, ctx, flower(sk, p, s.x, s.y, PETALS[(col + 2 * row) % PETALS.length]));
  }).join('');
}

/** The sun in the top right corner with short rays, above the sunflower heads. */
function sun(sk: Sketch, p: Placement): string {
  const [x, y] = [292, 21];
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    return stroke(p, [x + 14 * Math.cos(a), y + 14 * Math.sin(a)], [x + 19 * Math.cos(a), y + 19 * Math.sin(a)], SUN_DARK, 2.2);
  }).join('');
  return `<g data-part="sun">${rays}${sk.circle(...at(p, x, y), 22 * p.s, { fill: SUN, stroke: SUN_DARK, strokeWidth: 1.8, roughness: 0.5 })}</g>`;
}

/** The lawn from the fence down across the whole half. */
function lawn(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  const [, edge] = at(p, 0, LAWN_TOP);
  const [, bottom] = at(p, 0, UNITS_H);
  const fill = `<rect x="${num(box.x)}" y="${num(edge)}" width="${num(box.w)}" height="${num(bottom - edge)}" fill="${GRASS}"/>`;
  const line = sk.line(box.x + 3, edge, box.x + box.w - 3, edge, { stroke: GRASS_DARK, strokeWidth: 1.6, roughness: 0.8 });
  return `<g data-part="lawn">${fill}${line}</g>`;
}

/** A picket fence across the half: two rails and pointed pickets every 16 units, as many as fit in the half. */
function fence(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  const lo = MID + (box.x - p.cx) / p.s;
  const hi = MID + (box.x + box.w - p.cx) / p.s;
  const rails = [100, 138].map((y) => {
    const [, ry] = at(p, 0, y);
    return sk.rect(box.x + 1, ry, box.w - 2, 6 * p.s, { fill: WOOD, stroke: WOOD_DARK, strokeWidth: 1.4, roughness: 0.5 });
  }).join('');
  let pickets = '';
  for (let x = MID - 16 * Math.floor((MID - lo) / 16); x + 6 <= hi - 1; x += 16) {
    if (x - 6 < lo + 1) continue;
    pickets += sk.polygon([[-6, FENCE_BASE], [-6, FENCE_TOP + 7], [0, FENCE_TOP], [6, FENCE_TOP + 7], [6, FENCE_BASE]].map(([dx, y]) => at(p, x + dx, y)), { fill: WOOD, stroke: WOOD_DARK, strokeWidth: 1.4, roughness: 0.4 });
  }
  return `<g data-part="fence">${rails}${pickets}</g>`;
}

/** The flower bed: dark soil from the lawn to the bottom of the scene, with a raised edge along its back. */
function bed(sk: Sketch, p: Placement): string {
  const soil = sk.path(moved(p, `M 2 ${BED_TOP + 4} Q 2 ${BED_TOP} 8 ${BED_TOP} L 312 ${BED_TOP} Q 318 ${BED_TOP} 318 ${BED_TOP + 4} L 318 ${UNITS_H} L 2 ${UNITS_H} Z`), { fill: SOIL, stroke: SOIL_DARK, strokeWidth: 1.8, roughness: 0.6 });
  const clods = ([[30, 256], [96, 230], [150, 256], [208, 202], [262, 230], [300, 256], [70, 202]] as Pt[]).map(([x, y]) => {
    const [cx, cy] = at(p, x, y);
    return `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(3.5 * p.s)}" ry="${num(1.5 * p.s)}" fill="${SOIL_DARK}" opacity="0.6"/>`;
  }).join('');
  return `<g data-part="bed">${soil}${clods}</g>`;
}

/** A watering can in the kid colour at the right end of the fence, its spout to the right; it stands in front of the last sunflower's stem. */
function can(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const colour = ctx.kid.colour;
  const handle = sk.path(moved(p, 'M 289 148 Q 296 126 307 148'), { stroke: INK, strokeWidth: 2.6 * p.s, roughness: 0.4 });
  const spout = sk.polygon([at(p, 306, 160), at(p, 318, 140), at(p, 320, 142), at(p, 308, 165)], { fill: colour, strokeWidth: 1.4, roughness: 0.3 });
  const rose = sk.ellipse(...at(p, 319, 140), 6 * p.s, 4 * p.s, { fill: colour, strokeWidth: 1.4, roughness: 0.3 });
  const body = sk.polygon([at(p, 285, 168), at(p, 287, 146), at(p, 309, 146), at(p, 311, 168)], { fill: colour, strokeWidth: 1.8, roughness: 0.4 });
  const band = stroke(p, [287, 152], [309, 152], '#ffffff', 1.4);
  return `<g data-part="can">${handle}${spout}${rose}${body}${band}</g>`;
}

/** Tufts of grass at the foot of the fence, between the sunflower stems so none hides behind one, each swaying from its root. */
function tufts(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return [40, 130, 220].map((x, i) => {
    const d = `M ${x - 6} 172 Q ${x - 8} 162 ${x - 10} 156 Q ${x - 3} 162 ${x - 1} 168 Q ${x} 158 ${x + 1} 152 Q ${x + 3} 160 ${x + 2} 168 Q ${x + 6} 160 ${x + 10} 157 Q ${x + 8} 164 ${x + 6} 172 Z`;
    const blades = sk.path(moved(p, d), { fill: GRASS_DARK, stroke: STEM_DARK, strokeWidth: 1.2, roughness: 0.4 });
    return `<g class="fb-anim fb-garden-sway" style="${timing(`${ctx.seedKey}:sway:${i}`, [3, 4.5])}">${blades}</g>`;
  }).join('');
}

const BEES = 3;

/** Bees at seeded spots above the flowers, one in each third of the bed; each flies a small loop around its spot. */
function bees(p: Placement, ctx: HalfContext): string {
  let out = '';
  for (let i = 0; i < BEES; i++) {
    const k = `${ctx.seedKey}:bee:${i}`;
    const [x, y] = [40 + 90 * i + rand(`${k}:x`) * 60, 112 + rand(`${k}:y`) * 34];
    const [bx, by] = at(p, x, y);
    const wings = [-2, 2.5].map((dx) => `<ellipse cx="${num(bx + dx * p.s)}" cy="${num(by - 4 * p.s)}" rx="${num(2.6 * p.s)}" ry="${num(3.6 * p.s)}" fill="${WING}" fill-opacity="0.85" stroke="${INK}" stroke-width="${num(Math.max(0.5, 0.8 * p.s))}"/>`).join('');
    const body = `<ellipse cx="${num(bx)}" cy="${num(by)}" rx="${num(5.5 * p.s)}" ry="${num(3.8 * p.s)}" fill="${BEE}" stroke="${INK}" stroke-width="${num(Math.max(0.6, 1 * p.s))}"/>`;
    const stripes = [-1.2, 1.6].map((dx) => stroke(p, [x + dx, y - 3.2], [x + dx, y + 3.2], INK, 1.5)).join('');
    const style = `${timing(k, [3, 5])};--rx:${num(7 * p.s)}px;--ry:${num(4 * p.s)}px`;
    out += `<g data-part="bee" class="fb-anim fb-garden-bee" style="${style}">${wings}${body}${stripes}</g>`;
  }
  return out;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box, UNITS);
  // Items have their own sketch, and so does the can drawn after them (the bees use none), so adding an item never re-wobbles the scenery.
  return `<g>${sun(sk, p)}${lawn(sk, p, ctx)}${fence(sk, p, ctx)}${tufts(sk, p, ctx)}${bed(sk, p)}` +
    `${items(createSketch(`${ctx.seedKey}:items`), p, ctx)}${can(createSketch(`${ctx.seedKey}:late`), p, ctx)}${bees(p, ctx)}</g>`;
}

const css = `
  @keyframes fb-garden-bee {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(var(--rx), calc(-1 * var(--ry))); }
    50% { transform: translate(0, calc(-2 * var(--ry))); }
    75% { transform: translate(calc(-1 * var(--rx)), calc(-1 * var(--ry))); }
  }
  @keyframes fb-garden-sway {
    0%, 100% { transform: rotate(-6deg); }
    50% { transform: rotate(6deg); }
  }
  .fb-garden-bee { animation-name: fb-garden-bee; animation-timing-function: ease-in-out; }
  .fb-garden-sway { animation-name: fb-garden-sway; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
`;

export const garden: Theme = {
  id: 'garden',
  label: 'Garten',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  css,
};
