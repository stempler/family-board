import { rand, scaledCount, timing, twinkle } from '../draw/anim';
import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { item, type HalfContext, type Theme } from './types';

// A night sky over a little moon, drawn in "sky units": a rocket stands on a
// small moon peeking up at the bottom right. Fat yellow stars appear at fixed
// spots that form four simple constellations (a dipper, a W, a kite and a hunter
// with his bow), one after the other; a bigger glowing star worth ten takes the
// place of a star at a seeded, random-looking spot among the ones already lit.
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
const CAPACITY = STARS.length; // 30; big glowing stars and small stars share the star spots
// Spots a big star may take first: every merge leaves at least CAPACITY − 8 items (minimal replacement),
// so a big star picked from these always replaces a lit star and never lands in an empty constellation.
const BIG_POOL = CAPACITY - 8;

const TWINKLERS = 12; // star spots that twinkle in a 400-wide half (fewer in narrower halves), picked by seed

const DUSK = '#d6dcef';
const NIGHT = '#27355f';
const DOT = '#dfe6ff';
const LINE = '#a9b8e8';
const STAR = '#ffd95e';
const STAR_EDGE = '#8a6a12';
const MOON = '#cfccc3';
const MOON_DARK = '#aeaa9f';
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

const SMALL_R = 10; // units, outer radius of a star
const BIG_R = SMALL_R * 1.4;

/** A fat yellow star with a white glint. */
function star(sk: Sketch, p: Placement, x: number, y: number): string {
  const body = sk.polygon(starPoints(p, x, y, SMALL_R), { fill: STAR, stroke: STAR_EDGE, strokeWidth: 1.5, roughness: 0.5 });
  const [gx, gy] = at(p, x - 2, y - 2);
  return `${body}<circle cx="${num(gx)}" cy="${num(gy)}" r="${num(1.6 * p.s)}" fill="#fff" opacity="0.9"/>`;
}

/** A big gold star (worth ten) with a soft glow behind it and a white glint. */
function goldStar(sk: Sketch, p: Placement, x: number, y: number): string {
  const [cx, cy] = at(p, x, y);
  const glow = `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(BIG_R * 1.45 * p.s)}" fill="${STAR}" opacity="0.3"/>`;
  const body = sk.polygon(starPoints(p, x, y, BIG_R), { fill: STAR, stroke: STAR_EDGE, strokeWidth: 1.5, roughness: 0.5 });
  const [gx, gy] = at(p, x - 2.8, y - 2.8);
  return `${glow}${body}<circle cx="${num(gx)}" cy="${num(gy)}" r="${num(2.2 * p.s)}" fill="#fff" opacity="0.9"/>`;
}

/**
 * Which star spots twinkle in this half: a fixed seeded pick of about 2 in 5 spots of every constellation (12 in a 400-wide half, scaled with the width),
 * so the first constellation already twinkles and a twinkling star keeps twinkling as stars are added.
 */
function twinklers(seedKey: string, box: Box): Set<number> {
  const total = scaledCount(TWINKLERS, box);
  const out = new Set<number>();
  let offset = 0;
  for (const c of CONSTELLATIONS) {
    const spots = c.stars.map((_, i) => offset + i).sort((a, b) => rand(`${seedKey}:tw:${a}`) - rand(`${seedKey}:tw:${b}`));
    for (const spot of spots.slice(0, Math.round((c.stars.length * total) / STARS.length))) out.add(spot);
    offset += c.stars.length;
  }
  return out;
}

/**
 * Where the items stand. Big star k takes spot `order[k]`: a seeded shuffle of the first BIG_POOL spots, then the
 * rest in constellation order. Small stars take the lowest spots no big star holds. So a big star never moves, and a
 * small star never moves either: a new big star only takes a spot away from the free list, and the small stars that
 * remain are a prefix of what was there before.
 */
export function starSpots(big: number, small: number, seedKey: string): { kind: 'big' | 'small'; spot: number }[] {
  const pool = Array.from({ length: BIG_POOL }, (_, i) => i).sort((a, b) => rand(`${seedKey}:big:${a}`) - rand(`${seedKey}:big:${b}`));
  const order = [...pool, ...Array.from({ length: STARS.length - BIG_POOL }, (_, i) => BIG_POOL + i)];
  const bigs = order.slice(0, Math.min(big, STARS.length));
  const taken = new Set(bigs);
  const free = Array.from({ length: STARS.length }, (_, i) => i).filter((i) => !taken.has(i));
  return [...bigs.map((spot) => ({ kind: 'big' as const, spot })), ...free.slice(0, small).map((spot) => ({ kind: 'small' as const, spot }))];
}

function slots(ctx: HalfContext): { kind: 'big' | 'small'; spot: number }[] {
  return starSpots(ctx.groups.big, ctx.groups.small, ctx.seedKey);
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
  const list = slots(ctx);
  const twinkling = twinklers(ctx.seedKey, ctx.box);
  let out = constellationLines(p, new Set(list.map((s) => s.spot)));
  list.forEach((s, i) => {
    const [x, y] = STARS[s.spot];
    if (s.kind === 'big') {
      out += item('big', i, ctx, goldStar(sk, p, x, y));
    } else {
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
