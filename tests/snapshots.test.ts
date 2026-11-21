import { describe, expect, it } from 'vitest';
import { renderBoard } from '../src/board';
import { DEFAULT_SEASONS, type CardConfig, type KidConfig } from '../src/config';
import type { BoardModel, Kid } from '../src/model';
import { activeSeason, seasonStart } from '../src/season';
import { THEMES } from '../src/themes/registry';

// Whole-board SVG snapshots. Rendering is deterministic (seeded wobble, fixed item spots), so any change to these
// files is a visible change to the board. A pure refactor must leave them all untouched; an intended visual change
// updates them with `mise run test -- -u` and the diff shows up in review. Open the .svg files in a browser to look.

const JUNE = new Date(2026, 5, 1); // outside every default season
const COLOURS = ['#d9534f', '#3b7dd8', '#5cb85c', '#f0ad4e', '#8e5ea2'];

function kid(i: number, points: number): Kid {
  return {
    id: `k${i + 1}`,
    name: ['Mia', 'Ben', 'Lena', 'Noah', 'Maximiliane'][i],
    colour: COLOURS[i],
    avatar: { kind: 'emoji', value: ['🦄', '🦖', '🐱', '🚀', '🌻'][i] },
    points,
    jars: [{ id: `j${i}`, name: 'Eis', icon: { kind: 'emoji', value: '🍦' }, current: 3 + i, goal: 10 }],
    found: true,
  };
}

function board(theme: string | string[], points: number[], date = JUNE, seasons = false, birthdays: Record<string, string> = {}): string {
  const kids: KidConfig[] = points.map((_, i) => ({ id: `k${i + 1}`, theme: Array.isArray(theme) ? theme[i] : theme, show_number: true, ...(birthdays[`k${i + 1}`] ? { birthday: birthdays[`k${i + 1}`] } : {}) }));
  const config: CardConfig = {
    type: 'custom:family-board-card',
    overview_entity: 'sensor.taskmate_overview',
    rewards_entity: 'sensor.taskmate_rewards',
    kids,
    seasons: seasons ? DEFAULT_SEASONS.map((s) => ({ ...s })) : [],
    reward_icons: {},
  };
  const model: BoardModel = {
    status: 'ok',
    kids: points.map((p, i) => kid(i, p)),
    sharedJars: [{ id: 's1', name: 'Kino', icon: { kind: 'emoji', value: '🎬' }, goal: 40, contributions: { k1: 6, k2: 9 } }],
  };
  return renderBoard(model, config, { date });
}

/** One element per line, so a snapshot diff is readable. Only newlines are added; the product's output is unchanged. */
const lines = (svg: string): string => svg.replaceAll('><', '>\n<');

const file = (name: string) => `./__snapshots__/svg/${name}.svg`;

