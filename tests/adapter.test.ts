/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../src/config';
import { parseIcon, resolveEntity, toBoardModel, type HassStates } from '../src/adapter';
import fixture from './fixtures/docs-sample.json';

const states = fixture as unknown as HassStates;
const cfg = (kids: string[], extra: Record<string, unknown> = {}) =>
  normalizeConfig({ kids: kids.map((id) => ({ id, theme: 'bricks' })), ...extra });

describe('toBoardModel', () => {
  const m = toBoardModel(states, cfg(['k1', 'k2']));
  it('maps kids', () => {
    expect(m.status).toBe('ok');
    expect(m.kids.map((k) => k.name)).toEqual(['Mia', 'Ben']);
    expect(m.kids[0].points).toBe(12);
    expect(m.kids[1].points).toBe(0);
    expect(m.kids[0].colour).toBe('#ff0000');
    expect(m.kids[1].colour).toBe('#3b7dd8');
  });
  it('maps jars', () => {
    expect(m.kids[0].jars.map((j) => [j.id, j.current, j.goal])).toEqual([['r1', 22, 50], ['r2', 0, 20]]);
    expect(m.kids[1].jars.map((j) => j.id)).toEqual(['r2']);
  });
  it('maps shared jars', () => {
    expect(m.sharedJars).toHaveLength(1);
    expect(m.sharedJars[0].id).toBe('r3');
    expect(m.sharedJars[0].contributions).toEqual({ k1: 5, k2: 8 });
    expect(m.sharedJars[0].goal).toBe(40);
  });
  it('applies reward_icons', () => {
    const m2 = toBoardModel(states, cfg(['k1', 'k2'], { reward_icons: { r1: '🧱' } }));
    expect(m2.kids[0].jars[0].icon).toEqual({ kind: 'emoji', value: '🧱' });
  });
  it('marks unknown kids as not found', () => {
    const m3 = toBoardModel(states, cfg(['k1', 'kZ']));
    expect(m3.kids[1].found).toBe(false);
    expect(m3.kids[1].name).toBe('kZ');
    expect(m3.kids[1].jars).toEqual([]);
    expect(m3.kids[0].found).toBe(true);
    expect(m3.kids[0].name).toBe('Mia');
  });
  it('reports missing status', () => {
    expect(toBoardModel({}, cfg(['k1'])).status).toBe('missing');
    const un = { ...states, 'sensor.taskmate_overview': { state: 'unavailable', attributes: {} } };
    expect(toBoardModel(un, cfg(['k1'])).status).toBe('missing');
    const { 'sensor.taskmate_rewards': _r, ...noRewards } = states;
    const m4 = toBoardModel(noRewards, cfg(['k1']));
    expect(m4.status).toBe('ok');
    expect(m4.kids[0].jars).toEqual([]);
    expect(m4.sharedJars).toEqual([]);
  });
});

