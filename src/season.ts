import type { SeasonRule } from './config';

function mmdd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

const EASTER_REL = /^easter(?:([+-])(\d{1,2}))?$/;

/** Parses "easter", "easter-N" or "easter+N" (N from 0 to 60) to its day offset from Easter Sunday; null for anything else. */
export function easterOffset(value: string): number | null {
  const m = EASTER_REL.exec(value);
  if (!m) return null;
  const n = m[2] === undefined ? 0 : Number(m[2]);
  if (n > 60) return null;
  return m[1] === '-' && n > 0 ? -n : n;
}

/** Resolves "MM-DD" or "easter±N" to "MM-DD" against the given Easter Sunday; `relative` tells whether it was Easter-relative. */
export function resolveSeasonDate(value: string, easter: Date): { md: string; relative: boolean } {
  const n = easterOffset(value);
  if (n === null) return { md: value, relative: false };
  return { md: mmdd(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + n)), relative: true };
}

function matches(rule: SeasonRule, date: Date): boolean {
  const md = mmdd(date);
  const easter = easterSunday(date.getFullYear());
  const from = resolveSeasonDate(rule.from, easter);
  const to = resolveSeasonDate(rule.to, easter);
  if (from.relative || to.relative) {
    return from.md <= to.md && md >= from.md && md <= to.md; // never wraps
  }
  return from.md <= to.md
    ? md >= from.md && md <= to.md
    : md >= from.md || md <= to.md; // wraps the year end
}

export function activeSeason(date: Date, seasons: SeasonRule[], knownThemes: string[]): SeasonRule | null {
  return seasons.find((s) => knownThemes.includes(s.theme) && matches(s, date)) ?? null;
}

/** Easter Sunday of the given year (anonymous Gregorian algorithm, Meeus/Jones/Butcher), as a local date. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** The first day of `rule` in `year` as a local date (resolving "easter±N"): a date on which the season is active. */
export function seasonStart(rule: SeasonRule, year: number): Date {
  const { md } = resolveSeasonDate(rule.from, easterSunday(year));
  const [m, d] = md.split('-').map(Number);
  return new Date(year, m - 1, d);
}

const WITH_YEAR = /^(\d{4})-(\d{2}-\d{2})$/;

/** True on the kid's birthday ("YYYY-MM-DD" or "MM-DD", local date); a 29 February birthday is shown on 28 February in non-leap years. */
export function isBirthday(birthday: string, date: Date): boolean {
  const md = WITH_YEAR.exec(birthday)?.[2] ?? birthday;
  if (mmdd(date) === md) return true;
  const year = date.getFullYear();
  const leap = new Date(year, 1, 29).getMonth() === 1;
  return md === '02-29' && !leap && mmdd(date) === '02-28';
}

/**
 * The kid's age on `date`: the completed years since a "YYYY-MM-DD" birthday, so the new age on the birthday
 * (on 28 February of a non-leap year for a 29 February birthday too). Undefined without a year or below 1.
 */
export function ageOn(birthday: string, date: Date): number | undefined {
  const m = WITH_YEAR.exec(birthday);
  if (!m) return undefined;
  const reached = mmdd(date) >= m[2] || isBirthday(birthday, date);
  const age = date.getFullYear() - Number(m[1]) - (reached ? 0 : 1);
  return age >= 1 ? age : undefined;
}
