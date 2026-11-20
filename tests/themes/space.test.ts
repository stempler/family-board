import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.space);

const space = THEMES.space;
const half = (points: number) => space.renderHalf(contractCtx(space, points));

/** The markup of the group with data-part="<name>". */
function part(svg: string, name: string): string {
  const open = svg.indexOf(`<g data-part="${name}"`);
  expect(open).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (const m of svg.slice(open).matchAll(/<g[\s>]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(open, open + m.index! + 4);
  }
  throw new Error('unclosed group');
}

describe('space', () => {
  it('has a night sky, a moon, a rocket and a comet', () => {
    const out = half(7);
    for (const name of ['sky', 'moon', 'rocket', 'comet']) expect(out).toContain(`data-part="${name}"`);
  });
  it('flickers the flame and sends one comet', () => {
    const out = half(7);
    expect(out.match(/fb-space-flame/g) ?? []).toHaveLength(1);
    expect(out.match(/fb-space-comet/g) ?? []).toHaveLength(1);
  });
  it('never counts the rocket or the comet as an item', () => {
    for (const points of [0, 7, 30]) {
      expect(part(half(points), 'rocket')).not.toContain('fb-item');
      expect(part(half(points), 'comet')).not.toContain('fb-item');
    }
  });
  it('twinkles about 2 in 5 stars, at most 12', () => {
    for (const points of [0, 7, 30, 1000]) {
      const out = half(points);
      const n = (out.match(/fb-anim fb-twinkle/g) ?? []).length;
      expect(n).toBeLessThanOrEqual(12);
      expect(n).toBeLessThanOrEqual((out.match(/data-item="small"/g) ?? []).length);
    }
    expect((half(7).match(/fb-anim fb-twinkle/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((half(30).match(/fb-anim fb-twinkle/g) ?? []).length).toBe(12);
  });
  it('keeps a twinkling star twinkling when another star appears', () => {
    const twinkling = (points: number) => [...half(points).matchAll(/class="fb-anim fb-twinkle" style="([^"]*)"/g)].map((m) => m[1]);
    const before = twinkling(12);
    expect(twinkling(13).slice(0, before.length)).toEqual(before);
  });
  it('draws constellation lines only between stars that both exist', () => {
    const lines = (points: number) => (half(points).match(/data-line=/g) ?? []).length;
    expect(lines(0)).toBe(0);
    expect(lines(1)).toBe(0);
    expect(lines(2)).toBe(1);
    expect(lines(30)).toBeGreaterThan(lines(7));
  });
  it('puts ringed planets first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    expect(kinds).toEqual(['big', 'big', 'big', 'small', 'small', 'small', 'small', 'small', 'small', 'small']);
  });
  it('paints the planets in the kid colour', () => {
    const fills = (points: number) => (half(points).match(/fill="#d9534f"/g) ?? []).length;
    expect(fills(30) - fills(29)).toBe(0);
    expect(fills(40) - fills(30)).toBeGreaterThanOrEqual(4);
  });
  it('keeps the scenery wobble when a star is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
