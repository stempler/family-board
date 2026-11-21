import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { footprint, spots, type Spot } from '../../src/themes/garden';
import { THEMES } from '../../src/themes/registry';
import { afterItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const garden = THEMES.garden;

runThemeContract(garden);

const half = (points: number) => garden.renderHalf(contractCtx(garden, points));
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('garden half', () => {
  it('has a flower bed, a fence, a watering can and bees', () => {
    const out = half(7);
    for (const name of ['bed', 'fence', 'can', 'bee']) expect(out).toContain(`data-part="${name}"`);
  });
  it('flies 2 or 3 bees and sways at most 4 tufts', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      const bees = count(out, /fb-anim fb-garden-bee/g);
      expect(bees).toBeGreaterThanOrEqual(2);
      expect(bees).toBeLessThanOrEqual(3);
      expect(count(out, /data-part="bee"/g)).toBe(bees);
      const sway = count(out, /fb-anim fb-garden-sway/g);
      expect(sway).toBeGreaterThanOrEqual(1);
      expect(sway).toBeLessThanOrEqual(4);
    }
  });
  it('flies each bee in a small loop of its own', () => {
    const out = half(7);
    const styles = [...out.matchAll(/class="fb-anim fb-garden-bee" style="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(styles).size).toBe(styles.length);
    for (const s of styles) expect(Number(s.match(/--t:([\d.]+)s/)![1])).toBeGreaterThanOrEqual(2);
  });
  it('puts sunflowers first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, garden.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 30 flowers', () => {
    expect(garden.capacity).toBe(30);
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('keeps the scenery wobble when a flower is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
  it('uses the kid colour on the watering can', () => {
    const out = half(0);
    expect(out.slice(out.indexOf('data-part="can"'))).toContain('#d9534f');
  });
  it('fits a narrow half', () => {
    const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
    expect(coordsOutside(garden.renderHalf(contractCtx(garden, 4321, undefined, narrow)), narrow)).toEqual([]);
  });
});

describe('garden item layout', () => {
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
  const size = (s: Spot) => { const [l, t, r, b] = footprint(s); return { w: r - l, h: b - t, area: (r - l) * (b - t) }; };

  it('plants the flowers in staggered rows of ten, the front row first', () => {
    const flowers = spots(0, 30);
    const rows = [flowers.slice(0, 10), flowers.slice(10, 20), flowers.slice(20, 30)];
    for (const r of rows) for (const s of r) expect(s.y).toBe(r[0].y);
    expect(rows[1][0].y).toBeLessThan(rows[0][0].y);
    expect(rows[2][0].y).toBeLessThan(rows[1][0].y);
    expect(rows[1][0].x).not.toBe(rows[0][0].x); // staggered
  });
  it('stands the first ten sunflowers at the fence, much taller than a flower', () => {
    const flower = size(spots(0, 1)[0]);
    const tall = spots(10, 0);
    const bedTop = Math.min(...spots(0, 30).map((s) => footprint(s)[1]));
    for (const s of tall) {
      expect(size(s).h).toBeGreaterThan(4 * flower.h);
      expect(footprint(s)[3]).toBeLessThan(bedTop); // behind the bed
    }
  });
  it('keeps every sunflower clearly bigger than a flower, also in the bed', () => {
    const flower = size(spots(0, 1)[0]).area;
    for (const s of spots(garden.capacity, 0)) expect(size(s).area).toBeGreaterThan(1.5 * flower);
  });
  it('keeps every sunflower spot clear of every flower spot at the fence and of each other', () => {
    expect(overlapping([...spots(10, 0), ...spots(0, garden.capacity)])).toEqual([]);
    expect(overlapping(spots(garden.capacity, 0))).toEqual([]);
  });
  for (const points of [30, 37, 199, 300, 1000]) {
    it(`draws no two items on top of each other at ${points} points`, () => {
      const { big, small } = groupItems(points, garden.capacity);
      const list = spots(big, small);
      expect(list).toHaveLength(big + small);
      expect(overlapping(list)).toEqual([]);
    });
  }
});
