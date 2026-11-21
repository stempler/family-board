import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import type { Kid } from '../../src/model';
import type { HalfContext, Theme } from '../../src/themes/types';

export const contractBox: Box = { x: 400, y: 0, w: 400, h: 450 };

export function contractKid(points: number, id = 'k1', colour = '#d9534f'): Kid {
  return { id, name: 'Anna', colour, avatar: { kind: 'emoji', value: '🙂' }, points, jars: [], found: true };
}

export function contractCtx(theme: Theme, points: number, newFrom = points, box: Box = contractBox, id = 'k1', newTo = points): HalfContext {
  return { kid: contractKid(points, id), box, groups: groupItems(points, theme.capacity), newFrom, newTo, seedKey: `${id}:${theme.id}` };
}

export function coordsOutside(svg: string, box: Box): string[] {
  const bad: string[] = [];
  for (const m of svg.matchAll(/\s(x|y|cx|cy)="(-?[\d.]+)"/g)) {
    const v = parseFloat(m[2]);
    const horizontal = m[1] === 'x' || m[1] === 'cx';
    const [lo, hi] = horizontal ? [box.x, box.x + box.w] : [box.y, box.y + box.h];
    if (!(v >= lo && v <= hi)) bad.push(`${m[1]}=${m[2]}`);
  }
  return bad;
}

/** Markup drawn after the last counted item (scenery in front of the items). */
export function afterItems(svg: string): string {
  const open = svg.lastIndexOf('<g class="fb-item');
  let depth = 0;
  for (const m of svg.slice(open).matchAll(/<g[\s>]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(open + m.index! + 4);
  }
  throw new Error('unclosed group');
}

/** Every `--t:` loop duration in the markup, in seconds. */
export function loopDurations(svg: string): number[] {
  return [...svg.matchAll(/--t:(-?[\d.]+)s/g)].map((m) => parseFloat(m[1]));
}

export function runThemeContract(theme: Theme): void {
  describe(`theme contract: ${theme.id}`, () => {
    for (const points of [0, 7, 30, 1000]) {
      describe(`${points} points`, () => {
        const ctx = contractCtx(theme, points);
        const out = theme.renderHalf(ctx);

        it('draws one data-item per grouped item', () => {
          expect(out.match(/data-item="(small|big)"/g) ?? []).toHaveLength(ctx.groups.big + ctx.groups.small);
          expect(out.match(/data-item="big"/g) ?? []).toHaveLength(ctx.groups.big);
        });
        it('has no NaN', () => {
          expect(out).not.toContain('NaN');
        });
        it('keeps x/y/cx/cy inside the box', () => {
          expect(coordsOutside(out, ctx.box)).toEqual([]);
        });
        it('is deterministic', () => {
          expect(theme.renderHalf(contractCtx(theme, points))).toBe(out);
        });
        it('animates between 1 and 30 elements', () => {
          const n = (out.match(/class="fb-anim/g) ?? []).length;
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(30);
        });
        it('loops for at least 2 s', () => {
          for (const t of loopDurations(out)) expect(t).toBeGreaterThanOrEqual(2);
        });
        it('never animates a counted item directly', () => {
          const both = (out.match(/class="[^"]*"/g) ?? []).filter((c) => c.includes('fb-item') && c.includes('fb-anim'));
          expect(both).toEqual([]);
        });
      });
    }

    it('prefixes its css', () => {
      const css = theme.css ?? '';
      // Keyframe blocks hold percentages like 86.5%, so class selectors are only read outside them.
      const outside = css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
      expect(outside).not.toContain('@keyframes');
      const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g), ...outside.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
      for (const name of names) expect(name.startsWith(`fb-${theme.id}-`), name).toBe(true);
    });

    it('escapes the kid colour exactly once', () => {
      const ctx = contractCtx(theme, 37);
      const out = theme.renderHalf({ ...ctx, kid: { ...ctx.kid, colour: 'red&"x' } });
      expect(out).not.toContain('&amp;amp;');
      expect(out).not.toContain('&amp;quot;');
      expect(out).not.toContain('red&"');
    });

    it('marks items in [newFrom, newTo) as fb-new', () => {
      const out = theme.renderHalf(contractCtx(theme, 7, 5));
      expect(out.match(/class="fb-item fb-new"/g) ?? []).toHaveLength(2);
      expect(out.match(/class="fb-item[^"]*"/g) ?? []).toHaveLength(7);
    });

    it('marks only items inside the range as fb-new', () => {
      const out = theme.renderHalf(contractCtx(theme, 7, 2, undefined, undefined, 4));
      expect(out.match(/class="fb-item fb-new"/g) ?? []).toHaveLength(2);
    });
  });
}
