import { describe, expect, it } from 'vitest';
import { SCENE_BOTTOM } from '../../src/draw/units';
import { hillTopAt, treeFoot } from '../../src/themes/christmas';
import { THEMES, getTheme } from '../../src/themes/registry';
import { runSeasonContract, seasonBox, seasonHalves } from './season-contract';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

const christmas = THEMES.christmas;

runThemeContract(christmas);
runSeasonContract(christmas);

describe('christmas season scene', () => {
  const out = christmas.renderSeasonScene!(seasonHalves(christmas), seasonBox);

  it('keeps data-tree on each tree for the browser check', () => {
    expect(out.match(/data-tree="/g) ?? []).toHaveLength(2);
    expect(out).toContain('data-tree="k1" data-season-kid="k1"');
    expect(out).toContain('data-tree="k2" data-season-kid="k2"');
  });
  it('lets 28 flakes fall over the scene', () => {
    expect(out.match(/class="fb-anim fb-fall"/g) ?? []).toHaveLength(28);
  });
});

describe('christmas season scene ground', () => {
  for (const kids of [2, 5]) {
    it(`stands every tree's trunk and ribbon in the snow with ${kids} kids`, () => {
      const w = seasonBox.w / kids;
      const halves = Array.from({ length: kids }, (_, i) => contractCtx(christmas, 7, 7, { x: i * w, y: 0, w, h: seasonBox.h }, `k${i + 1}`));
      const out = christmas.renderSeasonScene!(halves, seasonBox);
      const centres = [...out.matchAll(/data-season-kid="[^"]*" data-cx="(-?[\d.]+)"/g)].map((m) => parseFloat(m[1]));
      expect(centres).toHaveLength(kids);
      halves.forEach((h, i) => {
        const foot = treeFoot(seasonBox, h.box);
        expect(foot.cx).toBeCloseTo(centres[i], 1);
        expect(hillTopAt(seasonBox, foot.cx)).toBeLessThan(foot.base);
        for (const [x, y] of foot.ribbon) expect(hillTopAt(seasonBox, x)).toBeLessThan(y);
      });
    });
  }
  it('keeps the snowman standing on the snow', () => {
    expect(hillTopAt(seasonBox, seasonBox.w / 2)).toBeLessThan(seasonBox.h * SCENE_BOTTOM);
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
});

describe('registry', () => {
  it('falls back to bricks for unknown ids', () => {
    expect(getTheme('nope').id).toBe('bricks');
    expect(getTheme('christmas')).toBe(christmas);
  });
});

describe('theme renames', () => {
  it('registers bricks and dog in order', () => {
    expect(Object.keys(THEMES)).toEqual(['christmas', 'bricks', 'dino', 'wizard', 'racing', 'space', 'dog', 'chess', 'halloween', 'easter', 'pirates', 'underwater', 'football', 'martin', 'birthday', 'construction', 'garden', 'summer']);
  });
  it('maps the retired ids to bricks', () => {
    expect(getTheme('lego').id).toBe('bricks');
    expect(getTheme('rescue').id).toBe('bricks');
  });
});
