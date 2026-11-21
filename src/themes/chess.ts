import { rand, timing } from '../draw/anim';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { at, mapPath, placement, type Placement, type Pt, type Units } from '../draw/units';
import { groupItems, newItemRange, type ItemGroups, type NewRange } from '../items';
import { CAPTURE_ORDER, parsePlacement, POSITIONS } from './chess-positions';
import { item, type HalfContext, type Theme } from './types';

// The kid plays one game after another. Every point captures one of the opponent's 15 pieces
// (the king is never captured); the 16th point is the checkmate, the game is won and a new one
// starts. Points → wins = floor(points / 16), captured = points mod 16.
//
// The scene, in "scene units" (fitted into the scene band of the half), seen from the front:
// a wall shelf at the top holds one toppled dark king per won game (kings merge into trophies,
// minimal replacement, see groupItems); below it a green games table with a top-down 8×8 board
// showing POSITIONS[captured] (kid = white, drawn in the kid colour; opponent = dark), and the
// captured pieces lined up beside the board in two rows of 8 along its right edge.
//
// Counted items (data-item), in this order: shelf trophies (big), shelf kings (small), then the
// captured pieces in capture order. The board pieces are scenery.

export const SHELF_CAP = 10; // kings and trophies on the shelf
export const SHELF_UNITS: readonly number[] = [5, 25, 125]; // wins per trophy

const W = 300; // scene width
const H = 280; // scene height
const MID = W / 2;
/** The scene sits in the middle of the scene band, not at its bottom. */
const UNITS: Units = { mid: MID, top: 0, w: W, h: H, fill: 0.92, align: 'centre' };

const SHELF_Y = 32; // top of the shelf plank; shelf items stand on it
const SLOT_W = 29; // shelf slot pitch
const TABLE_Y = 46; // top edge of the table
const S = 26; // board square size
const FRAME = 9; // board frame width
const BX = 18; // left edge of the squares
const BY = 59; // top edge of the squares (rank 8)
const CAP_X = [251, 279]; // centres of the two captured rows, beside the board's right edge
const PIECE_K = 0.95; // piece size relative to the drawings below (base 16 wide, up to 25 tall)
const BASE_INSET = 3.5; // a piece stands this far above the bottom of its square
const KING_K = 1.05; // size of a toppled king on the shelf

const WALL = '#f4e4d0';
const SHELF_WOOD = '#8a5a34';
const FELT = '#5c9a7c';
const TABLE_WOOD = '#7a4a2a';
const FRAME_WOOD = '#6b4423';
const LIGHT_SQ = '#fbf1dc';
const DARK_SQ = '#c49a6c';
const DARK_PIECE = '#2f2723';
const DARK_DETAIL = '#e8dcc2';
const GOLD = '#f2c12e';
const GOLD_DARK = '#c99a12';

/** Maps a drawing's local coordinates (piece base centre at 0 0, y up is negative) into the half. */
type Local = (x: number, y: number) => Pt;

function local(p: Placement, x0: number, y0: number, k: number, lying = false): Local {
  // Lying: the piece's up direction points right, its base at the left.
  return (x, y) => (lying ? at(p, x0 - k * y, y0 + k * x) : at(p, x0 + k * x, y0 + k * y));
}

// Piece silhouettes, front view, base centred at 0 0. Chunky so they read at ~20 px.
interface Art { body: string; balls?: [number, number, number][]; detail?: string }

