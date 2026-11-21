import { describe, expect, it } from 'vitest';
import { renderBoard } from '../src/board';
import { DEFAULT_SEASONS, type CardConfig, type KidConfig } from '../src/config';
import type { BoardModel, Kid } from '../src/model';
import { easterSunday } from '../src/season';
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

function board(theme: string | string[], points: number[], date = JUNE, seasons = false): string {
  const kids: KidConfig[] = points.map((_, i) => ({ id: `k${i + 1}`, theme: Array.isArray(theme) ? theme[i] : theme, show_number: true }));
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

const file = (name: string) => `./__snapshots__/svg/${name}.svg`;

describe('board snapshots', () => {
  for (const id of Object.keys(THEMES)) {
    describe(id, () => {
      it('two kids at 12 and 37 points', async () => {
        await expect(board(id, [12, 37])).toMatchFileSnapshot(file(`${id}-12-37`));
      });
      it('two kids at 0 and 1000 points', async () => {
        await expect(board(id, [0, 1000])).toMatchFileSnapshot(file(`${id}-0-1000`));
      });
    });
  }

  // Narrow halves: every theme once on a five-kid board.
  const ids = Object.keys(THEMES);
  for (let start = 0; start < ids.length; start += 5) {
    const five = ids.slice(start, start + 5);
    it(`five kids: ${five.join(', ')}`, async () => {
      await expect(board(five, [7, 30, 31, 300, 4321].slice(0, five.length))).toMatchFileSnapshot(file(`five-kids-${start / 5 + 1}`));
    });
  }

  const SEASON_DATES: Record<string, Date> = {
    christmas: new Date(2026, 11, 15),
    halloween: new Date(2026, 9, 28),
    easter: easterSunday(2027),
  };
  it('covers every theme with a season scene', () => {
    const seasonal = Object.values(THEMES).filter((t) => t.renderSeasonScene).map((t) => t.id);
    expect(Object.keys(SEASON_DATES).sort()).toEqual(seasonal.sort());
  });
  for (const [id, date] of Object.entries(SEASON_DATES)) {
    it(`season scene ${id}`, async () => {
      await expect(board('bricks', [12, 37], date, true)).toMatchFileSnapshot(file(`season-${id}`));
    });
  }
});
