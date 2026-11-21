import { timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { item, type HalfContext, type Theme } from './types';

// The scene is drawn in "scene units" after mockups/shared-screen.html (1):
// a twig nest centred on x NEST_X with eggs piled in rows, and a dinosaur
// standing on the ground to its right, head lowered towards the eggs. Egg slots
// are filled bottom row first, centre outwards, so an egg never moves once it is laid.
const MID = 160;
const NEST_X = 100;
const TOP = 52;
const GROUND = 292;
const UNITS_H = GROUND - TOP;
const UNITS_W = 320;

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
const DINO_DARK = '#6a9f69';
const CLAW = '#fbf3df';
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
  const count = Math.min(big + small, SLOTS.length);
  const wobbly = count - 1; // only the last egg wobbles, as if about to hatch: the last small one if any, else the last big one
  let out = '';
  for (let i = 0; i < count; i++) {
    const isBig = i < big;
    const body = egg(sk, p, ...SLOTS[i], i, isBig);
    // The wobble sits on an inner group, so it never fights the item's fb-new drop.
    const shown = i === wobbly ? `<g class="fb-anim fb-dino-wobble" style="${timing(`${ctx.seedKey}:wobble`, [11, 13])}">${body}</g>` : body;
    out += item(isBig ? 'big' : 'small', i, ctx, shown);
  }
  return out;
}

type Pt = [number, number];
type Cubic = [Pt, Pt, Pt, Pt];

/** The dinosaur's back, from the tail root over the hump and up the neck to the head, in scene units. */
const BACK: Cubic[] = [
  [[282, 262], [296, 232], [290, 190], [258, 178]],
  [[258, 178], [242, 172], [238, 160], [238, 142]],
  [[238, 142], [238, 126], [230, 116], [216, 114]],
];

function onCubic([a, b, c, d]: Cubic, t: number): { pt: Pt; out: Pt } {
  const u = 1 - t;
  const pt: Pt = [0, 1].map((k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]) as Pt;
  const [dx, dy] = [0, 1].map((k) => 3 * u * u * (b[k] - a[k]) + 6 * u * t * (c[k] - b[k]) + 3 * t * t * (d[k] - c[k]));
  const len = Math.hypot(dx, dy) || 1;
  return { pt, out: [-dy / len, dx / len] }; // the body lies to the left of the back's direction, so the right-hand normal points away from it
}

function spike(sk: Sketch, p: Placement, [x, y]: Pt, [ox, oy]: Pt, size: number): string {
  const [tx, ty] = [-oy, ox];
  return sk.polygon([at(p, x + tx * size * 0.7, y + ty * size * 0.7), at(p, x + ox * size * 1.3, y + oy * size * 1.3), at(p, x - tx * size * 0.7, y - ty * size * 0.7)], { fill: SPIKES, strokeWidth: 1.6, roughness: 0.5 });
}

function dot(p: Placement, x: number, y: number, r: number, fill: string): string {
  const [cx, cy] = at(p, x, y);
  return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r * p.s)}" fill="${fill}"/>`;
}

/** A tail curling up behind the body; its root is hidden behind the hips. */
function tail(sk: Sketch, p: Placement, seedKey: string): string {
  const d = 'M 270 272 C 300 278 318 262 318 236 C 318 212 302 200 290 208 C 284 212 288 222 296 220 C 302 226 300 240 292 246 C 284 252 276 250 268 244 Z';
  return `<g data-part="tail" class="fb-anim fb-dino-sway" style="${timing(`${seedKey}:sway`, [3, 4])}">${sk.path(moved(p, d), { fill: DINO, strokeWidth: 2.2, roughness: 0.8 })}</g>`;
}

/** One sturdy leg with three toes on the ground line, the foot pointing towards the nest. */
function leg(sk: Sketch, p: Placement, x: number, fill: string): string {
  const d = `M ${x - 12} 250 C ${x - 16} 236 ${x + 14} 228 ${x + 16} 246 C ${x + 14} 262 ${x + 16} 276 ${x + 14} 292 L ${x - 18} 292 C ${x - 28} 292 ${x - 24} 282 ${x - 14} 280 C ${x - 12} 274 ${x - 14} 262 ${x - 12} 250 Z`;
  let toes = '';
  for (let k = 0; k < 3; k++) {
    const tx = x - 24 + k * 7;
    toes += sk.polygon([at(p, tx, 286), at(p, tx - 5, 292), at(p, tx + 4, 292)], { fill: CLAW, strokeWidth: 1.2, roughness: 0.3 });
  }
  return `<g data-part="leg">${sk.path(moved(p, d), { fill, strokeWidth: 2.4, roughness: 0.8 })}${toes}</g>`;
}

