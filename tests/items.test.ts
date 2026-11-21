import { describe, expect, it } from 'vitest';
import { groupItems, ITEM_UNITS, newItemRange } from '../src/items';

describe('groupItems', () => {
  it('keeps small counts as single items', () => {
    expect(groupItems(12, 30)).toEqual({ unit: 1, big: 0, small: 12 });
  });
  it('replaces as few small items as possible', () => {
    expect(groupItems(29, 30)).toEqual({ unit: 1, big: 0, small: 29 });
    expect(groupItems(31, 30)).toEqual({ unit: 10, big: 1, small: 21 });
    expect(groupItems(37, 30)).toEqual({ unit: 10, big: 1, small: 27 });
    expect(groupItems(40, 30)).toEqual({ unit: 10, big: 2, small: 20 });
    expect(groupItems(300, 30)).toEqual({ unit: 10, big: 30, small: 0 });
    expect(groupItems(301, 30)).toEqual({ unit: 50, big: 6, small: 1 });
  });
  it('draws the most items that fit for the chosen unit', () => {
    const exactFit = (n: number, cap: number) => n <= cap || ITEM_UNITS.some((u) => {
      for (let big = 1; big <= Math.min(cap, Math.floor(n / u)); big++) if (big + n - big * u <= cap) return true;
      return false;
    });
    for (const cap of [15, 20, 30, 36]) for (let n = 0; n <= 2000; n++) {
      const g = groupItems(n, cap);
      expect(g.big + g.small).toBeLessThanOrEqual(cap);
      if (!exactFit(n, cap)) continue; // gaps fall back to a rounded-down count
      expect(g.big * g.unit + g.small).toBe(n);
      if (g.unit > 1 && g.big > 0) expect(g.big - 1 + (n - (g.big - 1) * g.unit)).toBeGreaterThan(cap); // one fewer big would not fit
    }
  });
  it('accepts custom units', () => {
    expect(groupItems(7, 5, [5, 25])).toEqual({ unit: 5, big: 1, small: 2 });
  });
  describe('newItemRange', () => {
    it('pops nothing without previous points or when points did not go up', () => {
      expect(newItemRange(undefined, 12, 30)).toEqual({ newFrom: 12, newTo: 12 });
      expect(newItemRange(41, 39, 30)).toEqual({ newFrom: 30, newTo: 30 });
    });
    it('pops the new small items', () => {
      expect(newItemRange(10, 12, 30)).toEqual({ newFrom: 10, newTo: 12 });
      expect(newItemRange(32, 34, 30)).toEqual({ newFrom: 23, newTo: 25 });
    });
    it('pops only the new big item when a merge happens', () => {
      expect(newItemRange(30, 31, 30)).toEqual({ newFrom: 0, newTo: 1 });
      expect(newItemRange(39, 40, 30)).toEqual({ newFrom: 1, newTo: 2 });
    });
    it('pops nothing when the unit changes', () => {
      expect(newItemRange(300, 301, 30)).toEqual({ newFrom: 7, newTo: 7 });
    });
  });
  it('treats zero and negatives as zero', () => {
    expect(groupItems(0, 30)).toEqual({ unit: 1, big: 0, small: 0 });
    expect(groupItems(-5, 30)).toEqual({ unit: 1, big: 0, small: 0 });
  });
  it('treats NaN as zero', () => {
    expect(groupItems(NaN, 30).small).toBe(0);
  });
  it('fits very large counts within capacity', () => {
    const g = groupItems(1000, 30);
    expect(g.big + g.small).toBeLessThanOrEqual(30);
    expect(g.big * g.unit + g.small).toBe(1000);
  });
  it('clamps when no unit fits', () => {
    const g = groupItems(100000, 30);
    expect(g.unit).toBe(1000);
    expect(g.big + g.small).toBeLessThanOrEqual(30);
  });
  it('groups by the smallest unit whose big items fit when no exact fit exists', () => {
    expect(groupItems(137, 15)).toEqual({ unit: 10, big: 13, small: 2 });
  });
  it('fills capacity with the largest unit when even that overflows', () => {
    expect(groupItems(100000, 30)).toEqual({ unit: 1000, big: 30, small: 0 });
  });
  it('floors fractional counts and treats capacity below 1 as 1', () => {
    expect(groupItems(3.9, 30)).toEqual({ unit: 1, big: 0, small: 3 });
    expect(groupItems(1, 0)).toEqual({ unit: 1, big: 0, small: 1 });
  });
});
