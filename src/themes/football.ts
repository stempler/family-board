import { timing } from '../draw/anim';
import { createSketch, esc, INK, num, type Sketch } from '../draw/sketch';
import { at, moved, placement, points, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A football pitch, drawn in "pitch units": the far touchline at the top with a corner flag in the kid
// colour at its right end, a goal with a net at the left and its goal line. Footballs lie on the grass in two rows
// of five beside the goal and two rows of ten along the touchline. Trophies (a tall two-handled cup with a ball on top)
// stand five big ones in a row in front of the goal first, then medium ones in a row of ten beyond the touchline, then
// on the ball rows. Now and then a ball bounces into the net, where it then rests.
const MID = 160;
const UNITS_W = 320;
const UNITS_H = 260;
const UNITS: Units = { mid: MID, top: 0, w: UNITS_W, h: UNITS_H, fill: 0.92 };
const TOUCHLINE = 50;

const GRASS = '#7fc26b';
const GRASS_LIGHT = '#8fcd79';
const LINE = '#ffffff';
const NET = '#eef3f5';
const NET_LINE = '#b9c6cc';
const GOLD = '#f2c14e';
const GOLD_DARK = '#b8862b';
const BALL = '#ffffff';

const GOAL_X0 = 14; // front posts
const GOAL_X1 = 146;
const GOAL_TOP = 116; // crossbar
const GOAL_GROUND = 192; // goal line

const BALL_D = 20; // a football: 20 units across
const TROPHY_W = 30; // a trophy with its handles at scale 1: 30 x 42 units
const TROPHY_H = 42;
const BIG = 1.5; // the first five: 45 x 63, about three balls tall, seven times a ball's area
const MEDIUM = 0.87; // the rest: 26.1 x 36.5, almost two balls tall, more than twice a ball's area

/** The x of `n` spots centred on `cx`, `pitch` apart, left to right. */
const across = (n: number, cx: number, pitch: number) => Array.from({ length: n }, (_, i) => cx + pitch * (i - (n - 1) / 2));

/** Big trophy spots in a row in front of the goal, the middle one first, then outwards to the right and the left. */
const BIG_SPOTS: Pt[] = [2, 3, 1, 4, 0].map((i): Pt => [across(5, 155, 50)[i], 259 - (TROPHY_H * BIG) / 2]);

/** Ball rows: two of five beside the goal, the front one first, then two of ten along the touchline, the nearer one first. */
const SIDE_X = across(5, 240, 30);
const LINE_X = across(10, 160, 30);
const SIDE_Y = [172, 142];
const LINE_Y = [97, 67];
const BALLS: Pt[] = [
  ...SIDE_Y.flatMap((y) => SIDE_X.map((x): Pt => [x, y])),
  ...LINE_Y.flatMap((y) => LINE_X.map((x): Pt => [x, y])),
];

const CAPACITY = BALLS.length;

/**
 * Medium trophy spots, in order: a row of ten beyond the touchline (never needed by a ball), right to left; then one
 * on each column of the ball rows along the touchline and beside the goal, right to left, covering the column's two
 * balls. The n-th trophy leaves room for at most 30 - n balls, so the balls it covers are the last ones in the ball
 * order: the 16th covers balls 20 and 30, the 25th balls 11 and 21, the 26th balls 5 and 10, the 30th balls 1 and 6.
 */
const MEDIUM_SPOTS: Pt[] = [
  ...across(10, 140, TROPHY_W * MEDIUM + 2.05).reverse().map((x): Pt => [x, 24]),
  ...[...LINE_X].reverse().map((x): Pt => [x, (LINE_Y[0] + LINE_Y[1]) / 2]),
  ...[...SIDE_X].reverse().map((x): Pt => [x, (SIDE_Y[0] + SIDE_Y[1]) / 2]),
];

const TROPHIES: [x: number, y: number, k: number][] = [
  ...BIG_SPOTS.map(([x, y]): [number, number, number] => [x, y, BIG]),
  ...MEDIUM_SPOTS.map(([x, y]): [number, number, number] => [x, y, MEDIUM]),
];

export interface Spot { kind: 'big' | 'small'; x: number; y: number; k: number } // pitch units, centre of the footprint; k scales the drawing

/** Where the items go: trophies on their spots in order, balls on the ball spots in order. No item ever moves when one is added. */
export function spots(big: number, small: number): Spot[] {
  return [
    ...TROPHIES.slice(0, big).map(([x, y, k]): Spot => ({ kind: 'big', x, y, k })),
    ...BALLS.slice(0, Math.max(0, Math.min(small, CAPACITY - big))).map(([x, y]): Spot => ({ kind: 'small', x, y, k: 1 })),
  ];
}

/** The box a drawn item covers, in pitch units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  const [w, h] = s.kind === 'big' ? [TROPHY_W, TROPHY_H] : [BALL_D, BALL_D];
  return [s.x - (w / 2) * s.k, s.y - (h / 2) * s.k, s.x + (w / 2) * s.k, s.y + (h / 2) * s.k];
}

/** A football centred on (x, y) in units with radius r: a white ball, a patch in the middle and seams to the rim, black unless `colour` is given. */
function ball(sk: Sketch, p: Placement, x: number, y: number, r: number, colour = INK): string {
  const [cx, cy] = at(p, x, y);
  const body = sk.circle(cx, cy, 2 * r * p.s, { fill: BALL, strokeWidth: Math.max(1, r * 0.16), roughness: 0.4 });
  const corners: Pt[] = Array.from({ length: 5 }, (_, i): Pt => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [Math.cos(a), Math.sin(a)];
  });
  const patch = `<polygon points="${points(corners.map(([dx, dy]) => at(p, x + dx * r * 0.38, y + dy * r * 0.38)))}" fill="${esc(colour)}"/>`;
  const seams = corners.map(([dx, dy]) => {
    const [x0, y0] = at(p, x + dx * r * 0.38, y + dy * r * 0.38);
    const [x1, y1] = at(p, x + dx * r * 0.92, y + dy * r * 0.92);
    return `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}" stroke="${esc(colour)}" stroke-width="${num(Math.max(0.6, r * 0.12 * p.s))}" stroke-linecap="round"/>`;
  }).join('');
  return body + patch + seams;
}

