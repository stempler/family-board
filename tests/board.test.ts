import { describe, expect, it } from 'vitest';
import { boardSize, renderBoard } from '../src/board';
import { drawJar, drawSharedJar } from '../src/draw/jar';
import { DEFAULT_SEASONS, type CardConfig, type KidConfig } from '../src/config';
import { de } from '../src/i18n';
import { groupItems } from '../src/items';
import type { BoardModel, Kid, SharedJar } from '../src/model';
import { activeSeason, seasonStart } from '../src/season';
import { SCENE_BOTTOM } from '../src/draw/units';
import { THEMES } from '../src/themes/registry';

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
    fill: 'auto',
  };
}

const twoKids = config([
  { id: 'k1', theme: 'bricks', show_number: false },
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

  it('renders a retired theme id without throwing', () => {
    expect(() => renderBoard(model([kid('k1', 5)]), config([{ id: 'k1', theme: 'rescue', show_number: true }]), { date: JUNE })).not.toThrow();
  });

  it('draws one half per kid with its own theme outside a season', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: JUNE });
    expect(out.match(/data-kid-half="/g) ?? []).toHaveLength(2);
    const bricksHalf = group(out, 'data-kid-half="k1"');
    const bricks = group(bricksHalf, 'data-theme="bricks"');
    expect(bricks.match(/data-item="small"/g) ?? []).toHaveLength(5);
    expect(group(out, 'data-kid-half="k2"')).toContain('data-theme="dino"');
  });

  it('uses the season scene for the whole board in December', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: DECEMBER });
    expect(out.match(/data-theme="/g) ?? []).toHaveLength(1);
    expect(out).toContain('data-theme="christmas"');
    expect(out).not.toContain('data-theme="bricks"');
    expect(out.match(/data-kid-half="/g) ?? []).toHaveLength(2);
    expect(out.match(/data-item="/g) ?? []).toHaveLength(8);
  });

  describe('seasons without a shared scene', () => {
    const withSeasons = (seasons: CardConfig['seasons']): CardConfig => ({ ...twoKids, seasons });

    it('applies a theme without a season scene to every half', () => {
      const cfg = withSeasons([{ theme: 'dino', from: '07-01', to: '08-31' }]);
      const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), cfg, { date: new Date(2026, 6, 15) });
      expect(group(out, 'data-kid-half="k1"')).toContain('data-theme="dino"');
      expect(group(out, 'data-kid-half="k2"')).toContain('data-theme="dino"');
      expect(out).not.toContain('data-theme="bricks"');
    });

    it('still finds a christmas rule listed after a non-matching rule', () => {
      const cfg = withSeasons([{ theme: 'dino', from: '07-01', to: '08-31' }, { theme: 'christmas', from: '12-01', to: '12-26' }]);
      const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), cfg, { date: DECEMBER });
      expect(out.match(/data-theme="/g) ?? []).toHaveLength(1);
      expect(out).toContain('data-theme="christmas"');
    });

    it('skips a rule with an unknown theme', () => {
      const cfg = withSeasons([{ theme: 'nope', from: '06-01', to: '06-30' }]);
      const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), cfg, { date: JUNE });
      expect(group(out, 'data-kid-half="k1"')).toContain('data-theme="bricks"');
      expect(group(out, 'data-kid-half="k2"')).toContain('data-theme="dino"');
    });
  });

  it('gives every half a transparent hit target above the season scene in December', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: DECEMBER });
    const sceneEnd = out.indexOf(group(out, 'data-theme="christmas"')) + group(out, 'data-theme="christmas"').length;
    for (const [id, x] of [['k1', '0'], ['k2', '400']]) {
      const half = group(out, `data-kid-half="${id}"`);
      expect(half).toContain(`<rect x="${x}" y="0" width="400" height="450" fill="transparent" pointer-events="all"/>`);
      expect(out.indexOf(`data-kid-half="${id}"`)).toBeGreaterThan(sceneEnd);
    }
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

  describe('number chip', () => {
    const pointsGroup = (out: string, id: string) => group(out, `data-points="${id}"`);
    const attr = (src: string, tag: string, name: string) => Number(new RegExp(`<${tag}[^>]* ${name}="([-\\d.]+)"`).exec(src)![1]);
    const nameOf = (half: string) => {
      const m = /<text x="([-\d.]+)"[^>]* font-size="([-\d.]+)"[^>]*text-anchor="start"[^>]*>([^<]*)</.exec(half)!;
      return { x: Number(m[1]), size: Number(m[2]), content: m[3] };
    };

    it('puts a name-high number chip at the right edge of the half', () => {
      const cfg = config([{ id: 'k1', theme: 'bricks', show_number: true }, { id: 'k2', theme: 'dino', show_number: true }]);
      const out = renderBoard(model([kid('k1', 12, { name: 'Mia' }), kid('k2', 37, { name: 'Ben' })]), cfg, { date: JUNE });
      for (const [id, pts] of [['k1', '12'], ['k2', '37']]) {
        const half = group(out, `data-kid-half="${id}"`);
        const chip = pointsGroup(half, id);
        const n = nameOf(half);
        const end = n.x + Array.from(n.content).length * n.size * 0.55;
        const x = attr(chip, 'rect', 'x');
        const i = id === 'k1' ? 0 : 1;
        expect(x).toBeGreaterThanOrEqual(end);
        expect(x + attr(chip, 'rect', 'width')).toBeCloseTo(i * 400 + 400 - 14, 0); // flush with the right margin
        const h = attr(chip, 'rect', 'height');
        expect(h).toBeGreaterThanOrEqual(0.6 * n.size); // about the height of the name's letters
        expect(h).toBeLessThanOrEqual(0.8 * n.size);
        expect(chip).toMatch(new RegExp(`<text[^>]*font-weight="bold"[^>]*>${pts}</text>`));
        expect(chip).toContain('fill="#d9534f"');
      }
    });

    it('keeps the chip inside the half for 5 kids with long names and 4-digit points', () => {
      const ids = ['a', 'b', 'c', 'd', 'e'];
      const cfg = config(ids.map((id) => ({ id, theme: 'bricks', show_number: true })));
      const out = renderBoard(model(ids.map((id, i) => kid(id, (i + 1) * 1000, { name: 'Maximiliane-Sophie' }))), cfg, { date: JUNE });
      ids.forEach((id, i) => {
        const half = group(out, `data-kid-half="${id}"`);
        const chip = pointsGroup(half, id);
        const n = nameOf(half);
        const x = attr(chip, 'rect', 'x');
        expect(x + attr(chip, 'rect', 'width')).toBeLessThanOrEqual(i * 160 + 160 - 14);
        expect(x).toBeGreaterThanOrEqual(n.x + Array.from(n.content).length * n.size * 0.55);
        expect(n.size).toBeGreaterThanOrEqual(12);
        expect(Array.from(n.content).length).toBeGreaterThanOrEqual(4);
      });
    });

    it('picks white or ink text by the luminance of a hex kid colour', () => {
      const cfg = config([{ id: 'k1', theme: 'bricks', show_number: true }, { id: 'k2', theme: 'bricks', show_number: true }]);
      const out = renderBoard(model([kid('k1', 12, { colour: '#1a237e' }), kid('k2', 12, { colour: '#ffd54f' })]), cfg, { date: JUNE });
      expect(pointsGroup(out, 'k1')).toMatch(/<text[^>]*fill="#ffffff"[^>]*>12</);
      expect(pointsGroup(out, 'k2')).toMatch(/<text[^>]*fill="#3a2f28"[^>]*>12</);
    });

    it('keeps ink text for a non-hex colour', () => {
      const cfg = config([{ id: 'k1', theme: 'bricks', show_number: true }]);
      const out = renderBoard(model([kid('k1', 12, { colour: 'rebeccapurple' })]), cfg, { date: JUNE });
      expect(pointsGroup(out, 'k1')).toMatch(/<text[^>]*fill="#3a2f28"[^>]*>12</);
    });

    it('shows no chip for a kid that is not found', () => {
      const cfg = config([{ id: 'k1', theme: 'bricks', show_number: true }]);
      const out = renderBoard(model([kid('k1', 0, { found: false })]), cfg, { date: JUNE });
      expect(out).toContain(de.kidNotFound);
      expect(out).not.toContain('data-points=');
    });

    it('shows whole points only', () => {
      const cfg = config([{ id: 'k1', theme: 'bricks', show_number: true }]);
      const out = renderBoard(model([kid('k1', 12.5)]), cfg, { date: JUNE });
      expect(pointsGroup(out, 'k1')).toMatch(/>12</);
      expect(pointsGroup(out, 'k1')).not.toContain('12.5');
    });

    it('hides the chip with show_number: false', () => {
      const out = renderBoard(model([kid('k1', 4321), kid('k2', 1234)]), twoKids, { date: JUNE });
      expect(out).not.toContain('>4321<');
      expect(out).not.toContain('data-points="k1"');
      expect(out).toContain('data-points="k2"');
      expect(out).toContain('>1234<');
    });
  });

  it('shows the tap hint and marks the half tappable only with a tap_path', () => {
    const cfg = config([
      { id: 'k1', theme: 'bricks', show_number: false, tap_path: '/lovelace/k1' },
      { id: 'k2', theme: 'dino', show_number: false },
    ]);
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), cfg, { date: JUNE });
    const h1 = group(out, 'data-kid-half="k1"');
    const h2 = group(out, 'data-kid-half="k2"');
    expect(h1).toContain(de.tapHint);
    expect(out).toContain('data-kid-half="k1" data-tappable="true"');
    expect(h2).not.toContain(de.tapHint);
    expect(out).not.toContain('data-kid-half="k2" data-tappable');
  });

  it('shows no tap hint for a kid that was not found', () => {
    const cfg = config([{ id: 'k1', theme: 'bricks', show_number: false, tap_path: '/x' }]);
    const out = renderBoard(model([kid('k1', 0, { found: false })]), cfg, { date: JUNE });
    expect(group(out, 'data-kid-half="k1"')).not.toContain(de.tapHint);
    expect(out).not.toContain('data-tappable');
  });

  it('draws the season scene only for found kids and keeps a not-found half untappable', () => {
    const cfg = config([
      { id: 'k1', theme: 'bricks', show_number: true, tap_path: '/x' },
      { id: 'k2', theme: 'dino', show_number: true, tap_path: '/y' },
    ]);
    const out = renderBoard(model([kid('k1', 5), kid('k2', 0, { found: false })]), cfg, { date: DECEMBER });
    expect(out).toContain('data-season-kid="k1"');
    expect(out).not.toContain('data-season-kid="k2"');
    expect(group(out, 'data-kid-half="k2"')).toContain(de.kidNotFound);
    expect(out).toContain('data-kid-half="k1" data-tappable="true"');
    expect(out).not.toContain('data-kid-half="k2" data-tappable');
  });

  it('shows the tap hint in the christmas season scene only with a tap_path', () => {
    const cfg = config([
      { id: 'k1', theme: 'bricks', show_number: false, tap_path: '/x' },
      { id: 'k2', theme: 'dino', show_number: false },
    ]);
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), cfg, { date: DECEMBER });
    expect(out).toContain('data-theme="christmas"');
    expect(group(out, 'data-kid-half="k1"')).toContain(de.tapHint);
    expect(group(out, 'data-kid-half="k2"')).not.toContain(de.tapHint);
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
    it('marks only the new big item when a merge happens above capacity', () => expect(seasonCount(39, 40)).toBe(1));
    it('marks the new small item above capacity', () => expect(seasonCount(37, 38)).toBe(1));
    it('marks nothing above capacity when points dropped', () => expect(seasonCount(40, 38)).toBe(0));

    // Chess counts its own items: kings on the shelf, then the captured pieces.
    const chessNew = (prev: number, points: number) => {
      const cfg = config([{ id: 'k1', theme: 'chess', show_number: true }]);
      const out = renderBoard(model([kid('k1', points)]), cfg, { date: JUNE, prevPoints: { k1: prev } });
      return { shelf: (group(out, 'data-part="shelf"').match(/fb-new/g) ?? []).length, captured: (group(out, 'data-part="captured"').match(/fb-new/g) ?? []).length };
    };
    it('pops the new captured piece in chess', () => expect(chessNew(18, 19)).toEqual({ shelf: 0, captured: 1 }));
    it('pops only the new king when a chess game is won', () => expect(chessNew(31, 32)).toEqual({ shelf: 1, captured: 0 }));
  });

  it('spans the full width with one kid', () => {
    const out = renderBoard(model([kid('k1', 5)]), twoKids, { date: JUNE });
    expect(out.match(/data-kid-half="/g) ?? []).toHaveLength(1);
    expect(group(out, 'data-kid-half="k1"')).toContain('<rect x="0" y="0" width="800" height="450"');
  });

  it('splits three kids into thirds without NaN', () => {
    const cfg = config([...twoKids.kids, { id: 'k3', theme: 'bricks', show_number: true }]);
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

  describe('stays within the animation budget', () => {
    const busy = model([kid('k1', 1000), kid('k2', 37)]);
    const animated = (svg: string) => (svg.match(/class="fb-anim/g) ?? []).length;

    for (const id of Object.keys(THEMES)) {
      it(`with both kids on ${id}`, () => {
        const cfg: CardConfig = { ...config([{ id: 'k1', theme: id, show_number: false }, { id: 'k2', theme: id, show_number: false }]), seasons: [] };
        const n = animated(renderBoard(busy, cfg, { date: JUNE }));
        expect(n).toBeGreaterThan(0);
        expect(n).toBeLessThanOrEqual(60);
      });
    }

    for (const id of Object.keys(THEMES)) {
      for (const points of [0, 30, 37, 1000]) {
        it(`with five kids on ${id} at ${points} points`, () => {
          const ids = ['k1', 'k2', 'k3', 'k4', 'k5'];
          const five = model(ids.map((k) => kid(k, points)));
          const cfg: CardConfig = { ...config(ids.map((k) => ({ id: k, theme: id, show_number: false }))), seasons: [] };
          const n = animated(renderBoard(five, cfg, { date: JUNE }));
          expect(n).toBeLessThanOrEqual(60);
        });
      }
    }

    // One date inside each default season whose theme draws a shared season scene.
    const seasonDates = new Map<string, Date>();
    for (let day = 0; day < 366; day++) {
      const date = new Date(2026, 0, 1 + day);
      const rule = activeSeason(date, DEFAULT_SEASONS, Object.keys(THEMES));
      if (rule && THEMES[rule.theme].renderSeasonScene && !seasonDates.has(rule.theme)) seasonDates.set(rule.theme, date);
    }
    it('finds a season scene to check', () => expect(seasonDates.size).toBeGreaterThan(0));
    for (const [theme, date] of seasonDates) {
      it(`in the ${theme} season`, () => {
        const out = renderBoard(busy, twoKids, { date });
        expect(out).toContain(`data-theme="${theme}"`);
        const n = animated(out);
        expect(n).toBeGreaterThan(0);
        expect(n).toBeLessThanOrEqual(60);
      });
    }
  });
});

describe('every theme at the narrowest and widest board', () => {
  const animated = (svg: string) => (svg.match(/class="fb-anim/g) ?? []).length;
  const shapes = [
    { name: 'widest (1600 wide)', size: { w: 4000, h: 900 }, ids: ['k1'] },
    { name: 'narrowest for five kids (800x600)', size: { w: 1024, h: 768 }, ids: ['k1', 'k2', 'k3', 'k4', 'k5'] },
  ];
  const check = (out: string) => {
    expect(out).not.toContain('NaN');
    expect(animated(out)).toBeLessThanOrEqual(60);
  };

  for (const id of Object.keys(THEMES)) {
    for (const s of shapes) {
      it(`${id} as a half theme, ${s.name}`, () => {
        const cfg: CardConfig = { ...config(s.ids.map((k) => ({ id: k, theme: id, show_number: true }))), seasons: [] };
        check(renderBoard(model(s.ids.map((k) => kid(k, 37))), cfg, { date: JUNE, size: s.size }));
      });
    }
  }

  for (const t of Object.values(THEMES).filter((x) => x.renderSeasonScene)) {
    const date = seasonStart(DEFAULT_SEASONS.find((r) => r.theme === t.id)!, 2026);
    for (const s of shapes) {
      it(`${t.id} season scene, ${s.name}`, () => {
        const cfg = config(s.ids.map((k) => ({ id: k, theme: 'bricks', show_number: true })));
        const out = renderBoard(model(s.ids.map((k) => kid(k, 37))), cfg, { date, size: s.size });
        expect(out).toContain(`data-theme="${t.id}"`);
        check(out);
      });
    }
  }
});

describe('birthday', () => {
  const cfg = (extra: Partial<CardConfig> = {}, k2Birthday?: string): CardConfig => ({
    ...config([
      { id: 'k1', theme: 'bricks', show_number: false, birthday: '12-10' },
      { id: 'k2', theme: 'dino', show_number: true, ...(k2Birthday ? { birthday: k2Birthday } : {}) },
    ]),
    ...extra,
  });
  const two = (opts: { date: Date; prevPoints?: Record<string, number> }, c = cfg(), kids = [kid('k1', 5), kid('k2', 3)]) =>
    renderBoard(model(kids), c, opts);
  const half = (svg: string, id: string) => group(svg, `data-kid-half="${id}"`);
  const june10 = (d: number) => new Date(2026, 5, d);
  const juneCfg = () => { const c = cfg(); c.kids[0].birthday = '06-10'; return c; };

  it('shows the birthday theme on the day, outside a season', () => {
    const out = two({ date: june10(10) }, juneCfg());
    expect(half(out, 'k1')).toContain('data-theme="birthday"');
    expect(half(out, 'k2')).toContain('data-theme="dino"');
  });

  it('shows the favourite the day before and after', () => {
    for (const d of [9, 11]) expect(half(two({ date: june10(d) }, juneCfg()), 'k1')).toContain('data-theme="bricks"');
  });

  it('switches the shared season scene off on a birthday in December', () => {
    const out = two({ date: DECEMBER });
    expect(out).not.toContain('data-season-kid');
    expect(half(out, 'k1')).toContain('data-theme="birthday"');
    const k2 = half(out, 'k2');
    expect(k2).toContain('data-theme="christmas"');
    expect(k2).toContain(`<rect x="400" y="0" width="400" height="450" fill="${THEMES.christmas.background}"/>`);
    expect(k2).not.toContain('fill="transparent"');
  });

  it('keeps the season scene without any birthday', () => {
    const out = two({ date: DECEMBER }, config(twoKids.kids));
    expect(out.match(/data-season-kid/g) ?? []).toHaveLength(2);
  });

  it('shows both halves as birthday when both kids have one', () => {
    const out = two({ date: DECEMBER }, cfg({}, '12-10'));
    expect(half(out, 'k1')).toContain('data-theme="birthday"');
    expect(half(out, 'k2')).toContain('data-theme="birthday"');
    expect(out).not.toContain('data-season-kid');
  });

  it('keeps the season scene when the birthday kid is not found', () => {
    const out = two({ date: DECEMBER }, cfg(), [kid('k1', 5, { found: false }), kid('k2', 3)]);
    expect(out.match(/data-season-kid/g) ?? []).toHaveLength(1);
    expect(out).toContain('data-season-kid="k2"');
    expect(half(out, 'k1')).toContain(de.kidNotFound);
  });

  it('never treats a kid without a config entry as a birthday kid without TaskMate', () => {
    const out = two({ date: DECEMBER }, config([{ id: 'k2', theme: 'dino', show_number: true }]), [kid('k1', 5), kid('k2', 3)]);
    expect(out).not.toContain('data-theme="birthday"');
  });

  it('treats a kid without a config entry as a birthday kid when TaskMate reports the birthday', () => {
    const out = two({ date: DECEMBER }, config([{ id: 'k2', theme: 'dino', show_number: true }]), [kid('k1', 5, { birthday: { age: 6 } }), kid('k2', 3)]);
    expect(half(out, 'k1')).toContain('data-theme="birthday"');
    expect(candles(half(out, 'k1'))).toBe(6);
  });

  describe('from TaskMate', () => {
    const plain = () => config([
      { id: 'k1', theme: 'bricks', show_number: false },
      { id: 'k2', theme: 'dino', show_number: true },
    ]);

    it('shows the birthday half with TaskMate\'s age without any card birthday', () => {
      const out = two({ date: june10(1) }, plain(), [kid('k1', 5, { birthday: { age: 9 } }), kid('k2', 3)]);
      expect(half(out, 'k1')).toContain('data-theme="birthday"');
      expect(candles(half(out, 'k1'))).toBe(9);
      expect(half(out, 'k2')).toContain('data-theme="dino"');
    });

    it('takes the age from the card birthday when TaskMate gives none', () => {
      const c = cfg();
      c.kids[0].birthday = '2019-12-10';
      const out = half(two({ date: DECEMBER }, c, [kid('k1', 5, { birthday: {} }), kid('k2', 3)]), 'k1');
      expect(out).toContain('data-theme="birthday"');
      expect(candles(out)).toBe(7);
    });

    it('takes the age the kid turns this year from the card birthday when TaskMate reports the day without an age', () => {
      const c = cfg();
      c.kids[0].birthday = '2019-12-10';
      const out = half(two({ date: june10(1) }, c, [kid('k1', 5, { birthday: {} }), kid('k2', 3)]), 'k1');
      expect(out).toContain('data-theme="birthday"');
      expect(candles(out)).toBe(7);
    });

    it('prefers TaskMate\'s age over the card birthday', () => {
      const c = cfg();
      c.kids[0].birthday = '2019-12-10';
      expect(candles(half(two({ date: DECEMBER }, c, [kid('k1', 5, { birthday: { age: 8 } }), kid('k2', 3)]), 'k1'))).toBe(8);
    });

    it('shows the birthday half when the card birthday is another day', () => {
      const c = cfg();
      c.kids[0].birthday = '2019-03-04';
      const out = half(two({ date: june10(10) }, c, [kid('k1', 5, { birthday: {} }), kid('k2', 3)]), 'k1');
      expect(out).toContain('data-theme="birthday"');
    });

    it('falls back to the card birthday without TaskMate\'s birthday', () => {
      const out = two({ date: june10(10) }, juneCfg(), [kid('k1', 5), kid('k2', 3)]);
      expect(half(out, 'k1')).toContain('data-theme="birthday"');
    });

    it('switches the shared season scene off during the Christmas season', () => {
      const out = two({ date: DECEMBER }, plain(), [kid('k1', 5, { birthday: { age: 7 } }), kid('k2', 3)]);
      expect(out).not.toContain('data-season-kid');
      expect(half(out, 'k1')).toContain('data-theme="birthday"');
      expect(half(out, 'k2')).toContain('data-theme="christmas"');
    });

    it('never treats a kid not found as a birthday kid', () => {
      const out = two({ date: DECEMBER }, plain(), [kid('k1', 5, { found: false, birthday: { age: 7 } }), kid('k2', 3)]);
      expect(out).not.toContain('data-theme="birthday"');
      expect(out).toContain('data-season-kid="k2"');
    });
  });

  it('pops the new item in the birthday half, counted with the birthday capacity', () => {
    const out = two({ date: DECEMBER, prevPoints: { k1: 31 } }, cfg(), [kid('k1', 32), kid('k2', 3)]);
    const k1 = half(out, 'k1');
    expect(k1.match(/fb-new/g) ?? []).toHaveLength(1);
    const g = groupItems(32, THEMES.birthday.capacity);
    expect(k1.match(/data-item="/g) ?? []).toHaveLength(g.big + g.small);
  });

  it('keeps the birthday half tappable', () => {
    const c = cfg();
    c.kids[0].tap_path = '/k1';
    expect(half(two({ date: DECEMBER }, c), 'k1')).toContain('data-tappable="true"');
  });

  /** Month and day of `date` as a `birthday` value. */
  const mmdd = (date: Date) => `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const animated = (svg: string) => (svg.match(/class="fb-anim/g) ?? []).length;
  const LIT_CAKE = 30; // a full half of balloons beside the cake
  const LIT_YEAR = 2014; // born then, the kid is 12 in 2026: enough candles that every flickering flame is lit

  it('lights every flickering flame and the banner ends at the worst case', () => {
    const c = cfg();
    c.kids[0].birthday = `${LIT_YEAR}-12-10`;
    expect(animated(half(two({ date: DECEMBER }, c, [kid('k1', LIT_CAKE), kid('k2', 3)]), 'k1'))).toBe(10);
  });

  const candles = (svg: string) => (svg.match(/data-part="candle"/g) ?? []).length;

  it('shows the age as candles on the birthday', () => {
    const c = cfg();
    c.kids[0].birthday = '2019-12-10';
    expect(candles(half(two({ date: DECEMBER }, c), 'k1'))).toBe(7);
  });

  it('shows the current age to a kid who picks birthday as a favourite', () => {
    const c = cfg();
    c.kids[0].birthday = '2019-12-10';
    c.kids[0].theme = 'birthday';
    const out = half(two({ date: june10(1) }, c), 'k1');
    expect(out).toContain('data-theme="birthday"');
    expect(candles(out)).toBe(6);
  });

  it('shows no candles for a birthday without a year', () => {
    const out = half(two({ date: DECEMBER }), 'k1');
    expect(out).toContain('data-theme="birthday"');
    expect(candles(out)).toBe(0);
  });

  for (const t of Object.values(THEMES).filter((x) => x.renderSeasonScene)) {
    const date = seasonStart(DEFAULT_SEASONS.find((r) => r.theme === t.id)!, 2026);

    it(`stays within the animation budget with a lit birthday cake in the ${t.id} season`, () => {
      const c = cfg();
      c.kids[0].birthday = `${LIT_YEAR}-${mmdd(date)}`;
      for (const points of [0, 30, 37, 1000]) {
        const out = two({ date }, c, [kid('k1', LIT_CAKE), kid('k2', points)]);
        expect(half(out, 'k1')).toContain('data-theme="birthday"');
        expect(animated(out), `${t.id} at ${points}`).toBeLessThanOrEqual(60);
      }
    });

    it(`stays within the animation budget with five kids and a lit birthday cake in the ${t.id} season`, () => {
      const ids = ['k1', 'k2', 'k3', 'k4', 'k5'];
      const c = config(ids.map((id, i) => ({ id, theme: 'bricks', show_number: false, ...(i === 0 ? { birthday: `${LIT_YEAR}-${mmdd(date)}` } : {}) })));
      for (const points of [0, 30, 37, 1000]) {
        const out = renderBoard(model(ids.map((id, i) => kid(id, i === 0 ? LIT_CAKE : points))), c, { date });
        expect(half(out, 'k1')).toContain('data-theme="birthday"');
        expect(half(out, 'k2')).toContain(`data-theme="${t.id}"`);
        expect(animated(out), `${t.id} at ${points}`).toBeLessThanOrEqual(60);
      }
    });
  }

});

describe('boardSize', () => {
  it.each([
    [undefined, 2, 800, 450],
    [{ w: 1600, h: 900 }, 2, 800, 450],
    [{ w: 2304, h: 1440 }, 2, 720, 450], // 16:10
    [{ w: 1024, h: 768 }, 2, 600, 450], // 4:3
    [{ w: 2100, h: 900 }, 2, 1050, 450], // 21:9
    [{ w: 4000, h: 900 }, 2, 1600, 450], // capped
    [{ w: 1024, h: 768 }, 5, 800, 600], // fallback: 5 x 160, taller
    [{ w: 900, h: 1600 }, 2, 400, 711], // portrait, floor 400
    [{ w: 1024, h: 768 }, 0, 600, 450],
    [{ w: 0, h: 768 }, 2, 800, 450],
    [{ w: NaN, h: 768 }, 2, 800, 450],
  ])('%o with %i kids -> %i x %i', (size, kids, w, h) => {
    expect(boardSize(size, kids)).toEqual({ w, h });
  });
});

describe('renderBoard with a size', () => {
  const WIDE = { w: 2304, h: 1440 }; // 16:10
  const SQUARE = { w: 1024, h: 768 }; // 4:3
  const jar = { id: 'j1', name: 'J', icon: { kind: 'emoji' as const, value: '🎁' }, goal: 10, current: 3 };
  const five = config(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, theme: 'bricks', show_number: true })));
  const fiveKids = () => ['a', 'b', 'c', 'd', 'e'].map((id) => kid(id, 4, { jars: [jar as never] }));

  it('uses the shape of the free area for the viewBox and the halves', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: JUNE, size: WIDE });
    expect(out).toContain('viewBox="0 0 720 450"');
    for (const id of ['k1', 'k2']) expect(group(out, `data-kid-half="${id}"`)).toContain('width="360" height="450" fill=');
  });

  it('centres the jar row in a taller picture', () => {
    const out = renderBoard(model(fiveKids()), five, { date: JUNE, size: SQUARE });
    expect(out).toContain('viewBox="0 0 800 600"');
    ['a', 'b', 'c', 'd', 'e'].forEach((id, i) => {
      const box = { x: i * 160 + 14, y: 441, w: 40, h: 74 };
      expect(group(out, `data-kid-half="${id}"`)).toContain(drawJar(jar as never, box, '#d9534f', `${id}:jar:j1`));
      expect(group(out, `data-kid-half="${id}"`)).toContain('width="160" height="600" fill=');
    });
    const withShared = renderBoard(model(fiveKids(), [{ id: 's0', name: 'S', icon: jar.icon, goal: 10, contributions: {} } as never]), five, { date: JUNE, size: SQUARE });
    expect(withShared).toContain(drawSharedJar({ id: 's0', name: 'S', icon: jar.icon, goal: 10, contributions: {} } as never, { x: 380, y: 441, w: 40, h: 74 }, Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, '#d9534f'])), 'shared:s0'));
  });

  it.each([720, 1050])('keeps the shared row centred at %i wide', (w) => {
    const shared = Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, name: 'S', icon: jar.icon, goal: 10, contributions: {} }));
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)], shared as never), twoKids, { date: JUNE, size: { w: w * 2, h: 900 } });
    const colours = { k1: '#d9534f', k2: '#d9534f' };
    const at = (i: number, x: number) => drawSharedJar(shared[i] as never, { x, y: 366, w: 40, h: 74 }, colours, `shared:s${i}`);
    const rowW = 3 * 40 + 2 * 12;
    const leftMargin = (w - rowW) / 2;
    const lastX = leftMargin + rowW - 40;
    const rightMargin = w - (lastX + 40);
    expect(leftMargin).toBe(rightMargin);
    expect(out).toContain(at(0, leftMargin));
    expect(out).toContain(at(2, lastX));
  });

  it('centres the messages for a missing model and for no kids', () => {
    const missing = renderBoard({ status: 'missing', kids: [], sharedJars: [] }, twoKids, { date: JUNE, size: WIDE });
    expect(missing).toContain('viewBox="0 0 720 450"');
    expect(missing).toContain('<text x="360" y="225"');
    expect(renderBoard(model([]), twoKids, { date: JUNE, size: WIDE })).toContain('<text x="360" y="225"');
  });

  describe('season scene in a taller picture', () => {
    const sceneBottom = SCENE_BOTTOM * 600;
    const seasonJarY = sceneBottom + ((1 - SCENE_BOTTOM) * 600 - 74) / 2;

    it('draws the scene at the full picture height, without a band', () => {
      const out = renderBoard(model(fiveKids()), five, { date: DECEMBER, size: SQUARE });
      expect(out).toContain('viewBox="0 0 800 600"');
      expect(out).not.toContain('y="450"');
      expect(group(out, 'data-theme="christmas"')).toContain('<rect x="0" y="0" width="800" height="600" fill="');
    });

    it('centres every jar in the scene bottom band', () => {
      const shared = { id: 's0', name: 'S', icon: jar.icon, goal: 10, contributions: {} } as never;
      const out = renderBoard(model(fiveKids()), five, { date: DECEMBER, size: SQUARE });
      ['a', 'b', 'c', 'd', 'e'].forEach((id, i) => {
        const box = { x: i * 160 + 14, y: seasonJarY, w: 40, h: 74 };
        expect(group(out, `data-kid-half="${id}"`)).toContain(drawJar(jar as never, box, '#d9534f', `${id}:jar:j1`));
      });
      const colours = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, '#d9534f']));
      const withShared = renderBoard(model(fiveKids(), [shared]), five, { date: DECEMBER, size: SQUARE });
      expect(withShared).toContain(drawSharedJar(shared, { x: 380, y: seasonJarY, w: 40, h: 74 }, colours, 'shared:s0'));
    });

    it('starts the summer ground at the scene bottom of the taller picture', () => {
      const out = renderBoard(model(fiveKids()), five, { date: new Date(2026, 7, 1), size: SQUARE });
      expect(out.match(/data-ground/g)).toHaveLength(1);
      expect(out).toContain(`<rect data-ground x="0" y="${sceneBottom - 1}" width="800" height="${600 - sceneBottom + 1}" fill="${THEMES.summer.ground}"/>`);
      expect(sceneBottom - 1).toBe(473);
    });

    it('keeps jar y 366 and the 450 box at the default size and at 16:10', () => {
      const kids = [kid('k1', 4, { jars: [jar as never] }), kid('k2', 4)];
      const jarAt = drawJar(jar as never, { x: 14, y: 366, w: 40, h: 74 }, '#d9534f', 'k1:jar:j1');
      const dflt = renderBoard(model(kids), twoKids, { date: DECEMBER });
      expect(dflt).toContain('viewBox="0 0 800 450"');
      expect(group(dflt, 'data-theme="christmas"')).toContain('<rect x="0" y="0" width="800" height="450" fill="');
      expect(dflt).toContain(jarAt);
      const out = renderBoard(model(kids), twoKids, { date: DECEMBER, size: WIDE });
      expect(out).toContain('viewBox="0 0 720 450"');
      expect(group(out, 'data-theme="christmas"')).toContain('<rect x="0" y="0" width="720" height="450" fill="');
      expect(out).toContain(jarAt);
    });
  });

});

describe('ground colour behind the jars', () => {
  const pirates = config([{ id: 'k1', theme: 'pirates', show_number: true }, { id: 'k2', theme: 'pirates', show_number: true }]);
  const groundRect = (x: number, y: number, w: number, h: number) =>
    `<rect data-ground x="${x}" y="${y}" width="${w}" height="${h}" fill="${THEMES.pirates.ground}"/>`;

  it('lists the themes with a ground colour', () => {
    expect(Object.values(THEMES).filter((t) => t.ground).map((t) => t.id).sort()).toEqual(['birthday', 'construction', 'garden', 'pirates', 'summer', 'underwater']);
  });

  it('continues the ground below the scene in each half, between scene and jars', () => {
    const out = renderBoard(model([kid('k1', 5, { jars: [{ id: 'j', name: 'J', icon: { kind: 'emoji', value: '🎁' }, goal: 10, current: 3 } as never] }), kid('k2', 3)]), pirates, { date: JUNE });
    const top = SCENE_BOTTOM * 450;
    expect(top - 1).toBe(354.5);
    [0, 400].forEach((x, i) => {
      const half = group(out, `data-kid-half="k${i + 1}"`);
      const rect = groundRect(x, 354.5, 400, 95.5);
      expect(half).toContain(rect);
      expect(half.indexOf(rect)).toBeGreaterThan(half.indexOf('data-theme="pirates"'));
    });
    const half = group(out, 'data-kid-half="k1"');
    expect(half.indexOf(groundRect(0, 354.5, 400, 95.5))).toBeLessThan(half.indexOf('data-jar'));
  });

  it('reaches the bottom of a taller picture', () => {
    const five = config(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, theme: 'pirates', show_number: true })));
    const out = renderBoard(model(['a', 'b', 'c', 'd', 'e'].map((id) => kid(id, 4))), five, { date: JUNE, size: { w: 1024, h: 768 } });
    const rects = [...out.matchAll(/<rect data-ground x="[-\d.]+" y="([-\d.]+)" width="[-\d.]+" height="([-\d.]+)"/g)];
    expect(rects).toHaveLength(5);
    for (const m of rects) {
      expect(m[1]).toBe('354.5');
      expect(Number(m[1]) + Number(m[2])).toBe(600);
    }
    const jar = { id: 'j1', name: 'J', icon: { kind: 'emoji' as const, value: '🎁' }, goal: 10, current: 3 };
    const jars = ['a', 'b', 'c', 'd', 'e'].map((id) => kid(id, 4, { jars: [jar as never] }));
    const withJars = renderBoard(model(jars), five, { date: JUNE, size: { w: 1024, h: 768 } });
    expect(group(withJars, 'data-kid-half="a"')).toContain(drawJar(jar as never, { x: 14, y: 441, w: 40, h: 74 }, '#d9534f', 'a:jar:j1'));
  });

  it('draws the ground for a kid that was not found', () => {
    const out = renderBoard(model([kid('k1', 5, { found: false }), kid('k2', 3)]), pirates, { date: JUNE });
    expect(group(out, 'data-kid-half="k1"')).toContain(groundRect(0, 354.5, 400, 95.5));
  });

  it('draws one ground across the board in season mode', () => {
    const out = renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: new Date(2026, 7, 1) });
    expect(out.match(/data-ground/g)).toHaveLength(1);
    expect(out).toContain(`<rect data-ground x="0" y="354.5" width="800" height="95.5" fill="${THEMES.summer.ground}"/>`);
  });

  it('draws no ground for a theme without one', () => {
    expect(renderBoard(model([kid('k1', 5), kid('k2', 3)]), twoKids, { date: JUNE })).not.toContain('data-ground');
  });
});
