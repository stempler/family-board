import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { THEMES } from '../../src/themes/registry';
import { footprint, spots, type Spot } from '../../src/themes/underwater';
import { afterItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const underwater = THEMES.underwater;

runThemeContract(underwater);

const half = (points: number) => underwater.renderHalf(contractCtx(underwater, points));
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('underwater half', () => {
  it('has a sea floor, seaweed, a coral and a fish', () => {
    const out = half(7);
    for (const name of ['floor', 'weed', 'coral', 'fish']) expect(out).toContain(`data-part="${name}"`);
  });
  it('rises 6 to 10 bubbles, swims one fish and sways the seaweed', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      const bubbles = count(out, /fb-anim fb-underwater-bubble/g);
      expect(bubbles).toBeGreaterThanOrEqual(6);
      expect(bubbles).toBeLessThanOrEqual(10);
      expect(count(out, /fb-anim fb-underwater-swim/g)).toBe(1);
      expect(count(out, /fb-anim fb-underwater-sway/g)).toBe(3);
    }
  });
  it('swims the fish in one long cycle, clipped to the half', () => {
    const out = half(7);
    const swim = out.match(/class="fb-anim fb-underwater-swim" style="--t:([\d.]+)s/);
    expect(Number(swim![1])).toBeGreaterThanOrEqual(14);
    expect(Number(swim![1])).toBeLessThanOrEqual(20);
    const fish = out.slice(out.indexOf('data-part="fish"'));
    const id = fish.match(/<clipPath id="([^"]+)">/)![1];
    expect(fish).toContain(`clip-path="url(#${id})"`);
  });
  it('puts pearl shells first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, underwater.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 30 shells', () => {
    expect(underwater.capacity).toBe(30);
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('keeps the scenery wobble when a shell is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
  it('uses the kid colour on the fish', () => {
    expect(half(0)).toContain('#d9534f');
  });
  it('fits a narrow half', () => {
    const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
    expect(coordsOutside(underwater.renderHalf(contractCtx(underwater, 4321, undefined, narrow)), narrow)).toEqual([]);
  });
});

describe('underwater item layout', () => {
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

  it('keeps every pearl shell clearly bigger than a shell, also on a shell spot', () => {
    const small = area(spots(0, 1)[0]);
    for (const s of spots(underwater.capacity, 0)) expect(area(s)).toBeGreaterThan(1.5 * small);
  });
  it('keeps every pearl shell spot clear of every shell spot and of each other', () => {
    const own = spots(underwater.capacity, 0).filter((s) => s.slot < 0);
    expect(overlapping([...own, ...spots(0, underwater.capacity)])).toEqual([]);
  });
  for (const points of [30, 37, 199, 1000]) {
    it(`draws no two items on top of each other at ${points} points`, () => {
      const { big, small } = groupItems(points, underwater.capacity);
      const list = spots(big, small);
      expect(list).toHaveLength(big + small);
      expect(overlapping(list)).toEqual([]);
    });
  }
});