/** A gold trophy with its footprint centred on (x, y) in units, scaled by `k`: a round foot, a stem, a tall cup with two handles and a ball on top. */
function trophy(sk: Sketch, p: Placement, x: number, y: number, k: number): string {
  const b = y + (TROPHY_H / 2) * k; // the bottom of the foot
  const u = (dx: number, dy: number) => `${x + dx * k} ${b + dy * k}`; // a point relative to the foot's bottom centre
  const sw = (w: number) => w * Math.max(0.6, k);
  const handles = sk.path(moved(p, `M ${u(-8, -31)} C ${u(-16, -31)} ${u(-16, -20)} ${u(-5, -18)}`), { stroke: GOLD_DARK, strokeWidth: sw(2.4), roughness: 0.4 }) +
    sk.path(moved(p, `M ${u(8, -31)} C ${u(16, -31)} ${u(16, -20)} ${u(5, -18)}`), { stroke: GOLD_DARK, strokeWidth: sw(2.4), roughness: 0.4 });
  const foot = sk.path(moved(p, `M ${u(-11, 0)} Q ${u(-11, -6)} ${u(0, -6)} Q ${u(11, -6)} ${u(11, 0)} Z`), { fill: GOLD_DARK, strokeWidth: sw(1.8), roughness: 0.4 });
  const stem = sk.path(moved(p, `M ${u(-2.5, -15)} L ${u(2.5, -15)} L ${u(3.5, -5.5)} L ${u(-3.5, -5.5)} Z`), { fill: GOLD, strokeWidth: sw(1.6), roughness: 0.4 });
  const cup = sk.path(moved(p, `M ${u(-9, -34)} L ${u(9, -34)} Q ${u(9, -18)} ${u(0, -14)} Q ${u(-9, -18)} ${u(-9, -34)} Z`), { fill: GOLD, strokeWidth: sw(2), roughness: 0.5 });
  const shine = `<polyline points="${points([[-6, -31], [-6, -24], [-3.5, -19]].map(([dx, dy]) => at(p, x + dx * k, b + dy * k)))}" fill="none" stroke="#fff" stroke-width="${num(1.6 * k * p.s)}" stroke-linecap="round" opacity="0.85"/>`;
  return handles + foot + stem + cup + shine + ball(sk, p, x, b - 37 * k, 5 * k);
}

function items(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) =>
    s.kind === 'big' ? item('big', i, ctx, trophy(sk, p, s.x, s.y, s.k)) : item('small', i, ctx, ball(sk, p, s.x, s.y, BALL_D / 2)),
  ).join('');
}

/** The grass in mown stripes from the touchline down, the touchline, the goal line and the penalty spot. */
function pitch(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const { box } = ctx;
  let stripes = '';
  for (let y = TOUCHLINE, i = 0; y < UNITS_H; y += 30, i++) {
    if (i % 2) continue;
    const [, y0] = at(p, 0, y);
    const [, y1] = at(p, 0, Math.min(UNITS_H, y + 30));
    stripes += `<rect x="${num(box.x)}" y="${num(y0)}" width="${num(box.w)}" height="${num(y1 - y0)}" fill="${GRASS_LIGHT}"/>`;
  }
  const touch = sk.line(...at(p, -2, TOUCHLINE), ...at(p, 312, TOUCHLINE), { stroke: LINE, strokeWidth: 3 * p.s, roughness: 0.6 });
  const goalLine = sk.line(...at(p, -2, GOAL_GROUND), ...at(p, 160, GOAL_GROUND), { stroke: LINE, strokeWidth: 3 * p.s, roughness: 0.6 });
  return `<g data-part="pitch">${stripes}${touch}${goalLine}</g>`;
}

