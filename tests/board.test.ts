import { describe, expect, it } from 'vitest';
import { newItemsFrom, renderBoard } from '../src/board';
import { DEFAULT_SEASONS, type CardConfig, type KidConfig } from '../src/config';
import { de } from '../src/i18n';
import type { BoardModel, Kid, SharedJar } from '../src/model';

const JUNE = new Date(2026, 5, 1);
const DECEMBER = new Date(2026, 11, 10);

function kid(id: string, points: number, extra: Partial<Kid> = {}): Kid {
  return { id, name: id.toUpperCase(), colour: '#d9534f', avatar: { kind: 'emoji', value: '🙂' }, points, jars: [], found: true, ...extra };
}

function config(kids: KidConfig[]): CardConfig {
  return {
    type: 'custom:family-board-card',
    overview_entity: 'sensor.taskmate_overview',
    rewards_entity: 'sensor.taskmate_rewards',
    kids,
    seasons: DEFAULT_SEASONS.map((s) => ({ ...s })),
    reward_icons: {},
  };
}

const twoKids = config([
  { id: 'k1', theme: 'lego', show_number: false },
  { id: 'k2', theme: 'dino', show_number: true },
]);

function model(kids: Kid[], sharedJars: SharedJar[] = []): BoardModel {
  return { status: 'ok', kids, sharedJars };
}

