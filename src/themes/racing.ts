import { timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { item, type HalfContext, type Theme } from './types';

// A race track scene drawn in "scene units": a trophy shelf on the left, a
// three-step podium beside it, a chequered flag on a pole at the right and a
// race track across the bottom with a generic race car in the kid's colour.
// Medals hang on the shelf's hooks (3 rows of 8, top row first, left to right).
// Trophies come first: on the podium (1st, 2nd, 3rd), then on top of the shelf,
// then, only when there are more than 11, standing in the shelf's compartments
// from the bottom right, so they never take a hook a medal needs.
const MID = 160;
const UNITS_W = 320;
const TOP = 16;
const BOTTOM = 262;
const UNITS_H = BOTTOM - TOP;

const COLS = 8;
const ROWS = 3;
const CAPACITY = COLS * ROWS;
const PITCH = 22;
const COL_X0 = 23; // centre of the first column
const SHELF_X0 = 8;
const SHELF_X1 = 192;
const SHELF_TOP = 58; // top of the top board, trophies stand on it
const ROW_TOP = 64; // top of the first compartment
const ROW_H = 44;
const BOARD = 6; // thickness of a shelf board
const SHELF_BOTTOM = ROW_TOP + ROWS * ROW_H; // 196
const GROUND = 200; // grass starts here
const KERB = 222; // top kerb of the track
const ASPHALT = 226;
const ASPHALT_END = 258;

const SKY = '#dcefff';
const CLOUD = '#ffffff';
const GRASS = '#8cc56b';
const ASPHALT_FILL = '#6f737a';
const KERB_RED = '#d64541';
const WOOD = '#b07a45';
const WOOD_DARK = '#7a5230';
const SHELF_BACK = '#ead6b4';
const GOLD = '#f2c14e';
const GOLD_DARK = '#c9962a';
const STEPS = ['#e8e3d6', '#f4efe2', '#ddd6c6']; // 2nd, 1st, 3rd (left to right)
const TYRE = '#2b2b2b';
const HUB = '#c9ccd1';

const SCENE_TOP = 0.17; // leave room for the board header
const SCENE_BOTTOM = 0.79; // leave room for the jar row
const ROLL = 20; // px the car rolls forward; the keyframes use the same value

type Pt = [number, number];

interface Placement { cx: number; top: number; s: number }

function at(p: Placement, x: number, y: number): Pt {
  return [p.cx + (x - MID) * p.s, p.top + (y - TOP) * p.s];
}

/** Rewrites every "x y" pair of a path in scene units into board coordinates. */
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

const colX = (k: number) => COL_X0 + k * PITCH;
const rowTop = (r: number) => ROW_TOP + r * ROW_H;

/** Medal hooks, top row first, left to right. */
const HOOKS: Pt[] = Array.from({ length: CAPACITY }, (_, i) => [colX(i % COLS), rowTop(Math.floor(i / COLS)) + 5]);

/** Where trophies stand (the middle of their base): podium 1st/2nd/3rd, the shelf top, then compartments from the bottom right. */
const STANDS: Pt[] = [
  [239, 160], [215, 174], [264, 184],
  ...Array.from({ length: COLS }, (_, k): Pt => [colX(k), SHELF_TOP]),
  ...Array.from({ length: CAPACITY }, (_, i): Pt => {
    const j = CAPACITY - 1 - i;
    return [colX(j % COLS), rowTop(Math.floor(j / COLS)) + ROW_H - BOARD];
  }),
];

const points = (pts: Pt[]) => pts.map((q) => q.map(num).join(',')).join(' ');
const local = (p: Placement, x: number, y: number, pts: Pt[]): Pt[] => pts.map(([dx, dy]) => at(p, x + dx, y + dy));

/** A gold medal hanging from a hook at (x, y) on a V of ribbon in the kid's colour. */
function medal(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const straps = sk.polygon(local(p, x, y, [[-7, 0], [-2, 0], [3, 17], [-2, 17]]), { fill: colour, strokeWidth: 1.4, roughness: 0.4 }) +
    sk.polygon(local(p, x, y, [[7, 0], [2, 0], [-3, 17], [2, 17]]), { fill: colour, strokeWidth: 1.4, roughness: 0.4 });
  const [cx, cy] = at(p, x, y + 24);
  const disc = sk.circle(cx, cy, 16 * p.s, { fill: GOLD, strokeWidth: 1.8, roughness: 0.5 });
  const rim = `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(5 * p.s)}" fill="none" stroke="${GOLD_DARK}" stroke-width="1.2"/>`;
  const glint = `<circle cx="${num(cx - 3 * p.s)}" cy="${num(cy - 3 * p.s)}" r="${num(1.6 * p.s)}" fill="#fff" opacity="0.85"/>`;
  return straps + disc + rim + glint;
}

/** A big gold trophy cup standing with the middle of its base at (x, y); the base carries a band in the kid's colour. */
function trophy(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const handles = sk.path(moved(p, `M ${x - 7} ${y - 27} C ${x - 12} ${y - 27} ${x - 12} ${y - 19} ${x - 5} ${y - 17}`), { stroke: GOLD_DARK, strokeWidth: 2.2, roughness: 0.4 }) +
    sk.path(moved(p, `M ${x + 7} ${y - 27} C ${x + 12} ${y - 27} ${x + 12} ${y - 19} ${x + 5} ${y - 17}`), { stroke: GOLD_DARK, strokeWidth: 2.2, roughness: 0.4 });
  const cup = sk.path(moved(p, `M ${x - 8} ${y - 30} L ${x + 8} ${y - 30} Q ${x + 8} ${y - 15} ${x} ${y - 13} Q ${x - 8} ${y - 15} ${x - 8} ${y - 30} Z`), { fill: GOLD, strokeWidth: 2, roughness: 0.5 });
  const stem = sk.polygon(local(p, x, y, [[-2, -13], [2, -13], [4, -8], [-4, -8]]), { fill: GOLD, strokeWidth: 1.6, roughness: 0.4 });
  const base = sk.rect(...at(p, x - 7, y - 8), 14 * p.s, 8 * p.s, { fill: colour, strokeWidth: 1.8, roughness: 0.5 });
  const shine = `<polyline points="${points(local(p, x, y, [[-5, -27], [-5, -21], [-3, -17]]))}" fill="none" stroke="#fff" stroke-width="${num(1.6 * p.s)}" stroke-linecap="round" opacity="0.85"/>`;
  return handles + cup + stem + base + shine;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { big, small } = ctx.groups;
  const colour = ctx.kid.colour;
  let out = '';
  for (let i = 0; i < big && i < STANDS.length; i++) out += item('big', i, ctx, trophy(sk, p, ...STANDS[i], colour));
  for (let j = 0; j < small && big + j < CAPACITY; j++) out += item('small', big + j, ctx, medal(sk, p, ...HOOKS[j], colour));
  return out;
}

/** Two soft clouds in the sky above the podium. */
function clouds(p: Placement): string {
  let out = '';
  for (const [x, y, w] of [[232, 44, 44], [276, 92, 30]]) {
    for (const [dx, dy, r] of [[-0.3, 0.1, 0.22], [0, -0.05, 0.3], [0.3, 0.1, 0.22]]) {
      const [cx, cy] = at(p, x + dx * w, y + dy * w);
      out += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r * w * p.s)}" fill="${CLOUD}" opacity="0.9"/>`;
    }
  }
  return `<g data-part="clouds">${out}</g>`;
}

