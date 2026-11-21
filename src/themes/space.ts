import { rand, timing, twinkle } from '../draw/anim';
import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { item, type HalfContext, type Theme } from './types';

// A night sky over a little moon, drawn in "sky units": a rocket stands on a
// small moon peeking up at the bottom right, ringed planets hang in three fixed larger slots and
// stars appear at fixed spots that form four simple constellations (a dipper, a
// W, a kite and a hunter with his bow), one constellation after the other.
// Thin lines join two stars of a constellation once both are there. The half
// background stays a pale dusk blue so the board's dark header and jar labels
// stay readable; only the scene band is a deep night sky.
const MID = 160;
const UNITS_W = 320;
const TOP = 0;
const BOTTOM = 250;
const UNITS_H = BOTTOM - TOP;

type Pt = [number, number];

/** Constellations: star spots in filling order and the lines between them (pairs of indices into the spots). */
const CONSTELLATIONS: { stars: Pt[]; lines: [number, number][] }[] = [
  { // dipper
    stars: [[18, 46], [42, 40], [66, 48], [88, 60], [90, 90], [124, 96], [128, 64]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  { // W
    stars: [[162, 38], [182, 64], [204, 44], [228, 66], [250, 36]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  { // kite with its tail
    stars: [[196, 92], [174, 114], [218, 114], [196, 136], [204, 158], [188, 176], [172, 194]],
    lines: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  { // hunter: shoulders, belt, feet, head, bow
    stars: [[22, 114], [66, 112], [24, 138], [46, 144], [68, 150], [22, 176], [72, 178], [44, 90], [98, 116], [110, 140], [102, 164]],
    lines: [[7, 0], [7, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [8, 9], [9, 10], [1, 9]],
  },
];

const STARS: Pt[] = CONSTELLATIONS.flatMap((c) => c.stars);
const LINES: [number, number][] = CONSTELLATIONS.flatMap((c, k) => {
  const offset = CONSTELLATIONS.slice(0, k).reduce((n, d) => n + d.stars.length, 0);
  return c.lines.map(([a, b]) => [a + offset, b + offset] as [number, number]);
});
const PLANETS: Pt[] = [[44, 214], [128, 214], [292, 64]];
const CAPACITY = STARS.length; // 30; big items beyond the planet slots take star spots

const TWINKLERS = 12; // star spots that twinkle, picked by seed per half

const DUSK = '#d6dcef';
const NIGHT = '#27355f';
const DOT = '#dfe6ff';
const LINE = '#a9b8e8';
const STAR = '#ffd95e';
const STAR_EDGE = '#8a6a12';
const MOON = '#cfccc3';
const MOON_DARK = '#aeaa9f';
const RING = '#f6e7b4';
const HULL = '#f4f1ea';
const WINDOW = '#8fd3f4';
const FLAME = '#f6993f';
const FLAME_CORE = '#ffe066';
const COMET = '#f4f8ff';

const SCENE_TOP = 0.17; // leave room for the board header
const SCENE_BOTTOM = 0.79; // leave room for the jar row

interface Placement { cx: number; top: number; s: number }

function at(p: Placement, x: number, y: number): Pt {
  return [p.cx + (x - MID) * p.s, p.top + (y - TOP) * p.s];
}

/** Fits the sky units into the scene band of `box`, horizontally centred, bottom-aligned. */
function placement(box: Box): Placement {
  const top = box.y + box.h * SCENE_TOP;
  const height = box.h * (SCENE_BOTTOM - SCENE_TOP);
  const s = Math.min(height / UNITS_H, (box.w * 0.92) / UNITS_W);
  return { cx: box.x + box.w / 2, top: top + (height - UNITS_H * s), s };
}

const points = (pts: Pt[]) => pts.map((q) => q.map(num).join(',')).join(' ');

function starPoints(p: Placement, x: number, y: number, r: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(at(p, x + rr * Math.cos(a), y + rr * Math.sin(a)));
  }
  return pts;
}

/** A fat yellow star with a white glint. */
function star(sk: Sketch, p: Placement, x: number, y: number): string {
  const body = sk.polygon(starPoints(p, x, y, 10), { fill: STAR, stroke: STAR_EDGE, strokeWidth: 1.5, roughness: 0.5 });
  const [gx, gy] = at(p, x - 2, y - 2);
  return `${body}<circle cx="${num(gx)}" cy="${num(gy)}" r="${num(1.6 * p.s)}" fill="#fff" opacity="0.9"/>`;
}

/** Points of a ring around (x, y), tilted, split into the half behind the planet and the half in front. */
function ring(p: Placement, x: number, y: number, rx: number, ry: number): { back: Pt[]; front: Pt[] } {
  const tilt = -0.28;
  const back: Pt[] = [];
  const front: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i * Math.PI) / 24; // upper half, left to right
    const b = (i * Math.PI) / 24; // lower half, right to left
    const pt = (t: number): Pt => {
      const ex = rx * Math.cos(t);
      const ey = ry * Math.sin(t);
      return at(p, x + ex * Math.cos(tilt) - ey * Math.sin(tilt), y + ex * Math.sin(tilt) + ey * Math.cos(tilt));
    };
    back.push(pt(a));
    front.push(pt(b));
  }
  return { back, front };
}

/** A ringed planet in the kid colour; `k` scales it down when it sits on a star spot. */
function planet(sk: Sketch, p: Placement, x: number, y: number, colour: string, k: number): string {
  const r = 16 * k;
  const { back, front } = ring(p, x, y, 30 * k, 8 * k);
  const line = (pts: Pt[]) => `M ${pts.map((q) => q.map(num).join(' ')).join(' L ')}`;
  const ringStyle = { stroke: RING, strokeWidth: 3.6 * k, roughness: 0.4 };
  const body = sk.circle(...at(p, x, y), 2 * r * p.s, { fill: colour, strokeWidth: 2 * Math.max(k, 0.7), roughness: 0.6 });
  const [bx, by] = at(p, x, y + r * 0.35);
  const band = `<ellipse cx="${num(bx)}" cy="${num(by)}" rx="${num(r * 0.8 * p.s)}" ry="${num(r * 0.18 * p.s)}" fill="#fff" opacity="0.25"/>`;
  const [gx, gy] = at(p, x - r * 0.4, y - r * 0.4);
  const glint = `<circle cx="${num(gx)}" cy="${num(gy)}" r="${num(r * 0.22 * p.s)}" fill="#fff" opacity="0.7"/>`;
  return sk.path(line(back), ringStyle) + body + band + glint + sk.path(line(front), ringStyle);
}

/**
 * Which star spots twinkle in this half: a fixed seeded pick of about 2 in 5 spots of every constellation (12 in all),
 * so the first constellation already twinkles and a twinkling star keeps twinkling as stars are added.
 */
function twinklers(seedKey: string): Set<number> {
  const out = new Set<number>();
  let offset = 0;
  for (const c of CONSTELLATIONS) {
    const spots = c.stars.map((_, i) => offset + i).sort((a, b) => rand(`${seedKey}:tw:${a}`) - rand(`${seedKey}:tw:${b}`));
    for (const spot of spots.slice(0, Math.round((c.stars.length * TWINKLERS) / STARS.length))) out.add(spot);
    offset += c.stars.length;
  }
  return out;
}

/** Planets first in their own slots, then on star spots; stars fill the remaining star spots in constellation order. */
function slots(ctx: HalfContext): { kind: 'big' | 'small'; spot: number; planetSlot: boolean }[] {
  const { big, small } = ctx.groups;
  const out: { kind: 'big' | 'small'; spot: number; planetSlot: boolean }[] = [];
  let spot = 0;
  for (let i = 0; i < big; i++) out.push(i < PLANETS.length ? { kind: 'big', spot: i, planetSlot: true } : { kind: 'big', spot: spot++, planetSlot: false });
  for (let i = 0; i < small && spot < STARS.length; i++) out.push({ kind: 'small', spot: spot++, planetSlot: false });
  return out;
}

function sky(sk: Sketch, box: Box, seedKey: string): string {
  const x0 = box.x + 8;
  const x1 = box.x + box.w - 8;
  const y0 = box.y + box.h * SCENE_TOP;
  const y1 = box.y + box.h * SCENE_BOTTOM;
  const r = 18;
  const d = `M ${num(x0 + r)} ${num(y0)} L ${num(x1 - r)} ${num(y0)} Q ${num(x1)} ${num(y0)} ${num(x1)} ${num(y0 + r)} L ${num(x1)} ${num(y1 - r)} Q ${num(x1)} ${num(y1)} ${num(x1 - r)} ${num(y1)} ` +
    `L ${num(x0 + r)} ${num(y1)} Q ${num(x0)} ${num(y1)} ${num(x0)} ${num(y1 - r)} L ${num(x0)} ${num(y0 + r)} Q ${num(x0)} ${num(y0)} ${num(x0 + r)} ${num(y0)} Z`;
  const panel = sk.path(d, { fill: NIGHT, stroke: '#1b2547', strokeWidth: 2.4, roughness: 0.6 });
  let dots = '';
  for (let i = 0; i < 26; i++) {
    const k = `${seedKey}:dot:${i}`;
    const x = x0 + 10 + rand(`${k}:x`) * (x1 - x0 - 20);
    const y = y0 + 8 + rand(`${k}:y`) * (y1 - y0 - 40);
    dots += `<circle cx="${num(x)}" cy="${num(y)}" r="${num(0.7 + rand(`${k}:r`) * 0.8)}" fill="${DOT}" opacity="${num(0.35 + rand(`${k}:o`) * 0.35)}"/>`;
  }
  return `<g data-part="sky">${panel}${dots}</g>`;
}

/** Faint lines between two stars of a constellation that are both drawn. */
function constellationLines(p: Placement, filled: Set<number>): string {
  let out = '';
  for (const [a, b] of LINES) {
    if (!filled.has(a) || !filled.has(b)) continue;
    const [ax, ay] = at(p, ...STARS[a]);
    const [bx, by] = at(p, ...STARS[b]);
    out += `<line data-line="${a}-${b}" x1="${num(ax)}" y1="${num(ay)}" x2="${num(bx)}" y2="${num(by)}" stroke="${LINE}" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.6"/>`;
  }
  return out;
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const colour = ctx.kid.colour;
  const list = slots(ctx);
  const twinkling = twinklers(ctx.seedKey);
  const stars = new Set(list.filter((s) => s.kind === 'small').map((s) => s.spot));
  let out = constellationLines(p, stars);
  list.forEach((s, i) => {
    if (s.kind === 'big') {
      const [x, y] = s.planetSlot ? PLANETS[s.spot] : STARS[s.spot];
      out += item('big', i, ctx, planet(sk, p, x, y, colour, s.planetSlot ? 1 : 0.5));
    } else {
      const [x, y] = STARS[s.spot];
      const body = star(sk, p, x, y);
      out += item('small', i, ctx, twinkling.has(s.spot) ? `<g ${twinkle(`${ctx.seedKey}:star:${s.spot}`)}>${body}</g>` : body);
    }
  });
  return out;
}

/** The small moon: a grey dome rising from the bottom of the scene at the right, with a few craters. */
function moon(sk: Sketch, p: Placement): string {
  const d = `M ${at(p, 160, 250).map(num).join(' ')} C ${[at(p, 172, 212), at(p, 226, 204), at(p, 252, 204)].map((q) => q.map(num).join(' ')).join(' ')} ` +
    `C ${[at(p, 284, 204), at(p, 314, 216), at(p, 318, 250)].map((q) => q.map(num).join(' ')).join(' ')} Z`;
  const hill = sk.path(d, { fill: MOON, strokeWidth: 2.4, roughness: 0.8 });
  let craters = '';
  for (const [x, y, w, h] of [[198, 236, 22, 7], [232, 222, 16, 5], [292, 232, 18, 6], [258, 242, 26, 7]]) {
    craters += sk.ellipse(...at(p, x, y), w * p.s, h * p.s, { fill: MOON_DARK, strokeWidth: 1.4, roughness: 0.6 });
  }
  return `<g data-part="moon">${hill}${craters}</g>`;
}

const LIFT = 16; // units the rocket drawing is raised so its feet stand on the moon's top

/** A generic rocket standing on its legs at the right, the kid colour on nose and fins; its flame flickers. */
function rocket(sk: Sketch, p: Placement, colour: string, seedKey: string): string {
  const X = 258;
  const up = (x: number, y: number) => at(p, x, y - LIFT);
  const poly = (pts: Pt[]) => pts.map(([x, y]) => up(x, y));
  const legs = sk.line(...up(X - 12, 196), ...up(X - 22, 220), { strokeWidth: 2.6, roughness: 0.4 }) +
    sk.line(...up(X + 12, 196), ...up(X + 22, 220), { strokeWidth: 2.6, roughness: 0.4 });
  const outer = sk.path(`M ${[up(X - 8, 204), up(X + 8, 204)].map((q) => q.map(num).join(' ')).join(' L ')} C ${[up(X + 8, 212), up(X + 4, 220), up(X, 226)].map((q) => q.map(num).join(' ')).join(' ')} C ${[up(X - 4, 220), up(X - 8, 212), up(X - 8, 204)].map((q) => q.map(num).join(' ')).join(' ')} Z`, { fill: FLAME, stroke: '#d9771f', strokeWidth: 1.4, roughness: 0.4 });
  const inner = sk.polygon(poly([[X - 4, 205], [X + 4, 205], [X, 217]]), { fill: FLAME_CORE, stroke: 'none', roughness: 0.3 });
  const flame = `<g class="fb-anim fb-space-flame" style="${timing(`${seedKey}:flame`, [2, 2.6])}">${outer}${inner}</g>`;
  const fins = sk.polygon(poly([[X - 15, 170], [X - 28, 194], [X - 28, 206], [X - 15, 196]]), { fill: colour, strokeWidth: 2.2, roughness: 0.5 }) +
    sk.polygon(poly([[X + 15, 170], [X + 28, 194], [X + 28, 206], [X + 15, 196]]), { fill: colour, strokeWidth: 2.2, roughness: 0.5 });
  const body = sk.path(`M ${[up(X - 15, 202), up(X - 15, 150)].map((q) => q.map(num).join(' ')).join(' L ')} C ${[up(X - 15, 136), up(X - 8, 126), up(X, 118)].map((q) => q.map(num).join(' ')).join(' ')} C ${[up(X + 8, 126), up(X + 15, 136), up(X + 15, 150)].map((q) => q.map(num).join(' ')).join(' ')} L ${up(X + 15, 202).map(num).join(' ')} Z`, { fill: HULL, strokeWidth: 2.6, roughness: 0.6 });
  const nose = sk.path(`M ${up(X - 12, 136).map(num).join(' ')} C ${[up(X - 8, 127), up(X - 4, 122), up(X, 118)].map((q) => q.map(num).join(' ')).join(' ')} C ${[up(X + 4, 122), up(X + 8, 127), up(X + 12, 136)].map((q) => q.map(num).join(' ')).join(' ')} Z`, { fill: colour, strokeWidth: 2, roughness: 0.5 });
  const [wx, wy] = up(X, 156);
  const window = `<circle cx="${num(wx)}" cy="${num(wy)}" r="${num(7 * p.s)}" fill="${WINDOW}" stroke="${INK}" stroke-width="2.2"/><circle cx="${num(wx - 2.4 * p.s)}" cy="${num(wy - 2.4 * p.s)}" r="${num(1.8 * p.s)}" fill="#fff"/>`;
  const stripe = sk.line(...up(X - 15, 184), ...up(X + 15, 184), { stroke: colour, strokeWidth: 3.4, roughness: 0.4 });
  const nozzle = sk.polygon(poly([[X - 10, 202], [X + 10, 202], [X + 8, 207], [X - 8, 207]]), { fill: '#8d939c', strokeWidth: 2, roughness: 0.4 });
  return `<g data-part="rocket">${legs}${flame}${fins}${body}${nose}${window}${stripe}${nozzle}</g>`;
}

const COMET_X = 18; // units, left end of the comet's tail at rest
const COMET_Y = 14;
const COMET_W = 40; // units, tail plus head; the keyframes move it by whole multiples of this

/** A comet in the top band of the sky; it is hidden at rest and crosses left to right once per ~18 s cycle. */
function comet(p: Placement, seedKey: string): string {
  const tail: Pt[] = [at(p, COMET_X, COMET_Y - 1), at(p, COMET_X + COMET_W - 6, COMET_Y - 4), at(p, COMET_X + COMET_W - 6, COMET_Y + 4)];
  const [hx, hy] = at(p, COMET_X + COMET_W - 6, COMET_Y);
  const body = `<polygon points="${points(tail)}" fill="${COMET}" opacity="0.55"/>` +
    `<circle cx="${num(hx)}" cy="${num(hy)}" r="${num(5 * p.s)}" fill="${COMET}" stroke="${FLAME_CORE}" stroke-width="1.4"/>`;
  return `<g data-part="comet"><g class="fb-anim fb-space-comet" opacity="0" style="${timing(`${seedKey}:comet`, [17, 19])}">${body}</g></g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const front = createSketch(`${ctx.seedKey}:front`);
  const p = placement(ctx.box);
  const colour = ctx.kid.colour;
  return `<g>${sky(sk, ctx.box, ctx.seedKey)}${items(sk, p, ctx)}${moon(front, p)}${rocket(front, p, colour, ctx.seedKey)}${comet(p, ctx.seedKey)}</g>`;
}

// The comet moves 5 of its own widths right (fill-box percentages, so it scales with the scene) and a little down.
const css = `
  @keyframes fb-space-comet {
    0% { transform: translate(0, 0); opacity: 0; }
    1% { opacity: 1; }
    9% { opacity: 1; }
    10% { transform: translate(500%, 80%); opacity: 0; }
    100% { transform: translate(500%, 80%); opacity: 0; }
  }
  @keyframes fb-space-flame {
    0%, 100% { transform: scale(1, 1); opacity: 1; }
    25% { transform: scale(0.9, 1.12); opacity: 0.9; }
    50% { transform: scale(1.06, 0.92); opacity: 1; }
    75% { transform: scale(0.94, 1.08); opacity: 0.92; }
  }
  .fb-space-comet { animation-name: fb-space-comet; animation-timing-function: linear; transform-box: fill-box; transform-origin: 0 0; }
  .fb-space-flame { animation-name: fb-space-flame; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 0; }
`;

export const space: Theme = {
  id: 'space',
  capacity: CAPACITY,
  background: DUSK,
  renderHalf,
  css,
};
