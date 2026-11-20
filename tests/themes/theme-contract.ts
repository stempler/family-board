import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import type { Kid } from '../../src/model';
import type { HalfContext, Theme } from '../../src/themes/types';

export const contractBox: Box = { x: 400, y: 0, w: 400, h: 450 };

export function contractKid(points: number, id = 'k1', colour = '#d9534f'): Kid {
  return { id, name: 'Anna', colour, avatar: { kind: 'emoji', value: '🙂' }, points, jars: [], found: true };
}

export function contractCtx(theme: Theme, points: number, newFrom = points, box: Box = contractBox, id = 'k1'): HalfContext {
  return { kid: contractKid(points, id), box, groups: groupItems(points, theme.capacity), newFrom, seedKey: `${id}:${theme.id}` };
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
      });
    }

    it('marks items from newFrom as fb-new', () => {
      const out = theme.renderHalf(contractCtx(theme, 7, 5));
      expect(out.match(/class="fb-item fb-new"/g) ?? []).toHaveLength(2);
      expect(out.match(/class="fb-item[^"]*"/g) ?? []).toHaveLength(7);
    });
  });
}