/** Grass behind the track, then the track: kerbs in red and white around the asphalt and a dashed middle line. */
function track(sk: Sketch, p: Placement): string {
  const grass = sk.rect(...at(p, -4, GROUND), (UNITS_W + 8) * p.s, (KERB - GROUND) * p.s, { fill: GRASS, stroke: 'none', roughness: 0.6 });
  const asphalt = sk.rect(...at(p, -4, ASPHALT), (UNITS_W + 8) * p.s, (ASPHALT_END - ASPHALT) * p.s, { fill: ASPHALT_FILL, strokeWidth: 2.2, roughness: 0.7 });
  let kerbs = '';
  for (const y of [KERB, ASPHALT_END]) {
    for (let x = -4, k = 0; x < UNITS_W + 4; x += 16, k++) {
      const [kx, ky] = at(p, x, y);
      const w = Math.min(16, UNITS_W + 4 - x);
      kerbs += `<rect x="${num(kx)}" y="${num(ky)}" width="${num(w * p.s)}" height="${num(4 * p.s)}" fill="${k % 2 ? '#fff' : KERB_RED}"/>`;
    }
  }
  let dashes = '';
  for (let x = 4; x < UNITS_W - 8; x += 28) {
    const [dx, dy] = at(p, x, (ASPHALT + ASPHALT_END) / 2 - 1);
    dashes += `<rect x="${num(dx)}" y="${num(dy)}" width="${num(14 * p.s)}" height="${num(2 * p.s)}" fill="#f4f4f4" opacity="0.8"/>`;
  }
  return `<g data-part="track">${grass}${asphalt}${kerbs}${dashes}</g>`;
}

