import { timing } from '../draw/anim';
import { createSketch, num, type Sketch } from '../draw/sketch';
import { around, at, moved, placement, points, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A building site, drawn in "site units": bare earth from the horizon (y 100) down. A yellow excavator
// with a cab stripe in the kid colour digs at a heap of earth on the left; at the right a wall rises from
// a concrete foundation, red clay bricks laid in running bond from the bottom left. A barrier with a
// warning light and a traffic cone stand at the back. Pallets stacked with bricks stand on the earth in front
// of the wall and the excavator: a front row of six big ones first, then two rows of twelve smaller ones behind.
const MID = 160;
const UNITS_W = 320;
const UNITS_H = 260;
const UNITS: Units = { mid: MID, top: 0, w: UNITS_W, h: UNITS_H, fill: 0.92 };
const HORIZON = 100;

const SKY = '#cfe7f7';
const EARTH = '#c99d6e';
const EARTH_DARK = '#9c7148';
const YELLOW = '#f4c20d';
const YELLOW_DARK = '#b88a00';
const STEEL = '#4d4d4d';
const STEEL_LIGHT = '#8a8a8a';
const WINDOW = '#bfe3f5';
const BRICK = '#c0502e';
const BRICK_DARK = '#7d2c15';
const WOOD = '#d6a66b';
const WOOD_DARK = '#8b5e34';
const CONCRETE = '#bdbab2';
const ORANGE = '#f07f1d';
const RED = '#d83a2e';
const WHITE = '#ffffff';
const LAMP = '#ffb000';

const BRICK_W = 22; // a brick in the wall: 22 x 10 units, laid with 3-unit joints
const BRICK_H = 10;
const BOND_X = 25; // a brick and its joint
const BOND_Y = 13;
const PER_ROW = 5;
const ROWS = 6;
const WALL_X = 176; // left edge of the bottom row
const WALL_BASE = 186; // top of the foundation
const WALL_MID = WALL_X + (BOND_X * PER_ROW + BOND_X / 2) / 2;

const PALLET_W = 28; // a pallet stacked with bricks at scale 1: 28 x 20 units
const PALLET_H = 20;
const BIG = 1.5; // the front row: 42 x 30, three bricks tall, so a pallet reads as "ten"
const BACK = 0.8; // the rows behind: 22.4 x 16, still clearly bigger than a brick

/** `n` pallet spots [x, y, scale] at scale `k` in a row centred on `y` and on the half, 2.5 units apart, the one nearest the wall's middle first. */
const palletRow = (n: number, y: number, k: number): [number, number, number][] =>
  Array.from({ length: n }, (_, i): [number, number, number] => [MID + (PALLET_W * k + 2.5) * (i - (n - 1) / 2), y, k])
    .sort((a, b) => Math.abs(a[0] - WALL_MID) - Math.abs(b[0] - WALL_MID));

/** Pallet spots: the big front row first, then the back rows, the one nearer the wall first; 30, as many as the grouping can ask for. */
const PALLETS: [number, number, number][] = [
  ...palletRow(6, 259.5 - (PALLET_H * BIG) / 2, BIG),
  ...palletRow(12, 193 + (PALLET_H * BACK) / 2, BACK),
  ...palletRow(12, 211 + (PALLET_H * BACK) / 2, BACK),
];

/** Brick spots in the wall: row by row from the bottom, left to right; every second row offset by half a brick. */
const BRICKS: Pt[] = Array.from({ length: ROWS * PER_ROW }, (_, i): Pt => {
  const [r, c] = [Math.floor(i / PER_ROW), i % PER_ROW];
  return [WALL_X + BRICK_W / 2 + BOND_X * c + (r % 2) * (BOND_X / 2), WALL_BASE - BRICK_H / 2 - BOND_Y * r];
});

const CAPACITY = BRICKS.length;

export interface Spot { kind: 'big' | 'small'; x: number; y: number; k: number } // site units, centre of the footprint; k scales a pallet

/** Where the items go: pallets on their spots, bricks into the wall, both in order. */
export function spots(big: number, small: number): Spot[] {
  return [
    ...PALLETS.slice(0, big).map(([x, y, k]): Spot => ({ kind: 'big', x, y, k })),
    ...BRICKS.slice(0, small).map(([x, y]): Spot => ({ kind: 'small', x, y, k: 1 })),
  ];
}

/** The box a drawn item covers, in site units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [w, h] = s.kind === 'big' ? [PALLET_W * s.k, PALLET_H * s.k] : [BRICK_W, BRICK_H];
  return [s.x - w / 2, s.y - h / 2, s.x + w / 2, s.y + h / 2];
}

/** A line from a to b in units, `w` px wide at scale 1. */
function stroke(p: Placement, a: Pt, b: Pt, colour: string, w: number): string {
  const [x0, y0] = at(p, ...a);
  const [x1, y1] = at(p, ...b);
  return `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}" stroke="${colour}" stroke-width="${num(Math.max(0.6, w * p.s))}" stroke-linecap="round"/>`;
}

/** A clay brick centred on (x, y) in units, with a pale edge along its top. */
function brick(sk: Sketch, p: Placement, x: number, y: number): string {
  const [l, t] = [x - BRICK_W / 2, y - BRICK_H / 2];
  const body = sk.rect(...at(p, l, t), BRICK_W * p.s, BRICK_H * p.s, { fill: BRICK, stroke: BRICK_DARK, strokeWidth: 1.4, roughness: 0.4 });
  return body + stroke(p, [l + 3, t + 2.2], [l + BRICK_W - 6, t + 2.2], '#e2876a', 1.2);
}

/** A wooden pallet with its footprint centred on (x, y) in units, scaled by `k`: a deck on three blocks, stacked with two layers of bricks. */
function pallet(sk: Sketch, p: Placement, x: number, y: number, k: number): string {
  const [w, h] = [PALLET_W * k, PALLET_H * k];
  const [l, t, b] = [x - w / 2, y - h / 2, y + h / 2];
  const blocks = [l + k, x - 2.5 * k, l + w - 6 * k].map((bx) =>
    `<rect x="${num(at(p, bx, 0)[0])}" y="${num(at(p, 0, b - 3 * k)[1])}" width="${num(5 * k * p.s)}" height="${num(3 * k * p.s)}" fill="${WOOD_DARK}"/>`).join('');
  const deck = sk.rect(...at(p, l, b - 6 * k), w * p.s, 3 * k * p.s, { fill: WOOD, stroke: WOOD_DARK, strokeWidth: 1.2, roughness: 0.3 });
  const stack = sk.rect(...at(p, l + 1.5 * k, t), (w - 3 * k) * p.s, (h - 6 * k) * p.s, { fill: BRICK, stroke: BRICK_DARK, strokeWidth: 1.6, roughness: 0.4 });
  // Joints: one bed joint between the layers, three bricks in the lower layer and two and two halves in the upper one.
  const [sl, sr] = [l + 1.5 * k, l + w - 1.5 * k];
  const mid = t + (h - 6 * k) / 2;
  const w3 = (sr - sl) / 3;
  const joints = [
    stroke(p, [sl, mid], [sr, mid], BRICK_DARK, 1),
    ...[1, 2].map((i) => stroke(p, [sl + i * w3, mid], [sl + i * w3, b - 6 * k], BRICK_DARK, 1)),
    ...[0.5, 1.5, 2.5].map((i) => stroke(p, [sl + i * w3, t], [sl + i * w3, mid], BRICK_DARK, 1)),
  ].join('');
  return blocks + deck + stack + joints;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) =>
    s.kind === 'big' ? item('big', i, ctx, pallet(sk, p, s.x, s.y, s.k)) : item('small', i, ctx, brick(sk, p, s.x, s.y)),
  ).join('');
}

