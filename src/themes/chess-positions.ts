/**
 * Chess positions for the chess theme: one game, white (the kid) against black.
 * POSITIONS[k] is the board once black has lost the first k pieces of CAPTURE_ORDER.
 * Every position comes from one real game (an Italian opening, castled kings): each
 * snapshot is taken just before white's next capture, so black's recaptures are shown.
 * Placement fields only (rank 8 first), as in FEN.
 */

/** Black's pieces in the order the kid captures them (lowercase FEN letters). */
export const CAPTURE_ORDER: readonly string[] = [
  'p', 'n', 'b', 'p', 'n', 'p', 'p', 'p', 'b', 'p', 'r', 'p', 'q', 'p', 'r',
];

export const POSITIONS: readonly string[] = [
  // k=0: start position
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  // k=1: Italian opening, both castled; d4 break, Bxd4 Nxd4
  'r1bq1rk1/1pp1bpp1/p2p1n1p/8/2BnP3/2N2N1P/PPP2PP1/R2Q1RK1',
  // k=2: Nxd4 c5, Nf5 Bxf5
  'r2q1rk1/1p2bpp1/p2p1n1p/2p2b2/2B1P3/2N4P/PPP2PP1/R2Q1RK1',
  // k=3: exf5 d5, attacking the bishop
  'r2q1rk1/1p2bpp1/p4n1p/2pp1P2/2B5/2N4P/PPP2PP1/R2Q1RK1',
  // k=4: Nxd5 Nxd5
  'r2q1rk1/1p2bpp1/p6p/2pn1P2/2B5/7P/PPP2PP1/R2Q1RK1',
  // k=5: Bxd5 Bf6
  'r2q1rk1/1p3pp1/p4b1p/2pB1P2/8/7P/PPP2PP1/R2Q1RK1',
  // k=6: Bxb7 Rb8
  '1r1q1rk1/1B3pp1/p4b1p/2p2P2/8/7P/PPP2PP1/R2Q1RK1',
  // k=7: Bxa6 Rxb2, Qd3 c4
  '3q1rk1/5pp1/B4b1p/5P2/2p5/3Q3P/PrP2PP1/R4RK1',
  // k=8: Qxc4; f4 forks queen and bishop
  '5rk1/5pp1/B4q1p/3RbP2/2Q2P2/7P/PrP3P1/5RK1',
  // k=9: fxe5 Qe7, Rd7 Qxe5
  '5rk1/3R1pp1/B6p/4qP2/2Q5/7P/PrP3P1/5RK1',
  // k=10: Rxf7 Rxf7, the rook is pinned
  '6k1/5rp1/B6p/4qP2/2Q5/7P/PrP3P1/5RK1',
  // k=11: Qxf7 Kh8, Bd3 Qe3+ Kh1 Qg5, f6 gxf6
  '7k/5Q2/5p1p/6q1/8/3B3P/PrP3P1/5R1K',
  // k=12: Rxf6 Qxf6
  '7k/5Q2/5q1p/8/8/3B3P/PrP3P1/7K',
  // k=13: Qxf6+ Kg8
  '6k1/8/5Q1p/8/8/3B3P/PrP3P1/7K',
  // k=14: Qxh6 Rxc2
  '6k1/8/7Q/8/8/3B3P/P1r3P1/7K',
  // k=15: Bxc2, only black's king is left
  '6k1/8/7Q/8/8/7P/P1B3P1/7K',
];

/** Parses a FEN placement field into 8 ranks (rank 8 first) of 8 files (a first). */
export function parsePlacement(fen: string): (string | null)[][] {
  return fen.split('/').map((rank) => {
    const squares: (string | null)[] = [];
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') squares.push(...Array<null>(Number(ch)).fill(null));
      else squares.push(ch);
    }
    return squares;
  });
}
