import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { footprint, spots } from '../../src/themes/birthday';
import { seasonThemeIds, THEMES } from '../../src/themes/registry';
import { layout } from './layout';
import { beforeItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const birthday = THEMES.birthday;

runThemeContract(birthday);

const half = (points: number) => birthday.renderHalf(contractCtx(birthday, points));
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('birthday half', () => {
  it('has a table, a cake, bunting and a balloon', () => {
    const out = half(7);
    for (const name of ['table', 'cake', 'bunting', 'balloon']) expect(out).toContain(`data-part="${name}"`);
  });
  it('flickers the flames of at most the first 8 candles and sways one balloon', () => {
    expect(count(half(0), /fb-anim fb-birthday-flame/g)).toBe(0);
    expect(count(half(7), /fb-anim fb-birthday-flame/g)).toBe(7);
    expect(count(half(30), /fb-anim fb-birthday-flame/g)).toBe(8);
    for (const points of [0, 7, 30, 1000]) expect(count(half(points), /fb-anim fb-birthday-sway/g)).toBe(1);
  });
  it('animates at most 15 elements', () => {
    for (const points of [30, 1000]) expect(count(half(points), /class="fb-anim/g)).toBeLessThanOrEqual(15);
  });
  it('flickers a flame after the candle, never the counted item', () => {
    const out = half(7);
    const first = out.slice(out.indexOf('<g class="fb-item'), out.indexOf('<g class="fb-item', out.indexOf('<g class="fb-item') + 1));
    expect(first).toContain('fb-birthday-flame');
    expect(first.indexOf('data-part="candle"')).toBeLessThan(first.indexOf('fb-birthday-flame'));
  });
  it('shows a whole birthday picture at 0 points: a cake without candles', () => {
    const out = half(0);
    for (const name of ['cake', 'table', 'bunting']) expect(out).toContain(`data-part="${name}"`);
    expect(out).not.toContain('data-item');
  });
  it('is not a season theme', () => {
    expect(seasonThemeIds()).not.toContain('birthday');
    expect(birthday.renderSeasonScene).toBeUndefined();
  });
  it('puts presents first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, birthday.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 30 candles', () => {
    expect(birthday.capacity).toBe(30);
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('keeps the scenery wobble when a candle is added', () => {
    expect(beforeItems(half(8))).toBe(beforeItems(half(7)));
  });
  it('uses the kid colour', () => {
    expect(half(0)).toContain('#d9534f');
  });
  it('fits a narrow half', () => {
    const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
    expect(coordsOutside(birthday.renderHalf(contractCtx(birthday, 4321, undefined, narrow)), narrow)).toEqual([]);
  });
});

describe('birthday item layout', () => {
  const { overlapping, area } = layout(footprint);

  it('has a spot beside the cake for as many presents as the grouping can ask for', () => {
    expect(spots(birthday.capacity, 0)).toHaveLength(birthday.capacity);
  });
  it('keeps every present clearly bigger than a candle', () => {
    const small = area(spots(0, 1)[0]);
    for (const s of spots(birthday.capacity, 0)) expect(area(s)).toBeGreaterThan(1.5 * small);
  });
  it('keeps every present spot clear of every candle spot', () => {
    expect(overlapping([...spots(birthday.capacity, 0), ...spots(0, birthday.capacity)])).toEqual([]);
  });
  for (const points of [30, 37, 199, 300, 1000]) {
    it(`draws no two items on top of each other at ${points} points`, () => {
      const { big, small } = groupItems(points, birthday.capacity);
      const list = spots(big, small);
      expect(list).toHaveLength(big + small);
      expect(overlapping(list)).toEqual([]);
    });
  }
});
