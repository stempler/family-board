import { groupItems } from '../../src/items';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { starSpots } from '../../src/themes/space';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.space);

const space = THEMES.space;
const half = (points: number) => space.renderHalf(contractCtx(space, points));

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

describe('space', () => {
  it('has a night sky, a moon, a rocket and a comet', () => {
    const out = half(7);
    for (const name of ['sky', 'moon', 'rocket', 'comet']) expect(out).toContain(`data-part="${name}"`);
  });
  it('flickers the flame and sends one comet', () => {
    const out = half(7);
    expect(out.match(/fb-space-flame/g) ?? []).toHaveLength(1);
    expect(out.match(/fb-space-comet/g) ?? []).toHaveLength(1);
  });
  it('never counts the rocket or the comet as an item', () => {
    for (const points of [0, 7, 30]) {
      expect(part(half(points), 'rocket')).not.toContain('fb-item');
      expect(part(half(points), 'comet')).not.toContain('fb-item');
    }
  });
  it('twinkles about 2 in 5 stars, at most 12', () => {
    for (const points of [0, 7, 30, 1000]) {
      const out = half(points);
      const n = (out.match(/fb-anim fb-twinkle/g) ?? []).length;
      expect(n).toBeLessThanOrEqual(12);
      expect(n).toBeLessThanOrEqual((out.match(/data-item="small"/g) ?? []).length);
    }
    expect((half(7).match(/fb-anim fb-twinkle/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((half(30).match(/fb-anim fb-twinkle/g) ?? []).length).toBe(12);
  });
  it('keeps a twinkling star twinkling when another star appears', () => {
    const twinkling = (points: number) => [...half(points).matchAll(/class="fb-anim fb-twinkle" style="([^"]*)"/g)].map((m) => m[1]);
    const before = twinkling(12);
    expect(twinkling(13).slice(0, before.length)).toEqual(before);
  });
  it('draws constellation lines only between stars that both exist', () => {
    const lines = (points: number) => (half(points).match(/data-line=/g) ?? []).length;
    expect(lines(0)).toBe(0);
    expect(lines(1)).toBe(0);
    expect(lines(2)).toBe(1);
    expect(lines(30)).toBeGreaterThan(lines(7));
  });
  it('lists big stars first, then small ones', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, space.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('draws small items as yellow stars and big items as larger glowing stars', () => {
    const out = half(75);
    const groups = [...out.matchAll(/<g class="fb-item[^"]*" data-item="(small|big)">/g)];
    expect(groups.some((m) => m[1] === 'big')).toBe(true);
    expect(groups.some((m) => m[1] === 'small')).toBe(true);
    for (const [i, m] of groups.entries()) {
      const end = i + 1 < groups.length ? groups[i + 1].index! : out.indexOf('data-part="moon"');
      expect(end).toBeGreaterThan(0);
      const body = out.slice(m.index!, end);
      expect(body).toContain('#ffd95e');
      if (m[1] === 'big') expect(body).toContain('opacity="0.3"'); // the glow
      else expect(body).not.toContain('opacity="0.3"');
    }
  });
  describe('star spots', () => {
    const spotsAt = (points: number, seed = 'k1:space') => {
      const g = groupItems(points, space.capacity);
      return { unit: g.unit, list: starSpots(g.big, g.small, seed) };
    };
    it('never puts two items on one spot', () => {
      for (let n = 0; n <= 400; n++) {
        const spots = spotsAt(n).list.map((s) => s.spot);
        expect(new Set(spots).size).toBe(spots.length);
      }
    });
    it('keeps every star on its spot when a point is added (a merge only turns stars into one big star)', () => {
      for (let n = 0; n < 400; n++) {
        const a = spotsAt(n);
        const b = spotsAt(n + 1);
        if (a.unit !== b.unit && a.unit > 1) continue; // a unit change redraws everything
        const bigA = a.list.filter((s) => s.kind === 'big').map((s) => s.spot);
        const bigB = new Set(b.list.filter((s) => s.kind === 'big').map((s) => s.spot));
        for (const spot of bigA) expect(bigB.has(spot)).toBe(true);
        const smallA = new Set(a.list.filter((s) => s.kind === 'small').map((s) => s.spot));
        const smallB = b.list.filter((s) => s.kind === 'small').map((s) => s.spot);
        const added = smallB.filter((spot) => !smallA.has(spot));
        expect(added.length).toBeLessThanOrEqual(1);
        if (added.length) expect(added[0]).toBe(smallB[smallB.length - 1]); // the new star is the last item
      }
    });
    it('puts a big star on a spot that was lit just before', () => {
      for (let n = 31; n <= 228; n++) {
        const a = spotsAt(n - 1);
        const b = spotsAt(n);
        if (b.unit !== 10) continue;
        const litA = new Set(a.list.map((s) => s.spot));
        const newBig = b.list.filter((s) => s.kind === 'big').map((s) => s.spot).filter((spot) => !a.list.some((x) => x.kind === 'big' && x.spot === spot));
        for (const spot of newBig) expect(litA.has(spot)).toBe(true);
      }
    });
    it('spreads big stars instead of filling from the first spot', () => {
      const firstBig = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((k) => spotsAt(31, `${k}:space`).list[0].spot);
      expect(new Set(firstBig).size).toBeGreaterThan(2);
      const bigs = spotsAt(75).list.filter((s) => s.kind === 'big').map((s) => s.spot);
      expect(bigs).not.toEqual(bigs.map((_, i) => i)); // not simply the first spots in order
    });
  });
  it('draws no planets or rings', () => {
    for (const points of [0, 30, 75, 1000]) {
      const out = half(points);
      expect(out).not.toMatch(/data-part="(planet|ring)"/);
      expect(out).not.toContain('#f6e7b4');
    }
  });
  it('keeps the scenery wobble when a star is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
