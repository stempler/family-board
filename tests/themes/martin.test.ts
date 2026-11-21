import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { footprint, spots } from '../../src/themes/martin';
import { THEMES } from '../../src/themes/registry';
import { layout } from './layout';
import { runSeasonContract, seasonBox, seasonHalves } from './season-contract';
import { beforeItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const martin = THEMES.martin;

runThemeContract(martin);
runSeasonContract(martin);

const half = (points: number) => martin.renderHalf(contractCtx(martin, points));
const scene = (k1: number, k2: number) => martin.renderSeasonScene!(seasonHalves(martin, k1, k2), seasonBox);
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('martin half', () => {
  it('has its parts', () => {
    const out = half(7);
    for (const name of ['houses', 'moon', 'line']) expect(out).toContain(`data-part="${name}"`);
  });
  it('flickers the glow of at most the first 8 lanterns and twinkles 3 to 5 stars', () => {
    expect(count(half(0), /fb-anim fb-martin-flicker/g)).toBe(0);
    expect(count(half(7), /fb-anim fb-martin-flicker/g)).toBe(7);
    expect(count(half(1000), /fb-anim fb-martin-flicker/g)).toBe(8);
    for (const points of [0, 7, 1000]) {
      const stars = count(half(points), /fb-anim fb-martin-twinkle/g);
      expect(stars).toBeGreaterThanOrEqual(3);
      expect(stars).toBeLessThanOrEqual(5);
    }
  });
  it('flickers a glow behind the lantern, never the counted item', () => {
    const out = half(7);
    const first = out.slice(out.indexOf('<g class="fb-item'));
    expect(first.indexOf('fb-martin-flicker')).toBeLessThan(first.indexOf('data-part="lantern"'));
  });
  it('puts big items first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, martin.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 30 small lanterns', () => {
    expect(martin.capacity).toBe(30);
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('keeps the scenery wobble when an item is added', () => {
    expect(beforeItems(half(8))).toBe(beforeItems(half(7)));
  });
  it('uses the kid colour', () => {
    expect(half(0)).toContain('#d9534f');
  });
  it('fits a narrow half', () => {
    const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
    expect(coordsOutside(martin.renderHalf(contractCtx(martin, 4321, undefined, narrow)), narrow)).toEqual([]);
  });
});

describe('martin season scene', () => {
  it('has one lantern line per kid, houses and a moon', () => {
    const out = scene(12, 7);
    expect(count(out, /data-part="line"/g)).toBe(2);
    expect(out).toContain('data-part="houses"');
    expect(out).toContain('data-part="moon"');
  });
  it('animates at most 30 elements in the season scene', () => {
    expect(count(scene(1000, 1000), /class="fb-anim/g)).toBeLessThanOrEqual(30);
  });
});

describe('martin item layout', () => {
  const { overlapping, area } = layout(footprint);

  it('keeps every big lantern clearly bigger than a small one, also on a small spot', () => {
    const small = area(spots(0, 1)[0]);
    for (const s of spots(martin.capacity, 0)) expect(area(s)).toBeGreaterThan(1.5 * small);
  });
  it('keeps every big lantern spot clear of every small spot and of each other', () => {
    const own = spots(martin.capacity, 0).filter((s) => s.slot < 0);
    expect(overlapping([...own, ...spots(0, martin.capacity)])).toEqual([]);
  });
  for (const points of [30, 37, 199, 1000]) {
    it(`draws no two items on top of each other at ${points} points`, () => {
      const { big, small } = groupItems(points, martin.capacity);
      const list = spots(big, small);
      expect(list).toHaveLength(big + small);
      expect(overlapping(list)).toEqual([]);
    });
  }
});
