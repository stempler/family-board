import { timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { item, type HalfContext, type Theme } from './types';

// A chessboard on a green games table, drawn in "table units": the board is a
// 6×6 parallelogram (seen at a slight angle, each row further back shifts a
// little to the right), a big friendly king stands on the table at the left and
// a knight at the front right. Pieces in the kid's colour stand one per square:
// queens (big items) first, then pawns, filling the near row left to right and
// then the rows behind it, so nothing moves once it is placed. The king and the
// knight are ivory and stand off the board, so they never look like a point.
const MID = 160;
const UNITS_W = 320;
const TOP = 4; // room above the board for the crown of a queen on the back row
const TABLE_EDGE = 248; // front edge of the table top; the king and the knight stand just behind it
const BOTTOM = 258; // bottom of the table's front edge
const UNITS_H = BOTTOM - TOP;

const N = 6; // squares per side; capacity is N × N
const CAPACITY = N * N;
const SQ_W = 34; // width of a square
const SQ_D = 31; // depth of a square (foreshortened)
const SKEW = 6; // how far each row further back shifts right
const NEAR_X = 64; // near-left corner of the playing squares
const NEAR_Y = 214;
const FRAME = 0.24; // frame width, in squares
const FRAME_FACE = 10; // height of the board's front face

const WALL = '#f4e4d0';
const FELT = '#5c9a7c';
const FELT_DARK = '#447a60';
const TABLE_WOOD = '#7a4a2a';
const FRAME_WOOD = '#6b4423';
const FRAME_FACE_WOOD = '#55361c';
const LIGHT_SQ = '#fbf1dc';
const DARK_SQ = '#c49a6c';
const IVORY = '#fbf5e6';
const IVORY_SHADE = '#e8dcc2';
const GOLD = '#f2c12e';
const CHEEK = '#f4a7a0';

const SCENE_TOP = 0.17; // leave room for the board header
const SCENE_BOTTOM = 0.79; // leave room for the jar row

type Pt = [number, number];

interface Placement { cx: number; top: number; s: number }

function at(p: Placement, x: number, y: number): Pt {
  return [p.cx + (x - MID) * p.s, p.top + (y - TOP) * p.s];
}

/** Rewrites every "x y" pair of a path in table units into board coordinates. */
function moved(p: Placement, d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => at(p, +x, +y).map(num).join(' '));
}

/** Like `moved`, for a path drawn around (0, 0): scaled by `k` and placed at (cx, cy). */
function shape(p: Placement, cx: number, cy: number, d: string, k = 1): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => at(p, cx + k * +x, cy + k * +y).map(num).join(' '));
}

/** Fits the table into the scene band of `box`, horizontally centred, standing on the band's bottom. */
function placement(box: Box): Placement {
  const top = box.y + box.h * SCENE_TOP;
  const height = box.h * (SCENE_BOTTOM - SCENE_TOP);
  const s = Math.min(height / UNITS_H, (box.w * 0.92) / UNITS_W);
  return { cx: box.x + box.w / 2, top: top + (height - UNITS_H * s), s };
}

/** A point on the board, `u` squares from the left edge and `v` squares back from the near edge, in table units. */
function boardPt(u: number, v: number): Pt {
  return [NEAR_X + u * SQ_W + v * SKEW, NEAR_Y - v * SQ_D];
}

/** Square slots in filling order: near row left to right, then each row further back. The piece stands a little in front of the square's centre. */
const SLOTS: { x: number; y: number; row: number }[] = Array.from({ length: CAPACITY }, (_, i) => {
  const row = Math.floor(i / N);
  const [x, y] = boardPt((i % N) + 0.5, row + 0.26);
  return { x, y, row };
});

const quad = (p: Placement, pts: Pt[]): Pt[] => pts.map(([x, y]) => at(p, x, y));

