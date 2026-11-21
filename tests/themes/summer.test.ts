import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { THEMES } from '../../src/themes/registry';
import { footprint, spots } from '../../src/themes/summer';
import { type Footprint, layout, mixes, movedItems } from './layout';
import { runSeasonContract, seasonBox, seasonHalves } from './season-contract';
import { beforeItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const summer = THEMES.summer;

runThemeContract(summer);
runSeasonContract(summer);

const half = (points: number) => summer.renderHalf(contractCtx(summer, points));
const scene = (k1: number, k2: number) => summer.renderSeasonScene!(seasonHalves(summer, k1, k2), seasonBox);
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('summer half', () => {
  it('has its parts', () => {
    const out = half(7);
    for (const name of ['sand', 'sun', 'castle', 'bucket']) expect(out).toContain(`data-part="${name}"`);
  });
  it('waves the castle flag, rolls 2 to 4 waves and turns the sun rays', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      expect(count(out, /fb-anim fb-summer-flag/g)).toBe(1);
      const waves = count(out, /fb-anim fb-summer-wave/g);
      expect(waves).toBeGreaterThanOrEqual(2);
      expect(waves).toBeLessThanOrEqual(4);
      expect(count(out, /fb-anim fb-summer-ray/g)).toBe(1);
    }
  });
  it('waves a flag in the kid colour on the castle', () => {
    const out = half(0);
    const castle = out.slice(out.indexOf('data-part="castle"'));
    expect(castle.slice(castle.indexOf('fb-summer-flag'))).toContain('#d9534f');
  });
  it('puts big items first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, summer.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 30 shells', () => {
    expect(summer.capacity).toBe(30);
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('keeps the scenery wobble when an item is added', () => {
    expect(beforeItems(half(8))).toBe(beforeItems(half(7)));
  });
  it('uses the kid colour on the bucket', () => {
    const out = half(0);
    expect(out).toContain('#d9534f');
    const bucket = out.slice(out.indexOf('data-part="bucket"'));
    expect(bucket.slice(0, bucket.indexOf('data-part="castle"'))).toContain('#d9534f');
  });
  it('fits a narrow half', () => {
    const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
    expect(coordsOutside(summer.renderHalf(contractCtx(summer, 4321, undefined, narrow)), narrow)).toEqual([]);
  });
});

describe('summer season scene', () => {
  it('has one castle and one bucket per kid on one beach under the sun', () => {
    const out = scene(12, 7);
    expect(count(out, /data-part="castle"/g)).toBe(2);
    expect(count(out, /data-part="bucket"/g)).toBe(2);
    expect(count(out, /data-part="sand"/g)).toBe(1);
    expect(count(out, /data-part="sun"/g)).toBe(1);
  });
  it('animates at most 30 elements in the season scene', () => {
    expect(count(scene(1000, 1000), /class="fb-anim/g)).toBeLessThanOrEqual(30);
  });
});

describe('summer item layout', () => {
  const { overlapping, area, size, onScenery } = layout(footprint);

  it('lays the shells in three rows of ten', () => {
    const shells = spots(0, 30);
    for (const r of [0, 10, 20]) for (const s of shells.slice(r, r + 10)) expect(s.y).toBe(shells[r].y);
    expect(new Set(shells.map((s) => s.y)).size).toBe(3);
  });
  const small = () => area(spots(0, 1)[0]);
  const stars = () => spots(summer.capacity, 0);

  it('has a spot for as many starfish as the grouping can ask for', () => {
    expect(stars()).toHaveLength(summer.capacity);
  });
  it('makes the first five starfish large, at least four times a shell\'s area, in one row', () => {
    const five = stars().slice(0, 5);
    for (const s of five) expect(area(s)).toBeGreaterThanOrEqual(4 * small());
    expect(new Set(five.map((s) => s.y)).size).toBe(1);
  });
  it('keeps every starfish at least twice a shell\'s area', () => {
    for (const s of stars()) expect(area(s)).toBeGreaterThanOrEqual(2 * small());
  });
  it('gives starfish 6 to 30 one medium size, smaller than the first five', () => {
    const rest = stars().slice(5);
    for (const s of rest) {
      expect(size(s).w).toBeCloseTo(size(rest[0]).w, 9);
      expect(size(s).h).toBeCloseTo(size(rest[0]).h, 9);
    }
    expect(area(stars()[0])).toBeGreaterThan(area(rest[0]));
  });
  it('lays the medium starfish in a row of five, then in rows of ten', () => {
    const rows = new Map<number, number>();
    for (const s of stars().slice(5)) rows.set(s.y, (rows.get(s.y) ?? 0) + 1);
    expect([...rows.values()]).toEqual([5, 10, 10]);
  });
  it('keeps every item on the sand, clear of the bucket, the spade and the castle', () => {
    const scenery: Record<string, Footprint> = {
      crossbar: [58, 99, 74, 109], handle: [14, 121, 56, 139], rim: [10, 132, 60, 139], bucket: [12, 136, 58, 176],
      castle: [228, 126, 308, 176], tower: [258, 108, 278, 176], pole: [266, 78, 290, 108],
    };
    for (const { big, small: n } of mixes(summer.capacity)) {
      const list = spots(big, n);
      expect(onScenery(list, scenery), `${big} big, ${n} small`).toEqual([]);
      for (const s of list) {
        const [l, t, r, b] = footprint(s);
        expect(l >= 0 && r <= 320 && t >= 104 && b <= 240, `${s.kind} at ${s.x},${s.y}`).toBe(true);
      }
    }
  });
  it('never moves or resizes an item when one is added', () => {
    expect(movedItems(spots, footprint, summer.capacity)).toEqual([]);
  });
  it('draws no two items on top of each other at any total up to 1000', () => {
    for (const { big, small: n, points } of mixes(summer.capacity)) {
      const list = spots(big, n);
      expect(list, `${points} points`).toHaveLength(big + n);
      expect(overlapping(list), `${points} points`).toEqual([]);
    }
  });
});