describe('board snapshots', () => {
  for (const id of Object.keys(THEMES)) {
    describe(id, () => {
      it('two kids at 12 and 37 points', async () => {
        await expect(lines(board(id, [12, 37]))).toMatchFileSnapshot(file(`${id}-12-37`));
      });
      it('two kids at 0 and 1000 points', async () => {
        await expect(lines(board(id, [0, 1000]))).toMatchFileSnapshot(file(`${id}-0-1000`));
      });
    });
  }

  // Narrow halves: every theme once on a five-kid board. The lists are explicit and fixed so that adding a theme
  // never reshuffles (and so never rewrites) the existing boards. A new theme goes on a board with room left
  // (at most five kids) or on a new board with the next number.
  const FIVE_KID_BOARDS: string[][] = [
    ['christmas', 'bricks', 'dino', 'wizard', 'racing'],
    ['space', 'dog', 'chess', 'halloween', 'easter'],
    ['pirates', 'underwater', 'football', 'martin', 'birthday'],
    ['construction', 'garden', 'summer'],
  ];
  it('puts every registered theme on a five-kid board', () => {
    const listed = FIVE_KID_BOARDS.flat();
    const missing = Object.keys(THEMES).filter((id) => !listed.includes(id));
    expect(missing, `theme(s) ${missing.join(', ')} not on a five-kid board: add each to a list in FIVE_KID_BOARDS (a board holds at most five kids; start a new list when full)`).toEqual([]);
    const unknown = listed.filter((id) => !(id in THEMES));
    expect(unknown, 'FIVE_KID_BOARDS lists themes that are not registered').toEqual([]);
    expect(new Set(listed).size, 'a theme is listed twice in FIVE_KID_BOARDS').toBe(listed.length);
    for (const five of FIVE_KID_BOARDS) expect(five.length).toBeLessThanOrEqual(5);
  });
  FIVE_KID_BOARDS.forEach((five, n) => {
    it(`five kids: ${five.join(', ')}`, async () => {
      await expect(lines(board(five, [7, 30, 31, 300, 4321].slice(0, five.length)))).toMatchFileSnapshot(file(`five-kids-${n + 1}`));
    });
  });

  // The date of each season scene comes from the theme's default season rule.
  const SEASON_DATES: Record<string, Date> = Object.fromEntries(DEFAULT_SEASONS.map((r) => [r.theme, seasonStart(r, 2026)]));
  it('covers every theme with a season scene', () => {
    const seasonal = Object.values(THEMES).filter((t) => t.renderSeasonScene).map((t) => t.id);
    expect(Object.keys(SEASON_DATES).sort()).toEqual(seasonal.sort());
  });
  it('shows each season theme on its snapshot date (no earlier default rule overlaps it)', () => {
    const themeIds = Object.keys(THEMES);
    expect(DEFAULT_SEASONS.map((r) => r.theme), 'one default rule per season theme').toEqual([...new Set(DEFAULT_SEASONS.map((r) => r.theme))]);
    for (const [id, date] of Object.entries(SEASON_DATES)) {
      expect(activeSeason(date, DEFAULT_SEASONS, themeIds)?.theme, `on ${date.toDateString()} the default seasons show another theme than ${id}`).toBe(id);
    }
  });
  for (const [id, date] of Object.entries(SEASON_DATES)) {
    it(`season scene ${id}`, async () => {
      await expect(lines(board('bricks', [12, 37], date, true))).toMatchFileSnapshot(file(`season-${id}`));
    });
  }

  // A birthday kid's half beside another kid, and inside a season whose shared scene is switched off for the day.
  const BIRTHDAY_BOARDS: Record<string, string> = {
    'birthday-beside-dino': board(['bricks', 'dino'], [12, 37], JUNE, false, { k1: '06-01' }),
    'birthday-in-christmas': board(['bricks', 'dino'], [12, 37], new Date(2026, 11, 10), true, { k1: '12-10' }),
  };
  for (const [name, svg] of Object.entries(BIRTHDAY_BOARDS)) {
    it(`birthday board ${name}`, async () => {
      await expect(lines(svg)).toMatchFileSnapshot(file(name));
    });
  }

  // Every snapshot file must belong to a test above; a renamed or removed theme leaves orphans behind that
  // vitest never reports.
  it('has no orphaned snapshot files', () => {
    const expected = [
      ...Object.keys(THEMES).flatMap((id) => [`${id}-12-37.svg`, `${id}-0-1000.svg`]),
      ...FIVE_KID_BOARDS.map((_, n) => `five-kids-${n + 1}.svg`),
      ...Object.keys(SEASON_DATES).map((id) => `season-${id}.svg`),
      ...Object.keys(BIRTHDAY_BOARDS).map((name) => `${name}.svg`),
    ].sort();
    const actual = Object.keys(import.meta.glob('./__snapshots__/svg/*')).map((p) => p.split('/').pop()!).sort();
    const orphans = actual.filter((f) => !expected.includes(f));
    const missing = expected.filter((f) => !actual.includes(f));
    expect({ orphans, missing }, 'tests/__snapshots__/svg must hold exactly the files written by this test: delete orphans (git rm) or run `mise run test -- -u` for missing ones').toEqual({ orphans: [], missing: [] });
  });
});