function table(sk: Sketch, p: Placement): string {
  const top = sk.polygon(quad(p, [[8, 112], [312, 112], [320, TABLE_EDGE], [0, TABLE_EDGE]]), { fill: FELT, strokeWidth: 2.4, roughness: 0.8 });
  const band = sk.polygon(quad(p, [[2, 226], [318, 226], [320, TABLE_EDGE], [0, TABLE_EDGE]]), { fill: FELT_DARK, stroke: 'none', roughness: 0.6 });
  const front = sk.rect(...at(p, 0, TABLE_EDGE), UNITS_W * p.s, (BOTTOM - TABLE_EDGE) * p.s, { fill: TABLE_WOOD, strokeWidth: 2.4, roughness: 0.8 });
  return `<g data-part="table">${top}${band}${front}</g>`;
}

/** The frame with its front face, then the light board and the dark squares on it. */
function board(sk: Sketch, p: Placement): string {
  const lo = -FRAME;
  const hi = N + FRAME;
  const corners = [boardPt(lo, lo), boardPt(hi, lo), boardPt(hi, hi), boardPt(lo, hi)];
  const [nl, nr] = corners;
  const face = sk.polygon(quad(p, [nl, nr, [nr[0], nr[1] + FRAME_FACE], [nl[0], nl[1] + FRAME_FACE]]), { fill: FRAME_FACE_WOOD, strokeWidth: 2.2, roughness: 0.6 });
  const frame = sk.polygon(quad(p, corners), { fill: FRAME_WOOD, strokeWidth: 2.4, roughness: 0.7 });
  const field = sk.polygon(quad(p, [boardPt(0, 0), boardPt(N, 0), boardPt(N, N), boardPt(0, N)]), { fill: LIGHT_SQ, strokeWidth: 1.8, roughness: 0.5 });
  let dark = '';
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if ((r + c) % 2) continue; // the near-left square is dark, as on a real board
      dark += sk.polygon(quad(p, [boardPt(c, r), boardPt(c + 1, r), boardPt(c + 1, r + 1), boardPt(c, r + 1)]), { fill: DARK_SQ, stroke: 'none', roughness: 0.4 });
    }
  }
  return `<g data-part="board">${face}${frame}${field}${dark}</g>`;
}

const PIECE_K = 1.15; // piece size

/** A pawn in the kid's colour, standing at (x, y). */
function pawn(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const k = PIECE_K;
  const q = (pts: Pt[]) => pts.map(([dx, dy]) => at(p, x + dx * k, y + dy * k));
  const base = sk.polygon(q([[-11, 0], [11, 0], [9, -5], [-9, -5]]), { fill: colour, strokeWidth: 1.8, roughness: 0.4 });
  const body = sk.path(shape(p, x, y, 'M -7 -5 Q -4 -11 -3 -17 L 3 -17 Q 4 -11 7 -5 Z', k), { fill: colour, strokeWidth: 1.8, roughness: 0.4 });
  const collar = sk.ellipse(...q([[0, -17]])[0], 13 * k * p.s, 4 * k * p.s, { fill: colour, strokeWidth: 1.6, roughness: 0.3 });
  const head = sk.circle(...q([[0, -23.5]])[0], 12 * k * p.s, { fill: colour, strokeWidth: 1.8, roughness: 0.4 });
  const [gx, gy] = q([[-2, -25.5]])[0];
  const glint = `<circle cx="${num(gx)}" cy="${num(gy)}" r="${num(2 * k * p.s)}" fill="#fff" opacity="0.8"/>`;
  return base + body + collar + head + glint;
}

/** A queen: taller than a pawn, in the kid's colour, with a gold crown. */
function queen(sk: Sketch, p: Placement, x: number, y: number, colour: string): string {
  const k = PIECE_K;
  const q = (pts: Pt[]) => pts.map(([dx, dy]) => at(p, x + dx * k, y + dy * k));
  const base = sk.polygon(q([[-12, 0], [12, 0], [10, -6], [-10, -6]]), { fill: colour, strokeWidth: 2, roughness: 0.4 });
  const body = sk.path(shape(p, x, y, 'M -8 -6 Q -4 -15 -3.5 -24 L 3.5 -24 Q 4 -15 8 -6 Z', k), { fill: colour, strokeWidth: 2, roughness: 0.4 });
  const collar = sk.ellipse(...q([[0, -24]])[0], 15 * k * p.s, 4.5 * k * p.s, { fill: colour, strokeWidth: 1.6, roughness: 0.3 });
  const crown = sk.polygon(q([[-6, -26], [6, -26], [9, -36], [4, -31], [0, -37], [-4, -31], [-9, -36]]), { fill: GOLD, strokeWidth: 1.6, roughness: 0.3 });
  const [bx, by] = q([[0, -38.5]])[0];
  const ball = `<circle cx="${num(bx)}" cy="${num(by)}" r="${num(2.4 * k * p.s)}" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>`;
  const shine = sk.path(shape(p, x, y, 'M -4 -8 Q -2 -15 -1.5 -20', k), { stroke: '#ffffff', strokeWidth: 2, roughness: 0.3 });
  return base + body + collar + crown + ball + `<g opacity="0.7">${shine}</g>`;
}

