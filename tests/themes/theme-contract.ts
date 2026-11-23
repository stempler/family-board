import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import type { Kid } from '../../src/model';
import type { HalfContext, Theme } from '../../src/themes/types';

export const contractBox: Box = { x: 400, y: 0, w: 400, h: 450 };

export function contractKid(points: number, id = 'k1', colour = '#d9534f'): Kid {
  return { id, name: 'Anna', colour, avatar: { kind: 'emoji', value: '🙂' }, points, jars: [], found: true };
}

/** A context for `points`; newFrom/newTo default to "nothing new" (from the theme's `items` hook when it has one). */
export function contractCtx(theme: Theme, points: number, newFrom?: number, box: Box = contractBox, id = 'k1', newTo?: number): HalfContext {
  const none = theme.items ? theme.items(points, undefined) : { newFrom: points, newTo: points };
  return { kid: contractKid(points, id), box, groups: groupItems(points, theme.capacity), newFrom: newFrom ?? none.newFrom, newTo: newTo ?? none.newTo, seedKey: `${id}:${theme.id}` };
}

/** How many data-item elements `theme` draws for `points`. */
export function itemCount(theme: Theme, points: number): number {
  if (theme.items) return theme.items(points, undefined).total;
  const g = groupItems(points, theme.capacity);
  return g.big + g.small;
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

/** Markup drawn before the first counted item (scenery behind the items). */
export function beforeItems(svg: string): string {
  const open = svg.indexOf('<g class="fb-item');
  if (open < 0) throw new Error('no item');
  return svg.slice(0, open);
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

function channel(hex: string, i: number): number {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (c: string) => 0.2126 * channel(c, 0) + 0.7152 * channel(c, 1) + 0.0722 * channel(c, 2);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function runThemeContract(theme: Theme): void {
  describe(`theme contract: ${theme.id}`, () => {
    for (const points of [0, 7, 30, 1000]) {
      describe(`${points} points`, () => {
        const ctx = contractCtx(theme, points);
        const out = theme.renderHalf(ctx);

        it('draws one data-item per grouped item', () => {
          expect(out.match(/data-item="(small|big)"/g) ?? []).toHaveLength(itemCount(theme, points));
          if (!theme.items) expect(out.match(/data-item="big"/g) ?? []).toHaveLength(ctx.groups.big);
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

    if (theme.ground) {
      it('keeps the jar outline readable on its ground colour', () => {
        expect(contrast('#3a2f28', theme.ground!)).toBeGreaterThanOrEqual(3);
      });

      it('draws its ground colour in the scene', () => {
        expect(theme.renderHalf(contractCtx(theme, 7))).toContain(`fill="${theme.ground}"`);
      });
    }
  });
}
