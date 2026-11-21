import { describe, expect, it } from 'vitest';
import { groupItems } from '../../src/items';
import { footprint, spots, type Spot } from '../../src/themes/easter';
import { THEMES } from '../../src/themes/registry';
import { runSeasonContract, seasonBox, seasonHalves } from './season-contract';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

const easter = THEMES.easter;

runThemeContract(easter);
runSeasonContract(easter);

const half = (points: number) => easter.renderHalf(contractCtx(easter, points));
const scene = (k1: number, k2: number) => easter.renderSeasonScene!(seasonHalves(easter, k1, k2), seasonBox);
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('easter half', () => {
  it('has a meadow with flowers, a basket, a bunny and butterflies', () => {
    const out = half(7);
    for (const name of ['meadow', 'flowers', 'basket', 'bunny', 'butterfly']) expect(out).toContain(`data-part="${name}"`);
  });
  it('lets one bunny twitch and hop and 2 butterflies flutter', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      expect(count(out, /fb-anim fb-easter-hop/g)).toBe(1);
      expect(count(out, /fb-anim fb-easter-ears/g)).toBe(1);
      expect(count(out, /fb-anim fb-easter-fly/g)).toBe(2);
      expect(count(out, /fb-anim fb-easter-flap/g)).toBe(2);
    }
  });
  it('puts chocolate bunnies first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, easter.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 20 eggs', () => {
    expect(count(half(20), /data-item="small"/g)).toBe(20);
  });
  it('paints the eggs in stripes, dots and zigzags', () => {
    const out = half(3);
    for (const pattern of ['stripes', 'dots', 'zigzag']) expect(out).toContain(`data-egg="${pattern}"`);
  });
  it('puts no egg on top of another', () => {
    const eggs = [...half(20).matchAll(/data-egg="\w+" data-at="([\d.]+),([\d.]+),([\d.]+),([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    expect(eggs).toHaveLength(20);
    for (let i = 0; i < eggs.length; i++) {
      for (let j = i + 1; j < eggs.length; j++) {
        const [x1, y1, rx, ry] = eggs[i];
        const [x2, y2] = eggs[j];
        // Two equal ellipses are apart when their centres are more than one "diameter" apart in the scaled metric.
        expect(Math.hypot((x2 - x1) / (2 * rx), (y2 - y1) / (2 * ry)), `eggs ${i} and ${j}`).toBeGreaterThan(1);
      }
    }
  });
  it('ties the basket bow in the kid colour', () => {
    expect(half(0)).toContain('#d9534f');
  });
  it('keeps the scenery wobble when an egg is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});

describe('easter season scene', () => {
  it('has one bunny, 3 butterflies and two baskets', () => {
    const out = scene(12, 7);
    expect(count(out, /fb-anim fb-easter-hop/g)).toBe(1);
    expect(count(out, /fb-anim fb-easter-fly/g)).toBe(3);
    expect(count(out, /data-part="basket"/g)).toBe(2);
    expect(out).toContain('data-part="flowers"');
  });
});

describe('easter item layout', () => {
  const GAP = 2; // meadow units of air between two drawn items
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

  it('has a spot for every bunny, clear of every egg slot and of each other', () => {
    const all = [...spots(easter.capacity, 0), ...spots(0, easter.capacity)];
    expect(all).toHaveLength(2 * easter.capacity);
    expect(overlapping(all)).toEqual([]);
  });
  for (const points of [20, 37, 199, 349, 1000]) {
    it(`draws every item at ${points} points`, () => {
      const { big, small } = groupItems(points, easter.capacity);
      expect(spots(big, small)).toHaveLength(big + small);
    });
  }

  const items = (svg: string, kind: string) => [...svg.matchAll(new RegExp(`<g class="fb-item[^"]*" data-item="${kind}">`, 'g'))].map((m) => {
    let depth = 0;
    for (const t of svg.slice(m.index!).matchAll(/<g[\s>]|<\/g>/g)) {
      depth += t[0] === '</g>' ? -1 : 1;
      if (depth === 0) return svg.slice(m.index!, m.index! + t.index! + 4).replace(' fb-new', '');
    }
    throw new Error('unclosed group');
  });
  it('never moves or re-wobbles an egg when a bunny is added', () => {
    // 74 -> 75 points: 6 bunnies + 14 eggs become 7 bunnies + 5 eggs; the remaining eggs keep their spots.
    expect(groupItems(74, easter.capacity)).toMatchObject({ unit: 10, big: 6, small: 14 });
    expect(groupItems(75, easter.capacity)).toMatchObject({ unit: 10, big: 7, small: 5 });
    expect(items(half(75), 'small')).toEqual(items(half(74), 'small').slice(0, 5));
  });
  it('never moves a bunny when an egg is added', () => {
    expect(groupItems(38, easter.capacity)).toMatchObject({ big: 2, small: 18 });
    expect(items(half(38), 'big')).toEqual(items(half(37), 'big'));
  });
});

describe('easter meadow', () => {
  const meadowPoints = (svg: string) => {
    const g = svg.slice(svg.indexOf('data-part="meadow"'));
    const d = g.slice(0, g.indexOf('</g>'));
    const nums = [...d.matchAll(/d="([^"]*)"/g)].flatMap((m) => m[1].match(/-?[\d.]+/g)!.map(Number));
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  };
  it('runs past the board edges in the season scene, so only its top outline shows', () => {
    const m = meadowPoints(scene(12, 7));
    expect(m.minX).toBeLessThan(seasonBox.x);
    expect(m.maxX).toBeGreaterThan(seasonBox.x + seasonBox.w);
    expect(m.maxY).toBeGreaterThan(seasonBox.y + seasonBox.h);
  });
  it('stays inside its half as a rounded mound', () => {
    const ctx = contractCtx(easter, 7);
    const m = meadowPoints(half(7));
    expect(m.minX).toBeGreaterThan(ctx.box.x);
    expect(m.maxX).toBeLessThan(ctx.box.x + ctx.box.w);
  });
});
