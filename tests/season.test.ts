import { describe, expect, it } from 'vitest';
import { DEFAULT_SEASONS } from '../src/config';
import { activeSeason, ageOn, ageTurning, easterOffset, easterSunday, seasonStart, isBirthday } from '../src/season';

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

describe('activeSeason with easter-relative rules', () => {
  const all = ['christmas', 'halloween', 'easter'];
  const at = (y: number, m: number, d: number) => activeSeason(new Date(y, m - 1, d), DEFAULT_SEASONS, all)?.theme ?? null;
  it('uses the default easter window', () => {
    expect(at(2027, 3, 21)).toBe('easter');
    expect(at(2027, 3, 29)).toBe('easter');
    expect(at(2027, 3, 20)).toBeNull();
    expect(at(2027, 3, 30)).toBeNull();
    expect(at(2028, 4, 9)).toBe('easter');
  });
  it('uses the other defaults', () => {
    expect(at(2026, 10, 28)).toBe('halloween');
    expect(at(2026, 12, 24)).toBe('christmas');
  });
  it('supports mixed absolute and relative ends', () => {
    const rule = [{ theme: 'x', from: '03-01', to: 'easter+1' }];
    expect(activeSeason(new Date(2027, 2, 15), rule, ['x'])?.theme).toBe('x');
  });
  it('does not wrap rules with a relative end', () => {
    const rule = [{ theme: 'x', from: 'easter+1', to: '03-01' }];
    expect(activeSeason(new Date(2027, 0, 15), rule, ['x'])).toBeNull();
  });
  it('treats bare easter as easter+0', () => {
    const rule = [{ theme: 'x', from: 'easter', to: 'easter' }];
    expect(activeSeason(new Date(2027, 2, 28), rule, ['x'])?.theme).toBe('x');
    expect(activeSeason(new Date(2027, 2, 27), rule, ['x'])).toBeNull();
  });
  it('skips unknown themes', () => {
    expect(activeSeason(new Date(2027, 2, 25), DEFAULT_SEASONS, ['christmas'])).toBeNull();
  });
});

describe('easterOffset', () => {
  it('parses easter, easter-N and easter+N with N from 0 to 60', () => {
    expect(easterOffset('easter')).toBe(0);
    expect(easterOffset('easter-0')).toBe(0);
    expect(easterOffset('easter+0')).toBe(0);
    expect(easterOffset('easter-7')).toBe(-7);
    expect(easterOffset('easter+60')).toBe(60);
    expect(easterOffset('easter-60')).toBe(-60);
  });
  it('returns null for anything else', () => {
    for (const v of ['easter+61', 'easter-61', 'easter+100', 'easter+007', 'ostern', 'easter+', 'Easter-7', '12-01']) {
      expect(easterOffset(v), v).toBeNull();
    }
  });
});

describe('seasonStart', () => {
  it('is a day on which every default season is active', () => {
    for (const year of [2026, 2027, 2028]) {
      for (const rule of DEFAULT_SEASONS) expect(activeSeason(seasonStart(rule, year), [rule], [rule.theme])).toEqual(rule);
    }
  });
  it('resolves an Easter-relative start', () => {
    expect(seasonStart({ theme: 'easter', from: 'easter-7', to: 'easter+1' }, 2027)).toEqual(new Date(2027, 2, 21));
  });
});

describe('isBirthday', () => {
  it('is true on the day only', () => {
    expect(isBirthday('12-10', new Date(2026, 11, 10))).toBe(true);
    expect(isBirthday('12-10', new Date(2026, 11, 9))).toBe(false);
    expect(isBirthday('12-10', new Date(2026, 11, 11))).toBe(false);
  });
  it('uses the local date', () => {
    expect(isBirthday('12-10', new Date(2026, 11, 10, 23, 59))).toBe(true);
    expect(isBirthday('12-10', new Date(2026, 11, 10, 0, 0))).toBe(true);
  });
  it('shows a 29 February birthday on 28 February in non-leap years', () => {
    expect(isBirthday('02-29', new Date(2027, 1, 28))).toBe(true);
    expect(isBirthday('02-29', new Date(2027, 2, 1))).toBe(false);
  });
  it('shows a 29 February birthday only on the 29th in leap years', () => {
    expect(isBirthday('02-29', new Date(2028, 1, 29))).toBe(true);
    expect(isBirthday('02-29', new Date(2028, 1, 28))).toBe(false);
  });
  it('leaves a 28 February birthday alone', () => {
    expect(isBirthday('02-28', new Date(2028, 1, 29))).toBe(false);
    expect(isBirthday('02-28', new Date(2028, 1, 28))).toBe(true);
  });
});

describe('isBirthday with the birth year', () => {
  it('is true on the day only, whatever the year', () => {
    expect(isBirthday('2019-12-10', new Date(2026, 11, 10))).toBe(true);
    expect(isBirthday('2019-12-10', new Date(2026, 11, 9))).toBe(false);
    expect(isBirthday('2019-12-10', new Date(2026, 11, 11))).toBe(false);
  });
  it('shows a 29 February birthday on 28 February in non-leap years', () => {
    expect(isBirthday('2020-02-29', new Date(2027, 1, 28))).toBe(true);
    expect(isBirthday('2020-02-29', new Date(2028, 1, 28))).toBe(false);
    expect(isBirthday('2020-02-29', new Date(2028, 1, 29))).toBe(true);
  });
});

describe('ageOn', () => {
  it('counts the completed years, the new age on the birthday', () => {
    expect(ageOn('2019-12-10', new Date(2026, 11, 9))).toBe(6);
    expect(ageOn('2019-12-10', new Date(2026, 11, 10))).toBe(7);
  });
  it('has the new age on 28 February of a non-leap year for a 29 February birthday', () => {
    expect(ageOn('2020-02-29', new Date(2027, 1, 27))).toBe(6);
    expect(ageOn('2020-02-29', new Date(2027, 1, 28))).toBe(7);
    expect(ageOn('2020-02-29', new Date(2028, 1, 28))).toBe(7);
    expect(ageOn('2020-02-29', new Date(2028, 1, 29))).toBe(8);
  });
  it('knows no age without a year', () => {
    expect(ageOn('12-10', new Date(2026, 11, 10))).toBeUndefined();
  });
  it('knows no age below 1 or for a birth date in the future', () => {
    expect(ageOn('2026-12-10', new Date(2026, 11, 10))).toBeUndefined();
    expect(ageOn('2027-01-01', new Date(2026, 11, 10))).toBeUndefined();
  });
});

describe('ageTurning', () => {
  it('is the age the kid turns in the year of the date, whatever the day', () => {
    expect(ageTurning('2019-12-10', new Date(2026, 5, 1))).toBe(7);
  });
  it('knows no age without a year', () => {
    expect(ageTurning('12-10', new Date(2026, 5, 1))).toBeUndefined();
  });
  it('knows no age below 1 or for a birth year in the future', () => {
    expect(ageTurning('2026-12-10', new Date(2026, 5, 1))).toBeUndefined();
    expect(ageTurning('2027-01-01', new Date(2026, 5, 1))).toBeUndefined();
  });
});