/** The trophy shelf: a back panel with three compartments, a hook above each medal place and boards to stand trophies on. */
function shelf(sk: Sketch, p: Placement): string {
  const back = sk.rect(...at(p, SHELF_X0, ROW_TOP), (SHELF_X1 - SHELF_X0) * p.s, (SHELF_BOTTOM - ROW_TOP) * p.s, { fill: SHELF_BACK, strokeWidth: 2.4, roughness: 0.7 });
  let boards = sk.rect(...at(p, SHELF_X0 - 4, SHELF_TOP), (SHELF_X1 - SHELF_X0 + 8) * p.s, BOARD * p.s, { fill: WOOD, strokeWidth: 2.2, roughness: 0.6 });
  for (let r = 0; r < ROWS; r++) boards += sk.rect(...at(p, SHELF_X0, rowTop(r) + ROW_H - BOARD), (SHELF_X1 - SHELF_X0) * p.s, BOARD * p.s, { fill: WOOD, strokeWidth: 2, roughness: 0.6 });
  const sides = sk.rect(...at(p, SHELF_X0 - 2, SHELF_TOP), 5 * p.s, (GROUND + 2 - SHELF_TOP) * p.s, { fill: WOOD_DARK, strokeWidth: 1.8, roughness: 0.5 }) +
    sk.rect(...at(p, SHELF_X1 - 3, SHELF_TOP), 5 * p.s, (GROUND + 2 - SHELF_TOP) * p.s, { fill: WOOD_DARK, strokeWidth: 1.8, roughness: 0.5 });
  let hooks = '';
  for (const [x, y] of HOOKS) {
    const [hx, hy] = at(p, x, y);
    hooks += `<circle cx="${num(hx)}" cy="${num(hy)}" r="${num(1.8 * p.s)}" fill="${WOOD_DARK}"/>`;
  }
  return `<g data-part="shelf">${back}${boards}${sides}${hooks}</g>`;
}

/** A three-step podium beside the shelf: the winner's step in the middle, with a star. */
function podium(sk: Sketch, p: Placement): string {
  const steps: [number, number, number][] = [[203, 174, 24], [227, 160, 24], [251, 184, 26]];
  let out = '';
  steps.forEach(([x, y, w], i) => {
    out += sk.rect(...at(p, x, y), w * p.s, (GROUND + 4 - y) * p.s, { fill: STEPS[i], strokeWidth: 2.2, roughness: 0.6 });
  });
  const [sx, sy] = at(p, 239, 178);
  const r = 6 * p.s;
  const star: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    star.push([sx + rr * Math.cos(a), sy + rr * Math.sin(a)]);
  }
  return `<g data-part="podium">${out}<polygon points="${points(star)}" fill="${GOLD}" stroke="${INK}" stroke-width="1"/></g>`;
}

const FLAG_X = 290;
const FLAG_TOP = 28;
const FLAG_COLS = 7;
const FLAG_ROWS = 5;
const SQUARE = 4;

/** A chequered flag on a pole at the right; the cloth waves from the pole. */
function flag(sk: Sketch, p: Placement, seedKey: string): string {
  const pole = sk.rect(...at(p, FLAG_X - 3, FLAG_TOP - 4), 3 * p.s, (GROUND + 6 - FLAG_TOP) * p.s, { fill: '#9aa0a8', strokeWidth: 1.6, roughness: 0.4 });
  const [kx, ky] = at(p, FLAG_X - 1.5, FLAG_TOP - 5);
  const knob = `<circle cx="${num(kx)}" cy="${num(ky)}" r="${num(2.6 * p.s)}" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>`;
  let squares = '';
  for (let r = 0; r < FLAG_ROWS; r++) {
    for (let c = 0; c < FLAG_COLS; c++) {
      const [x, y] = at(p, FLAG_X + c * SQUARE, FLAG_TOP + r * SQUARE);
      squares += `<rect x="${num(x)}" y="${num(y)}" width="${num(SQUARE * p.s)}" height="${num(SQUARE * p.s)}" fill="${(r + c) % 2 ? '#fff' : INK}"/>`;
    }
  }
  const edge = sk.rect(...at(p, FLAG_X, FLAG_TOP), FLAG_COLS * SQUARE * p.s, FLAG_ROWS * SQUARE * p.s, { strokeWidth: 1.8, roughness: 0.5 });
  const cloth = `<g class="fb-anim fb-racing-flag" style="${timing(`${seedKey}:flag`, [2.6, 3.2])}">${squares}${edge}</g>`;
  return `<g data-part="flag">${pole}${knob}${cloth}</g>`;
}

