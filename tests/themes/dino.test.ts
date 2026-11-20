import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.dino);

const dino = THEMES.dino;
const half = (points: number) => dino.renderHalf(contractCtx(dino, points));

describe('dino', () => {
  it('has a body, tail and feet', () => {
    const out = half(7);
    for (const part of ['body', 'tail', 'feet', 'head']) expect(out).toContain(`data-part="${part}"`);
  });
  it('wobbles exactly one egg, the last small one', () => {
    const out = half(7);
    expect(out.match(/fb-dino-wobble/g) ?? []).toHaveLength(1);
  });
  it('wobbles the last big egg when there are no small eggs (20 points)', () => {
    const ctx = contractCtx(dino, 20);
    expect(ctx.groups).toMatchObject({ small: 0 });
    expect(ctx.groups.big).toBeGreaterThan(0);
    expect(dino.renderHalf(ctx).match(/fb-dino-wobble/g) ?? []).toHaveLength(1);
  });
  it("keeps the nest front's wobble when an egg is added", () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
