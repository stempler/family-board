import { timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { item, type HalfContext, type Theme } from './types';

// A sunny yard with a dog house, drawn in "yard units": a round-eared pup in a
// scarf of the kid's colour sits on the left, the dog house stands in the
// middle and bones pile up on the right. Gold paw badges (big items) hang on
// nails on the dog house wall; more badges than nails hang on strings from
// the roof to a pole on the right, each in its own fixed spot. The
// pile fills bottom row first, centre outwards, so nothing moves once it has
// landed. A plain, generic dog house: no tower, no letters, no vehicles.
const MID = 160;
const UNITS_W = 320;
const TOP = 14; // top of the sun
const GROUND = 240; // where the house, the pup and the pile stand
const BOTTOM = 258; // bottom of the grass strip
const UNITS_H = BOTTOM - TOP;

type Pt = [number, number];

/** Nails on the dog house wall, in filling order: a row under the roof, the gable, then beside the door. */
const NAILS: Pt[] = [[101, 132], [125, 132], [79, 132], [147, 132], [113, 98], [82, 174], [144, 174], [82, 210], [144, 210]];

/** Strings from the right roof slope to the pole; the y of each string and how many badges hang on it. */
const STRINGS: { y: number; n: number }[] = [{ y: 60, n: 8 }, { y: 86, n: 7 }, { y: 112, n: 6 }];
const POLE_X = 316;
const ROOF_PEAK: Pt = [113, 52];
const ROOF_EAVE: Pt = [171, 118];
const roofX = (y: number) => ROOF_PEAK[0] + ((y - ROOF_PEAK[1]) * (ROOF_EAVE[0] - ROOF_PEAK[0])) / (ROOF_EAVE[1] - ROOF_PEAK[1]);
/** Spots for badges beyond the nails, string by string, left to right; a badge hangs 11 units below its string, clear of the roof. */
const HANGS: Pt[] = STRINGS.flatMap(({ y, n }) => Array.from({ length: n }, (_, k): Pt => [roofX(y + 20) + 14 + k * 20, y]));

const PILE_X = 236; // centre of the bone pile
const PITCH_X = 26;
const PITCH_Y = 15;
const BONE_K = 1; // bone size: 23 x 13 units, so neighbours never touch
const ROWS = [6, 5, 5, 4, 4, 3, 2, 1]; // bones per row from the bottom up; capacity is their sum
const CAPACITY = ROWS.reduce((a, b) => a + b, 0);

/** Pile slots, bottom row first, each row filled centre outwards; a small fixed tilt per slot makes it look piled. */
function pileSlots(): { x: number; y: number; a: number }[] {
  const slots: { x: number; y: number; a: number }[] = [];
  const outward = (n: number) => Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) || a - b);
  ROWS.forEach((n, row) => {
    for (const k of outward(n)) {
      const a = ((k * 7 + row * 5) % 3 - 1) * 3; // -3..3 degrees, fixed per slot
      slots.push({ x: PILE_X + (k - (n - 1) / 2) * PITCH_X, y: GROUND - 8 - row * PITCH_Y, a });
    }
  });
  return slots;
}

const PILE = pileSlots();

const SKY = '#dcedf6';
const GRASS = '#8cc66b';
const GRASS_DARK = '#6aa84f';
const SUN = '#ffd95e';
const CLOUD = '#ffffff';
const WALL = '#7fb8a4';
const WALL_LINE = '#5f9884';
const ROOF = '#7a4a2a';
const DOOR = '#3b2a22';
const GOLD = '#f2c12e';
const BONE = '#f7efdc';
const FUR = '#d9a066';
const FUR_DARK = '#8a5a35';
const FUR_LIGHT = '#f6e3c6';
const TONGUE = '#ef8a8a';

const SCENE_TOP = 0.17; // leave room for the board header
const SCENE_BOTTOM = 0.79; // leave room for the jar row

interface Placement { cx: number; top: number; s: number }

function at(p: Placement, x: number, y: number): Pt {
  return [p.cx + (x - MID) * p.s, p.top + (y - TOP) * p.s];
}

/** Rewrites every "x y" pair of a path in yard units into board coordinates. */
function moved(p: Placement, d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => at(p, +x, +y).map(num).join(' '));
}

/** Like `moved`, for a path drawn around (0, 0): scaled by `k`, turned by `deg` and centred on (cx, cy). */
function shape(p: Placement, cx: number, cy: number, k: number, deg: number, d: string): string {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => at(p, cx + k * (x * c - y * s), cy + k * (x * s + y * c)).map(num).join(' '));
}

