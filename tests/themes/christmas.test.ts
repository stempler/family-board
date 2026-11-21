import { describe, expect, it } from 'vitest';
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
    expect(Object.keys(THEMES)).toEqual(['christmas', 'bricks', 'dino', 'wizard', 'racing', 'space', 'dog', 'chess', 'halloween', 'easter', 'pirates', 'underwater', 'football', 'martin', 'birthday', 'construction', 'garden']);
  });
  it('maps the retired ids to bricks', () => {
    expect(getTheme('lego').id).toBe('bricks');
    expect(getTheme('rescue').id).toBe('bricks');
  });
});
