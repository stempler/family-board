import { describe, expect, it } from 'vitest';
import { renderBoard } from '../src/board';
import { DEFAULT_SEASONS, type CardConfig, type KidConfig } from '../src/config';
import { de } from '../src/i18n';
import { groupItems } from '../src/items';
import type { BoardModel, Kid, SharedJar } from '../src/model';
import { activeSeason, seasonStart } from '../src/season';
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

  it('never treats a kid without a config entry as a birthday kid', () => {
    const out = two({ date: DECEMBER }, config([{ id: 'k2', theme: 'dino', show_number: true }]), [kid('k1', 5), kid('k2', 3)]);
    expect(out).not.toContain('data-theme="birthday"');
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

  it('stays within the animation budget on every season day', () => {
    for (const t of Object.values(THEMES).filter((x) => x.renderSeasonScene)) {
      const rule = DEFAULT_SEASONS.find((r) => r.theme === t.id)!;
      const date = seasonStart(rule, 2026);
      const c = cfg();
      c.kids[0].birthday = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const out = two({ date }, c, [kid('k1', 1000), kid('k2', 1000)]);
      expect((out.match(/class="fb-anim/g) ?? []).length, t.id).toBeLessThanOrEqual(60);
    }
  });
});
