import { timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { item, type HalfContext, type Theme } from './types';

// The tower is drawn in "tower units" after mockups/shared-screen.html (1):
// bricks stack upwards from the baseplate at y BASE, centred on x MID, each
// shifted a little left or right. Brick i always sits at the same height, so a
// new brick lands on top and the ones below never move.
const MID = 100;
const BRICK_W = 78;
const BRICK_H = 15;
const STUD_W = 17;
const STUD_H = 6;
const PITCH = BRICK_H + STUD_H; // studs stay visible between bricks, so every brick can be counted
const SHIFT = 6;
const CAPACITY = 20;
const PLATE_H = 12;
const PLATE_W = 250;
const BASE = 400; // top of the baseplate
const TOP = BASE - CAPACITY * PITCH; // top of the highest stud
const UNITS_H = BASE + PLATE_H - TOP;

const COLOURS = ['#e3342f', '#f6c90e', '#3490dc', '#38c172', '#f6993f'];
const GOLD = '#d49a0c';
const STAR = '#ffffff';
const PLATE = '#5aa469';
const HEAD = '#f6d33c';
const SKY = '#e8f1fb';

const SCENE_TOP = 0.17; // leave room for the board header
const SCENE_BOTTOM = 0.79; // leave room for the jar row

interface Placement { cx: number; top: number; s: number }

function at(p: Placement, x: number, y: number): [number, number] {
  return [p.cx + (x - MID) * p.s, p.top + (y - TOP) * p.s];
}

/** Fits the tower into the scene band of `box`, horizontally centred. */
function placement(box: Box): Placement {
  const top = box.y + box.h * SCENE_TOP;
  const height = box.h * (SCENE_BOTTOM - SCENE_TOP);
  const s = Math.min(height / UNITS_H, (box.w * 0.9) / PLATE_W);
  return { cx: box.x + box.w / 2, top: top + (height - UNITS_H * s), s };
}

function starPoints(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}

/** One brick with its studs on top; `x`, `y` is the top-left corner of the brick body in tower units. */
function brick(sk: Sketch, p: Placement, x: number, y: number, w: number, fill: string, big: boolean): string {
  const studs = Math.round(w / (BRICK_W / 2));
  let out = '';
  for (let k = 0; k < studs; k++) {
    const sx = x + (w / studs) * (k + 0.5) - STUD_W / 2;
    const [x0, y0] = at(p, sx, y - STUD_H);
    out += sk.rect(x0, y0, STUD_W * p.s, STUD_H * p.s + 1, { fill, strokeWidth: 1.4, roughness: 0.5 });
  }
  const [bx, by] = at(p, x, y);
  out += sk.rect(bx, by, w * p.s, BRICK_H * p.s, { fill, strokeWidth: big ? 2.4 : 2, roughness: 0.7 });
  const shine = `<rect x="${num(bx + 3 * p.s)}" y="${num(by + 2.5 * p.s)}" width="${num(Math.min(18, w * 0.2) * p.s)}" height="${num(2.5 * p.s)}" rx="${num(1.2 * p.s)}" fill="#fff" opacity="0.55"/>`;
  const star = big ? sk.polygon(starPoints(bx + (w * p.s) / 2, by + (BRICK_H * p.s) / 2, BRICK_H * 0.42 * p.s), { fill: STAR, strokeWidth: 1.2, roughness: 0.4 }) : '';
  return out + shine + star;
}

function tower(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { big, small } = ctx.groups;
  let out = '';
  for (let i = 0; i < big + small && i < CAPACITY; i++) {
    const isBig = i < big;
    const w = isBig ? BRICK_W * 2 : BRICK_W;
    const x = MID - w / 2 + (i % 2 ? SHIFT : -SHIFT);
    const y = BASE - BRICK_H - i * PITCH;
    out += item(isBig ? 'big' : 'small', i, ctx.newFrom, brick(sk, p, x, y, w, isBig ? GOLD : COLOURS[i % COLOURS.length], isBig));
  }
  return out;
}

function baseplate(sk: Sketch, p: Placement): string {
  const left = MID - PLATE_W / 2;
  let studs = '';
  for (let k = 0; k < 9; k++) {
    // Studs under the tower are hidden by the bottom brick; the rest peek out at both ends.
    const sx = left + 10 + k * ((PLATE_W - 20 - STUD_W) / 8);
    const [x0, y0] = at(p, sx, BASE - STUD_H + 1);
    studs += sk.rect(x0, y0, STUD_W * p.s, STUD_H * p.s, { fill: PLATE, strokeWidth: 1.2, roughness: 0.5 });
  }
  const [px, py] = at(p, left, BASE);
  return studs + sk.rect(px, py, PLATE_W * p.s, PLATE_H * p.s, { fill: PLATE, strokeWidth: 2.2, roughness: 0.8 });
}

/** A little builder in the kid's colour, standing on the baseplate next to the tower and waving. */
function minifig(sk: Sketch, p: Placement, colour: string, seedKey: string): string {
  const [fx, fy] = at(p, MID + 108, BASE); // between the feet
  const k = p.s * 1.3;
  const f = (dx: number, dy: number): [number, number] => [fx + dx * k, fy + dy * k];
  const r = (dx: number, dy: number, w: number, h: number, fill: string, width = 1.8) => sk.rect(...f(dx, dy), w * k, h * k, { fill, strokeWidth: width, roughness: 0.6 });
  const legs = r(-10, -18, 9.5, 18, '#3b4a6b') + r(0.5, -18, 9.5, 18, '#3b4a6b');
  const torso = sk.polygon([f(-10, -18), f(10, -18), f(8, -36), f(-8, -36)], { fill: colour, strokeWidth: 2, roughness: 0.6 });
  const armL = sk.line(...f(-8, -33), ...f(-16, -22), { stroke: colour, strokeWidth: 4 * k, roughness: 0.4 });
  const armR = sk.line(...f(8, -33), ...f(17, -46), { stroke: colour, strokeWidth: 4 * k, roughness: 0.4 });
  const [hx, hy] = f(18, -48);
  const hand = `<circle cx="${num(hx)}" cy="${num(hy)}" r="${num(2.6 * k)}" fill="${HEAD}" stroke="${INK}" stroke-width="1.2"/>`;
  const head = r(-6, -50, 12, 14, HEAD) + r(-3, -54, 6, 4, HEAD, 1.4);
  const [ex, ey] = f(0, -45);
  const face = `<circle cx="${num(ex - 2.4 * k)}" cy="${num(ey)}" r="${num(k)}" fill="${INK}"/><circle cx="${num(ex + 2.4 * k)}" cy="${num(ey)}" r="${num(k)}" fill="${INK}"/>` +
    sk.path(`M ${num(ex - 3 * k)} ${num(ey + 3 * k)} Q ${num(ex)} ${num(ey + 6 * k)} ${num(ex + 3 * k)} ${num(ey + 3 * k)}`, { strokeWidth: 1.2, roughness: 0.3 });
  // The raised arm and hand wave together, pivoting at the shoulder (bottom left of the group); the torso hides the joint.
  const wave = `<g class="fb-anim fb-lego-wave" style="${timing(`${seedKey}:wave`, [9, 11])}">${armR}${hand}</g>`;
  return legs + armL + wave + torso + head + face;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box);
  return `<g>${baseplate(sk, p)}${minifig(sk, p, ctx.kid.colour, ctx.seedKey)}${tower(sk, p, ctx)}</g>`;
}

// At rest for 80 % of the cycle, then three swings of ±20° around the shoulder, then back to rest.
const css = `
  @keyframes fb-lego-wave {
    0%, 80%, 100% { transform: rotate(0deg); }
    83% { transform: rotate(-20deg); }
    86.5% { transform: rotate(20deg); }
    90% { transform: rotate(-20deg); }
    93.5% { transform: rotate(20deg); }
    97% { transform: rotate(0deg); }
  }
  .fb-lego-wave { animation-name: fb-lego-wave; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 0% 100%; }
`;

export const lego: Theme = {
  id: 'lego',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  css,
};