/** Round body and neck as one silhouette, with a light belly, spots and back spikes. */
function body(sk: Sketch, p: Placement): string {
  const back = BACK.map(([, b, c, d]) => `C ${b.join(' ')} ${c.join(' ')} ${d.join(' ')}`).join(' ');
  const d = `M ${BACK[0][0].join(' ')} ${back} L 198 140 C 202 156 208 170 212 184 C 198 200 196 232 212 256 C 230 280 266 282 282 262 Z`;
  const shape = sk.path(moved(p, d), { fill: DINO, strokeWidth: 2.5, roughness: 0.9 });
  const belly = sk.path(moved(p, 'M 216 184 C 204 204 204 238 218 256 C 230 270 250 272 262 266 C 240 254 226 228 224 196 C 223 188 220 182 216 184 Z'), { fill: DINO_BELLY, strokeWidth: 1.6, roughness: 0.6 });
  const throat = sk.path(moved(p, 'M 208 146 C 212 158 216 170 218 184'), { stroke: DINO_BELLY, strokeWidth: 5 * p.s, roughness: 0.6 });
  const spots = dot(p, 266, 208, 6, DINO_DARK) + dot(p, 252, 196, 4, DINO_DARK) + dot(p, 278, 230, 4.5, DINO_DARK) + dot(p, 260, 226, 3.5, DINO_DARK);
  let spikes = '';
  for (const [seg, t, size] of [[0, 0.35, 9], [0, 0.7, 10], [0, 0.97, 10], [1, 0.4, 9], [1, 0.85, 9], [2, 0.3, 8]] as [number, number, number][]) {
    const { pt, out } = onCubic(BACK[seg], t);
    spikes += spike(sk, p, pt, out, size);
  }
  return `<g data-part="body">${spikes}${shape}${belly}${throat}${spots}</g>`;
}

/** A small arm reaching towards the nest. */
function arm(sk: Sketch, p: Placement): string {
  const d = 'M 222 204 C 210 204 200 210 194 220 C 192 226 198 228 202 224 C 206 220 212 218 222 218 Z';
  const claws = sk.polygon([at(p, 195, 219), at(p, 188, 223), at(p, 195, 224)], { fill: CLAW, strokeWidth: 1.2, roughness: 0.3 }) +
    sk.polygon([at(p, 197, 224), at(p, 191, 230), at(p, 200, 227)], { fill: CLAW, strokeWidth: 1.2, roughness: 0.3 });
  return `<g data-part="arm">${claws}${sk.path(moved(p, d), { fill: DINO, strokeWidth: 2, roughness: 0.6 })}</g>`;
}

/** The head at the end of the neck, lowered and looking down at the eggs. */
function head(sk: Sketch, p: Placement, seedKey: string): string {
  let spikes = sk.polygon([at(p, 212, 106), at(p, 220, 90), at(p, 226, 108)], { fill: SPIKES, strokeWidth: 1.6, roughness: 0.5 });
  spikes += sk.polygon([at(p, 226, 112), at(p, 240, 104), at(p, 234, 122)], { fill: SPIKES, strokeWidth: 1.6, roughness: 0.5 });
  const shape = sk.path(moved(p, 'M 236 128 C 234 108 214 100 198 104 C 182 108 168 124 164 138 C 162 150 172 158 188 156 C 210 154 236 148 236 128 Z'), { fill: DINO, strokeWidth: 2.5, roughness: 0.9 });
  const [ex, ey] = at(p, 204, 120);
  const eye = `<g class="fb-anim fb-dino-blink" style="${timing(`${seedKey}:blink`, [5.5, 6.5])}">` +
    `<circle cx="${num(ex)}" cy="${num(ey)}" r="${num(5.5 * p.s)}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>` +
    `<circle cx="${num(ex - 1.6 * p.s)}" cy="${num(ey + 1.4 * p.s)}" r="${num(2.8 * p.s)}" fill="${INK}"/>` +
    `<circle cx="${num(ex - 2.4 * p.s)}" cy="${num(ey + 0.2 * p.s)}" r="${num(0.9 * p.s)}" fill="#fff"/></g>`;
  const nostril = dot(p, 171, 134, 1.6, INK);
  const smile = sk.path(moved(p, 'M 172 148 Q 186 154 202 146'), { strokeWidth: 2, roughness: 0.5 });
  const [cx, cy] = at(p, 214, 138);
  const cheek = `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(5 * p.s)}" ry="${num(3 * p.s)}" fill="#ef7fb0" opacity="0.6"/>`;
  return `<g data-part="head" class="fb-anim fb-dino-bob" style="${timing(`${seedKey}:bob`, [4, 5])}">${spikes}${shape}${eye}${nostril}${smile}${cheek}</g>`;
}