const ART: Record<string, Art> = {
  p: { body: 'M -8 0 L 8 0 L 7.5 -3 L 4 -4.5 Q 2.5 -8 3.5 -11.5 L -3.5 -11.5 Q -2.5 -8 -4 -4.5 L -7.5 -3 Z', balls: [[0, -15.5, 5]] },
  r: { body: 'M -8 0 L 8 0 L 8 -3.5 L 5.5 -5 L 5 -14 L 7.5 -15.5 L 7.5 -21 L 4.5 -21 L 4.5 -18.5 L 1.5 -18.5 L 1.5 -21 L -1.5 -21 L -1.5 -18.5 L -4.5 -18.5 L -4.5 -21 L -7.5 -21 L -7.5 -15.5 L -5 -14 L -5.5 -5 L -8 -3.5 Z' },
  n: {
    body: 'M -7 0 L 8.5 0 L 8.5 -3.5 L 6.5 -4.5 Q 9 -13 5.5 -19 Q 2 -23.5 -2.5 -22 L -3.5 -24.5 L -5.5 -21 Q -9 -18.5 -9.5 -13.5 L -9.5 -11.5 Q -7.5 -9.5 -4 -12 Q -2 -9.5 -4 -6 L -6 -4.5 L -7.5 -3.5 Z',
    balls: [[-4, -17.5, 1.2]],
    detail: 'M 1.5 -21 Q 6 -17 6 -10',
  },
  b: {
    body: 'M -8 0 L 8 0 L 7.5 -3 L 3.5 -4.5 Q 6.5 -10 5.5 -14 Q 4 -19 0 -21.5 Q -4 -19 -5.5 -14 Q -6.5 -10 -3.5 -4.5 L -7.5 -3 Z',
    balls: [[0, -23.2, 2]],
    detail: 'M 0.5 -17.5 L 3.2 -13.5',
  },
  q: {
    body: 'M -8 0 L 8 0 L 7.5 -3 L 4.5 -4.5 L 8.5 -18 L 4 -12.5 L 2.2 -20 L 0 -13 L -2.2 -20 L -4 -12.5 L -8.5 -18 L -4.5 -4.5 L -7.5 -3 Z',
    balls: [[-8.5, -19.3, 1.7], [-2.2, -21.3, 1.7], [2.2, -21.3, 1.7], [8.5, -19.3, 1.7]],
  },
  k: {
    body: 'M -8 0 L 8 0 L 7.5 -3 L 4.5 -4.5 L 6.5 -15 Q 6.5 -18.5 0 -18.5 Q -6.5 -18.5 -6.5 -15 L -4.5 -4.5 L -7.5 -3 Z ' +
      'M -1.3 -18.5 L -1.3 -21 L -3.6 -21 L -3.6 -23.2 L -1.3 -23.2 L -1.3 -25.5 L 1.3 -25.5 L 1.3 -23.2 L 3.6 -23.2 L 3.6 -21 L 1.3 -21 L 1.3 -18.5 Z',
  },
};

/** One piece (`scale`: box units per drawing unit): `letter` in FEN case (uppercase = the kid, in the kid colour; lowercase = the opponent, dark). */
function piece(sk: Sketch, f: Local, scale: number, letter: string, kidColour: string): string {
  const kid = letter === letter.toUpperCase();
  const art = ART[letter.toLowerCase()];
  const fill = kid ? kidColour : DARK_PIECE;
  const detailColour = kid ? INK : DARK_DETAIL;
  let out = sk.path(mapPath(art.body, f), { fill, strokeWidth: 1.5, roughness: 0.35 });
  for (const [x, y, r] of art.balls ?? []) {
    // A tiny ball (an eye) is a detail mark; a bigger one (a pawn head, a crown ball) is part of the body.
    out += r < 1.5 ? sk.circle(...f(x, y), 2 * r * scale, { fill: detailColour, stroke: 'none', roughness: 0.2 }) : sk.circle(...f(x, y), 2 * r * scale, { fill, strokeWidth: 1.3, roughness: 0.3 });
  }
  if (art.detail) out += sk.path(mapPath(art.detail, f), { stroke: detailColour, strokeWidth: 1.2, roughness: 0.25 });
  return out;
}