/** Pieces drawn back row first so nearer pieces overlap the ones behind; each square has its own sketch so a new piece never changes another's wobble. */
function pieces(p: Placement, ctx: HalfContext): string {
  const { big, small } = ctx.groups;
  const colour = ctx.kid.colour;
  const n = Math.min(big + small, SLOTS.length);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => SLOTS[b].row - SLOTS[a].row || a - b);
  let out = '';
  for (const i of order) {
    const isBig = i < big;
    const { x, y } = SLOTS[i];
    const sk = createSketch(`${ctx.seedKey}:square:${i}`);
    const body = isBig ? queen(sk, p, x, y, colour) : pawn(sk, p, x, y, colour);
    out += item(isBig ? 'big' : 'small', i, ctx.newFrom, `<g data-slot="${i}">${body}</g>`);
  }
  return out;
}

const KING_X = 33;

/** A big ivory king with a friendly face standing on the table at the left; about every 16 s he tips his crown. */
function king(sk: Sketch, p: Placement, seedKey: string): string {
  const base = sk.polygon(quad(p, [[KING_X - 26, 246], [KING_X + 26, 246], [KING_X + 22, 234], [KING_X - 22, 234]]), { fill: IVORY, strokeWidth: 2.4, roughness: 0.6 });
  const rim = sk.rect(...at(p, KING_X - 20, 226), 40 * p.s, 8 * p.s, { fill: IVORY_SHADE, strokeWidth: 2, roughness: 0.5 });
  const body = sk.path(shape(p, KING_X, 0, 'M -16 226 Q -10 190 -8 154 L 8 154 Q 10 190 16 226 Z'), { fill: IVORY, strokeWidth: 2.4, roughness: 0.6 });
  const collar = sk.ellipse(...at(p, KING_X, 152), 34 * p.s, 9 * p.s, { fill: IVORY_SHADE, strokeWidth: 2, roughness: 0.5 });
  const head = sk.circle(...at(p, KING_X, 130), 38 * p.s, { fill: IVORY, strokeWidth: 2.4, roughness: 0.6 });
  let face = '';
  for (const dx of [-7, 7]) {
    const [ex, ey] = at(p, KING_X + dx, 127);
    const [cx, cy] = at(p, KING_X + dx * 1.5, 136);
    face += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(3.4 * p.s)}" fill="${CHEEK}" opacity="0.7"/><circle cx="${num(ex)}" cy="${num(ey)}" r="${num(2.4 * p.s)}" fill="${INK}"/>`;
  }
  const smile = sk.path(moved(p, `M ${KING_X - 6} 137 Q ${KING_X} 142 ${KING_X + 6} 137`), { strokeWidth: 1.8, roughness: 0.3 });
  const shine = sk.path(moved(p, `M ${KING_X - 9} 210 Q ${KING_X - 6} 186 ${KING_X - 5} 166`), { stroke: '#ffffff', strokeWidth: 3, roughness: 0.4 });
  const crownBody = sk.polygon(quad(p, [[KING_X - 17, 114], [KING_X + 17, 114], [KING_X + 21, 90], [KING_X + 10, 101], [KING_X, 86], [KING_X - 10, 101], [KING_X - 21, 90]]), { fill: GOLD, strokeWidth: 2.2, roughness: 0.5 });
  const cross = sk.rect(...at(p, KING_X - 2.5, 44), 5 * p.s, 44 * p.s, { fill: GOLD, strokeWidth: 1.8, roughness: 0.4 }) +
    sk.rect(...at(p, KING_X - 9, 54), 18 * p.s, 5 * p.s, { fill: GOLD, strokeWidth: 1.8, roughness: 0.4 });
  let jewels = '';
  for (const [dx, fill] of [[-9, '#d64545'], [0, '#3d7fd6'], [9, '#d64545']] as const) {
    const [jx, jy] = at(p, KING_X + dx, 108);
    jewels += `<circle cx="${num(jx)}" cy="${num(jy)}" r="${num(2.6 * p.s)}" fill="${fill}" stroke="${INK}" stroke-width="1"/>`;
  }
  const crown = `<g class="fb-anim fb-chess-tip" style="${timing(`${seedKey}:tip`, [15, 17])}">${cross}${crownBody}${jewels}</g>`;
  return `<g data-part="king">${base}${rim}${body}<g opacity="0.7">${shine}</g>${collar}${head}${face}${smile}${crown}</g>`;
}

