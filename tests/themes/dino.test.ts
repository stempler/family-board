import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { afterItems, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.dino);

const dino = THEMES.dino;
const half = (points: number) => dino.renderHalf(contractCtx(dino, points));

/** The markup of every `<g data-part="…">` group with that part name, in drawing order. */
function parts(svg: string, name: string): string[] {
  const out: string[] = [];
  for (const start of svg.matchAll(new RegExp(`<g data-part="${name}"`, 'g'))) {
    let depth = 0;
    for (const m of svg.slice(start.index).matchAll(/<g[\s>]|<\/g>/g)) {
      depth += m[0] === '</g>' ? -1 : 1;
      if (depth === 0) {
        out.push(svg.slice(start.index, start.index + m.index + 4));
        break;
      }
    }
  }
  return out;
}

interface Bounds { minX: number; maxX: number; minY: number; maxY: number }

/** Bounds of a group from its path points and its x/y/cx/cy attributes (like coordsOutside). */
function bounds(svg: string): Bounds {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const d of svg.matchAll(/\sd="([^"]*)"/g)) {
    for (const m of d[1].matchAll(/(-?[\d.]+) +(-?[\d.]+)/g)) {
      xs.push(parseFloat(m[1]));
      ys.push(parseFloat(m[2]));
    }
  }
  for (const m of svg.matchAll(/\s(x|y|cx|cy)="(-?[\d.]+)"/g)) (m[1].endsWith('x') ? xs : ys).push(parseFloat(m[2]));
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe('dino', () => {
  it('draws a whole dino: body, two legs, an arm, a tail and a head, next to a nest', () => {
    const out = half(7);
    for (const part of ['body', 'arm', 'tail', 'head', 'nest']) expect(parts(out, part), part).toHaveLength(1);
    expect(parts(out, 'leg')).toHaveLength(2);
    expect(out).not.toContain('data-part="feet"');
  });
  for (const points of [0, 7, 37, 300]) {
    describe(`at ${points} points`, () => {
      const nest = (out: string) => bounds(parts(out, 'nest')[0] ?? '');
      it('stands beside the nest, not behind it', () => {
        const out = half(points);
        expect(parts(out, 'nest')).toHaveLength(1);
        expect(bounds(parts(out, 'body')[0] ?? '').minX).toBeGreaterThanOrEqual(nest(out).maxX - 10);
      });
      it('stands with both feet on the ground', () => {
        const out = half(points);
        const legs = parts(out, 'leg');
        expect(legs).toHaveLength(2);
        for (const leg of legs) expect(Math.abs(bounds(leg).maxY - nest(out).maxY)).toBeLessThanOrEqual(6);
      });
    });
  }
  it('keeps the blink, head bob and tail sway on their parts', () => {
    const out = half(7);
    expect(parts(out, 'head')[0]).toMatch(/^<g data-part="head" class="fb-anim fb-dino-bob"/);
    expect(parts(out, 'head')[0]).toContain('fb-dino-blink');
    expect(parts(out, 'tail')[0]).toMatch(/^<g data-part="tail" class="fb-anim fb-dino-sway"/);
  });
  it('wobbles exactly one egg, the last small one', () => {
    const out = half(7);
    expect(out.match(/fb-dino-wobble/g) ?? []).toHaveLength(1);
  });
  it('wobbles the last big egg when there are no small eggs (150 points)', () => {
    const ctx = contractCtx(dino, 150);
    expect(ctx.groups).toMatchObject({ small: 0 });
    expect(ctx.groups.big).toBeGreaterThan(0);
    expect(dino.renderHalf(ctx).match(/fb-dino-wobble/g) ?? []).toHaveLength(1);
  });
  it("keeps the nest front's wobble when an egg is added", () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
