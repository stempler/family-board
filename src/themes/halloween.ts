import { particles, rand, scaledCount, timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { seasonKid, seasonPlacement } from '../draw/season';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { at, placement, points, SCENE_TOP, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A night pumpkin patch, drawn in "patch units": a big carved-pumpkin candy bucket stands in the
// middle (x 84..216 around the centre x 150), its handle in the kid colour arching up to y 24. Candy
// heaps up in the bucket's open top and then spills onto the ground in front of it; jack-o'-lanterns
// sit in two little piles beside it. The ground line is y 228. Everything is friendly: the bucket,
// the lanterns, the ghost and the bat all smile.
const MID = 150;
const HALF_W = 150;
const TOP = 0;
const UNITS_H = 240;
/** The scene takes at most 47% of the width it stands in. */
const UNITS: Units = { mid: MID, top: TOP, w: HALF_W, h: UNITS_H, fill: 0.47 };
const GROUND = 228;

const SKY = '#bcaddf';
const GROUND_FILL = '#7f8f4e';
const FENCE = '#9b7653';
const MOON = '#fbf0b8';
const MOON_DARK = '#e9d98c';
const PUMPKIN = '#f28c28';
const PUMPKIN_DARK = '#c96a12';
const STEM = '#5b7f2a';
const FACE = '#4a2c17';
const GLOW = '#ffd23f';
const GHOST = '#ffffff';
const CHEEK = '#f7a8b8';
const BAT = '#4a3b6b';
const CANDY = ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#3b86d6', '#ff7eb6'];

const SMALL = 1; // candy scale: a candy is 23 units end to end and 10.5 tall
const LANTERN_R = 16;
const SPILL = 0.4; // scale of a lantern sitting on a candy spot, so it fits the candy pitch
const GLOWING = 6; // only the first lanterns flicker

/** Lantern spots beside the bucket: a little pile of three on each side, clear of every candy spot. */
const LANTERNS: Pt[] = [[68, 208], [232, 208], [28, 208], [272, 208], [48, 172], [252, 172]];

/**
 * Candy spots, 30 apart in a row and 15 apart between rows, so no two candies touch: staggered rows heaped up
 * over the bucket's opening (bottom row first), then the ground in front of and beside the bucket.
 */
const CANDY_SLOTS: Pt[] = [
  [105, 112], [135, 112], [165, 112], [195, 112],
  [120, 97], [150, 97], [180, 97],
  [105, 82], [135, 82], [165, 82], [195, 82],
  [120, 67], [150, 67], [180, 67],
  [135, 52], [165, 52],
  [150, 37],
  [90, 234], [120, 234], [150, 234], [180, 234], [210, 234],
  [105, 219], [135, 219], [165, 219], [195, 219],
  [45, 234], [255, 234], [15, 234], [285, 234],
];

const CAPACITY = CANDY_SLOTS.length;

/** A friendly carved face on a pumpkin centred at (x, y) with radius r: round-ish triangle eyes and a big grin. */
function face(sk: Sketch, x: number, y: number, r: number, fill: string): string {
  const eye = (dx: number) => sk.polygon([[x + dx - r * 0.2, y - r * 0.08], [x + dx, y - r * 0.42], [x + dx + r * 0.2, y - r * 0.08]], { fill, stroke: FACE, strokeWidth: 1.2, roughness: 0.4 });
  const [l, rr] = [x - r * 0.55, x + r * 0.55];
  const top = y + r * 0.12;
  const grin = sk.path(
    `M ${num(l)} ${num(top)} Q ${num(x)} ${num(top + r * 0.32)} ${num(rr)} ${num(top)} Q ${num(x)} ${num(top + r * 0.75)} ${num(l)} ${num(top)} Z`,
    { fill, stroke: FACE, strokeWidth: 1.2, roughness: 0.4 },
  );
  return eye(-r * 0.36) + eye(r * 0.36) + grin;
}

/** A jack-o'-lantern centred at (x, y) with radius r; its glowing face flickers when `glow` holds the timing key. */
function lantern(sk: Sketch, x: number, y: number, r: number, glow: string | null): string {
  const stem = sk.rect(x - r * 0.14, y - r * 1.05, r * 0.28, r * 0.35, { fill: STEM, strokeWidth: 1.2, roughness: 0.5 });
  const body = sk.ellipse(x, y, r * 2.2, r * 1.85, { fill: PUMPKIN, strokeWidth: 1.8, roughness: 0.7 });
  const ribs = sk.path(`M ${num(x - r * 0.45)} ${num(y - r * 0.85)} Q ${num(x - r * 0.75)} ${num(y)} ${num(x - r * 0.45)} ${num(y + r * 0.88)} M ${num(x + r * 0.45)} ${num(y - r * 0.85)} Q ${num(x + r * 0.75)} ${num(y)} ${num(x + r * 0.45)} ${num(y + r * 0.88)}`, { stroke: PUMPKIN_DARK, strokeWidth: 1.2, roughness: 0.5 });
  const lit = face(sk, x, y, r, GLOW);
  const glowing = glow ? `<g class="fb-anim fb-halloween-glow" style="${timing(glow, [2, 3])}">${lit}</g>` : lit;
  return stem + body + ribs + glowing;
}

/** A wrapped candy: a round middle with a twisted end on each side and a white stripe. */
function candy(sk: Sketch, x: number, y: number, k: number, fill: string): string {
  const w = 7 * k;
  const h = 5 * k;
  const end = (d: number) => sk.polygon([[x + d * w * 0.8, y], [x + d * w * 1.65, y - h * 1.05], [x + d * w * 1.65, y + h * 1.05]], { fill, strokeWidth: 1.2, roughness: 0.4 });
  const body = sk.ellipse(x, y, w * 2.2, h * 2, { fill, strokeWidth: 1.5, roughness: 0.5 });
  const stripe = `<line x1="${num(x - w * 0.3)}" y1="${num(y - h * 0.8)}" x2="${num(x + w * 0.3)}" y2="${num(y + h * 0.8)}" stroke="#fff" stroke-width="${num(1.6 * k)}" stroke-linecap="round" opacity="0.85"/>`;
  return end(-1) + end(1) + body + stripe;
}

export interface Spot { kind: 'big' | 'small'; x: number; y: number; k: number; slot: number } // patch units; k scales the drawing

/** Where the items go: lanterns first in their own spots, then on candy spots (smaller); candy fills the remaining candy spots in order. */
export function spots(big: number, small: number): Spot[] {
  const out: Spot[] = [];
  let slot = 0;
  for (let i = 0; i < big && slot < CANDY_SLOTS.length; i++) {
    if (i < LANTERNS.length) out.push({ kind: 'big', x: LANTERNS[i][0], y: LANTERNS[i][1], k: 1, slot: -1 });
    else out.push({ kind: 'big', x: CANDY_SLOTS[slot][0], y: CANDY_SLOTS[slot][1], k: SPILL, slot: slot++ });
  }
  for (let i = 0; i < small && slot < CANDY_SLOTS.length; i++, slot++) out.push({ kind: 'small', x: CANDY_SLOTS[slot][0], y: CANDY_SLOTS[slot][1], k: SMALL, slot });
  return out;
}

/** The box a drawn item covers, in patch units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  if (s.kind === 'big') {
    const r = LANTERN_R * s.k;
    return [s.x - 1.1 * r, s.y - 1.05 * r, s.x + 1.1 * r, s.y + 0.925 * r];
  }
  return [s.x - 11.55 * s.k, s.y - 5.25 * s.k, s.x + 11.55 * s.k, s.y + 5.25 * s.k];
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) => {
    const [x, y] = at(p, s.x, s.y);
    if (s.kind === 'small') return item('small', i, ctx, candy(sk, x, y, s.k * p.s, CANDY[s.slot % CANDY.length]));
    const glow = i < GLOWING ? `${ctx.seedKey}:glow:${i}` : null;
    return item('big', i, ctx, lantern(sk, x, y, LANTERN_R * s.k * p.s, glow));
  }).join('');
}

/** The big carved-pumpkin candy bucket with its handle in the kid colour; candy is drawn on top of it afterwards. */
function bucket(sk: Sketch, p: Placement, colour: string): string {
  const u = (x: number, y: number) => at(p, x, y).map(num).join(' ');
  const handle = sk.path(`M ${u(104, 132)} C ${u(104, -10)} ${u(196, -10)} ${u(196, 132)}`, { stroke: colour, strokeWidth: 6 * p.s, roughness: 0.5 });
  const knob = (x: number) => sk.circle(...at(p, x, 132), 9 * p.s, { fill: colour, strokeWidth: 1.6, roughness: 0.4 });
  const body = sk.ellipse(...at(p, MID, 170), 136 * p.s, 112 * p.s, { fill: PUMPKIN, strokeWidth: 2.6, roughness: 0.9 });
  const ribs = sk.path(`M ${u(118, 120)} Q ${u(96, 170)} ${u(118, 222)} M ${u(182, 120)} Q ${u(204, 170)} ${u(182, 222)}`, { stroke: PUMPKIN_DARK, strokeWidth: 1.8, roughness: 0.6 });
  const [fx, fy] = at(p, MID, 172);
  const carved = face(sk, fx, fy, 50 * p.s, FACE);
  const rim = sk.ellipse(...at(p, MID, 118), 92 * p.s, 20 * p.s, { fill: FACE, strokeWidth: 2.2, roughness: 0.6 });
  return `<g data-part="bucket">${handle}${body}${ribs}${carved}${rim}${knob(104)}${knob(196)}</g>`;
}

function moon(sk: Sketch, x: number, y: number, r: number): string {
  const body = sk.circle(x, y, 2 * r, { fill: MOON, strokeWidth: 2, roughness: 0.6 });
  const crater = (dx: number, dy: number, k: number) => `<circle cx="${num(x + dx * r)}" cy="${num(y + dy * r)}" r="${num(k * r)}" fill="${MOON_DARK}"/>`;
  return `<g data-part="moon">${body}${crater(-0.3, -0.2, 0.18)}${crater(0.35, 0.25, 0.13)}${crater(-0.1, 0.45, 0.1)}</g>`;
}

/** A crooked wooden fence along `baseY` from x0 to x1: two sagging rails and leaning pickets. */
function fence(sk: Sketch, x0: number, x1: number, baseY: number, h: number, key: string): string {
  const gap = h * 0.55;
  const n = Math.max(2, Math.floor((x1 - x0) / gap));
  const step = (x1 - x0) / n;
  let pickets = '';
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * step;
    const lean = (rand(`${key}:lean:${i}`) - 0.5) * 0.35;
    const ph = h * (0.82 + rand(`${key}:h:${i}`) * 0.3);
    const w = h * 0.13;
    const tx = x + lean * ph;
    pickets += sk.polygon([[x - w, baseY], [x + w, baseY], [tx + w, baseY - ph + w], [tx, baseY - ph], [tx - w, baseY - ph + w]], { fill: FENCE, strokeWidth: 1.5, roughness: 0.8 });
  }
  const rail = (y: number) => sk.path(`M ${num(x0)} ${num(y)} Q ${num((x0 + x1) / 2)} ${num(y + h * 0.12)} ${num(x1)} ${num(y - h * 0.06)}`, { stroke: FENCE, strokeWidth: h * 0.1, roughness: 0.9 });
  return `<g data-part="fence">${rail(baseY - h * 0.3)}${rail(baseY - h * 0.65)}${pickets}</g>`;
}

/** A small round ghost with a wavy hem, a smile and pink cheeks, centred at (x, y), `w` wide; it floats up and down. */
function ghost(sk: Sketch, x: number, y: number, w: number, key: string): string {
  const r = w / 2;
  const top = y - r * 0.6;
  const bottom = y + r * 1.1;
  const hem = [-1, -0.5, 0, 0.5, 1].map((t, i) => `${num(x + t * r)} ${num(bottom + (i % 2 ? -r * 0.18 : 0))}`).reverse();
  const d = `M ${num(x - r)} ${num(bottom)} L ${num(x - r)} ${num(top)} A ${num(r)} ${num(r)} 0 0 1 ${num(x + r)} ${num(top)} L ${hem.join(' L ')} Z`;
  const body = sk.path(d, { fill: GHOST, strokeWidth: 2, roughness: 0.7 });
  const eye = (dx: number) => `<ellipse cx="${num(x + dx * r)}" cy="${num(top + r * 0.05)}" rx="${num(r * 0.11)}" ry="${num(r * 0.16)}" fill="${INK}"/>`;
  const cheek = (dx: number) => `<ellipse cx="${num(x + dx * r)}" cy="${num(top + r * 0.35)}" rx="${num(r * 0.14)}" ry="${num(r * 0.08)}" fill="${CHEEK}"/>`;
  const smile = `<path d="M ${num(x - r * 0.18)} ${num(top + r * 0.3)} Q ${num(x)} ${num(top + r * 0.5)} ${num(x + r * 0.18)} ${num(top + r * 0.3)}" stroke="${INK}" stroke-width="${num(Math.max(1.2, r * 0.06))}" fill="none" stroke-linecap="round"/>`;
  return `<g data-part="ghost"><g class="fb-anim fb-halloween-ghost" style="${timing(`${key}:ghost`, [3.5, 4.5])}">${body}${eye(-0.32)}${eye(0.32)}${cheek(-0.55)}${cheek(0.55)}${smile}</g></g>`;
}

/** A little smiling bat, `w` wide, resting at (x, y); once per cycle it flutters across the sky (`cls` picks how far). */
function bat(sk: Sketch, x: number, y: number, w: number, key: string, cls: string): string {
  const r = w / 2;
  const wing = (d: number): Pt[] => [[x + d * r * 0.2, y - r * 0.1], [x + d * r * 0.6, y - r * 0.45], [x + d * r, y - r * 0.2], [x + d * r * 0.8, y + r * 0.05], [x + d * r * 0.55, y - r * 0.02], [x + d * r * 0.4, y + r * 0.18], [x + d * r * 0.2, y + r * 0.12]];
  const wings = sk.polygon(wing(-1), { fill: BAT, strokeWidth: 1.2, roughness: 0.4 }) + sk.polygon(wing(1), { fill: BAT, strokeWidth: 1.2, roughness: 0.4 });
  const ears = `<polygon points="${points([[x - r * 0.2, y - r * 0.2], [x - r * 0.14, y - r * 0.42], [x - r * 0.04, y - r * 0.26], [x + r * 0.04, y - r * 0.26], [x + r * 0.14, y - r * 0.42], [x + r * 0.2, y - r * 0.2]])}" fill="${BAT}"/>`;
  const body = `<ellipse cx="${num(x)}" cy="${num(y)}" rx="${num(r * 0.24)}" ry="${num(r * 0.26)}" fill="${BAT}" stroke="${INK}" stroke-width="1"/>`;
  const eye = (dx: number) => `<circle cx="${num(x + dx * r)}" cy="${num(y - r * 0.04)}" r="${num(r * 0.06)}" fill="#fff"/>`;
  return `<g data-part="bat"><g class="fb-anim ${cls}" style="${timing(`${key}:bat`, [14, 16])}">${wings}${ears}${body}${eye(-0.09)}${eye(0.09)}</g></g>`;
}

/** Stars twinkling in the sky band above the scene. */
function stars(key: string, box: Box, count: number): string {
  const sky = { x: box.x, y: box.y + box.h * SCENE_TOP, w: box.w, h: box.h * 0.22 };
  return particles(`${key}:stars`, sky, count, 'sparkle');
}

function renderHalf(ctx: HalfContext): string {
  const { box } = ctx;
  const sk = createSketch(ctx.seedKey);
  const late = createSketch(`${ctx.seedKey}:late`);
  const p = placement(box, UNITS);
  const ground = sk.ellipse(...at(p, MID, GROUND + 4), 310 * p.s, 26 * p.s, { fill: GROUND_FILL, strokeWidth: 2, roughness: 1 });
  const [fx0] = at(p, 2, 0);
  const [fx1, fy] = at(p, 298, 212);
  const back = moon(sk, ...at(p, 262, 36), 20 * p.s) + fence(sk, fx0, fx1, fy, 34 * p.s, ctx.seedKey) + ground;
  const [gx, gy] = at(p, 30, 84);
  const [bx, by] = at(p, 40, 22);
  return `<g>${stars(ctx.seedKey, box, scaledCount(6, box))}${back}${bucket(sk, p, ctx.kid.colour)}${items(sk, p, ctx)}` +
    `${ghost(late, gx, gy, 38 * p.s, ctx.seedKey)}${bat(late, bx, by, 30 * p.s, ctx.seedKey, 'fb-halloween-bat')}</g>`;
}

function renderSeasonScene(halves: HalfContext[], box: Box): string {
  const key = `season:${halves.map((h) => h.seedKey).join('|')}`;
  const sk = createSketch(key);
  const late = createSketch(`${key}:late`);
  const mid = box.x + box.w / 2;
  const hillY = box.y + box.h * 0.74;
  const right = box.x + box.w;
  const sky = `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}" fill="${SKY}"/>`;
  // The hill's sides and bottom run past the board edge, so only its top outline shows.
  const o = 12;
  const hill = sk.path(
    `M ${num(box.x - o)} ${num(hillY)} Q ${num(box.x + box.w * 0.25)} ${num(hillY - box.h * 0.04)} ${num(mid)} ${num(hillY)} T ${num(right + o)} ${num(hillY - box.h * 0.01)} L ${num(right + o)} ${num(box.y + box.h + o)} L ${num(box.x - o)} ${num(box.y + box.h + o)} Z`,
    { fill: GROUND_FILL, strokeWidth: 2, roughness: 1 },
  );
  const back = moon(sk, mid, box.y + box.h * 0.27, Math.min(34, box.h * 0.075)) + fence(sk, box.x + 6, right - 6, hillY - box.h * 0.02, Math.min(40, box.h * 0.09), key) + hill;
  const buckets = halves.map((ctx) => {
    const { cx, p } = seasonPlacement(box, ctx.box, UNITS);
    const ksk = createSketch(ctx.seedKey);
    return seasonKid(ctx.kid.id, cx, bucket(ksk, p, ctx.kid.colour) + items(ksk, p, ctx));
  }).join('');
  const g = ghost(late, mid, box.y + box.h * 0.52, Math.min(56, box.h * 0.12), key);
  const b = bat(late, box.x + box.w * 0.1, box.y + box.h * 0.22, Math.min(40, box.h * 0.09), key, 'fb-halloween-bat-wide');
  return `<g>${sky}${stars(key, box, scaledCount(5, box))}${back}${buckets}${g}${b}</g>`;
}

/** Keyframes for a bat that flutters `dx` of its own widths to the right in the first fifth of the cycle, flapping as it goes, then fades out and comes back to rest. */
function batKeyframes(name: string, dx: number): string {
  const steps: string[] = [];
  const flaps = 12;
  for (let i = 0; i <= flaps; i++) {
    const t = i / flaps;
    const pct = num(t * 18);
    const x = num(t * dx * 100);
    const y = num(Math.sin(t * Math.PI * 3) * -60);
    steps.push(`${pct}% { transform: translate(${x}%, ${y}%) scale(1, ${i % 2 ? 0.55 : 1}); opacity: 1; }`);
  }
  steps.push(`20% { transform: translate(${num(dx * 100)}%, 0) scale(1, 1); opacity: 0; }`);
  steps.push(`94% { transform: translate(0, 0) scale(1, 1); opacity: 0; }`);
  steps.push(`100% { transform: translate(0, 0) scale(1, 1); opacity: 1; }`);
  return `@keyframes ${name} {\n    ${steps.join('\n    ')}\n  }`;
}

const css = `
  @keyframes fb-halloween-ghost {
    0%, 100% { transform: translate(0, 0) rotate(-3deg); }
    50% { transform: translate(0, -12%) rotate(3deg); }
  }
  @keyframes fb-halloween-glow {
    0%, 100% { opacity: 1; }
    20% { opacity: 0.6; }
    35% { opacity: 0.95; }
    60% { opacity: 0.7; }
    80% { opacity: 1; }
  }
  ${batKeyframes('fb-halloween-bat', 6)}
  ${batKeyframes('fb-halloween-bat-wide', 14)}
  .fb-halloween-ghost { animation-name: fb-halloween-ghost; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
  .fb-halloween-glow { animation-name: fb-halloween-glow; animation-timing-function: ease-in-out; }
  .fb-halloween-bat { animation-name: fb-halloween-bat; animation-timing-function: linear; transform-box: fill-box; transform-origin: 50% 50%; }
  .fb-halloween-bat-wide { animation-name: fb-halloween-bat-wide; animation-timing-function: linear; transform-box: fill-box; transform-origin: 50% 50%; }
`;

export const halloween: Theme = {
  id: 'halloween',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  renderSeasonScene,
  css,
};