const REAR = 136; // wheel centres
const FRONT = 190;
const AXLE = 248;
const WHEEL_R = 9;

/** A spoked hub that turns while the car rolls; it shares the roll's timing so both stay in step. */
function hub(p: Placement, x: number, t: string): string {
  const [cx, cy] = at(p, x, AXLE);
  const r = 4.5 * p.s;
  const spokes = `<line x1="${num(cx - r)}" y1="${num(cy)}" x2="${num(cx + r)}" y2="${num(cy)}" stroke="${INK}" stroke-width="1.4"/>` +
    `<line x1="${num(cx)}" y1="${num(cy - r)}" x2="${num(cx)}" y2="${num(cy + r)}" stroke="${INK}" stroke-width="1.4"/>`;
  return `<g class="fb-anim fb-racing-spin" style="${t}"><circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${HUB}" stroke="${INK}" stroke-width="1.2"/>${spokes}</g>`;
}

/** A generic open-wheel race car in the kid's colour, seen from the side, nose to the right. Not a counted item. */
function car(sk: Sketch, p: Placement, colour: string, seedKey: string): string {
  const t = timing(`${seedKey}:roll`, [14, 16]);
  const wing = sk.line(...at(p, 122, 238), ...at(p, 122, 225), { strokeWidth: 2, roughness: 0.3 }) +
    sk.rect(...at(p, 113, 221), 16 * p.s, 5 * p.s, { fill: colour, strokeWidth: 2, roughness: 0.4 });
  const body = sk.polygon([at(p, 120, 249), at(p, 120, 237), at(p, 146, 234), at(p, 154, 226), at(p, 172, 226), at(p, 180, 236), at(p, 214, 241), at(p, 214, 249)], { fill: colour, strokeWidth: 2.4, roughness: 0.6 });
  const stripe = `<polyline points="${points([at(p, 124, 243), at(p, 210, 245)])}" fill="none" stroke="#fff" stroke-width="${num(2.2 * p.s)}" stroke-linecap="round"/>`;
  const [hx, hy] = at(p, 162, 224);
  const helmet = `<circle cx="${num(hx)}" cy="${num(hy)}" r="${num(6.5 * p.s)}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>` +
    `<rect x="${num(hx + 1 * p.s)}" y="${num(hy - 2.5 * p.s)}" width="${num(5 * p.s)}" height="${num(3 * p.s)}" rx="${num(1.2 * p.s)}" fill="#4a5a70"/>`;
  const wheels = sk.circle(...at(p, REAR, AXLE), 2 * WHEEL_R * p.s, { fill: TYRE, strokeWidth: 1.8, roughness: 0.5 }) +
    sk.circle(...at(p, FRONT, AXLE), 2 * WHEEL_R * p.s, { fill: TYRE, strokeWidth: 1.8, roughness: 0.5 });
  return `<g data-part="car"><g class="fb-anim fb-racing-roll" style="${t}">${wing}${helmet}${body}${stripe}${wheels}${hub(p, REAR, t)}${hub(p, FRONT, t)}</g></g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const front = createSketch(`${ctx.seedKey}:front`);
  const p = placement(ctx.box);
  const colour = ctx.kid.colour;
  return `<g>${clouds(p)}${track(sk, p)}${shelf(sk, p)}${podium(sk, p)}${items(sk, p, ctx)}` +
    `${flag(front, p, ctx.seedKey)}${car(front, p, colour, ctx.seedKey)}</g>`;
}

const css = `
  @keyframes fb-racing-flag {
    0%, 100% { transform: skewY(0deg) scaleX(1); }
    25% { transform: skewY(-5deg) scaleX(0.95); }
    50% { transform: skewY(0deg) scaleX(1); }
    75% { transform: skewY(5deg) scaleX(0.96); }
  }
  @keyframes fb-racing-roll {
    0%, 84%, 100% { transform: translateX(0); }
    89%, 92% { transform: translateX(${ROLL}px); }
  }
  @keyframes fb-racing-spin {
    0%, 84%, 100% { transform: rotate(0deg); }
    89%, 92% { transform: rotate(110deg); }
  }
  .fb-racing-flag { animation-name: fb-racing-flag; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 0% 50%; }
  .fb-racing-roll { animation-name: fb-racing-roll; animation-timing-function: ease-in-out; }
  .fb-racing-spin { animation-name: fb-racing-spin; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
`;

export const racing: Theme = {
  id: 'racing',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  css,
};
