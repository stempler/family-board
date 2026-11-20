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