/** The markup of the element group opened by `marker`, up to its matching close tag. */
function group(svg: string, marker: string): string {
  const start = svg.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = svg.lastIndexOf('<g', start);
  let depth = 0;
  for (const m of svg.slice(open).matchAll(/<g[\s>]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(open, open + m.index! + 4);
  }
  throw new Error('unclosed group');
}

describe('renderBoard', () => {
  it('is a full 800x450 svg', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: JUNE });
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"')).toBe(true);
    expect(out.endsWith('</svg>')).toBe(true);
  });

  it('draws one half per kid with its own theme outside a season', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: JUNE });
    expect(out.match(/data-kid-half="/g) ?? []).toHaveLength(2);
    const legoHalf = group(out, 'data-kid-half="k1"');
    const lego = group(legoHalf, 'data-theme="lego"');
    expect(lego.match(/data-item="small"/g) ?? []).toHaveLength(5);
    expect(group(out, 'data-kid-half="k2"')).toContain('data-theme="dino"');
  });

  it('uses the season scene for the whole board in December', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: DECEMBER });
    expect(out.match(/data-theme="/g) ?? []).toHaveLength(1);
    expect(out).toContain('data-theme="christmas"');
    expect(out).not.toContain('data-theme="lego"');
    expect(out.match(/data-kid-half="/g) ?? []).toHaveLength(2);
    expect(out.match(/data-item="/g) ?? []).toHaveLength(8);
  });

  it('centres a shared jar at the bottom on the divider', () => {
    const shared: SharedJar = { id: 's1', name: 'Zoo', icon: { kind: 'emoji', value: '🦁' }, goal: 100, contributions: { k1: 20, k2: 10 } };
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)], [shared]), twoKids, { date: JUNE });
    const jar = group(out, 'data-shared-jar="s1"');
    const line = jar.match(/<line x1="(-?[\d.]+)"[^>]* x2="(-?[\d.]+)"/)!;
    const centre = (parseFloat(line[1]) + parseFloat(line[2])) / 2;
    expect(Math.abs(centre - 400)).toBeLessThanOrEqual(40);
    expect(jar).toContain('data-kid="k1"');
  });

  it('draws the kid jars in that kid\'s half', () => {
    const jars = [1, 2, 3].map((n) => ({ id: `j${n}`, name: `J${n}`, icon: { kind: 'emoji' as const, value: '🎁' }, current: n, goal: 10 }));
    const out = renderBoard(model([kid('k1', 5, { jars }), kid('k2', 3)]), twoKids, { date: JUNE });
    const half = group(out, 'data-kid-half="k1"');
    expect(half.match(/data-jar="/g) ?? []).toHaveLength(3);
  });

  it('shows only the missing message when TaskMate is missing', () => {
    const out = renderBoard({ status: 'missing', kids: [], sharedJars: [] }, twoKids, { date: JUNE });
    expect(out).toContain(de.missing);
    expect(out).not.toContain('data-kid-half');
  });

  it('shows the no-kids message without kids', () => {
    const out = renderBoard(model([]), twoKids, { date: JUNE });
    expect(out).toContain(de.noKids);
    expect(out).not.toContain('data-kid-half');
  });

  it('shows kid-not-found instead of a scene', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 0, { found: false })]), twoKids, { date: JUNE });
    const half = group(out, 'data-kid-half="k2"');
    expect(half).toContain(de.kidNotFound);
    expect(half).not.toContain('data-theme');
  });

  it('escapes the kid name', () => {
    const out = renderBoard(model([kid('k1', 5, { name: '<script>' })]), twoKids, { date: JUNE });
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('truncates long names to 18 characters', () => {
    const out = renderBoard(model([kid('k1', 5, { name: 'Maximilian-Alexander von Hohenberg' })]), twoKids, { date: JUNE });
    expect(out).toContain('>Maximilian-Alexan…<');
  });

  it('shows the number only when show_number is set', () => {
    const out = renderBoard(model([kid('k1', 4321), kid('k2', 1234)]), twoKids, { date: JUNE });
    expect(out).not.toContain('>4321<');
    expect(out).toContain('>1234<');
  });

  it('shows the tap hint in every half', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: JUNE });
    expect(group(out, 'data-kid-half="k1"')).toContain(de.tapHint);
    expect(group(out, 'data-kid-half="k2"')).toContain(de.tapHint);
  });

  it('uses an avatar image when given', () => {
    const out = renderBoard(model([kid('k1', 5, { avatarImage: '/local/a.png?x=1&y=2' })]), twoKids, { date: JUNE });
    expect(out).toContain('<image href="/local/a.png?x=1&amp;y=2"');
  });

  describe('new items', () => {
    const count = (prev: number) => {
      const out = renderBoard(model([kid('k1', 12)]), twoKids, { date: JUNE, prevPoints: { k1: prev } });
      return (out.match(/fb-new/g) ?? []).length;
    };
    it('marks the increase', () => expect(count(10)).toBe(2));
    it('marks nothing when unchanged', () => expect(count(12)).toBe(0));
    it('marks nothing when points dropped', () => expect(count(14)).toBe(0));
    it('marks nothing without previous points', () => {
      const out = renderBoard(model([kid('k1', 12)]), twoKids, { date: JUNE });
      expect(out).not.toContain('fb-new');
    });

    // December: the christmas season scene, capacity 30, so large counts are grouped.
    const seasonCount = (prev: number, points: number) => {
      const out = renderBoard(model([kid('k1', points)]), twoKids, { date: DECEMBER, prevPoints: { k1: prev } });
      return (out.match(/fb-new/g) ?? []).length;
    };
    it('marks the new big item above capacity', () => expect(seasonCount(99, 100)).toBeGreaterThanOrEqual(1));
    it('marks the new small item above capacity', () => expect(seasonCount(37, 38)).toBe(1));
    it('marks nothing above capacity when points dropped', () => expect(seasonCount(40, 38)).toBe(0));
  });

  describe('newItemsFrom', () => {
    it('is the previous count below capacity', () => expect(newItemsFrom(10, 12, 30)).toBe(10));
    it('marks nothing without previous points, or when unchanged or dropped', () => {
      expect(newItemsFrom(undefined, 12, 30)).toBe(12);
      expect(newItemsFrom(12, 12, 30)).toBe(12);
      expect(newItemsFrom(14, 12, 30)).toBe(12);
      expect(newItemsFrom(40, 38, 30)).toBe(11);
    });
    it('starts at the first new big item when big items were added', () => {
      expect(newItemsFrom(99, 100, 30)).toBe(9); // 9 big + 9 small -> 10 big + 0 small
    });
    it('starts after the old small items when only small items were added', () => {
      expect(newItemsFrom(37, 38, 30)).toBe(10); // 3 big + 7 small -> 3 big + 8 small
    });
    it('marks nothing when the unit changes', () => {
      expect(newItemsFrom(29, 31, 30)).toBe(4); // 29 small -> 3 big + 1 small
    });
  });

  it('spans the full width with one kid', () => {
    const out = renderBoard(model([kid('k1', 5)]), twoKids, { date: JUNE });
    expect(out.match(/data-kid-half="/g) ?? []).toHaveLength(1);
    expect(group(out, 'data-kid-half="k1"')).toContain('<rect x="0" y="0" width="800" height="450"');
  });

  it('splits three kids into thirds without NaN', () => {
    const cfg = config([...twoKids.kids, { id: 'k3', theme: 'lego', show_number: true }]);
    const shared: SharedJar = { id: 's1', name: 'Zoo', icon: { kind: 'emoji', value: '🦁' }, goal: 100, contributions: { k1: 20 } };
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3), kid('k3', 40)], [shared]), cfg, { date: JUNE });
    expect(out.match(/data-kid-half="/g) ?? []).toHaveLength(3);
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('Infinity');
  });

  it('is deterministic and keeps jar wobble when a jar is added', () => {
    const j = (id: string) => ({ id, name: id, icon: { kind: 'emoji' as const, value: '🎁' }, current: 1, goal: 10 });
    const a = renderBoard(model([kid('k1', 5, { jars: [j('a')] })]), twoKids, { date: JUNE });
    expect(renderBoard(model([kid('k1', 5, { jars: [j('a')] })]), twoKids, { date: JUNE })).toBe(a);
    const b = renderBoard(model([kid('k1', 5, { jars: [j('a'), j('b')] })]), twoKids, { date: JUNE });
    expect(group(b, 'data-jar="a"')).toBe(group(a, 'data-jar="a"'));
  });

  it('caps the shared jar row to what fits on the board', () => {
    const shared: SharedJar[] = Array.from({ length: 30 }, (_, n) => ({ id: `s${n}`, name: 'Z', icon: { kind: 'emoji' as const, value: '🦁' }, goal: 10, contributions: { k1: 1 } }));
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)], shared), twoKids, { date: JUNE });
    const n = (out.match(/data-shared-jar="/g) ?? []).length;
    expect(n).toBeGreaterThan(1);
    expect(n).toBeLessThan(30);
    for (const m of out.matchAll(/data-shared-jar="[^"]*"><g><path d="M(-?[\d.]+)/g)) {
      expect(parseFloat(m[1])).toBeGreaterThanOrEqual(0);
      expect(parseFloat(m[1])).toBeLessThanOrEqual(800);
    }
  });

  it('keeps too many jars inside the half', () => {
    const jars = Array.from({ length: 20 }, (_, n) => ({ id: `j${n}`, name: `J${n}`, icon: { kind: 'emoji' as const, value: '🎁' }, current: 1, goal: 10 }));
    const out = renderBoard(model([kid('k1', 5, { jars }), kid('k2', 3)]), twoKids, { date: JUNE });
    const half = group(out, 'data-kid-half="k1"');
    const n = (half.match(/data-jar="/g) ?? []).length;
    expect(n).toBeGreaterThan(3);
    expect(n).toBeLessThan(20);
    expect(half).toContain('data-jar="j0"');
  });
});
