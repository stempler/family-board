import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { item, type HalfContext, type Theme } from './types';

// The nest is drawn in "nest units" after mockups/shared-screen.html (1):
// a twig nest centred on x NEST_X with eggs piled in rows, and a dinosaur
// peeking from behind on the right. Egg slots are filled bottom row first,
// centre outwards, so an egg never moves once it is laid.
const MID = 150;
const NEST_X = 130;
const TOP = 52; // tip of the dinosaur's head spikes
const GROUND = 292;
const UNITS_H = GROUND - TOP;
const UNITS_W = 300;

const EGG_RX = 15;
const EGG_RY = 20;
const BIG_RX = 19;
const BIG_RY = 25;

const EGG = '#f3ead2';
const SPOTS = ['#7fb77e', '#6aa9d8', '#e98fb4'];
const GOLD = '#f7d046';
const GOLD_SPOTS = '#e08a1e';
const NEST = '#b08d57';
const NEST_DARK = '#7a5c34';
const DINO = '#7fb77e';
const DINO_BELLY = '#cfe6a8';
const SPIKES = '#f6993f';
const GRASS = '#9cc56b';
const MEADOW = '#f3f6e6';

const CAPACITY = 15;
const SCENE_TOP = 0.17; // leave room for the board header
const SCENE_BOTTOM = 0.79; // leave room for the jar row

/** Egg slots, rows of 5, 4, 3, 2, 1 from the bottom of the nest up; each row is filled centre outwards. */
function eggSlots(): [number, number][] {
  const slots: [number, number][] = [];
  const outward = (n: number) => Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) || b - a);
  for (let row = 0; row < 5; row++) {
    const n = 5 - row;
    for (const k of outward(n)) slots.push([NEST_X + (k - (n - 1) / 2) * 34, 230 - row * 30]);
  }
  return slots;
}

const SLOTS = eggSlots();

interface Placement { cx: number; top: number; s: number }

function at(p: Placement, x: number, y: number): [number, number] {
  return [p.cx + (x - MID) * p.s, p.top + (y - TOP) * p.s];
}

/** Rewrites every "x y" pair of a path in nest units into board coordinates. */
function moved(p: Placement, d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => at(p, +x, +y).map(num).join(' '));
}

/** Fits the scene into the scene band of `box`, horizontally centred. */
function placement(box: Box): Placement {
  const top = box.y + box.h * SCENE_TOP;
  const height = box.h * (SCENE_BOTTOM - SCENE_TOP);
  const s = Math.min(height / UNITS_H, (box.w * 0.92) / UNITS_W);
  return { cx: box.x + box.w / 2, top: top + (height - UNITS_H * s), s };
}

function egg(sk: Sketch, p: Placement, x: number, y: number, i: number, big: boolean): string {
  const [cx, cy] = at(p, x, y);
  const rx = (big ? BIG_RX : EGG_RX) * p.s;
  const ry = (big ? BIG_RY : EGG_RY) * p.s;
  const spot = big ? GOLD_SPOTS : SPOTS[i % SPOTS.length];
  const dots: [number, number, number][] = big
    ? [[-0.4, -0.35, 0.16], [0.35, -0.1, 0.13], [-0.15, 0.3, 0.14], [0.4, 0.45, 0.1], [0.05, -0.62, 0.1], [-0.5, 0.15, 0.09]]
    : [[-0.3, -0.2, 0.2], [0.3, 0.3, 0.17], [0.25, -0.45, 0.12]];
  const speckles = dots.map(([dx, dy, r]) => `<circle cx="${num(cx + dx * rx)}" cy="${num(cy + dy * ry)}" r="${num(r * rx)}" fill="${spot}"/>`).join('');
  const shine = `<ellipse cx="${num(cx - rx * 0.45)}" cy="${num(cy - ry * 0.4)}" rx="${num(rx * 0.14)}" ry="${num(ry * 0.22)}" fill="#fff" opacity="0.7"/>`;
  return sk.ellipse(cx, cy, rx * 2, ry * 2, { fill: big ? GOLD : EGG, strokeWidth: big ? 2.4 : 2, roughness: 0.8 }) + speckles + shine;
}

function eggs(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { big, small } = ctx.groups;
  let out = '';
  for (let i = 0; i < big + small && i < SLOTS.length; i++) {
    const isBig = i < big;
    out += item(isBig ? 'big' : 'small', i, ctx.newFrom, egg(sk, p, ...SLOTS[i], i, isBig));
  }
  return out;
}

