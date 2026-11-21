import { describe, expect, it } from 'vitest';
import { groupItems } from '../../src/items';
import { CAPTURE_ORDER, parsePlacement, POSITIONS } from '../../src/themes/chess-positions';
import { SHELF_CAP, SHELF_UNITS } from '../../src/themes/chess';
import { THEMES } from '../../src/themes/registry';
import { contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.chess);

const chess = THEMES.chess;
const half = (points: number, colour?: string) => {
  const ctx = contractCtx(chess, points);
  return chess.renderHalf(colour ? { ...ctx, kid: { ...ctx.kid, colour } } : ctx);
};

/** The markup of the group with data-part="<name>". */
function part(svg: string, name: string): string {
  const open = svg.indexOf(`<g data-part="${name}"`);
  expect(open).toBeGreaterThanOrEqual(0);
  return group(svg, open);
}

/** The markup of the group opening at `open`. */
function group(svg: string, open: number): string {
  let depth = 0;
  for (const m of svg.slice(open).matchAll(/<g[\s>]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(open, open + m.index! + 4);
  }
  throw new Error('unclosed group');
}

const items = (svg: string) => svg.match(/data-item="(small|big)"/g) ?? [];

/** Every piece on the board as [square, letter]. */
function boardPieces(svg: string): [string, string][] {
  return [...part(svg, 'board').matchAll(/data-square="([a-h][1-8])" data-piece="([pnbrqkPNBRQK])"/g)].map((m) => [m[1], m[2]]);
}

describe('chess', () => {
  it('scales the hop height with the placement', () => {
    const hop = (w: number) => {
      const ctx = contractCtx(chess, 20);
      const svg = chess.renderHalf({ ...ctx, box: { ...ctx.box, w } });
      return Number(/--hop:([\d.]+)px/.exec(svg)![1]);
    };
    expect(hop(160)).toBeLessThan(hop(400));
    expect(hop(400)).toBeLessThanOrEqual(9);
    expect(chess.css).toContain('var(--hop)');
  });

  it('uses a shelf of 10 with trophies worth 5, 25 and 125 wins', () => {
    expect(SHELF_CAP).toBe(10);
    expect(SHELF_UNITS).toEqual([5, 25, 125]);
    expect(chess.capacity).toBe(SHELF_CAP + 15);
  });

  it.each([[0, 0, 0], [15, 0, 15], [16, 1, 0], [17, 1, 1], [31, 1, 15], [32, 2, 0], [80, 5, 0], [81, 5, 1]])(
    '%i points → %i wins, %i captured', (p, w, c) => {
      const out = half(p);
      expect(items(part(out, 'shelf'))).toHaveLength(w);
      expect(items(part(out, 'captured'))).toHaveLength(c);
      expect(items(out)).toHaveLength(w + c);
      expect(chess.items!(p, undefined).total).toBe(w + c);
    });

  it('merges kings into trophies only past 10 wins', () => {
    const shelf = (p: number) => part(half(p), 'shelf');
    expect(shelf(160).match(/data-item="small"/g)).toHaveLength(10);
    expect(shelf(160)).not.toContain('data-item="big"');
    const g = groupItems(11, SHELF_CAP, SHELF_UNITS);
    expect(shelf(176).match(/data-item="big"/g)).toHaveLength(g.big);
    expect(shelf(176).match(/data-item="small"/g)).toHaveLength(g.small);
  });

  it('puts trophies first, then kings, then the captured pieces in capture order', () => {
    const out = half(16 * 11 + 4);
    const order = [...out.matchAll(/data-item="(small|big)"><g data-(trophy|king|captured)="([^"]*)"/g)].map((m) => `${m[1]}:${m[2]}:${m[3]}`);
    expect(order).toEqual(['big:trophy:5', ...Array(6).fill('small:king:toppled'), ...CAPTURE_ORDER.slice(0, 4).map((c) => `small:captured:${c}`)]);
  });

  it('pops only the new king at a game boundary', () => {
    expect(chess.items!(32, 31)).toEqual({ total: 2, newFrom: 1, newTo: 2 });
  });
  it('pops only the new trophy when kings merge', () => {
    expect(chess.items!(176, 175)).toEqual({ total: 7, newFrom: 0, newTo: 1 }); // 10 kings + 15 captured → 1 trophy + 6 kings
  });
  it('pops the newest captured piece', () => {
    expect(chess.items!(19, 18)).toEqual({ total: 4, newFrom: 3, newTo: 4 }); // 1 king + 3 captured
  });
  it('pops every newly captured piece after a jump within a game', () => {
    expect(chess.items!(21, 18)).toEqual({ total: 6, newFrom: 3, newTo: 6 });
  });
  it('pops nothing when points go down', () => {
    expect(chess.items!(31, 33)).toMatchObject({ newFrom: 16, newTo: 16 });
  });
  it('pops nothing without previous points or when unchanged', () => {
    expect(chess.items!(19, undefined)).toMatchObject({ newFrom: 4, newTo: 4 });
    expect(chess.items!(19, 19)).toMatchObject({ newFrom: 4, newTo: 4 });
  });
  it('survives odd point values', () => {
    for (const p of [-5, NaN, Infinity, 2.5]) {
      const r = chess.items!(p, 0);
      expect(Number.isFinite(r.total)).toBe(true);
      expect(r.newFrom).toBeLessThanOrEqual(r.newTo);
    }
  });

  it('shows POSITIONS[captured] on the board', () => {
    for (const p of [0, 7, 15, 16 + 12, 300]) {
      const want: [string, string][] = [];
      parsePlacement(POSITIONS[p % 16]).forEach((rank, r) => rank.forEach((piece, f) => {
        if (piece) want.push([`${'abcdefgh'[f]}${8 - r}`, piece]);
      }));
      expect(boardPieces(half(p)).sort()).toEqual(want.sort());
    }
  });
  it('paints the kid pieces in the kid colour and the opponent dark', () => {
    const board = part(half(5, '#123456'), 'board');
    for (const m of board.matchAll(/data-piece="([A-Za-z])">/g)) {
      const piece = group(board, board.lastIndexOf('<g', m.index!));
      if (m[1] === m[1].toUpperCase()) expect(piece).toContain('fill="#123456"');
      else expect(piece).not.toContain('#123456');
    }
  });
  it('never counts a board piece', () => {
    expect(part(half(37), 'board')).not.toContain('fb-item');
  });

  it('hops exactly one of the kid pieces about every 10 s', () => {
    for (const p of [0, 7, 15, 1000]) {
      const out = half(p);
      const hops = [...out.matchAll(/class="fb-anim fb-chess-hop" style="--t:([\d.]+)s/g)];
      expect(hops).toHaveLength(1);
      expect(+hops[0][1]).toBeGreaterThanOrEqual(9);
      expect(+hops[0][1]).toBeLessThanOrEqual(11);
      const hop = group(out, out.lastIndexOf('<g', hops[0].index!));
      expect(hop).toMatch(/data-piece="[PNBRQK]"/);
      expect(out.match(/class="fb-anim/g)).toHaveLength(1);
    }
  });

  it('keeps every existing item unchanged when one is captured', () => {
    const bodies = (p: number) => [...half(p).matchAll(/<g class="fb-item[^"]*" data-item="[^"]*">/g)].map((m) => group(half(p), m.index!));
    const a = bodies(16 + 6);
    const b = bodies(16 + 7);
    expect(b.slice(0, a.length)).toEqual(a);
  });
  it('keeps the kings in place when a game is won', () => {
    const shelf = (p: number) => [...part(half(p), 'shelf').matchAll(/<g class="fb-item[^"]*" data-item="[^"]*">/g)].map((m) => group(part(half(p), 'shelf'), m.index!));
    expect(shelf(48).slice(0, 2)).toEqual(shelf(47));
  });

  it('keeps every stroke inside the scene band', () => {
    for (const points of [0, 15, 31, 300, 36000]) {
      const ys = [...half(points).matchAll(/ d="([^"]*)"/g)].flatMap((m) => [...m[1].matchAll(/-?[\d.]+[ ,](-?[\d.]+)/g)].map((n) => +n[1]));
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(450 * 0.17 - 2);
      expect(Math.max(...ys)).toBeLessThanOrEqual(450 * 0.79 + 2);
    }
  });
});