/** The goal: a net behind two white posts and a crossbar. */
function goalNet(sk: Sketch, p: Placement): string {
  const back = sk.rect(...at(p, GOAL_X0, GOAL_TOP), (GOAL_X1 - GOAL_X0) * p.s, (GOAL_GROUND - GOAL_TOP) * p.s, { fill: NET, stroke: 'none', roughness: 0.4 });
  let mesh = '';
  const line = (a: Pt, c: Pt) => {
    const [x0, y0] = at(p, ...a);
    const [x1, y1] = at(p, ...c);
    return `<line x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}" stroke="${NET_LINE}" stroke-width="${num(Math.max(0.6, 0.9 * p.s))}"/>`;
  };
  for (let x = GOAL_X0 + 11; x < GOAL_X1; x += 11) mesh += line([x, GOAL_TOP], [x, GOAL_GROUND]);
  for (let y = GOAL_TOP + 11; y < GOAL_GROUND; y += 11) mesh += line([GOAL_X0, y], [GOAL_X1, y]);
  return back + mesh;
}

function goalFrame(sk: Sketch, p: Placement): string {
  const post = (x: number) => sk.rect(...at(p, x - 3, GOAL_TOP - 3), 6 * p.s, (GOAL_GROUND - GOAL_TOP + 3) * p.s, { fill: LINE, strokeWidth: 1.8, roughness: 0.4 });
  const bar = sk.rect(...at(p, GOAL_X0 - 3, GOAL_TOP - 3), (GOAL_X1 - GOAL_X0 + 6) * p.s, 6 * p.s, { fill: LINE, strokeWidth: 1.8, roughness: 0.4 });
  return post(GOAL_X0) + post(GOAL_X1) + bar;
}

const SHOT_X = 112; // the shot ball at rest, in the net
const SHOT_Y = 183;
export const SHOT_R = 9;
export const SHOT_FROM: Pt = [300, 236]; // where it is kicked from, right of the big trophies and below the balls, clear of both

/** One extra ball (not counted), the kid's match ball with patches in the kid colour, that bounces from the front of the pitch into the net once per cycle; at rest it lies in the net. */
function shot(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const style = `${timing(`${ctx.seedKey}:shot`, [10, 14])};--sx:${num((SHOT_FROM[0] - SHOT_X) * p.s)}px;--sy:${num((SHOT_FROM[1] - SHOT_Y) * p.s)}px;--hop:${num(-34 * p.s)}px`;
  return `<g data-part="shot"><g class="fb-anim fb-football-shot" style="${style}">${ball(sk, p, SHOT_X, SHOT_Y, SHOT_R, ctx.kid.colour)}</g></g>`;
}

/** The goal: net, the ball resting in it, and the frame in front. */
function goal(sk: Sketch, p: Placement, ctx: HalfContext): string {
  return `<g data-part="goal">${goalNet(sk, p)}${shot(sk, p, ctx)}${goalFrame(sk, p)}</g>`;
}

/** The corner flag at the right end of the touchline; the cloth in the kid colour waves from the pole. */
function flag(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const pole = sk.line(...at(p, 306, TOUCHLINE), ...at(p, 306, 12), { strokeWidth: 2.2, roughness: 0.3 });
  const cloth = sk.polygon([at(p, 306, 13), at(p, 284, 15), at(p, 284, 29), at(p, 306, 28)], { fill: ctx.kid.colour, strokeWidth: 1.6, roughness: 0.4 });
  return `<g data-part="flag">${pole}<g class="fb-anim fb-football-flag" style="${timing(`${ctx.seedKey}:flag`, [2.6, 3.4])}">${cloth}</g></g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box, UNITS);
  // Items come last with their own sketch, so adding an item never re-wobbles the scenery.
  return `<g>${pitch(sk, p, ctx)}${goal(sk, p, ctx)}${flag(sk, p, ctx)}${items(createSketch(`${ctx.seedKey}:items`), p, ctx)}</g>`;
}

const css = `
  @keyframes fb-football-shot {
    0% { transform: translate(var(--sx), var(--sy)); opacity: 0; }
    2% { transform: translate(var(--sx), var(--sy)); opacity: 1; }
    6% { transform: translate(calc(var(--sx) * 0.62), calc(var(--sy) * 0.62 + var(--hop))); }
    9% { transform: translate(calc(var(--sx) * 0.3), calc(var(--sy) * 0.3)); }
    11.5% { transform: translate(calc(var(--sx) * 0.12), calc(var(--sy) * 0.12 + var(--hop) * 0.4)); }
    14%, 95% { transform: translate(0, 0); opacity: 1; }
    100% { transform: translate(0, 0); opacity: 0; }
  }
  @keyframes fb-football-flag {
    0%, 100% { transform: skewY(0deg) scaleX(1); }
    25% { transform: skewY(5deg) scaleX(0.94); }
    50% { transform: skewY(0deg) scaleX(1); }
    75% { transform: skewY(-5deg) scaleX(0.96); }
  }
  .fb-football-shot { animation-name: fb-football-shot; animation-timing-function: linear; }
  .fb-football-flag { animation-name: fb-football-flag; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 100% 50%; }
`;

export const football: Theme = {
  id: 'football',
  label: 'Fußball',
  capacity: CAPACITY,
  background: GRASS,
  renderHalf,
  css,
};
