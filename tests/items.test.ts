import { describe, expect, it } from 'vitest';
import { groupItems } from '../src/items';

describe('groupItems', () => {
  it('keeps small counts as single items', () => {
    expect(groupItems(12, 30)).toEqual({ unit: 1, big: 0, small: 12 });
  });
  it('groups into tens when over capacity', () => {
    expect(groupItems(37, 30)).toEqual({ unit: 10, big: 3, small: 7 });
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
