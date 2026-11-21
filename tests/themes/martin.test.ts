import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { footprint, spots } from '../../src/themes/martin';
import { THEMES } from '../../src/themes/registry';
import { type Footprint, layout, mixes, movedItems } from './layout';
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
  const { overlapping, area, size, onScenery } = layout(footprint);
  const small = () => area(spots(0, 1)[0]);
  const bigs = () => spots(martin.capacity, 0);

  it('has a spot for as many big lanterns as the grouping can ask for', () => {
    expect(bigs()).toHaveLength(martin.capacity);
  });
  it('makes the first five big lanterns large, at least four times a small one\'s area, on the top line', () => {
    const five = bigs().slice(0, 5);
    for (const s of five) expect(area(s)).toBeGreaterThanOrEqual(4 * small());
    expect(Math.max(...five.map((s) => s.y))).toBeLessThan(Math.min(...bigs().slice(5).map((s) => s.y)));
  });
  it('keeps every big lantern at least twice a small one\'s area', () => {
    for (const s of bigs()) expect(area(s)).toBeGreaterThanOrEqual(2 * small());
  });
  it('gives big lanterns 6 to 30 one medium size, clearly smaller than the first five', () => {
    const rest = bigs().slice(5);
    for (const s of rest) {
      expect(size(s).w).toBeCloseTo(size(rest[0]).w, 9);
      expect(size(s).h).toBeCloseTo(size(rest[0]).h, 9);
    }
    expect(area(bigs()[0])).toBeGreaterThan(1.5 * area(rest[0]));
  });
  it('hangs the medium lanterns in rows of ten on the lines, from the bottom line up', () => {
    const rows = new Map<number, number>();
    for (const s of bigs().slice(5)) rows.set(s.hang - s.hang % 50, (rows.get(s.hang - s.hang % 50) ?? 0) + 1);
    expect([...rows.values()]).toEqual([10, 10, 5]);
  });
  it('keeps every lantern clear of the lantern stick and the tall house, above the street', () => {
    const scenery: Record<string, Footprint> = { stick: [11.5, 17, 16.5, 232], tower: [298, 10, 318, 228] };
    for (const { big, small: n } of mixes(martin.capacity)) {
      const list = spots(big, n);
      expect(onScenery(list, scenery), `${big} big, ${n} small`).toEqual([]);
      for (const s of list) expect(footprint(s)[1] > 28 && footprint(s)[3] < 228, `${s.kind} at ${s.x},${s.y}`).toBe(true);
    }
  });
  it('never moves or resizes a lantern when one is added', () => {
    expect(movedItems(spots, footprint, martin.capacity)).toEqual([]);
  });
  it('draws no two lanterns on top of each other at any total up to 1000', () => {
    for (const { big, small: n, points } of mixes(martin.capacity)) {
      const list = spots(big, n);
      expect(list, `${points} points`).toHaveLength(big + n);
      expect(overlapping(list), `${points} points`).toEqual([]);
    }
  });
});
