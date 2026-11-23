import { particles, timing } from '../draw/anim';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { around, at, moved, placement, points, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A tower room at a wizard school, drawn in "room units": a tall hourglass on a
// table (centred on x HG_X), a candle on the left, an owl perched on a stack of
// books on the right below an arched night window. Gems fill the hourglass's
// lower bulb in fixed slots, bottom row first, centre outwards, so a gem never
// moves once it has landed.
const MID = 160; // centre of the room units
const UNITS_W = 320;
const TOP = 14; // top of the hourglass's top plate
const TABLE = 254; // table top; the hourglass, candle and books stand on it
const BOTTOM = 272; // bottom of the table's front edge
const UNITS_H = BOTTOM - TOP;
const UNITS: Units = { mid: MID, top: TOP, w: UNITS_W, h: UNITS_H, fill: 0.92 };

const HG_X = 148;
const NECK = 114; // narrowest point of the glass; high and with a full bell below it, so the top row of crystals stays inside
const BULB_BOTTOM = 240; // inner bottom of the lower bulb, top of the bottom plate
const UPPER_TOP = 28; // inner top of the upper bulb, bottom of the top plate
const BULB_HW = 92; // widest half-width of a bulb
const NECK_HW = 6;
const POST_X = 100; // posts stand this far left and right of HG_X

const PITCH_X = 22;
const PITCH_Y = 20;
const ROWS = [8, 7, 6, 5, 4]; // gems per row from the bottom up; capacity is their sum
const CAPACITY = ROWS.reduce((a, b) => a + b, 0);

const SAND = '#e9c46a';
const GLASS = '#eef5fb';
const WOOD = '#8b5a2b';
const WOOD_DARK = '#6b4423';
const TABLE_TOP = '#a8743f';
const WALL = '#e8e2ee';
const STONE = '#ddd4e6';
const STONE_EDGE = '#c6b9d3';
const NIGHT = '#2f3f73';
const MOON = '#fff1b8';
const WAX = '#f6eedb';
const FLAME = '#f6993f';
const FLAME_CORE = '#ffd95e';
const OWL = '#9c7a54';
const OWL_BELLY = '#ecdcb8';
const BEAK = '#f0a830';
const BOOKS = ['#7b5ea7', '#3f8f7f'];

/** Half-width of a bulb at distance `d` from the neck, for a bulb `len` units long: a bell that widens fast near the neck. */
function bulbHalfWidth(d: number, len: number): number {
  const t = Math.min(1, Math.max(0, d / len));
  return NECK_HW + (BULB_HW - NECK_HW) * (1 - (1 - t) ** 3.2);
}

/** Left contour of the glass from the top plate down to the bottom plate, in room units. */
function leftContour(): Pt[] {
  const pts: Pt[] = [];
  for (let y = UPPER_TOP; y < NECK; y += 6) pts.push([HG_X - bulbHalfWidth(NECK - y, NECK - UPPER_TOP), y]);
  for (let y = NECK; y <= BULB_BOTTOM; y += 6) pts.push([HG_X - bulbHalfWidth(y - NECK, BULB_BOTTOM - NECK), y]);
  return pts;
}

const CONTOUR = leftContour();
const mirror = ([x, y]: Pt): Pt => [2 * HG_X - x, y];
const GLASS_D = `M ${[...CONTOUR, ...CONTOUR.map(mirror).reverse()].map(([x, y]) => `${num(x)} ${num(y)}`).join(' L ')} Z`;

/** Gem slots, rows of 8, 7, 6, 5, 4 from the bottom of the lower bulb up; each row is filled centre outwards. */
function gemSlots(): Pt[] {
  const slots: Pt[] = [];
  const outward = (n: number) => Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) || a - b);
  ROWS.forEach((n, row) => {
    for (const k of outward(n)) slots.push([HG_X + (k - (n - 1) / 2) * PITCH_X, BULB_BOTTOM - 10 - row * PITCH_Y]);
  });
  return slots;
}

const SLOTS = gemSlots();

const GEM_SHAPE: Pt[] = [[-6, -8.2], [6, -8.2], [9.5, -2.8], [0, 8.2], [-9.5, -2.8]];
const CRYSTAL_SHAPE: Pt[] = [[-6.5, 9], [6.5, 9], [9, -6], [0, -20], [-9, -6]];