/** The wall shelf and the games table with the board frame and its squares (scenery). */
function furniture(sk: Sketch, p: Placement): string {
  const [sx, sy] = at(p, 2, SHELF_Y);
  const plank = sk.rect(sx, sy, (W - 4) * p.s, 7 * p.s, { fill: SHELF_WOOD, strokeWidth: 2, roughness: 0.6 });
  let brackets = '';
  for (const x of [30, W - 30]) brackets += sk.polygon([at(p, x - 4, SHELF_Y + 7), at(p, x + 4, SHELF_Y + 7), at(p, x, SHELF_Y + 12)], { fill: SHELF_WOOD, strokeWidth: 1.6, roughness: 0.4 });
  const [tx, ty] = at(p, 0, TABLE_Y);
  const rim = sk.rect(tx, ty, W * p.s, (H - TABLE_Y) * p.s, { fill: TABLE_WOOD, strokeWidth: 2.4, roughness: 0.7 });
  const [fx, fy] = at(p, 4, TABLE_Y + 4);
  const felt = sk.rect(fx, fy, (W - 8) * p.s, (H - TABLE_Y - 8) * p.s, { fill: FELT, strokeWidth: 1.6, roughness: 0.6 });
  const [ox, oy] = at(p, BX - FRAME, BY - FRAME);
  const frame = sk.rect(ox, oy, (8 * S + 2 * FRAME) * p.s, (8 * S + 2 * FRAME) * p.s, { fill: FRAME_WOOD, strokeWidth: 2.4, roughness: 0.6 });
  const [qx, qy] = at(p, BX, BY);
  const field = sk.rect(qx, qy, 8 * S * p.s, 8 * S * p.s, { fill: LIGHT_SQ, strokeWidth: 1.6, roughness: 0.4 });
  let dark = '';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if ((r + f) % 2 === 0) continue; // a8 is light, a1 is dark
      dark += sk.rect(...at(p, BX + f * S, BY + r * S), S * p.s, S * p.s, { fill: DARK_SQ, stroke: 'none', roughness: 0.3 });
    }
  }
  return `<g data-part="shelf-wood">${plank}${brackets}</g><g data-part="table">${rim}${felt}</g><g data-part="squares">${frame}${field}${dark}</g>`;
}

/** The pieces of POSITIONS[captured], back rank first so nearer pieces overlap the ones behind; one kid piece hops now and then. */
function board(p: Placement, ctx: HalfContext, captured: number): string {
  const ranks = parsePlacement(POSITIONS[captured]);
  const kidSquares = ranks.flatMap((rank, r) => rank.flatMap((pc, f) => (pc && pc === pc.toUpperCase() ? [`${r}:${f}`] : [])));
  const hopper = kidSquares[Math.floor(rand(`${ctx.seedKey}:hopper`) * kidSquares.length)];
  let out = '';
  ranks.forEach((rank, r) => rank.forEach((letter, f) => {
    if (!letter) return;
    const square = `${'abcdefgh'[f]}${8 - r}`;
    const sk = createSketch(`${ctx.seedKey}:piece:${square}:${letter}`);
    const g = `<g data-square="${square}" data-piece="${letter}">${piece(sk, local(p, BX + (f + 0.5) * S, BY + (r + 1) * S - BASE_INSET, PIECE_K), PIECE_K * p.s, letter, ctx.kid.colour)}</g>`;
    out += `${r}:${f}` === hopper ? `<g class="fb-anim fb-chess-hop" style="${timing(`${ctx.seedKey}:hop`, [9, 11])};--hop:${num(9 * p.s)}px">${g}</g>` : g;
  }));
  return `<g data-part="board">${out}</g>`;
}

/** A gold trophy cup standing at local 0 0; one star per unit step above 5 wins. */
function trophy(sk: Sketch, f: Local, stars: number): string {
  const cup = sk.path(mapPath('M -9 -27 L 9 -27 Q 9.5 -15 2.5 -12 L 2.5 -6 L 6.5 -4 L 6.5 0 L -6.5 0 L -6.5 -4 L -2.5 -6 L -2.5 -12 Q -9.5 -15 -9 -27 Z', f), { fill: GOLD, strokeWidth: 1.6, roughness: 0.35 });
  const handles = sk.path(mapPath('M -8.8 -24 Q -14 -24 -13 -19 Q -12 -16 -6.5 -15.5 M 8.8 -24 Q 14 -24 13 -19 Q 12 -16 6.5 -15.5', f), { stroke: GOLD_DARK, strokeWidth: 2, roughness: 0.3 });
  const shine = sk.path(mapPath('M -5.5 -24 Q -5.5 -18 -2.5 -15.5', f), { stroke: '#ffffff', strokeWidth: 1.6, roughness: 0.2 });
  let star = '';
  for (let i = 0; i < stars; i++) {
    const cx = (i - (stars - 1) / 2) * 6;
    const pts: Pt[] = Array.from({ length: 10 }, (_, j) => {
      const a = -Math.PI / 2 + (j * Math.PI) / 5;
      const r = j % 2 ? 1.3 : 3;
      return f(cx + r * Math.cos(a), -20 + r * Math.sin(a));
    });
    star += sk.polygon(pts, { fill: '#ffffff', strokeWidth: 0.8, roughness: 0.1 });
  }
  return `${handles}${cup}<g opacity="0.7">${shine}</g>${star}`;
}

