import { describe, expect, it } from 'vitest';
import { groupItems } from '../../src/items';
import { footprint, spots, type Spot } from '../../src/themes/halloween';
import { THEMES } from '../../src/themes/registry';
import { runSeasonContract, seasonBox, seasonHalves } from './season-contract';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

const halloween = THEMES.halloween;

runThemeContract(halloween);
runSeasonContract(halloween);

const half = (points: number) => halloween.renderHalf(contractCtx(halloween, points));
const scene = (k1: number, k2: number) => halloween.renderSeasonScene!(seasonHalves(halloween, k1, k2), seasonBox);
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('halloween half', () => {
  it('has a moon, a fence, a candy bucket, a ghost and a bat', () => {
    const out = half(7);
    for (const name of ['moon', 'fence', 'bucket', 'ghost', 'bat']) expect(out).toContain(`data-part="${name}"`);
  });
  it('floats one ghost and sends one bat', () => {
    for (const points of [0, 7, 1000]) {
      expect(count(half(points), /fb-anim fb-halloween-ghost/g)).toBe(1);
      expect(count(half(points), /fb-anim fb-halloween-bat"/g)).toBe(1);
    }
  });
  it('flickers the glow of at most the first 6 jack-o\'-lanterns', () => {
    expect(count(half(7), /fb-halloween-glow/g)).toBe(0);
    expect(count(half(37), /fb-halloween-glow/g)).toBe(1);
    expect(count(half(1000), /fb-halloween-glow/g)).toBe(6);
  });
  it('puts jack-o\'-lanterns first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, halloween.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 30 candies', () => {
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('uses the kid colour on the bucket handle', () => {
    expect(half(0)).toContain('#d9534f');
  });
  it('keeps the scenery wobble when a candy is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});

describe('halloween season scene', () => {
  it('has one ghost between the buckets and a bat', () => {
    const out = scene(12, 7);
    expect(count(out, /fb-anim fb-halloween-ghost/g)).toBe(1);
    expect(count(out, /fb-anim fb-halloween-bat-wide/g)).toBe(1);
    expect(out).toContain('data-part="moon"');
    expect(out).toContain('data-part="fence"');
    expect(count(out, /data-part="bucket"/g)).toBe(2);
  });
  it('flickers at most 6 lanterns per kid', () => {
    expect(count(scene(1000, 1000), /fb-halloween-glow/g)).toBe(12);
  });
});

describe('halloween item layout', () => {
  const GAP = 2; // patch units of air between two drawn items
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

  it('keeps a candy small enough to count (at most 24 units end to end)', () => {
    const [l, , r] = footprint(spots(0, 1)[0]);
    expect(r - l).toBeLessThanOrEqual(24);
  });
  it('keeps every candy spot clear of the others', () => {
    expect(overlapping(spots(0, 30))).toEqual([]);
  });
  it('keeps every lantern spot clear of every candy spot and of each other', () => {
    const lanterns = spots(6, 0);
    expect(overlapping([...lanterns, ...spots(0, 30)])).toEqual([]);
  });
  for (const points of [37, 199, 327, 1000]) {
    it(`draws no two items on top of each other at ${points} points`, () => {
      const { big, small } = groupItems(points, halloween.capacity);
      const list = spots(big, small);
      expect(list).toHaveLength(big + small);
      expect(overlapping(list)).toEqual([]);
    });
  }
});
