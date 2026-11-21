import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { THEMES } from '../../src/themes/registry';
import { footprint, spots, type Spot } from '../../src/themes/summer';
import { runSeasonContract, seasonBox, seasonHalves } from './season-contract';
import { afterItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

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
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
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
  const GAP = 2; // units of air between two drawn items
  const apart = (a: Spot, b: Spot) => {
    const [l1, t1, r1, b1] = footprint(a);
    const [l2, t2, r2, b2] = footprint(b);
    return l1 >= r2 + GAP || l2 >= r1 + GAP || t1 >= b2 + GAP || t2 >= b1 + GAP;
  };
  const overlapping = (list: Spot[]) => {
    const bad: string[] = [];
    list.forEach((a, i) => list.slice(i + 1).forEach((b) => { if (!apart(a, b)) bad.push(`${a.kind}@${a.x},${a.y} ${b.kind}@${b.x},${b.y}`); }));
    return bad;
  };
  const area = (s: Spot) => { const [l, t, r, b] = footprint(s); return (r - l) * (b - t); };

  it('lays the shells in three rows of ten', () => {
    const shells = spots(0, 30);
    for (const r of [0, 10, 20]) for (const s of shells.slice(r, r + 10)) expect(s.y).toBe(shells[r].y);
    expect(new Set(shells.map((s) => s.y)).size).toBe(3);
  });
  it('keeps every starfish clearly bigger than a shell, also on a shell spot', () => {
    const shell = area(spots(0, 1)[0]);
    for (const s of spots(summer.capacity, 0)) expect(area(s)).toBeGreaterThan(1.5 * shell);
  });
  it('keeps every own starfish spot clear of every shell spot and of each other', () => {
    const own = spots(summer.capacity, 0).filter((s) => s.slot < 0);
    expect(overlapping([...own, ...spots(0, summer.capacity)])).toEqual([]);
  });
  for (const points of [30, 37, 199, 1000]) {
    it(`draws no two items on top of each other at ${points} points`, () => {
      const { big, small } = groupItems(points, summer.capacity);
      const list = spots(big, small);
      expect(list).toHaveLength(big + small);
      expect(overlapping(list)).toEqual([]);
    });
  }
});
