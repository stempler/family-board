import { describe, expect, it } from 'vitest';
import { CAPTURE_ORDER, POSITIONS, parsePlacement } from '../../src/themes/chess-positions';

type Board = (string | null)[][];

const BLACK_SET: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
const WHITE_SET: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1 };

function count(board: Board, pred: (piece: string) => boolean): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rank of board) for (const p of rank) if (p && pred(p)) out[p] = (out[p] ?? 0) + 1;
  return out;
}

const isWhite = (p: string): boolean => p === p.toUpperCase();
const isBlack = (p: string): boolean => p === p.toLowerCase();

function find(board: Board, piece: string): [number, number][] {
  const out: [number, number][] = [];
  board.forEach((rank, r) => rank.forEach((p, f) => p === piece && out.push([r, f])));
  return out;
}

/** True when any piece of the other colour attacks the given king square. */
function inCheck(board: Board, king: 'K' | 'k'): boolean {
  const [[kr, kf]] = find(board, king);
  const enemy = (p: string | null): p is string => !!p && (king === 'K' ? isBlack(p) : isWhite(p));
  const at = (r: number, f: number): string | null =>
    r >= 0 && r < 8 && f >= 0 && f < 8 ? board[r][f] : null;
  const lower = (p: string | null): string | null => (enemy(p) ? p.toLowerCase() : null);
  // Pawns: white pawns attack towards rank 8 (lower row index), black towards rank 1.
  const pawnRow = king === 'K' ? kr - 1 : kr + 1;
  if (lower(at(pawnRow, kf - 1)) === 'p' || lower(at(pawnRow, kf + 1)) === 'p') return true;
  const jumps = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  if (jumps.some(([dr, df]) => lower(at(kr + dr, kf + df)) === 'n')) return true;
  const rays: [number, number, string][] = [
    [1, 0, 'r'], [-1, 0, 'r'], [0, 1, 'r'], [0, -1, 'r'],
    [1, 1, 'b'], [1, -1, 'b'], [-1, 1, 'b'], [-1, -1, 'b'],
  ];
  for (const [dr, df, slider] of rays) {
    for (let r = kr + dr, f = kf + df; r >= 0 && r < 8 && f >= 0 && f < 8; r += dr, f += df) {
      const p = board[r][f];
      if (!p) continue;
      const l = lower(p);
      if (l === slider || l === 'q') return true;
      break;
    }
  }
  return false;
}

const boards = POSITIONS.map(parsePlacement);

describe('chess positions', () => {
  it('has a capture order of the 15 non-king black pieces', () => {
    const tally: Record<string, number> = {};
    for (const p of CAPTURE_ORDER) tally[p] = (tally[p] ?? 0) + 1;
    expect(tally).toEqual({ p: 8, n: 2, b: 2, r: 2, q: 1 });
    expect(CAPTURE_ORDER).toHaveLength(15);
  });

  it('has 16 positions, starting from the initial position', () => {
    expect(POSITIONS).toHaveLength(16);
    expect(POSITIONS[0]).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  });

  it('parses every position into 8 ranks of 8 files', () => {
    for (const board of boards) {
      expect(board).toHaveLength(8);
      for (const rank of board) expect(rank).toHaveLength(8);
    }
  });

  it('parses rank 8 first and file a first', () => {
    const b = parsePlacement('4k3/8/8/8/8/8/8/R3K3');
    expect(b[0][4]).toBe('k');
    expect(b[7][0]).toBe('R');
    expect(b[7][4]).toBe('K');
    expect(b[3][3]).toBeNull();
  });

  it('black board pieces plus the first k captures make the full black set', () => {
    boards.forEach((board, k) => {
      const tally = count(board, isBlack);
      for (const p of CAPTURE_ORDER.slice(0, k)) tally[p] = (tally[p] ?? 0) + 1;
      expect(tally, `position ${k}`).toEqual(BLACK_SET);
    });
  });

  it('has exactly one king per side', () => {
    boards.forEach((board, k) => {
      expect(find(board, 'K'), `position ${k}`).toHaveLength(1);
      expect(find(board, 'k'), `position ${k}`).toHaveLength(1);
    });
  });

  it('never has the kings on adjacent squares', () => {
    boards.forEach((board, k) => {
      const [[wr, wf]] = find(board, 'K');
      const [[br, bf]] = find(board, 'k');
      expect(Math.max(Math.abs(wr - br), Math.abs(wf - bf)), `position ${k}`).toBeGreaterThan(1);
    });
  });

  it('has no pawn on rank 1 or 8', () => {
    boards.forEach((board, k) => {
      for (const r of [0, 7]) {
        expect(board[r].filter((p) => p === 'P' || p === 'p'), `position ${k}`).toEqual([]);
      }
    });
  });

  it('never gives white more of a piece type than the start set', () => {
    boards.forEach((board, k) => {
      const tally = count(board, isWhite);
      for (const [p, n] of Object.entries(tally)) {
        expect(n, `position ${k} ${p}`).toBeLessThanOrEqual(WHITE_SET[p]);
      }
    });
  });

  it('white misses at most k + 2 pieces and keeps its king', () => {
    boards.forEach((board, k) => {
      const white = Object.values(count(board, isWhite)).reduce((a, b) => a + b, 0);
      expect(16 - white, `position ${k}`).toBeLessThanOrEqual(k + 2);
      expect(find(board, 'K'), `position ${k}`).toHaveLength(1);
    });
  });

  it('a side with both bishops has them on opposite square colours', () => {
    boards.forEach((board, k) => {
      for (const b of ['B', 'b']) {
        const squares = find(board, b);
        if (squares.length === 2) {
          const [[r1, f1], [r2, f2]] = squares;
          expect((r1 + f1) % 2, `position ${k} ${b}`).not.toBe((r2 + f2) % 2);
        }
      }
    });
  });

  it('has distinct positions', () => {
    expect(new Set(POSITIONS).size).toBe(POSITIONS.length);
  });

  it('has neither king in check', () => {
    boards.forEach((board, k) => {
      expect(inCheck(board, 'K'), `position ${k} white`).toBe(false);
      expect(inCheck(board, 'k'), `position ${k} black`).toBe(false);
    });
  });
});