const CLODS: Pt[] = [[22, 232], [116, 214], [204, 252], [262, 206], [150, 240], [300, 232], [70, 256], [236, 228]];

/** Bare earth from the horizon down across the whole half, a few clods, and the heap the excavator digs at. */
function ground(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  const [, edge] = at(p, 0, HORIZON);
  const [, bottom] = at(p, 0, UNITS_H);
  const fill = `<rect x="${num(box.x)}" y="${num(edge)}" width="${num(box.w)}" height="${num(bottom - edge)}" fill="${EARTH}"/>`;
  const line = sk.line(box.x + 3, edge, box.x + box.w - 3, edge, { stroke: EARTH_DARK, strokeWidth: 1.8, roughness: 0.8 });
  const clods = CLODS.map(([x, y]) => {
    const [cx, cy] = at(p, x, y);
    return `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(4 * p.s)}" ry="${num(1.8 * p.s)}" fill="${EARTH_DARK}" opacity="0.6"/>`;
  }).join('');
  const heap = sk.path(moved(p, 'M 2 188 Q 6 162 24 156 Q 40 152 54 166 L 58 188 Z'), { fill: EARTH_DARK, stroke: '#7a5634', strokeWidth: 1.6, roughness: 0.8 });
  return `<g data-part="ground">${fill}${line}${clods}${heap}</g>`;
}

