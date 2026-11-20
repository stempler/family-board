import { describe, expect, it } from 'vitest';
import { DEFAULT_SEASONS } from '../src/config';
import { activeSeason } from '../src/season';

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
