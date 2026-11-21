import { describe, expect, it } from 'vitest';
import { DEFAULT_SEASONS, normalizeConfig } from '../src/config';

const base = { type: 'custom:family-board-card', kids: [{ id: 'a', theme: 'bricks' }] };

describe('normalizeConfig', () => {
  it('applies defaults', () => {
    const c = normalizeConfig(base);
    expect(c.overview_entity).toBe('sensor.taskmate_overview');
    expect(c.rewards_entity).toBe('sensor.taskmate_rewards');
    expect(c.seasons).toEqual(DEFAULT_SEASONS);
    expect(c.kids[0].show_number).toBe(true);
    expect(normalizeConfig({ ...base, kids: [{ id: 'a', theme: 'dino', show_number: false }] }).kids[0].show_number).toBe(false);
    expect(c.reward_icons).toEqual({});
  });
  it('throws for missing or empty kids', () => {
    expect(() => normalizeConfig({ type: 'x' })).toThrow(/kids/);
    expect(() => normalizeConfig({ type: 'x', kids: [] })).toThrow(/kids/);
  });
  it('throws for kid without id', () => {
    expect(() => normalizeConfig({ kids: [{ theme: 'bricks' }] })).toThrow(/id/);
  });
  it('throws for kid without theme', () => {
    expect(() => normalizeConfig({ kids: [{ id: 'a' }] })).toThrow(/theme/);
  });
  it('trims kid id and theme', () => {
    const c = normalizeConfig({ kids: [{ id: ' a872165c ', theme: ' bricks ' }] });
    expect(c.kids[0].id).toBe('a872165c');
    expect(c.kids[0].theme).toBe('bricks');
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
  it('accepts easter-relative season dates', () => {
    for (const v of ['easter', 'easter-7', 'easter+1', 'easter+60', 'easter-0', 'easter+0']) {
      expect(normalizeConfig({ ...base, seasons: [{ theme: 'x', from: v, to: '12-26' }] }).seasons[0].from).toBe(v);
    }
  });
  it('rejects invalid easter-relative season dates', () => {
    for (const v of ['easter+61', 'easter-61', 'ostern', 'easter+', 'easter 7', 'Easter-7', 'easter+100']) {
      expect(() => normalizeConfig({ ...base, seasons: [{ theme: 'x', from: '01-01', to: v }] })).toThrow(/MM-DD or easter/);
      expect(() => normalizeConfig({ ...base, seasons: [{ theme: 'x', from: v, to: '01-01' }] })).toThrow(/MM-DD or easter/);
    }
  });
  it('rejects easter-relative rules whose from is after to in every year', () => {
    const rules: [string, string][] = [['easter+1', 'easter-1'], ['05-01', 'easter'], ['12-20', 'easter'], ['easter+1', '03-01']];
    for (const [from, to] of rules) {
      expect(() => normalizeConfig({ ...base, seasons: [{ theme: 'x', from: '01-01', to: '01-02' }, { theme: 'x', from, to }] }))
        .toThrow("seasons[1]: from is after to (Easter-relative rules don't wrap the year end)");
    }
  });
  it('accepts easter-relative rules that match in some year', () => {
    const rules: [string, string][] = [
      ['03-01', 'easter+1'], ['easter-7', 'easter+1'], ['easter', 'easter'], ['04-01', 'easter'], ['easter', '04-01'], ['easter-60', '12-31'],
    ];
    for (const [from, to] of rules) {
      expect(normalizeConfig({ ...base, seasons: [{ theme: 'x', from, to }] }).seasons[0]).toEqual({ theme: 'x', from, to });
    }
  });
  it('still lets absolute-only rules wrap the year end', () => {
    expect(normalizeConfig({ ...base, seasons: [{ theme: 'x', from: '12-20', to: '01-06' }] }).seasons[0].to).toBe('01-06');
  });
  it('trims the season theme', () => {
    expect(normalizeConfig({ ...base, seasons: [{ theme: ' x ', from: '01-01', to: '01-02' }] }).seasons[0].theme).toBe('x');
  });
  it('defaults to christmas, halloween, easter and martin seasons', () => {
    expect(DEFAULT_SEASONS).toEqual([
      { theme: 'christmas', from: '12-01', to: '12-26' },
      { theme: 'halloween', from: '10-24', to: '10-31' },
      { theme: 'easter', from: 'easter-7', to: 'easter+1' },
      { theme: 'martin', from: '11-01', to: '11-11' },
    ]);
    expect(normalizeConfig(base).seasons).toEqual(DEFAULT_SEASONS);
  });
  it('trims tap_path', () => {
    expect(normalizeConfig({ kids: [{ id: 'a', theme: 't', tap_path: '  /k  ' }] }).kids[0].tap_path).toBe('/k');
    expect(() => normalizeConfig({ kids: [{ id: 'a', theme: 't', tap_path: '   ' }] })).toThrow(/tap_path/);
  });

  it('rejects duplicate kid ids (also after trimming)', () => {
    expect(() => normalizeConfig({ kids: [{ id: 'a', theme: 't' }, { id: ' a ', theme: 'u' }] })).toThrow(/kids\[1\]: duplicate id "a"/);
  });

  it('validates colour and tap_path', () => {
    expect(() => normalizeConfig({ kids: [{ id: 'a', theme: 't', colour: 5 }] })).toThrow(/colour/);
    expect(() => normalizeConfig({ kids: [{ id: 'a', theme: 't', tap_path: 'x' }] })).toThrow(/tap_path/);
    const c = normalizeConfig({ kids: [{ id: 'a', theme: 't', colour: '#fff', tap_path: '/k', show_number: true }] });
    expect(c.kids[0]).toEqual({ id: 'a', theme: 't', colour: '#fff', tap_path: '/k', show_number: true });
  });
});

describe('kid birthday', () => {
  const withBirthday = (birthday: unknown) => normalizeConfig({ kids: [{ id: 'a', theme: 'bricks', birthday }] });
  it('normalizes and accepts a valid day', () => {
    expect(withBirthday(' 12-10 ').kids[0].birthday).toBe('12-10');
    expect(withBirthday('02-29').kids[0].birthday).toBe('02-29');
  });
  it('has no birthday key without one', () => {
    expect('birthday' in normalizeConfig(base).kids[0]).toBe(false);
  });
  it.each(['10.12.', '2019-12-10', '12-1', '13-01', '', 1210, 12])('rejects the form %j', (v) => {
    expect(() => withBirthday(v)).toThrow('kids[0]: birthday must be formatted MM-DD');
  });
  it.each(['02-30', '04-31', '06-31', '11-31'])('rejects %s as no calendar day', (v) => {
    expect(() => withBirthday(v)).toThrow('kids[0]: birthday is not a calendar day');
  });
});
