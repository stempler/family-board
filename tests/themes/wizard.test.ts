import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { glassAt, outline } from '../../src/themes/wizard';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.wizard);

const wizard = THEMES.wizard;
const half = (points: number) => wizard.renderHalf(contractCtx(wizard, points));

describe('wizard', () => {
  it('keeps every gem and crystal inside the glass of the lower bulb', () => {
    // 2 units of clearance: the glass is drawn as a wobbly line through points 6 units apart, and the outlines are 2 units thick.
    const outside: string[] = [];
    for (let slot = 0; slot < wizard.capacity; slot++) {
      for (const big of [true, false]) {
        for (const [x, y] of outline(slot, big)) {
          const { axis, halfWidth } = glassAt(y);
          if (Math.abs(x - axis) > halfWidth - 2) outside.push(`${big ? 'crystal' : 'gem'} ${slot} at ${x},${y}`);
        }
      }
    }
    expect(outside).toEqual([]);
  });
  it('has an hourglass, a candle, an owl and a table', () => {
    const out = half(7);
    for (const part of ['hourglass', 'candle', 'owl', 'table']) expect(out).toContain(`data-part="${part}"`);
  });
  it('trickles sand, flickers the candle and blinks the owl', () => {
    const out = half(7);
    for (const anim of ['fb-wizard-sand', 'fb-wizard-flame', 'fb-wizard-blink']) expect(out.match(new RegExp(anim, 'g')) ?? []).toHaveLength(1);
  });
  it('sparkles 3 to 5 times over the gems', () => {
    for (const points of [0, 7, 1000]) {
      const n = (half(points).match(/fb-anim fb-sparkle/g) ?? []).length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
  it('fills gems in the kid colour', () => {
    const fills = (points: number) => (half(points).match(/fill="#d9534f"/g) ?? []).length;
    expect(fills(3) - fills(0)).toBeGreaterThanOrEqual(3);
  });
  it('keeps the scenery wobble when a gem is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
