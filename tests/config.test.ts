import { describe, expect, it } from 'vitest';
import { DEFAULT_SEASONS, normalizeConfig } from '../src/config';

const base = { type: 'custom:family-board-card', kids: [{ id: 'a', theme: 'lego' }] };

describe('normalizeConfig', () => {
  it('applies defaults', () => {
    const c = normalizeConfig(base);
    expect(c.overview_entity).toBe('sensor.taskmate_overview');
    expect(c.rewards_entity).toBe('sensor.taskmate_rewards');
    expect(c.seasons).toEqual(DEFAULT_SEASONS);
    expect(c.kids[0].show_number).toBe(false);
    expect(c.reward_icons).toEqual({});
  });
  it('throws for missing or empty kids', () => {
    expect(() => normalizeConfig({ type: 'x' })).toThrow(/kids/);
    expect(() => normalizeConfig({ type: 'x', kids: [] })).toThrow(/kids/);
  });
  it('throws for kid without id', () => {
    expect(() => normalizeConfig({ kids: [{ theme: 'lego' }] })).toThrow(/id/);
  });
  it('throws for kid without theme', () => {
    expect(() => normalizeConfig({ kids: [{ id: 'a' }] })).toThrow(/theme/);
  });
  it('trims kid id and theme', () => {
    const c = normalizeConfig({ kids: [{ id: ' a872165c ', theme: ' lego ' }] });
    expect(c.kids[0].id).toBe('a872165c');
    expect(c.kids[0].theme).toBe('lego');
  });
  it('does not validate theme names', () => {
    expect(() => normalizeConfig({ kids: [{ id: 'a', theme: 'nope' }] })).not.toThrow();
  });
  it('throws for bad season dates', () => {
    expect(() =>
      normalizeConfig({ ...base, seasons: [{ theme: 'x', from: '2026-12-01', to: '12-26' }] }),
    ).toThrow(/MM-DD/);
    expect(() =>
      normalizeConfig({ ...base, seasons: [{ theme: 'x', from: '12-01', to: '13-01' }] }),
    ).toThrow(/MM-DD/);
  });
  it('validates colour and tap_path', () => {
    expect(() => normalizeConfig({ kids: [{ id: 'a', theme: 't', colour: 5 }] })).toThrow(/colour/);
    expect(() => normalizeConfig({ kids: [{ id: 'a', theme: 't', tap_path: 'x' }] })).toThrow(/tap_path/);
    const c = normalizeConfig({ kids: [{ id: 'a', theme: 't', colour: '#fff', tap_path: '/k', show_number: true }] });
    expect(c.kids[0]).toEqual({ id: 'a', theme: 't', colour: '#fff', tap_path: '/k', show_number: true });
  });
});