/** Fits the yard into the scene band of `box`, horizontally centred. */
function placement(box: Box): Placement {
  const top = box.y + box.h * SCENE_TOP;
  const height = box.h * (SCENE_BOTTOM - SCENE_TOP);
  const s = Math.min(height / UNITS_H, (box.w * 0.92) / UNITS_W);
  return { cx: box.x + box.w / 2, top: top + (height - UNITS_H * s), s };
}

const BONE_D = 'M -6 -2.4 L 6 -2.4 C 6 -6.5 12 -6.5 11 -2 C 10.5 -0.8 10.5 0.8 11 2 C 12 6.5 6 6.5 6 2.4 L -6 2.4 C -6 6.5 -12 6.5 -11 2 C -10.5 0.8 -10.5 -0.8 -11 -2 C -12 -6.5 -6 -6.5 -6 -2.4 Z';

function bone(sk: Sketch, p: Placement, x: number, y: number, a: number): string {
  return sk.path(shape(p, x, y, BONE_K, a, BONE_D), { fill: BONE, strokeWidth: 1.8, roughness: 0.6 });
}

/** A plain gold paw print centred on (x, y), scaled by `k`: one pad and four toes. */
function paw(sk: Sketch, p: Placement, x: number, y: number, k: number): string {
  const style = { fill: GOLD, strokeWidth: 1.5, roughness: 0.4 };
  let out = sk.ellipse(...at(p, x, y + 3.5 * k), 12.5 * k * p.s, 10 * k * p.s, style);
  for (const [dx, dy] of [[-6.6, -2.4], [-2.5, -6.8], [2.5, -6.8], [6.6, -2.4]]) out += sk.ellipse(...at(p, x + dx * k, y + dy * k), 5 * k * p.s, 6 * k * p.s, style);
  const [hx, hy] = at(p, x - 2.5 * k, y + 2 * k);
  return `${out}<ellipse cx="${num(hx)}" cy="${num(hy)}" rx="${num(2.4 * k * p.s)}" ry="${num(1.4 * k * p.s)}" fill="#fff6c2" opacity="0.85"/>`;
}

/** Badge spot `i`: the nails first, then the strings. */
const badgeSpot = (i: number): Pt => (i < NAILS.length ? NAILS[i] : HANGS[i - NAILS.length]);

/** Badges first, each in its own fixed spot (nails, then strings); bones fill the pile from the bottom with their own sketch, so a bone never moves or re-wobbles when a badge is added. */
function items(sk: Sketch, bones: Sketch, p: Placement, ctx: HalfContext): string {
  const { big, small } = ctx.groups;
  let out = '';
  for (let i = 0; i < big && i < CAPACITY; i++) {
    const [x, y] = badgeSpot(i);
    out += item('big', i, ctx, paw(sk, p, x, y + 11, i < NAILS.length ? 1.05 : 0.95));
  }
  for (let j = 0; j < small && big + j < CAPACITY; j++) {
    const { x, y, a } = PILE[j];
    out += item('small', big + j, ctx, bone(bones, p, x, y, a));
  }
  return out;
}

/** The pole and the strings that carry badges beyond the nails; only strings that hold a badge are drawn. Own sketch, so it never shifts other wobble. */
function strings(sk: Sketch, p: Placement, big: number): string {
  const used = STRINGS.filter((_, r) => big > NAILS.length + STRINGS.slice(0, r).reduce((n, s) => n + s.n, 0));
  if (!used.length) return '';
  const pole = sk.rect(...at(p, POLE_X - 2.5, STRINGS[0].y - 8), 5 * p.s, (GROUND - STRINGS[0].y + 8) * p.s, { fill: ROOF, strokeWidth: 1.8, roughness: 0.5 });
  let lines = '';
  for (const { y } of used) lines += sk.path(moved(p, `M ${num(roofX(y))} ${y} Q ${num((roofX(y) + POLE_X) / 2)} ${y + 3} ${POLE_X} ${y}`), { strokeWidth: 1.4, roughness: 0.4 });
  return `<g data-part="strings">${lines}${pole}</g>`;
}

function sky(sk: Sketch, p: Placement): string {
  const [sx, sy] = at(p, 296, 32);
  const sun = `<circle cx="${num(sx)}" cy="${num(sy)}" r="${num(22 * p.s)}" fill="${SUN}" opacity="0.35"/>` + sk.circle(sx, sy, 30 * p.s, { fill: SUN, stroke: '#e0a92e', strokeWidth: 1.8, roughness: 0.6 });
  const cloud = sk.path(moved(p, 'M 12 52 C 6 52 4 40 14 40 C 16 30 32 28 36 38 C 44 32 56 38 52 46 C 60 48 58 56 50 56 L 16 56 C 12 56 10 54 12 52 Z'), { fill: CLOUD, stroke: '#b9cfdc', strokeWidth: 1.6, roughness: 0.6 });
  return `<g data-part="sky">${sun}${cloud}</g>`;
}