/** Neck and head rising from behind the nest, looking at the eggs. */
function dinosaur(sk: Sketch, p: Placement): string {
  const neck = sk.path(moved(p, 'M 226 286 C 224 200 238 150 244 108 L 284 104 C 282 150 268 200 266 286 Z'), { fill: DINO, strokeWidth: 2.5, roughness: 0.9 });
  const belly = sk.path(moved(p, 'M 232 250 C 232 200 242 160 248 124'), { stroke: DINO_BELLY, strokeWidth: 5 * p.s, roughness: 0.6 });
  let spikes = '';
  for (const [x, y] of [[283, 118], [280, 146], [275, 174], [271, 202]] as [number, number][]) {
    spikes += sk.polygon([at(p, x - 2, y - 9), at(p, x + 13, y), at(p, x - 1, y + 9)], { fill: SPIKES, strokeWidth: 1.6, roughness: 0.5 });
  }
  spikes += sk.polygon([at(p, 262, 74), at(p, 270, 54), at(p, 278, 74)], { fill: SPIKES, strokeWidth: 1.6, roughness: 0.5 });
  spikes += sk.polygon([at(p, 277, 78), at(p, 290, 62), at(p, 291, 83)], { fill: SPIKES, strokeWidth: 1.6, roughness: 0.5 });
  const head = sk.path(moved(p, 'M 290 96 C 294 68 262 62 236 72 C 214 80 206 94 212 104 C 220 116 252 118 268 112 C 284 108 288 104 290 96 Z'), { fill: DINO, strokeWidth: 2.5, roughness: 0.9 });
  const [ex, ey] = at(p, 250, 84);
  const eye = `<circle cx="${num(ex)}" cy="${num(ey)}" r="${num(5.5 * p.s)}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>` +
    `<circle cx="${num(ex - 1.6 * p.s)}" cy="${num(ey + 0.6 * p.s)}" r="${num(2.8 * p.s)}" fill="${INK}"/>` +
    `<circle cx="${num(ex - 2.4 * p.s)}" cy="${num(ey - 0.6 * p.s)}" r="${num(0.9 * p.s)}" fill="#fff"/>`;
  const [nx, ny] = at(p, 219, 88);
  const nostril = `<circle cx="${num(nx)}" cy="${num(ny)}" r="${num(1.6 * p.s)}" fill="${INK}"/>`;
  const smile = sk.path(moved(p, 'M 216 102 Q 232 110 248 104'), { strokeWidth: 2, roughness: 0.5 });
  const [cx, cy] = at(p, 258, 98);
  const cheek = `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(5 * p.s)}" ry="${num(3 * p.s)}" fill="#ef7fb0" opacity="0.6"/>`;
  return neck + belly + spikes + head + eye + nostril + smile + cheek;
}

/** A tail tip curling out from behind the left side of the nest. */
function tail(sk: Sketch, p: Placement): string {
  return sk.path(moved(p, 'M 34 252 C 12 246 0 228 4 202 C 14 222 28 232 46 236 Z'), { fill: DINO, strokeWidth: 2.2, roughness: 0.8 });
}

function nestBack(sk: Sketch, p: Placement): string {
  const [cx, cy] = at(p, NEST_X, 240);
  return sk.ellipse(cx, cy, 236 * p.s, 34 * p.s, { fill: NEST_DARK, strokeWidth: 2.5, roughness: 1 });
}

/** Front of the nest, drawn over the eggs so the bottom row sits inside it. Gets its own sketch so its wobble does not change with the egg count. */
function nestFront(sk: Sketch, p: Placement): string {
  const bowl = sk.path(moved(p, 'M 10 240 Q 130 268 250 240 Q 242 288 130 290 Q 18 288 10 240 Z'), { fill: NEST, strokeWidth: 3, roughness: 1 });
  let twigs = '';
  for (const d of ['M 26 254 Q 80 270 140 266', 'M 120 272 Q 180 274 236 254', 'M 40 270 Q 100 284 160 280', 'M 64 262 L 30 276', 'M 196 266 L 232 278']) {
    twigs += sk.path(moved(p, d), { stroke: NEST_DARK, strokeWidth: 1.8, roughness: 1 });
  }
  return bowl + twigs;
}

function ground(sk: Sketch, p: Placement): string {
  const [gx, gy] = at(p, MID, GROUND - 4);
  let tufts = '';
  for (const x of [8, 274, 292]) tufts += sk.path(moved(p, `M ${x} ${GROUND - 4} L ${x - 4} ${GROUND - 18} M ${x} ${GROUND - 4} L ${x + 2} ${GROUND - 20} M ${x} ${GROUND - 4} L ${x + 7} ${GROUND - 15}`), { stroke: '#5a8f3c', strokeWidth: 2, roughness: 0.6 });
  return sk.ellipse(gx, gy, UNITS_W * p.s, 16 * p.s, { fill: GRASS, strokeWidth: 2, roughness: 1 }) + tufts;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box);
  return `<g>${ground(sk, p)}${tail(sk, p)}${dinosaur(sk, p)}${nestBack(sk, p)}${eggs(sk, p, ctx)}${nestFront(createSketch(`${ctx.seedKey}:nest`), p)}</g>`;
}

export const dino: Theme = {
  id: 'dino',
  capacity: CAPACITY,
  background: MEADOW,
  renderHalf,
};
