import { describe, expect, it } from 'vitest';
import { toBoardModel } from '../src/adapter';
import { normalizeConfig } from '../src/config';
import { makeFakeHass, type FakeJar, type FakeKid } from '../dev/fake-hass';

describe('makeFakeHass', () => {
  const kids: FakeKid[] = [
    { id: 'k1', name: 'Mia', points: 12, theme: 'lego', colour: '#ff0000' },
    { id: 'k2', name: 'Ben', points: 40, theme: 'dino', colour: '#00ff00' },
  ];
  const jars: FakeJar[] = [
    { id: 'j1', name: 'Lego Set', icon: '🧱', goal: 50, allocations: { k1: 22 }, shared: false, assignedTo: ['k1'] },
    { id: 'j2', name: 'Trip', icon: '✈️', goal: 40, allocations: { k1: 5, k2: 8 }, shared: true, assignedTo: [] },
  ];

  it('round-trips through the real adapter', () => {
    const config = normalizeConfig({ kids: kids.map((k) => ({ id: k.id, theme: k.theme })) });
    const model = toBoardModel(makeFakeHass(kids, jars).states, config);
    expect(model.status).toBe('ok');
    expect(model.kids.map((k) => [k.id, k.name, k.points, k.colour])).toEqual([['k1', 'Mia', 12, '#ff0000'], ['k2', 'Ben', 40, '#00ff00']]);
    expect(model.kids[0].jars).toEqual([{ id: 'j1', name: 'Lego Set', icon: { kind: 'emoji', value: '🧱' }, current: 22, goal: 50 }]);
    expect(model.kids[1].jars).toEqual([]);
    expect(model.sharedJars).toEqual([{ id: 'j2', name: 'Trip', icon: { kind: 'emoji', value: '✈️' }, goal: 40, contributions: { k1: 5, k2: 8 } }]);
  });
});
