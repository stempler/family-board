import { describe, expect, it } from 'vitest';
import { toBoardModel } from '../src/adapter';
import { normalizeConfig } from '../src/config';
import { makeFakeHass, type FakeJar, type FakeKid } from '../dev/fake-hass';

describe('makeFakeHass', () => {
  const kids: FakeKid[] = [
    { id: 'k1', name: 'Mia', points: 12, theme: 'bricks', colour: '#ff0000' },
    { id: 'k2', name: 'Ben', points: 40, theme: 'dino', colour: '#00ff00' },
  ];
  const jars: FakeJar[] = [
    { id: 'j1', name: 'Bausteine-Set', icon: '🧱', goal: 50, allocations: { k1: 22 }, shared: false, assignedTo: ['k1'] },
    { id: 'j2', name: 'Trip', icon: '✈️', goal: 40, allocations: { k1: 5, k2: 8 }, shared: true, assignedTo: [] },
  ];

  it('round-trips through the real adapter', () => {
    const config = normalizeConfig({ kids: kids.map((k) => ({ id: k.id, theme: k.theme })) });
    const model = toBoardModel(makeFakeHass(kids, jars).states, config);
    expect(model.status).toBe('ok');
    expect(model.kids.map((k) => [k.id, k.name, k.points, k.colour])).toEqual([['k1', 'Mia', 12, '#ff0000'], ['k2', 'Ben', 40, '#00ff00']]);
    expect(model.kids[0].jars).toEqual([{ id: 'j1', name: 'Bausteine-Set', icon: { kind: 'emoji', value: '🧱' }, current: 22, goal: 50 }]);
    expect(model.kids[1].jars).toEqual([]);
    expect(model.sharedJars).toEqual([{ id: 'j2', name: 'Trip', icon: { kind: 'emoji', value: '✈️' }, goal: 40, contributions: { k1: 5, k2: 8 } }]);
    expect(model.kids.some((k) => 'birthday' in k)).toBe(false);
  });

  it('puts a birthday into the overview sensor in TaskMate\'s shape', () => {
    const withBirthday: FakeKid[] = [{ ...kids[0], birthday: { age: 7 } }, { ...kids[1], birthday: {} }];
    const states = makeFakeHass(withBirthday, jars).states;
    const children = states['sensor.taskmate_overview'].attributes.children as Record<string, unknown>[];
    expect(children.map((c) => c.birthday)).toEqual([{ multiplier: 2, age: 7 }, { multiplier: 2 }]);
    const config = normalizeConfig({ kids: kids.map((k) => ({ id: k.id, theme: k.theme })) });
    expect(toBoardModel(states, config).kids.map((k) => k.birthday)).toEqual([{ age: 7 }, {}]);
  });
});
