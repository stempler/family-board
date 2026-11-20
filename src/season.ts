import type { SeasonRule } from './config';

function mmdd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

function matches(rule: SeasonRule, md: string): boolean {
  return rule.from <= rule.to
    ? md >= rule.from && md <= rule.to
    : md >= rule.from || md <= rule.to; // wraps the year end
}

export function activeSeason(date: Date, seasons: SeasonRule[], knownThemes: string[]): SeasonRule | null {
  const md = mmdd(date);
  return seasons.find((s) => knownThemes.includes(s.theme) && matches(s, md)) ?? null;
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
