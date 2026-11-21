import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { de } from '../../src/i18n';
import { groupItems } from '../../src/items';
import { footprint, spots } from '../../src/themes/birthday';
import { seasonThemeIds, THEMES } from '../../src/themes/registry';
import { layout } from './layout';
import { beforeItems, contractBox, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const birthday = THEMES.birthday;

runThemeContract(birthday);

const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
const half = (points: number, age?: number, box: Box = contractBox) => birthday.renderHalf({ ...contractCtx(birthday, points, undefined, box), age });
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;
const animated = (svg: string) => count(svg, /class="fb-anim/g);

/** The candles' centres in board x, by row (0 is the top tier). */
function candleRows(svg: string): number[][] {
  const rows: number[][] = [];
  for (const m of svg.matchAll(/data-part="candle" data-row="(\d)" data-cx="(-?[\d.]+)"/g)) (rows[+m[1]] ??= []).push(parseFloat(m[2]));
  return rows;
}

/** Every `<g data-part="candle" ...>...</g>` group, up to its matching close tag. */
function candleGroups(svg: string): string[] {
  return [...svg.matchAll(/<g data-part="candle"/g)].map((start) => {
    const rest = svg.slice(start.index);
    let depth = 0;
    for (const m of rest.matchAll(/<g[\s>]|<\/g>/g)) {
      depth += m[0] === '</g>' ? -1 : 1;
      if (depth === 0) return rest.slice(0, m.index! + 4);
    }
    throw new Error('unclosed candle');
  });
}

describe('birthday half', () => {
  it('has a table, a cake and a banner instead of the bunting', () => {
    const out = half(7, 7);
    for (const name of ['table', 'cake', 'banner']) expect(out).toContain(`data-part="${name}"`);
    expect(out).not.toContain('data-part="bunting"');
  });
  it('is not a season theme', () => {
    expect(seasonThemeIds()).not.toContain('birthday');
    expect(birthday.renderSeasonScene).toBeUndefined();
  });
  it('uses the kid colour', () => {
    expect(half(0)).toContain('#d9534f');
  });
  it('keeps the scenery wobble when a balloon is added', () => {
    expect(beforeItems(half(8, 7))).toBe(beforeItems(half(7, 7)));
  });
  it('shows a whole birthday picture at 0 points and no age: cake, table, banner and topper', () => {
    const out = half(0);
    for (const name of ['cake', 'table', 'banner', 'topper']) expect(out).toContain(`data-part="${name}"`);
    expect(out).not.toContain('data-item');
  });
});

describe('birthday candles', () => {
  for (const age of [1, 7, 10, 11, 20]) {
    it(`shows ${age} candles at age ${age}`, () => {
      expect(count(half(12, age), /data-part="candle"/g)).toBe(age);
    });
  }
  it('draws more than 20 candles as 20', () => {
    expect(count(half(12, 25), /data-part="candle"/g)).toBe(20);
  });
  it('stands up to 10 candles in one row and 11 to 20 in two', () => {
    for (const age of [1, 7, 10]) expect(candleRows(half(12, age))).toHaveLength(1);
    for (const age of [11, 15, 20, 25]) {
      const rows = candleRows(half(12, age));
      expect(rows).toHaveLength(2);
      for (const r of rows) expect(r.length).toBeLessThanOrEqual(10);
    }
  });
  for (const box of [contractBox, narrow]) {
    it(`centres every row on the cake, mirrored (${box.w} wide)`, () => {
      const centre = box.x + box.w / 2;
      expect(half(12, 7, box)).toContain(`data-part="cake" data-cx="${centre}"`);
      for (const age of [1, 2, 7, 10, 11, 14, 19, 20]) {
        for (const row of candleRows(half(12, age, box))) {
          const xs = [...row].sort((a, b) => a - b);
          expect(xs.reduce((a, b) => a + b, 0) / xs.length).toBeCloseTo(centre, 1);
          xs.forEach((x, i) => expect(x - centre).toBeCloseTo(centre - xs[xs.length - 1 - i], 1));
        }
      }
    });
  }
  it('has no candles and a topper without an age', () => {
    const out = half(12);
    expect(out).not.toContain('data-part="candle"');
    expect(out).toContain('data-part="topper"');
    expect(half(12, 7)).not.toContain('data-part="topper"');
  });
  it('does not count the candles as items', () => {
    const out = half(0, 20);
    expect(candleGroups(out)).toHaveLength(20);
    for (const g of candleGroups(out)) expect(g).not.toContain('data-item');
    expect(out).not.toContain('data-item');
  });
});

describe('birthday balloons and presents', () => {
  for (const points of [0, 7, 30, 37, 199, 1000, 4321]) {
    it(`draws the grouped balloons and presents at ${points} points`, () => {
      const g = groupItems(points, birthday.capacity);
      const out = half(points, 7);
      expect(count(out, /data-part="balloon"/g)).toBe(g.small);
      expect(count(out, /data-part="present"/g)).toBe(g.big);
    });
  }
  it('holds 30 balloons', () => {
    expect(birthday.capacity).toBe(30);
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('puts presents first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, birthday.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
});

describe('birthday greeting', () => {
  /** The greeting's text element: its x, font size and text. */
  const greeting = (svg: string) => {
    const m = /<g data-part="banner">.*?<text x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/.exec(svg);
    expect(m).not.toBeNull();
    return { x: parseFloat(m![1]), size: parseFloat(m![2]), text: m![3] };
  };
  it('writes the long greeting in a 400-wide half', () => {
    expect(greeting(half(12, 7)).text).toBe(de.birthdayGreeting);
  });
  it('writes the short greeting in a 160-wide half', () => {
    expect(greeting(half(12, 7, narrow)).text).toBe(de.birthdayGreetingShort);
  });
  for (const box of [contractBox, { x: 0, y: 0, w: 266, h: 450 }, { x: 0, y: 0, w: 200, h: 450 }, narrow]) {
    it(`keeps the greeting readable and inside a ${box.w}-wide half`, () => {
      const g = greeting(half(12, 7, box));
      expect(g.size).toBeGreaterThanOrEqual(12);
      expect(g.x).toBeCloseTo(box.x + box.w / 2, 1);
      // 0.6 em per glyph is wider than the font's average, so the text is no wider than this.
      expect(Array.from(g.text).length * 0.6 * g.size).toBeLessThan(box.w - 20);
    });
  }
  it('keeps everything inside a narrow half', () => {
    for (const [points, age] of [[4321, 20], [0, undefined], [37, 11]] as [number, number | undefined][]) {
      expect(coordsOutside(half(points, age, narrow), narrow)).toEqual([]);
    }
  });
});

describe('birthday animation', () => {
  it('flickers one flame per candle, at most 8', () => {
    expect(count(half(12, 7), /fb-anim fb-birthday-flame/g)).toBe(7);
    expect(count(half(12, 20), /fb-anim fb-birthday-flame/g)).toBe(8);
    expect(count(half(12), /fb-anim fb-birthday-flame/g)).toBe(0);
  });
  it('waves the banner ends', () => {
    expect(count(half(12), /fb-anim fb-birthday-tail/g)).toBe(2);
  });
  it('animates 1 to 12 elements, also without candles', () => {
    for (const age of [undefined, 1, 7, 8, 20, 25]) {
      for (const points of [0, 30, 1000]) {
        const n = animated(half(points, age));
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(12);
      }
    }
  });
  it('never animates a counted item', () => {
    const both = (half(1000, 20).match(/class="[^"]*"/g) ?? []).filter((c) => c.includes('fb-item') && c.includes('fb-anim'));
    expect(both).toEqual([]);
  });
});

describe('birthday item layout', () => {
  const { overlapping, area } = layout(footprint);

  it('ties the balloons in columns of five', () => {
    const columns = new Map<number, number>();
    for (const s of spots(0, birthday.capacity)) columns.set(s.x, (columns.get(s.x) ?? 0) + 1);
    expect([...columns.values()]).toEqual(Array(6).fill(5));
  });
  it('has a spot for as many presents as the grouping can ask for', () => {
    expect(spots(birthday.capacity, 0)).toHaveLength(birthday.capacity);
  });
  it('keeps every present clearly bigger than a balloon', () => {
    const small = area(spots(0, 1)[0]);
    expect(area(spots(1, 0)[0])).toBeGreaterThan(2.5 * small);
    for (const s of spots(birthday.capacity, 0)) expect(area(s)).toBeGreaterThan(1.5 * small);
  });
  it('keeps every present inside the party units', () => {
    for (const s of spots(birthday.capacity, 0)) {
      const [l, t, r, b] = footprint(s);
      expect(l >= 0 && r <= 340 && t >= 0 && b <= 270, `present at ${s.x},${s.y}`).toBe(true);
    }
  });
  it('keeps the presents apart', () => {
    expect(overlapping(spots(birthday.capacity, 0))).toEqual([]);
  });
  for (const points of [30, 37, 199, 300, 1000, 4321]) {
    it(`draws no two items on top of each other at ${points} points`, () => {
      const { big, small } = groupItems(points, birthday.capacity);
      const list = spots(big, small);
      expect(list).toHaveLength(big + small);
      expect(overlapping(list)).toEqual([]);
    });
  }
  it('has a spot for every mix of presents and balloons', () => {
    for (let big = 0; big <= birthday.capacity; big++) {
      const list = spots(big, birthday.capacity - big);
      expect(list).toHaveLength(birthday.capacity);
      expect(overlapping(list)).toEqual([]);
    }
  });
});
