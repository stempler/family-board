import { groupItems } from '../../src/items';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { afterItems, contractBox, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.racing);

const racing = THEMES.racing;
const half = (points: number) => racing.renderHalf(contractCtx(racing, points));

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

describe('racing', () => {
  it('has a shelf, a podium, a track, a chequered flag and a car', () => {
    const out = half(7);
    for (const name of ['shelf', 'podium', 'track', 'flag', 'car']) expect(out).toContain(`data-part="${name}"`);
  });
  it('waves the flag once and rolls the car with both wheels in step', () => {
    const out = half(7);
    expect(out.match(/fb-racing-flag/g) ?? []).toHaveLength(1);
    expect(out.match(/fb-racing-roll/g) ?? []).toHaveLength(1);
    expect(out.match(/fb-racing-spin/g) ?? []).toHaveLength(2);
    const timings = [...out.matchAll(/class="fb-anim fb-racing-(?:roll|spin)" style="([^"]*)"/g)].map((m) => m[1]);
    expect(new Set(timings).size).toBe(1);
  });
  it('never counts the car as an item', () => {
    for (const points of [0, 7, 30]) expect(part(half(points), 'car')).not.toContain('fb-item');
  });
  it('keeps the car inside the half while it rolls 20 px forward', () => {
    const car = part(half(7), 'car');
    const xs = [...car.matchAll(/[ML]\s*(-?[\d.]+)[ ,]/g), ...car.matchAll(/\bc?x="(-?[\d.]+)"/g)].map((m) => parseFloat(m[1]));
    expect(xs.length).toBeGreaterThan(0);
    expect(Math.max(...xs) + 20).toBeLessThanOrEqual(contractBox.x + contractBox.w);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(contractBox.x);
  });
  it('puts trophies first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, racing.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('hangs medals on ribbons in the kid colour', () => {
    const fills = (points: number) => (half(points).match(/fill="#d9534f"/g) ?? []).length;
    expect(fills(3) - fills(0)).toBeGreaterThanOrEqual(3);
  });
  it('keeps the scenery wobble when a medal is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