function nestBack(sk: Sketch, p: Placement): string {
  const [cx, cy] = at(p, NEST_X, 240);
  return sk.ellipse(cx, cy, 188 * p.s, 30 * p.s, { fill: NEST_DARK, strokeWidth: 2.5, roughness: 1 });
}

/** Front of the nest, drawn over the eggs so the bottom row sits inside it. Gets its own sketch so its wobble does not change with the egg count. */
function nestFront(sk: Sketch, p: Placement): string {
  const bowl = sk.path(moved(p, 'M 4 240 Q 100 266 196 240 Q 190 288 100 290 Q 10 288 4 240 Z'), { fill: NEST, strokeWidth: 3, roughness: 1 });
  let twigs = '';
  for (const d of ['M 17 254 Q 60 270 108 266', 'M 92 272 Q 140 274 185 254', 'M 28 270 Q 76 284 124 280', 'M 47 262 L 20 276', 'M 153 266 L 182 278']) {
    twigs += sk.path(moved(p, d), { stroke: NEST_DARK, strokeWidth: 1.8, roughness: 1 });
  }
  return `<g data-part="nest">${bowl}${twigs}</g>`;
}

function ground(sk: Sketch, p: Placement): string {
  const [gx, gy] = at(p, MID, GROUND - 4);
  let tufts = '';
  for (const x of [8, 194, 304]) tufts += sk.path(moved(p, `M ${x} ${GROUND - 4} L ${x - 4} ${GROUND - 18} M ${x} ${GROUND - 4} L ${x + 2} ${GROUND - 20} M ${x} ${GROUND - 4} L ${x + 7} ${GROUND - 15}`), { stroke: '#5a8f3c', strokeWidth: 2, roughness: 0.6 });
  return sk.ellipse(gx, gy, UNITS_W * p.s, 16 * p.s, { fill: GRASS, strokeWidth: 2, roughness: 1 }) + tufts;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box);
  return `<g>${ground(sk, p)}${tail(sk, p, ctx.seedKey)}${leg(sk, p, 272, DINO_DARK)}${body(sk, p)}${leg(sk, p, 234, DINO)}${arm(sk, p)}${head(sk, p, ctx.seedKey)}${nestBack(sk, p)}${eggs(sk, p, ctx)}${nestFront(createSketch(`${ctx.seedKey}:nest`), p)}</g>`;
}

const css = `
  @keyframes fb-dino-blink {
    0%, 93%, 99%, 100% { transform: scaleY(1); }
    96% { transform: scaleY(0.1); }
  }
  @keyframes fb-dino-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(2.5px); }
  }
  @keyframes fb-dino-sway {
    0%, 100% { transform: rotate(0deg); }
    30% { transform: rotate(-4deg); }
    70% { transform: rotate(3deg); }
  }
  @keyframes fb-dino-wobble {
    0%, 88%, 100% { transform: rotate(0deg); }
    90% { transform: rotate(-7deg); }
    92% { transform: rotate(6deg); }
    94% { transform: rotate(-5deg); }
    96% { transform: rotate(3deg); }
    98% { transform: rotate(0deg); }
  }
  .fb-dino-blink { animation-name: fb-dino-blink; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
  .fb-dino-bob { animation-name: fb-dino-bob; animation-timing-function: ease-in-out; }
  .fb-dino-sway { animation-name: fb-dino-sway; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 0% 90%; }
  .fb-dino-wobble { animation-name: fb-dino-wobble; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
`;

export const dino: Theme = {
  id: 'dino',
  capacity: CAPACITY,
  background: MEADOW,
  renderHalf,
  css,
};
