import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/themes/types';
import { afterItems, contractCtx, coordsOutside } from './theme-contract';

export const seasonBox = { x: 0, y: 0, w: 800, h: 450 };

/** Both kids' contexts on the full board: k1 with 12 points on the left, k2 with 7 on the right. */
export function seasonHalves(theme: Theme, k1 = 12, k2 = 7) {
  return [
    contractCtx(theme, k1, k1, { x: 0, y: 0, w: 400, h: 450 }, 'k1'),
    contractCtx(theme, k2, k2, { x: 400, y: 0, w: 400, h: 450 }, 'k2'),
  ];
}

/** Checks every season scene must pass: one marked object per kid, clear of the centre band (shared jars), inside the box. */
export function runSeasonContract(theme: Theme): void {
  describe(`season contract: ${theme.id}`, () => {
    it('has a season scene', () => {
      expect(theme.renderSeasonScene).toBeTypeOf('function');
    });
    const scene = (k1 = 12, k2 = 7) => theme.renderSeasonScene!(seasonHalves(theme, k1, k2), seasonBox);
    const out = scene();

    it('marks one object per kid', () => {
      expect(out.match(/data-season-kid="/g) ?? []).toHaveLength(2);
      expect(out).toContain('data-season-kid="k1"');
      expect(out).toContain('data-season-kid="k2"');
    });
    it('keeps the kids\' centres out of the centre band', () => {
      const centres = [...out.matchAll(/data-season-kid="[^"]*" data-cx="(-?[\d.]+)"/g)].map((m) => parseFloat(m[1]));
      expect(centres).toHaveLength(2);
      for (const cx of centres) expect(cx < 360 || cx > 440).toBe(true);
    });
    it('draws each kid\'s items, no NaN, inside the box', () => {
      expect(out.match(/data-item="/g) ?? []).toHaveLength(19);
      expect(out).not.toContain('NaN');
      expect(coordsOutside(out, seasonBox)).toEqual([]);
    });
    it('uses the kid colour', () => {
      expect(out).toContain('#d9534f');
    });
    it('is deterministic', () => {
      expect(scene()).toBe(out);
    });
    it('animates at most 60 elements, even at 1000 points each', () => {
      for (const s of [out, scene(1000, 1000), scene(30, 30)]) {
        expect((s.match(/class="fb-anim/g) ?? []).length).toBeLessThanOrEqual(60);
        expect(s).not.toContain('NaN');
        expect(coordsOutside(s, seasonBox)).toEqual([]);
      }
    });
    it('never animates a counted item directly', () => {
      const both = (scene(1000, 37).match(/class="[^"]*"/g) ?? []).filter((c) => c.includes('fb-item') && c.includes('fb-anim'));
      expect(both).toEqual([]);
    });
    it('keeps the scenery wobble when an item is added', () => {
      const one = (points: number) => theme.renderSeasonScene!([seasonHalves(theme, points)[0]], seasonBox);
      expect(afterItems(one(8))).toBe(afterItems(one(7)));
    });
  });
}