function ground(sk: Sketch, p: Placement): string {
  const grass = sk.rect(...at(p, 0, GROUND), UNITS_W * p.s, (BOTTOM - GROUND) * p.s, { fill: GRASS, strokeWidth: 2, roughness: 0.8 });
  let tufts = '';
  for (const x of [4, 160, 300]) tufts += sk.path(moved(p, `M ${x} ${GROUND} L ${x + 3} ${GROUND - 7} M ${x + 5} ${GROUND} L ${x + 6} ${GROUND - 9} M ${x + 9} ${GROUND} L ${x + 11} ${GROUND - 6}`), { stroke: GRASS_DARK, strokeWidth: 1.8, roughness: 0.4 });
  return `<g data-part="ground">${grass}${tufts}</g>`;
}

/** A painted dog house with a pitched roof and an arched door; the nails for the badges are part of the wall. */
function house(sk: Sketch, p: Placement): string {
  const gable = sk.polygon([at(p, 68, 112), at(p, 113, 66), at(p, 158, 112)], { fill: WALL, strokeWidth: 2.2, roughness: 0.6 });
  const wall = sk.rect(...at(p, 68, 112), 90 * p.s, (GROUND - 112) * p.s, { fill: WALL, strokeWidth: 2.4, roughness: 0.7 });
  let boards = '';
  for (const y of [152, 192, 228]) {
    const [x0, yy] = at(p, 70, y);
    const [x1] = at(p, 156, y);
    boards += `<line x1="${num(x0)}" y1="${num(yy)}" x2="${num(x1)}" y2="${num(yy)}" stroke="${WALL_LINE}" stroke-width="${num(1.2 * p.s)}" opacity="0.6"/>`;
  }
  const door = sk.path(moved(p, `M 96 ${GROUND} L 96 186 C 96 162 130 162 130 186 L 130 ${GROUND} Z`), { fill: DOOR, strokeWidth: 2.4, roughness: 0.6 });
  const roof = sk.polygon([at(p, 55, 118), at(p, 113, 52), at(p, 113, 65), at(p, 66, 120)], { fill: ROOF, strokeWidth: 2.4, roughness: 0.7 }) +
    sk.polygon([at(p, 171, 118), at(p, 113, 52), at(p, 113, 65), at(p, 160, 120)], { fill: ROOF, strokeWidth: 2.4, roughness: 0.7 });
  let nails = '';
  for (const [x, y] of NAILS) {
    const [nx, ny] = at(p, x, y);
    nails += `<circle cx="${num(nx)}" cy="${num(ny)}" r="${num(1.8 * p.s)}" fill="${INK}"/>`;
  }
  return `<g data-part="house">${gable}${wall}${boards}${door}${roof}${nails}</g>`;
}

