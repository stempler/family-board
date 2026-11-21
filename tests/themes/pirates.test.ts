import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { footprint, spots } from '../../src/themes/pirates';
import { THEMES } from '../../src/themes/registry';
import { layout } from './layout';
import { afterItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const pirates = THEMES.pirates;

runThemeContract(pirates);

const half = (points: number) => pirates.renderHalf(contractCtx(pirates, points));
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('pirates half', () => {
  it('has a chest, the sea, a ship and a palm', () => {
    const out = half(7);
    for (const name of ['chest', 'sea', 'ship', 'palm']) expect(out).toContain(`data-part="${name}"`);
  });
  it('bobs one ship and moves 2 to 4 waves', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      expect(count(out, /fb-anim fb-pirates-bob/g)).toBe(1);
      const waves = count(out, /fb-anim fb-pirates-wave/g);
      expect(waves).toBeGreaterThanOrEqual(2);
      expect(waves).toBeLessThanOrEqual(4);
    }
  });
  it('puts gold bars first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, pirates.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 27 coins', () => {
    expect(pirates.capacity).toBe(27);
    expect(count(half(27), /data-item="small"/g)).toBe(27);
  });
  it('keeps the scenery wobble when a coin is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
  it('uses the kid colour on the flag', () => {
    expect(half(0)).toContain('#d9534f');
  });
  it('fits a narrow half', () => {
    const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
    expect(coordsOutside(pirates.renderHalf(contractCtx(pirates, 4321, undefined, narrow)), narrow)).toEqual([]);
  });
});

describe('pirates item layout', () => {
  const { overlapping, area } = layout(footprint);

  it('has a bar spot for every bar the grouping can ask for', () => {
    let most = 0;
    for (let n = 0; n <= 20000; n++) most = Math.max(most, groupItems(n, pirates.capacity).big);
    expect(spots(most, 0)).toHaveLength(most);
  });
  it('keeps every gold bar clearly bigger than a coin', () => {
    const small = area(spots(0, 1)[0]);
    for (const s of spots(pirates.capacity, 0)) expect(area(s)).toBeGreaterThan(1.5 * small);
  });
  it('keeps every bar spot clear of every coin spot and of each other', () => {
    expect(overlapping([...spots(pirates.capacity, 0), ...spots(0, pirates.capacity)])).toEqual([]);
  });
  for (const points of [27, 37, 172, 199, 270, 300, 1000]) {
    it(`draws no two items on top of each other at ${points} points`, () => {
      const { big, small } = groupItems(points, pirates.capacity);
      const list = spots(big, small);
      expect(list).toHaveLength(big + small);
      expect(overlapping(list)).toEqual([]);
    });
  }
});