/** Won games: trophies first, then toppled dark kings, each in its own shelf slot. */
function shelf(p: Placement, ctx: HalfContext, g: ItemGroups): string {
  let out = '';
  const n = g.big + g.small;
  for (let i = 0; i < n; i++) {
    const big = i < g.big;
    const x = MID + (i - (SHELF_CAP - 1) / 2) * SLOT_W;
    const sk = createSketch(`${ctx.seedKey}:shelf:${i}:${big ? `trophy${g.unit}` : 'king'}`);
    const body = big
      ? `<g data-trophy="${g.unit}">${trophy(sk, local(p, x, SHELF_Y, 1), SHELF_UNITS.indexOf(g.unit))}</g>`
      : `<g data-king="toppled">${piece(sk, local(p, x - 12.75 * KING_K, SHELF_Y - 8 * KING_K, KING_K, true), KING_K * p.s, 'k', ctx.kid.colour)}</g>`;
    out += item(big ? 'big' : 'small', i, ctx, body);
  }
  return `<g data-part="shelf">${out}</g>`;
}

/** The captured pieces beside the board: the row next to the board top to bottom, then the outer row. */
function capturedRow(p: Placement, ctx: HalfContext, captured: number, first: number): string {
  let out = '';
  for (let j = 0; j < captured; j++) {
    const letter = CAPTURE_ORDER[j];
    const sk = createSketch(`${ctx.seedKey}:captured:${j}`);
    const f = local(p, CAP_X[Math.floor(j / 8)], BY + ((j % 8) + 1) * S - BASE_INSET, PIECE_K);
    out += item('small', first + j, ctx, `<g data-captured="${letter}">${piece(sk, f, PIECE_K * p.s, letter, ctx.kid.colour)}</g>`);
  }
  return `<g data-part="captured">${out}</g>`;
}

/** Wins and captured pieces for `points` (negative or invalid points count as 0). */
function split(points: number): { wins: number; captured: number } {
  const n = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  return { wins: Math.floor(n / 16), captured: n % 16 };
}

function items(points: number, prev: number | undefined): { total: number } & NewRange {
  const cur = split(points);
  const g = groupItems(cur.wins, SHELF_CAP, SHELF_UNITS);
  const shelfCount = g.big + g.small;
  const total = shelfCount + cur.captured;
  const none = { total, newFrom: total, newTo: total };
  if (typeof prev !== 'number' || !Number.isFinite(prev)) return none;
  const before = split(prev);
  // A new win pops only the new king or trophy; the captured row empties for the next game.
  if (cur.wins > before.wins) return { total, ...newItemRange(before.wins, cur.wins, SHELF_CAP, SHELF_UNITS) };
  if (cur.wins === before.wins && cur.captured > before.captured) return { total, newFrom: shelfCount + before.captured, newTo: total };
  return none;
}

function renderHalf(ctx: HalfContext): string {
  const p = placement(ctx.box, UNITS);
  const { wins, captured } = split(ctx.kid.points);
  const g = groupItems(wins, SHELF_CAP, SHELF_UNITS);
  return `<g>${furniture(createSketch(ctx.seedKey), p)}${board(p, ctx, captured)}${shelf(p, ctx, g)}${capturedRow(p, ctx, captured, g.big + g.small)}</g>`;
}

const css = `
  @keyframes fb-chess-hop {
    0%, 88%, 95%, 99%, 100% { transform: translate(0, 0); }
    91.5% { transform: translate(0, calc(var(--hop) * -1)); }
    97% { transform: translate(0, calc(var(--hop) * -0.28)); }
  }
  .fb-chess-hop { animation-name: fb-chess-hop; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
`;

export const chess: Theme = {
  id: 'chess',
  capacity: SHELF_CAP + 15, // the most items chess draws; `items` below does the grouping, not `capacity`
  background: WALL,
  renderHalf,
  items,
  css,
};