/** The concrete foundation the wall rises from. */
function wall(sk: Sketch, p: Placement): string {
  const slab = sk.rect(...at(p, WALL_X - 6, WALL_BASE), (BOND_X * PER_ROW + BOND_X / 2 + 9) * p.s, 5 * p.s, { fill: CONCRETE, stroke: '#7f7c75', strokeWidth: 1.4, roughness: 0.4 });
  return `<g data-part="wall">${slab}</g>`;
}

const JOINT: Pt = [70, 142]; // where the boom meets the excavator, at the front of the cab
const ELBOW: Pt = [44, 70];
const BUCKET: Pt = [22, 122];

/** A beam from a to b, `w` units thick, as a polygon in units. */
function beam(a: Pt, b: Pt, w: number): Pt[] {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [nx, ny] = [(-dy / len) * (w / 2), (dx / len) * (w / 2)];
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
}

/** The excavator's boom, stick and bucket; it swings slowly up and down around the joint at the cab. */
function arm(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const pin = ([x, y]: Pt) => {
    const [cx, cy] = at(p, x, y);
    return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(2.6 * p.s)}" fill="${STEEL}"/>`;
  };
  const piston = stroke(p, [80, 146], [58, 104], STEEL_LIGHT, 3);
  const boom = sk.polygon(beam(JOINT, ELBOW, 10).map(([x, y]) => at(p, x, y)), { fill: YELLOW, stroke: YELLOW_DARK, strokeWidth: 1.8, roughness: 0.4 });
  const stick = sk.polygon(beam(ELBOW, BUCKET, 7).map(([x, y]) => at(p, x, y)), { fill: YELLOW, stroke: YELLOW_DARK, strokeWidth: 1.6, roughness: 0.4 });
  const bucket = sk.polygon(around(p, ...BUCKET, [[-6, -6], [12, 0], [10, 14], [0, 20], [-14, 18]]), { fill: STEEL_LIGHT, stroke: STEEL, strokeWidth: 1.6, roughness: 0.4 });
  const teeth = ([[-14, 18], [-9, 19], [-4, 19.5]] as Pt[]).map(([dx, dy]) => stroke(p, [BUCKET[0] + dx, BUCKET[1] + dy], [BUCKET[0] + dx - 2, BUCKET[1] + dy + 3], STEEL, 1.6)).join('');
  const [ox, oy] = at(p, ...JOINT);
  const style = `${timing(`${ctx.seedKey}:arm`, [6, 9])};--ox:${num(ox)}px;--oy:${num(oy)}px`;
  return `<g class="fb-anim fb-construction-arm" style="${style}">${piston}${boom}${stick}${teeth}${bucket}${pin(ELBOW)}${pin(BUCKET)}${pin(JOINT)}</g>`;
}

/** A yellow excavator facing left: tracks, the house with a stripe in the kid colour, the cab with its window, and the arm. */
function excavator(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const tracks = sk.path(moved(p, 'M 52 168 L 142 168 Q 150 168 150 177 Q 150 186 142 186 L 52 186 Q 44 186 44 177 Q 44 168 52 168 Z'), { fill: STEEL, strokeWidth: 1.8, roughness: 0.4 });
  const wheels = [56, 76, 97, 118, 138].map((x) => {
    const [cx, cy] = at(p, x, 177);
    return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(5 * p.s)}" fill="${STEEL_LIGHT}" stroke="#2f2f2f" stroke-width="${num(Math.max(0.6, 1 * p.s))}"/>`;
  }).join('');
  const turntable = sk.rect(...at(p, 84, 164), 44 * p.s, 4 * p.s, { fill: STEEL, strokeWidth: 1.2, roughness: 0.3 });
  const house = sk.rect(...at(p, 62, 142), 86 * p.s, 23 * p.s, { fill: YELLOW, stroke: YELLOW_DARK, strokeWidth: 2, roughness: 0.4 });
  const stripe = sk.rect(...at(p, 63, 150), 84 * p.s, 6 * p.s, { fill: ctx.kid.colour, strokeWidth: 1.2, roughness: 0.3 });
  const cab = sk.path(moved(p, 'M 102 142 L 102 110 Q 102 106 106 106 L 134 106 Q 142 106 143 114 L 146 142 Z'), { fill: YELLOW, stroke: YELLOW_DARK, strokeWidth: 2, roughness: 0.4 });
  const glass = sk.path(moved(p, 'M 108 136 L 108 113 L 132 113 Q 136 113 137 118 L 139 136 Z'), { fill: WINDOW, stroke: STEEL, strokeWidth: 1.4, roughness: 0.3 });
  return `<g data-part="excavator">${tracks}${wheels}${turntable}${house}${stripe}${cab}${glass}${arm(sk, p, ctx)}</g>`;
}