/** The outline of the item in slot `i` in room units (a crystal when `big`, a gem otherwise). */
export function outline(i: number, big: boolean): Pt[] {
  const [x, y] = SLOTS[i];
  return (big ? CRYSTAL_SHAPE : GEM_SHAPE).map(([dx, dy]) => [x + dx, y + dy] as Pt);
}

/** How far the lower bulb's glass is from the hourglass's axis at height `y`, and the axis's x, in room units. */
export function glassAt(y: number): { axis: number; halfWidth: number } {
  return { axis: HG_X, halfWidth: bulbHalfWidth(y - NECK, BULB_BOTTOM - NECK) };
}

/** A cut gem in the kid's house colour, centred on its slot. */
function gem(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const body = sk.polygon(around(p, x, y, GEM_SHAPE), { fill: colour, strokeWidth: 1.8, roughness: 0.5 });
  const facets = `<polyline points="${points(around(p, x, y, [[-9.5, -2.8], [9.5, -2.8]]))}" fill="none" stroke="${INK}" stroke-width="1" opacity="0.5"/>` +
    `<polyline points="${points(around(p, x, y, [[-2.8, -8.2], [-3.3, -2.8], [0, 8.2], [3.3, -2.8], [2.8, -8.2]]))}" fill="none" stroke="${INK}" stroke-width="0.8" opacity="0.35"/>`;
  const glint = `<polygon points="${points(around(p, x, y, [[-5, -6.9], [-1.7, -6.9], [-3.8, -4], [-7.1, -4]]))}" fill="#fff" opacity="0.75"/>`;
  return body + facets + glint;
}

/** A large crystal standing in its slot: the house colour lightened, with a white inner edge so it reads as special. */
function crystal(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const shape = CRYSTAL_SHAPE;
  const body = sk.polygon(around(p, x, y, shape), { fill: colour, strokeWidth: 2.2, roughness: 0.5 });
  const light = `<polygon points="${points(around(p, x, y, shape))}" fill="#fff" opacity="0.22"/>`;
  const edge = `<polygon points="${points(around(p, x, y, shape.map(([dx, dy]) => [dx * 0.72, dy * 0.72 - 1])))}" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.95"/>`;
  const ridge = `<polyline points="${points(around(p, x, y, [[-9, -6], [0, -2], [9, -6]]))}" fill="none" stroke="${INK}" stroke-width="0.9" opacity="0.4"/>` +
    `<polyline points="${points(around(p, x, y, [[0, -20], [0, -2], [0, 9]]))}" fill="none" stroke="${INK}" stroke-width="0.9" opacity="0.4"/>`;
  const glint = `<polygon points="${points(around(p, x, y, [[-6, -6], [-3, -12], [-2, -8], [-5, -2]]))}" fill="#fff" opacity="0.85"/>`;
  return body + light + edge + ridge + glint;
}

function gems(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { big, small } = ctx.groups;
  const colour = ctx.kid.colour;
  let out = '';
  for (let i = 0; i < big + small && i < SLOTS.length; i++) {
    const isBig = i < big;
    const [x, y] = SLOTS[i];
    out += item(isBig ? 'big' : 'small', i, ctx, isBig ? crystal(sk, p, x, y, colour) : gem(sk, p, x, y, colour));
  }
  return out;
}

/** Stone wall with an arched night window: a crescent moon and a few stars. */
function wall(sk: Sketch, p: Placement): string {
  let stones = '';
  for (const [x, y, w, h] of [[8, 150, 34, 16], [30, 132, 30, 15], [4, 116, 26, 14], [60, 30, 32, 15], [212, 40, 36, 16], [236, 150, 30, 15], [258, 168, 40, 16], [10, 220, 30, 14]]) {
    stones += sk.rect(...at(p, x, y), w * p.s, h * p.s, { stroke: STONE_EDGE, fill: STONE, strokeWidth: 1.2, roughness: 0.8 });
  }
  const arch = 'M 266 128 L 266 62 C 266 30 314 30 314 62 L 314 128 Z';
  const window = sk.path(moved(p, arch), { fill: NIGHT, strokeWidth: 2.6, roughness: 0.8 });
  const [mx, my] = at(p, 280, 66);
  const moon = `<circle cx="${num(mx)}" cy="${num(my)}" r="${num(9 * p.s)}" fill="${MOON}"/><circle cx="${num(mx + 4.5 * p.s)}" cy="${num(my - 2.5 * p.s)}" r="${num(8 * p.s)}" fill="${NIGHT}"/>`;
  let stars = '';
  for (const [x, y, r] of [[302, 58, 1.6], [296, 92, 1.3], [276, 108, 1.5], [306, 116, 1.1]]) {
    const [sx, sy] = at(p, x, y);
    stars += `<circle cx="${num(sx)}" cy="${num(sy)}" r="${num(r * p.s)}" fill="#fff"/>`;
  }
  const bars = sk.line(...at(p, 290, 40), ...at(p, 290, 128), { stroke: WOOD_DARK, strokeWidth: 2.2, roughness: 0.5 }) +
    sk.line(...at(p, 266, 88), ...at(p, 314, 88), { stroke: WOOD_DARK, strokeWidth: 2.2, roughness: 0.5 });
  const sill = sk.rect(...at(p, 260, 128), 60 * p.s, 7 * p.s, { fill: STONE, strokeWidth: 2, roughness: 0.6 });
  return `<g data-part="wall">${stones}${window}${moon}${stars}${bars}${sill}</g>`;
}

