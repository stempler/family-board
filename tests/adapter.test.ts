/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../src/config';
import { parseIcon, toBoardModel, type HassStates } from '../src/adapter';
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