const KNIGHT_X = 296;

/** An ivory knight on the table in front of the board's right corner, facing the board; about every 12 s it hops. */
function knight(sk: Sketch, p: Placement, seedKey: string): string {
  const y = 246;
  const base = sk.polygon(quad(p, [[KNIGHT_X - 17, y], [KNIGHT_X + 17, y], [KNIGHT_X + 14, y - 8], [KNIGHT_X - 14, y - 8]]), { fill: IVORY, strokeWidth: 2.2, roughness: 0.5 });
  const collar = sk.rect(...at(p, KNIGHT_X - 13, y - 14), 26 * p.s, 6 * p.s, { fill: IVORY_SHADE, strokeWidth: 2, roughness: 0.5 });
  const head = sk.path(shape(p, KNIGHT_X, y, 'M 12 -14 L 11 -34 Q 9 -50 -1 -57 L 1 -66 L -6 -59 Q -15 -57 -21 -47 L -25 -38 Q -27 -31 -20 -30 L -10 -33 Q -6 -30 -9 -23 L -12 -14 Z'), { fill: IVORY, strokeWidth: 2.4, roughness: 0.6 });
  const mane = sk.path(shape(p, KNIGHT_X, y, 'M 11 -30 Q 12 -46 3 -54 M 11 -36 L 15 -38 M 10 -43 L 14 -46 M 7 -49 L 10 -53'), { stroke: '#b89a6e', strokeWidth: 1.8, roughness: 0.4 });
  const [ex, ey] = at(p, KNIGHT_X - 9, y - 48);
  const [nx, ny] = at(p, KNIGHT_X - 22, y - 36);
  const face = `<circle cx="${num(ex)}" cy="${num(ey)}" r="${num(2.4 * p.s)}" fill="${INK}"/><circle cx="${num(nx)}" cy="${num(ny)}" r="${num(1.3 * p.s)}" fill="${INK}"/>`;
  const piece = `<g class="fb-anim fb-chess-hop" style="${timing(`${seedKey}:hop`, [11, 13])}">${base}${collar}${head}${mane}${face}</g>`;
  return `<g data-part="knight">${piece}</g>`;
}

function renderHalf(ctx: HalfContext): string {
  const sk = createSketch(ctx.seedKey);
  const p = placement(ctx.box);
  return `<g>${table(sk, p)}${board(sk, p)}${king(sk, p, ctx.seedKey)}${pieces(p, ctx)}${knight(sk, p, ctx.seedKey)}</g>`;
}

const css = `
  @keyframes fb-chess-hop {
    0%, 86%, 92%, 96%, 100% { transform: translate(0, 0) rotate(0deg); }
    89% { transform: translate(0, -18px) rotate(-8deg); }
    94% { transform: translate(0, -5px) rotate(0deg); }
  }
  @keyframes fb-chess-tip {
    0%, 84%, 97%, 100% { transform: rotate(0deg); }
    88%, 93% { transform: rotate(-14deg); }
  }
  .fb-chess-hop { animation-name: fb-chess-hop; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
  .fb-chess-tip { animation-name: fb-chess-tip; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 0% 100%; }
`;

export const chess: Theme = {
  id: 'chess',
  capacity: CAPACITY,
  background: WALL,
  renderHalf,
  css,
};