/** A pennant in the kid's house colour hanging on the wall above the candle. */
function banner(sk: Sketch, p: Placement, colour: string): string {
  const rod = sk.line(...at(p, 2, 40), ...at(p, 46, 40), { stroke: WOOD_DARK, strokeWidth: 3, roughness: 0.5 });
  const cloth = sk.polygon([at(p, 6, 40), at(p, 42, 40), at(p, 42, 104), at(p, 24, 90), at(p, 6, 104)], { fill: colour, strokeWidth: 2.2, roughness: 0.7 });
  const [sx, sy] = at(p, 24, 64);
  const r = 9 * p.s;
  const star: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    star.push([sx + rr * Math.cos(a), sy + rr * Math.sin(a)]);
  }
  return `<g data-part="banner">${rod}${cloth}<polygon points="${points(star)}" fill="#fff6c2" stroke="${INK}" stroke-width="1"/></g>`;
}

function table(sk: Sketch, p: Placement): string {
  return `<g data-part="table">${sk.rect(...at(p, 0, TABLE), UNITS_W * p.s, 9 * p.s, { fill: TABLE_TOP, strokeWidth: 2.4, roughness: 0.8 })}` +
    `${sk.rect(...at(p, 6, TABLE + 9), (UNITS_W - 12) * p.s, (BOTTOM - TABLE - 9) * p.s, { fill: WOOD_DARK, strokeWidth: 2.2, roughness: 0.8 })}</g>`;
}

/** A candle on a dish at the left; its flame flickers. */
function candle(sk: Sketch, p: Placement, seedKey: string): string {
  const [gx, gy] = at(p, 22, 178);
  const glow = `<circle cx="${num(gx)}" cy="${num(gy)}" r="${num(24 * p.s)}" fill="#fff3b0" opacity="0.45"/>`;
  const wax = sk.rect(...at(p, 13, 196), 18 * p.s, 56 * p.s, { fill: WAX, strokeWidth: 2, roughness: 0.6 });
  const drip = sk.path(moved(p, 'M 13 198 Q 12 210 15 212 Q 18 210 17 198 Z'), { fill: WAX, strokeWidth: 1.4, roughness: 0.4 });
  const dish = sk.ellipse(...at(p, 22, 251), 40 * p.s, 9 * p.s, { fill: '#c9a24a', strokeWidth: 2, roughness: 0.6 });
  const wick = sk.line(...at(p, 22, 196), ...at(p, 22, 190), { strokeWidth: 1.6, roughness: 0.3 });
  const outer = sk.path(moved(p, 'M 22 192 C 13 188 14 176 22 164 C 30 176 31 188 22 192 Z'), { fill: FLAME, stroke: '#d9771f', strokeWidth: 1.4, roughness: 0.4 });
  const inner = sk.path(moved(p, 'M 22 190 C 17 187 18 180 22 174 C 26 180 27 187 22 190 Z'), { fill: FLAME_CORE, stroke: 'none', roughness: 0.3 });
  const flame = `<g class="fb-anim fb-wizard-flame" style="${timing(`${seedKey}:flame`, [2.2, 3])}">${outer}${inner}</g>`;
  return `<g data-part="candle">${glow}${wax}${drip}${dish}${wick}${flame}</g>`;
}