/** A red and white striped barrier on two legs at the back with a blinking warning light on its left end, and a traffic cone beside it. */
function barrier(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const legs = ([[190, 182, 198], [272, 264, 280]] as [number, number, number][]).map(([x, x0, x1]) =>
    stroke(p, [x, 84], [x0, HORIZON], STEEL, 2) + stroke(p, [x, 84], [x1, HORIZON], STEEL, 2)).join('');
  const [bx, by] = at(p, 182, 80);
  const stripes = Array.from({ length: 8 }, (_, i) =>
    `<rect x="${num(bx + i * 12 * p.s)}" y="${num(by)}" width="${num(12 * p.s)}" height="${num(10 * p.s)}" fill="${i % 2 ? WHITE : RED}"/>`).join('');
  const board = sk.rect(bx, by, 96 * p.s, 10 * p.s, { strokeWidth: 1.6, roughness: 0.4 });
  const post = stroke(p, [188, 80], [188, 73], STEEL, 2);
  const [lx, ly] = at(p, 188, 68);
  const housing = `<circle cx="${num(lx)}" cy="${num(ly)}" r="${num(5.5 * p.s)}" fill="#7a4a00" stroke="${STEEL}" stroke-width="${num(Math.max(0.6, 1.2 * p.s))}"/>`;
  const lamp = `<circle cx="${num(lx)}" cy="${num(ly)}" r="${num(4.2 * p.s)}" fill="${LAMP}" class="fb-anim fb-construction-blink" style="${timing(`${ctx.seedKey}:blink`, [2, 3])}"/>`;
  const cone = sk.polygon(around(p, 302, 100, [[-9, 0], [-2, -22], [2, -22], [9, 0]]), { fill: ORANGE, stroke: '#a54d06', strokeWidth: 1.6, roughness: 0.4 });
  const band = `<polygon points="${points(around(p, 302, 100, [[-6.5, -8], [-4.3, -14], [4.3, -14], [6.5, -8]]))}" fill="${WHITE}"/>`;
  const foot = sk.rect(...at(p, 290, 99), 24 * p.s, 3 * p.s, { fill: ORANGE, stroke: '#a54d06', strokeWidth: 1.2, roughness: 0.3 });
  return `<g data-part="barrier">${legs}${stripes}${board}${post}${housing}${lamp}${cone}${band}${foot}</g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box, UNITS);
  // Items come last with their own sketch, so adding an item never re-wobbles the scenery.
  return `<g>${ground(sk, p, ctx)}${barrier(sk, p, ctx)}${wall(sk, p)}${excavator(sk, p, ctx)}${items(createSketch(`${ctx.seedKey}:items`), p, ctx)}</g>`;
}

const css = `
  @keyframes fb-construction-arm {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(9deg); }
  }
  @keyframes fb-construction-blink {
    0%, 45% { opacity: 1; }
    55%, 95% { opacity: 0.2; }
    100% { opacity: 1; }
  }
  .fb-construction-arm { animation-name: fb-construction-arm; animation-timing-function: ease-in-out; transform-box: view-box; transform-origin: var(--ox) var(--oy); }
  .fb-construction-blink { animation-name: fb-construction-blink; animation-timing-function: steps(1, end); }
`;

export const construction: Theme = {
  id: 'construction',
  label: 'Baustelle',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  css,
};