describe('TaskMate birthday mode', () => {
  /** The fixture with `birthday` set on Mia's overview entry (left out when `undefined`). */
  const withBirthday = (birthday: unknown): HassStates => {
    const overview = states['sensor.taskmate_overview'];
    const children = (overview.attributes.children as Record<string, unknown>[]).map((c) =>
      c.id === 'k1' && birthday !== undefined ? { ...c, birthday } : c);
    return { ...states, 'sensor.taskmate_overview': { ...overview, attributes: { ...overview.attributes, children } } };
  };
  const mia = (birthday: unknown) => toBoardModel(withBirthday(birthday), cfg(['k1', 'k2'])).kids[0];

  it('takes the age on the birthday', () => {
    expect(mia({ multiplier: 2, age: 7 }).birthday).toEqual({ age: 7 });
  });
  it('marks the birthday without an age', () => {
    expect(mia({ multiplier: 2 }).birthday).toEqual({});
    expect(mia({ multiplier: 2, chores_off: true }).birthday).toEqual({});
  });
  it('leaves the birthday out on other days', () => {
    expect('birthday' in mia(undefined)).toBe(false);
    expect('birthday' in toBoardModel(withBirthday({ multiplier: 2, age: 7 }), cfg(['k1', 'k2'])).kids[1]).toBe(false);
  });
  it('ignores a birthday that is not an object', () => {
    for (const b of [null, true, 'x', 7, [1]]) expect('birthday' in mia(b), String(b)).toBe(false);
  });
  it('takes the age only as a whole number of at least 1', () => {
    for (const age of ['7', 7.5, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(mia({ multiplier: 2, age }).birthday, String(age)).toEqual({});
    }
  });
});

describe('parseIcon', () => {
  const fb = { kind: 'mdi', value: 'mdi:gift' } as const;
  it('parses', () => {
    expect(parseIcon('mdi:cat', fb)).toEqual({ kind: 'mdi', value: 'mdi:cat' });
    expect(parseIcon('🧱', fb)).toEqual({ kind: 'emoji', value: '🧱' });
    expect(parseIcon(undefined, fb)).toEqual(fb);
    expect(parseIcon('', fb)).toEqual(fb);
  });
});

const captured = Object.entries(
  import.meta.glob<HassStates>('./fixtures/taskmate-*.json', { eager: true, import: 'default' }),
);

describe.each(captured)('captured TaskMate data %s', (_file, data) => {
  const children = (data['sensor.taskmate_overview'].attributes.children as { id: string }[]).map((c) => c.id);
  const m = toBoardModel(data, cfg(children));

  it('finds both kids with their points', () => {
    expect(m.status).toBe('ok');
    expect(m.kids.filter((k) => k.found)).toHaveLength(2);
    expect(m.kids.map((k) => k.points)).toEqual([12, 7]);
  });
  it('maps jars per kid', () => {
    const mia = m.kids[0].jars;
    expect(mia.map((j) => j.name)).toContain('Kino');
    const jar = mia.find((j) => j.name === 'Bausteine-Set');
    expect([jar?.current, jar?.goal]).toEqual([22, 50]);
    expect(m.kids[1].jars.map((j) => j.name)).toEqual(['Kino']);
  });
  it('maps the shared jar', () => {
    expect(m.sharedJars.map((j) => j.name)).toEqual(['Pizza-Abend']);
    expect(Object.values(m.sharedJars[0].contributions).reduce((a, b) => a + b, 0)).toBe(13);
  });
});

/** The fixture as Home Assistant names the sensors when it puts a prefix (e.g. the area) into the ids. */
function prefixed(prefix: string): HassStates {
  return {
    [`sensor.${prefix}_taskmate_overview`]: states['sensor.taskmate_overview'],
    [`sensor.${prefix}_taskmate_rewards`]: states['sensor.taskmate_rewards'],
  };
}

describe('resolveEntity', () => {
  it('keeps an entity that exists', () => {
    expect(resolveEntity(states, 'sensor.taskmate_overview', 'overview')).toBe('sensor.taskmate_overview');
  });
  it('finds the prefixed sensor when the default name does not exist', () => {
    const s = prefixed('wohnzimmer');
    expect(resolveEntity(s, 'sensor.taskmate_overview', 'overview')).toBe('sensor.wohnzimmer_taskmate_overview');
    expect(resolveEntity(s, 'sensor.taskmate_rewards', 'rewards')).toBe('sensor.wohnzimmer_taskmate_rewards');
  });
  it('does not guess between several candidates', () => {
    const s = { ...prefixed('wohnzimmer'), ...prefixed('kueche') };
    expect(resolveEntity(s, 'sensor.taskmate_overview', 'overview')).toBe('sensor.taskmate_overview');
  });
  it('does not replace an entity the config names explicitly', () => {
    expect(resolveEntity(prefixed('wohnzimmer'), 'sensor.other', 'overview')).toBe('sensor.other');
  });
  it('ignores entities that only contain the name', () => {
    const s = { 'sensor.taskmate_overview_2': states['sensor.taskmate_overview'], 'sensor.mytaskmate_overview': states['sensor.taskmate_overview'] };
    expect(resolveEntity(s, 'sensor.taskmate_overview', 'overview')).toBe('sensor.taskmate_overview');
  });
});

describe('toBoardModel with prefixed sensors', () => {
  it('shows the board with the default config', () => {
    const m = toBoardModel(prefixed('wohnzimmer'), cfg(['k1', 'k2']));
    expect(m.status).toBe('ok');
    expect(m.kids.map((k) => k.name)).toEqual(['Mia', 'Ben']);
    expect(m.kids[0].jars.map((j) => j.id)).toEqual(['r1', 'r2']);
  });
});