/** An owl perched on two books at the right; it blinks about every 7 s. */
function owl(sk: Sketch, p: Placement, seedKey: string): string {
  const books = sk.rect(...at(p, 266, 240), 50 * p.s, 14 * p.s, { fill: BOOKS[0], strokeWidth: 2, roughness: 0.6 }) +
    sk.rect(...at(p, 271, 228), 40 * p.s, 12 * p.s, { fill: BOOKS[1], strokeWidth: 2, roughness: 0.6 });
  const pages = sk.line(...at(p, 268, 247), ...at(p, 312, 247), { stroke: '#fbf3df', strokeWidth: 1.6, roughness: 0.3 }) +
    sk.line(...at(p, 273, 234), ...at(p, 309, 234), { stroke: '#fbf3df', strokeWidth: 1.6, roughness: 0.3 });
  const tufts = sk.polygon([at(p, 274, 186), at(p, 276, 170), at(p, 284, 182)], { fill: OWL, strokeWidth: 1.8, roughness: 0.5 }) +
    sk.polygon([at(p, 306, 186), at(p, 304, 170), at(p, 296, 182)], { fill: OWL, strokeWidth: 1.8, roughness: 0.5 });
  const body = sk.ellipse(...at(p, 290, 203), 42 * p.s, 52 * p.s, { fill: OWL, strokeWidth: 2.4, roughness: 0.8 });
  const belly = sk.ellipse(...at(p, 290, 212), 24 * p.s, 30 * p.s, { fill: OWL_BELLY, strokeWidth: 1.4, roughness: 0.6 });
  const wings = sk.path(moved(p, 'M 271 200 Q 268 216 278 224'), { strokeWidth: 1.8, roughness: 0.5 }) + sk.path(moved(p, 'M 309 200 Q 312 216 302 224'), { strokeWidth: 1.8, roughness: 0.5 });
  let chest = '';
  for (const [x, y] of [[285, 208], [295, 208], [290, 215], [285, 222], [295, 222]]) chest += sk.path(moved(p, `M ${x - 2.5} ${y} Q ${x} ${y + 3} ${x + 2.5} ${y}`), { stroke: '#b89a6e', strokeWidth: 1.2, roughness: 0.3 });
  let eyes = '';
  for (const x of [282, 298]) {
    const [ex, ey] = at(p, x, 192);
    eyes += `<circle cx="${num(ex)}" cy="${num(ey)}" r="${num(7 * p.s)}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>` +
      `<circle cx="${num(ex)}" cy="${num(ey + 0.5 * p.s)}" r="${num(3.4 * p.s)}" fill="${INK}"/>` +
      `<circle cx="${num(ex - 1.2 * p.s)}" cy="${num(ey - 0.8 * p.s)}" r="${num(1 * p.s)}" fill="#fff"/>`;
  }
  const blink = `<g class="fb-anim fb-wizard-blink" style="${timing(`${seedKey}:blink`, [6.5, 7.5])}">${eyes}</g>`;
  const beak = sk.polygon([at(p, 286, 198), at(p, 294, 198), at(p, 290, 206)], { fill: BEAK, strokeWidth: 1.4, roughness: 0.3 });
  const feet = sk.path(moved(p, 'M 282 228 L 282 224 M 285 228 L 285 224 M 295 228 L 295 224 M 298 228 L 298 224'), { stroke: BEAK, strokeWidth: 2, roughness: 0.3 });
  return `<g data-part="owl">${books}${pages}${tufts}${body}${belly}${wings}${chest}${blink}${beak}${feet}</g>`;
}

/** Wooden plates, the glass's back and the sand left in the upper bulb. */
function hourglassBack(sk: Sketch, p: Placement): string {
  const plate = (y: number) => sk.rect(...at(p, HG_X - POST_X - 8, y), (2 * POST_X + 16) * p.s, 14 * p.s, { fill: WOOD, strokeWidth: 2.4, roughness: 0.7 });
  const glass = sk.path(moved(p, GLASS_D), { fill: GLASS, stroke: 'none', roughness: 0.4 });
  const surface = 78;
  const sandLeft = CONTOUR.filter(([, y]) => y >= surface && y <= NECK);
  const sandPts = [[HG_X - bulbHalfWidth(NECK - surface, NECK - UPPER_TOP), surface] as Pt, ...sandLeft, [HG_X, NECK + 2] as Pt, ...sandLeft.map(mirror).reverse(), [HG_X + bulbHalfWidth(NECK - surface, NECK - UPPER_TOP), surface] as Pt];
  const sand = sk.polygon(sandPts.map(([x, y]) => at(p, x, y)), { fill: SAND, stroke: '#c99a3a', strokeWidth: 1.4, roughness: 0.6 });
  return `<g data-part="hourglass">${plate(TOP)}${plate(BULB_BOTTOM)}${glass}${sand}</g>`;
}

