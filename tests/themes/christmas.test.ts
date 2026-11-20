import { describe, expect, it } from 'vitest';
import { THEMES, getTheme } from '../../src/themes/registry';
import { afterItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const christmas = THEMES.christmas;

runThemeContract(christmas);

describe('christmas season scene', () => {
  const box = { x: 0, y: 0, w: 800, h: 450 };
  const halves = [
    contractCtx(christmas, 12, 12, { x: 0, y: 0, w: 400, h: 450 }, 'k1'),
    contractCtx(christmas, 7, 7, { x: 400, y: 0, w: 400, h: 450 }, 'k2'),
  ];
  const out = christmas.renderSeasonScene!(halves, box);

  it('draws one tree per kid', () => {
    expect(out.match(/data-tree="/g) ?? []).toHaveLength(2);
    expect(out).toContain('data-tree="k1"');
    expect(out).toContain('data-tree="k2"');
  });
  it('keeps tree centres out of the centre band', () => {
    const centres = [...out.matchAll(/data-tree="[^"]*" data-cx="(-?[\d.]+)"/g)].map((m) => parseFloat(m[1]));
    expect(centres).toHaveLength(2);
    for (const cx of centres) expect(cx < 360 || cx > 440).toBe(true);
  });
  it('draws each kid\'s ornaments, no NaN, inside the box', () => {
    expect(out.match(/data-item="/g) ?? []).toHaveLength(19);
    expect(out).not.toContain('NaN');
    expect(coordsOutside(out, box)).toEqual([]);
  });
  it('lets 28 flakes fall over the scene', () => {
    expect(out.match(/class="fb-anim fb-fall"/g) ?? []).toHaveLength(28);
  });
  it('uses the kid colour for the ribbon', () => {
    expect(out).toContain('#d9534f');
  });
});

describe('christmas half', () => {
  it('lets 13 flakes fall', () => {
    expect(christmas.renderHalf(contractCtx(christmas, 7)).match(/class="fb-anim fb-fall"/g) ?? []).toHaveLength(13);
  });
});

describe('christmas decorations after the ornaments', () => {
  it('keep their wobble when an ornament is added (half)', () => {
    const half = (points: number) => christmas.renderHalf(contractCtx(christmas, points));
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
  it('keep their wobble when an ornament is added (season scene)', () => {
    const box = { x: 0, y: 0, w: 800, h: 450 };
    const scene = (points: number) => christmas.renderSeasonScene!([contractCtx(christmas, points, points, { x: 0, y: 0, w: 400, h: 450 }, 'k1')], box);
    expect(afterItems(scene(8))).toBe(afterItems(scene(7)));
  });
});

describe('registry', () => {
  it('falls back to lego for unknown ids', () => {
    expect(getTheme('nope').id).toBe('lego');
    expect(getTheme('christmas')).toBe(christmas);
  });
});
