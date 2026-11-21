import { groupItems } from '../../src/items';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.chess);

const chess = THEMES.chess;
const half = (points: number) => chess.renderHalf(contractCtx(chess, points));

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

/** Items sorted by their square (data-slot, in filling order), each with its kind and markup. */
function pieces(svg: string): { slot: number; kind: string; body: string }[] {
  return [...svg.matchAll(/<g class="fb-item[^"]*" data-item="(small|big)"><g data-slot="(\d+)">/g)]
    .map((m) => ({ slot: +m[2], kind: m[1], body: group(svg, m.index! + m[0].indexOf('<g data-slot')) }))
    .sort((a, b) => a.slot - b.slot);
}

describe('chess', () => {
  it('has a board, a king, a knight and a table', () => {
    const out = half(7);
    for (const name of ['board', 'king', 'knight', 'table']) expect(out).toContain(`data-part="${name}"`);
  });
  it('hops the knight and tips the crown, once each', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      for (const anim of ['fb-chess-hop', 'fb-chess-tip']) expect(out.match(new RegExp(anim, 'g')) ?? []).toHaveLength(1);
    }
  });
  it('never counts the king or the knight', () => {
    const out = half(7);
    for (const name of ['king', 'knight']) expect(part(out, name)).not.toContain('fb-item');
  });
  it('holds 36 pieces, one per square', () => {
    expect(chess.capacity).toBe(36);
    const all = pieces(half(36));
    expect(all).toHaveLength(36);
    expect(new Set(all.map((p) => p.slot)).size).toBe(36);
  });
  it('fills squares from the first slot, queens first', () => {
    const all = pieces(half(37));
    const g = groupItems(37, chess.capacity);
    expect(all.map((p) => p.slot)).toEqual(Array.from({ length: g.big + g.small }, (_, i) => i));
    expect(all.map((p) => p.kind)).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('paints the pieces in the kid colour', () => {
    for (const p of pieces(half(12))) expect(p.body).toContain('fill="#d9534f"');
  });
  it('keeps every existing piece unchanged when one is added', () => {
    const a = pieces(half(12));
    const b = pieces(half(13));
    expect(b.filter((p) => p.slot < 12)).toEqual(a);
  });
  it('keeps every stroke inside the scene band, even with queens on the back row', () => {
    // 36 queens worth 1000 each fill all six rows with the tallest piece.
    for (const points of [0, 36, 36000]) {
      const ys = [...half(points).matchAll(/ d="([^"]*)"/g)].flatMap((m) => [...m[1].matchAll(/-?[\d.]+[ ,](-?[\d.]+)/g)].map((n) => +n[1]));
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(450 * 0.17 - 2);
      expect(Math.max(...ys)).toBeLessThanOrEqual(450 * 0.79 + 2);
    }
  });
  it('keeps the scenery wobble when a pawn is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