const DASH = 5; // px, one dash period; the keyframes move the group by exactly this much

/** A thin dashed stream of sand from the neck down towards the gems; the dash pattern moves down by one period per loop (translateY, not stroke-dashoffset). */
function trickle(p: Placement, seedKey: string): string {
  const [x, y0] = at(p, HG_X, NECK + 1);
  const [, y1] = at(p, HG_X, NECK + 18);
  const w = 2 * p.s;
  let dashes = '';
  for (let y = y0; y + DASH <= y1; y += DASH) dashes += `<rect x="${num(x - w / 2)}" y="${num(y)}" width="${num(w)}" height="${num(DASH / 2)}" rx="${num(w / 2)}" fill="${SAND}"/>`;
  return `<g class="fb-anim fb-wizard-sand" style="${timing(`${seedKey}:sand`, [2, 2.4])}">${dashes}</g>`;
}

/** Glass outline, highlights and posts, drawn over the gems. Gets its own sketch so its wobble does not change with the gem count. */
function hourglassFront(sk: Sketch, p: Placement): string {
  const outline = sk.path(moved(p, GLASS_D), { strokeWidth: 2.4, roughness: 0.6 });
  const shine = sk.path(moved(p, `M ${HG_X - 70} 50 Q ${HG_X - 80} 70 ${HG_X - 74} 90`), { stroke: '#ffffff', strokeWidth: 3, roughness: 0.4 }) +
    sk.path(moved(p, `M ${HG_X - 66} 166 Q ${HG_X - 80} 190 ${HG_X - 78} 214`), { stroke: '#ffffff', strokeWidth: 2.5, roughness: 0.4 });
  let posts = '';
  for (const dx of [-POST_X, POST_X]) posts += sk.rect(...at(p, HG_X + dx - 3.5, UPPER_TOP), 7 * p.s, (BULB_BOTTOM - UPPER_TOP) * p.s, { fill: WOOD_DARK, strokeWidth: 1.8, roughness: 0.5 });
  return `<g data-part="hourglass-front">${outline}<g opacity="0.7">${shine}</g>${posts}</g>`;
}

/** 4 sparkles pulsing over the lower bulb. */
function sparkles(p: Placement, seedKey: string): string {
  const [x0, y0] = at(p, HG_X - 64, NECK + 26);
  const [x1, y1] = at(p, HG_X + 64, BULB_BOTTOM - 4);
  return particles(`${seedKey}:sparkle`, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, 4, 'sparkle');
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box, UNITS);
  const colour = ctx.kid.colour;
  return `<g>${wall(sk, p)}${banner(sk, p, colour)}${table(sk, p)}${candle(sk, p, ctx.seedKey)}${owl(sk, p, ctx.seedKey)}${hourglassBack(sk, p)}${trickle(p, ctx.seedKey)}` +
    `${gems(sk, p, ctx)}${hourglassFront(createSketch(`${ctx.seedKey}:front`), p)}${sparkles(p, ctx.seedKey)}</g>`;
}

const css = `
  @keyframes fb-wizard-sand {
    from { transform: translateY(0); }
    to { transform: translateY(${DASH}px); }
  }
  @keyframes fb-wizard-flame {
    0%, 100% { transform: scale(1, 1); opacity: 1; }
    25% { transform: scale(0.94, 1.06); opacity: 0.9; }
    50% { transform: scale(1.04, 0.95); opacity: 1; }
    75% { transform: scale(0.96, 1.04); opacity: 0.92; }
  }
  @keyframes fb-wizard-blink {
    0%, 95%, 99%, 100% { transform: scaleY(1); }
    97% { transform: scaleY(0.1); }
  }
  .fb-wizard-sand { animation-name: fb-wizard-sand; animation-timing-function: linear; }
  .fb-wizard-flame { animation-name: fb-wizard-flame; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
  .fb-wizard-blink { animation-name: fb-wizard-blink; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
`;

export const wizard: Theme = {
  id: 'wizard',
  label: 'Zauberschule',
  capacity: CAPACITY,
  background: WALL,
  renderHalf,
  css,
};
