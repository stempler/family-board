import { describe, expect, it } from 'vitest';
import { DEFAULT_SEASONS } from '../src/config';
import { activeSeason, easterSunday } from '../src/season';

describe('activeSeason', () => {
  it('matches the start of the default season', () => {
    expect(activeSeason(new Date(2026, 11, 1), DEFAULT_SEASONS, ['christmas'])?.theme).toBe('christmas');
  });
  it('includes the end date and excludes the day after', () => {
    expect(activeSeason(new Date(2026, 11, 26), DEFAULT_SEASONS, ['christmas'])?.theme).toBe('christmas');
    expect(activeSeason(new Date(2026, 11, 27), DEFAULT_SEASONS, ['christmas'])).toBeNull();
  });
  it('supports rules wrapping the year end', () => {
    const rules = [{ theme: 'christmas', from: '12-20', to: '01-06' }];
    expect(activeSeason(new Date(2027, 0, 3), rules, ['christmas'])?.theme).toBe('christmas');
    expect(activeSeason(new Date(2026, 11, 25), rules, ['christmas'])?.theme).toBe('christmas');
    expect(activeSeason(new Date(2027, 5, 3), rules, ['christmas'])).toBeNull();
  });
  it('ignores rules whose theme is unknown', () => {
    const rules = [{ theme: 'halloween', from: '10-01', to: '11-01' }];
    expect(activeSeason(new Date(2026, 9, 15), rules, ['christmas'])).toBeNull();
  });
  it('picks the first matching rule with a known theme', () => {
    const rules = [
      { theme: 'halloween', from: '10-01', to: '12-31' },
      { theme: 'christmas', from: '12-01', to: '12-26' },
    ];
    expect(activeSeason(new Date(2026, 11, 5), rules, ['christmas'])?.theme).toBe('christmas');
  });
  it('uses the local date, not UTC', () => {
    expect(activeSeason(new Date(2026, 11, 1, 0, 30), DEFAULT_SEASONS, ['christmas'])?.theme).toBe('christmas');
  });
});

describe('easterSunday', () => {
  it('computes Easter Sunday', () => {
    const expected: Record<number, [number, number]> = {
      2026: [4, 5], 2027: [3, 28], 2028: [4, 16], 2029: [4, 1], 2030: [4, 21],
    };
    for (const [year, [month, day]] of Object.entries(expected)) {
      const d = easterSunday(Number(year));
      expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([Number(year), month, day]);
    }
  });
});