/** A round-eared pup sitting left of the house: the tail wags, the left ear twitches now and then and the head tilts every so often. */
function pup(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const fur = { fill: FUR, strokeWidth: 2.2, roughness: 0.7 };
  const tailShape = sk.path(moved(p, 'M 50 230 Q 68 228 66 204 Q 61 205 61 211 Q 61 222 48 222 Z'), fur);
  const tail = `<g class="fb-anim fb-rescue-wag" style="${timing(`${ctx.seedKey}:wag`, [2.2, 2.8])}">${tailShape}</g>`;
  const body = sk.ellipse(...at(p, 34, 211), 48 * p.s, 56 * p.s, fur);
  const belly = sk.ellipse(...at(p, 34, 218), 24 * p.s, 34 * p.s, { fill: FUR_LIGHT, strokeWidth: 1.2, roughness: 0.5 });
  const hind = sk.ellipse(...at(p, 14, 236), 22 * p.s, 10 * p.s, fur) + sk.ellipse(...at(p, 54, 236), 22 * p.s, 10 * p.s, fur);
  const legs = sk.rect(...at(p, 23, 200), 9 * p.s, 37 * p.s, fur) + sk.rect(...at(p, 36, 200), 9 * p.s, 37 * p.s, fur);
  const paws = sk.ellipse(...at(p, 27.5, 237), 13 * p.s, 7 * p.s, { fill: FUR_LIGHT, strokeWidth: 1.6, roughness: 0.4 }) +
    sk.ellipse(...at(p, 40.5, 237), 13 * p.s, 7 * p.s, { fill: FUR_LIGHT, strokeWidth: 1.6, roughness: 0.4 });
  const colour = ctx.kid.colour;
  const scarf = sk.polygon([at(p, 13, 181), at(p, 55, 181), at(p, 53, 192), at(p, 15, 192)], { fill: colour, strokeWidth: 2, roughness: 0.5 }) +
    sk.path(moved(p, 'M 41 191 C 37 198 35 203 38 206 C 41 207 43 201 44 194 Z'), { fill: colour, strokeWidth: 1.8, roughness: 0.4 }) +
    sk.path(moved(p, 'M 47 191 C 50 198 53 202 51 205 C 48 207 46 201 45 194 Z'), { fill: colour, strokeWidth: 1.8, roughness: 0.4 }) +
    sk.ellipse(...at(p, 44, 190), 10 * p.s, 8 * p.s, { fill: colour, strokeWidth: 1.8, roughness: 0.4 });

  const head = sk.ellipse(...at(p, 34, 160), 48 * p.s, 42 * p.s, fur);
  const ear = (x: number) => sk.ellipse(...at(p, x, 165), 14 * p.s, 28 * p.s, { fill: FUR_DARK, strokeWidth: 2, roughness: 0.6 });
  const leftEar = `<g class="fb-anim fb-rescue-ear" style="${timing(`${ctx.seedKey}:ear`, [7.5, 8.5])}">${ear(11)}</g>`;
  const muzzle = sk.ellipse(...at(p, 34, 170), 24 * p.s, 15 * p.s, { fill: FUR_LIGHT, strokeWidth: 1.4, roughness: 0.4 });
  let eyes = '';
  for (const x of [25, 43]) {
    const [ex, ey] = at(p, x, 156);
    eyes += `<circle cx="${num(ex)}" cy="${num(ey)}" r="${num(3.4 * p.s)}" fill="${INK}"/><circle cx="${num(ex - 1 * p.s)}" cy="${num(ey - 1.1 * p.s)}" r="${num(1.1 * p.s)}" fill="#fff"/>`;
  }
  const [nx, ny] = at(p, 34, 165);
  const nose = `<ellipse cx="${num(nx)}" cy="${num(ny)}" rx="${num(4.2 * p.s)}" ry="${num(2.8 * p.s)}" fill="${INK}"/>`;
  const tongue = sk.path(moved(p, 'M 32 174 Q 32 180 34 180 Q 36 180 36 174 Z'), { fill: TONGUE, strokeWidth: 1.2, roughness: 0.3 });
  const mouth = sk.path(moved(p, 'M 29 172 Q 31.5 175 34 172.5 Q 36.5 175 39 172'), { strokeWidth: 1.4, roughness: 0.3 });
  const headGroup = `<g class="fb-anim fb-rescue-tilt" style="${timing(`${ctx.seedKey}:tilt`, [13, 15])}">${head}${leftEar}${ear(57)}${muzzle}${tongue}${mouth}${nose}${eyes}</g>`;
  return `<g data-part="pup">${tail}${body}${belly}${hind}${legs}${paws}${scarf}${headGroup}</g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box);
  // The pup is drawn last with its own sketch, so adding an item never changes its wobble.
  return `<g>${sky(sk, p)}${ground(sk, p)}${house(sk, p)}${strings(createSketch(`${ctx.seedKey}:strings`), p, ctx.groups.big)}${items(sk, createSketch(`${ctx.seedKey}:bones`), p, ctx)}${pup(createSketch(`${ctx.seedKey}:pup`), p, ctx)}</g>`;
}

const css = `
  @keyframes fb-rescue-wag {
    0%, 100% { transform: rotate(-7deg); }
    50% { transform: rotate(7deg); }
  }
  @keyframes fb-rescue-ear {
    0%, 90%, 100% { transform: rotate(0deg); }
    93% { transform: rotate(-14deg); }
    96% { transform: rotate(5deg); }
  }
  @keyframes fb-rescue-tilt {
    0%, 70%, 96%, 100% { transform: rotate(0deg); }
    76%, 90% { transform: rotate(-10deg); }
  }
  .fb-rescue-wag { animation-name: fb-rescue-wag; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 0% 100%; }
  .fb-rescue-ear { animation-name: fb-rescue-ear; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 8%; }
  .fb-rescue-tilt { animation-name: fb-rescue-tilt; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
`;

export const rescue: Theme = {
  id: 'rescue',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  css,
};
