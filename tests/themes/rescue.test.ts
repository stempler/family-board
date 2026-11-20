import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.rescue);

const rescue = THEMES.rescue;
const half = (points: number) => rescue.renderHalf(contractCtx(rescue, points));

/** The markup of the group with data-part="<name>". */
function part(svg: string, name: string): string {
  const open = svg.indexOf(`<g data-part="${name}"`);
  expect(open).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (const m of svg.slice(open).matchAll(/<g[\s>]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(open, open + m.index! + 4);
  }
  throw new Error('unclosed group');
}

describe('rescue', () => {
  it('has a dog house, a pup and the ground', () => {
    const out = half(7);
    for (const name of ['house', 'pup', 'ground']) expect(out).toContain(`data-part="${name}"`);
  });
  it('wags the tail, twitches an ear and tilts the head, once each', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      for (const anim of ['fb-rescue-wag', 'fb-rescue-ear', 'fb-rescue-tilt']) expect(out.match(new RegExp(anim, 'g')) ?? []).toHaveLength(1);
    }
  });
  it('gives the pup a scarf in the kid colour and never counts it', () => {
    const pup = part(half(7), 'pup');
    expect(pup).toContain('fill="#d9534f"');
    expect(pup).not.toContain('fb-item');
  });
  it('puts paw badges first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    expect(kinds).toEqual(['big', 'big', 'big', 'small', 'small', 'small', 'small', 'small', 'small', 'small']);
  });
  it('holds 30 items', () => {
    expect(rescue.capacity).toBe(30);
    expect(half(30).match(/data-item="small"/g) ?? []).toHaveLength(30);
  });
  it('keeps every existing item in place when one is added', () => {
    const items = (svg: string) => [...svg.matchAll(/<g class="fb-item[^"]*" data-item="[^"]*">/g)].map((m) => m.index!);
    const a = half(12);
    const b = half(13);
    const bodies = (svg: string) => items(svg).map((i) => svg.slice(i).replace(/^<g class="fb-item[^"]*"/, '').slice(0, 300));
    expect(bodies(b).slice(0, 12)).toEqual(bodies(a));
  });
  it('keeps every bone and badge in place when a badge beyond the nails is added', () => {
    const at = (big: number, small: number) => rescue.renderHalf({ ...contractCtx(rescue, 0), groups: { unit: 10, big, small }, newFrom: 99 });
    const bodies = (svg: string, kind: string) => [...svg.matchAll(new RegExp(`<g class="fb-item" data-item="${kind}">`, 'g'))].map((m) => svg.slice(m.index!, m.index! + 400));
    for (const [big, small] of [[9, 6], [10, 6], [15, 4]]) {
      const before = at(big, small);
      const after = at(big + 1, small);
      expect(bodies(after, 'small')).toEqual(bodies(before, 'small'));
      expect(bodies(after, 'big').slice(0, big)).toEqual(bodies(before, 'big'));
    }
  });
  it('places 30 badges without any two sharing a spot', () => {
    const svg = rescue.renderHalf({ ...contractCtx(rescue, 0), groups: { unit: 10, big: 30, small: 0 }, newFrom: 99 });
    const starts = [...svg.matchAll(/data-item="big"><g><path d="M\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => `${Math.round(+m[1] / 8)},${Math.round(+m[2] / 8)}`);
    expect(starts).toHaveLength(30);
    expect(new Set(starts).size).toBe(30);
  });
  it('keeps the scenery wobble when a bone is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
