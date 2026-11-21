import { easterOffset, resolveSeasonDate } from './season';

export interface KidConfig { id: string; theme: string; colour?: string; tap_path?: string; show_number: boolean }
export interface SeasonRule { theme: string; from: string; to: string } // "MM-DD" or "easter[±N]", inclusive; absolute-only rules may wrap year end
export interface CardConfig {
  type: string;
  overview_entity: string;
  rewards_entity: string;
  kids: KidConfig[];
  seasons: SeasonRule[];
  reward_icons: Record<string, string>; // reward id or name -> emoji or "mdi:..."
}

export const DEFAULT_SEASONS: SeasonRule[] = [
  { theme: 'christmas', from: '12-01', to: '12-26' },
  { theme: 'halloween', from: '10-24', to: '10-31' },
  { theme: 'easter', from: 'easter-7', to: 'easter+1' },
];

const MM_DD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function validSeasonDate(v: string): boolean {
  return MM_DD.test(v) || easterOffset(v) !== null;
}

/** The earliest and latest possible Easter Sundays (Mar 22, Apr 25), in a common and a leap year. */
const EASTER_EXTREMES = [2027, 2028].flatMap((y) => [new Date(y, 2, 22), new Date(y, 3, 25)]);

/** False when a rule with an Easter-relative end can never match, because its from is after its to whenever Easter falls. */
function feasibleSeason(from: string, to: string): boolean {
  if (easterOffset(from) === null && easterOffset(to) === null) return true; // absolute-only rules may wrap the year end
  return EASTER_EXTREMES.some((easter) => resolveSeasonDate(from, easter).md <= resolveSeasonDate(to, easter).md);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function normalizeKid(raw: unknown, i: number): KidConfig {
  if (!isRecord(raw)) throw new Error(`kids[${i}] must be an object`);
  if (!nonEmptyString(raw.id)) throw new Error(`kids[${i}]: id is required`);
  if (!nonEmptyString(raw.theme)) throw new Error(`kids[${i}]: theme is required`);
  const kid: KidConfig = { id: raw.id.trim(), theme: raw.theme.trim(), show_number: raw.show_number !== false };
  if (raw.colour !== undefined) {
    if (typeof raw.colour !== 'string') throw new Error(`kids[${i}]: colour must be a string`);
    kid.colour = raw.colour;
  }
  if (raw.tap_path !== undefined) {
    if (typeof raw.tap_path !== 'string' || !raw.tap_path.startsWith('/')) {
      throw new Error(`kids[${i}]: tap_path must be a string starting with "/"`);
    }
    kid.tap_path = raw.tap_path;
  }
  return kid;
}

function normalizeSeason(raw: unknown, i: number): SeasonRule {
  if (!isRecord(raw)) throw new Error(`seasons[${i}] must be an object`);
  if (!nonEmptyString(raw.theme)) throw new Error(`seasons[${i}]: theme is required`);
  for (const key of ['from', 'to'] as const) {
    const v = raw[key];
    if (typeof v !== 'string' || !validSeasonDate(v)) {
      throw new Error(`seasons[${i}]: ${key} must be formatted MM-DD or easter±N`);
    }
  }
  const from = raw.from as string;
  const to = raw.to as string;
  if (!feasibleSeason(from, to)) {
    throw new Error(`seasons[${i}]: from is after to (Easter-relative rules don't wrap the year end)`);
  }
  return { theme: raw.theme.trim(), from, to };
}

export function normalizeConfig(raw: unknown): CardConfig {
  if (!isRecord(raw)) throw new Error('Invalid configuration');
  if (!Array.isArray(raw.kids) || raw.kids.length === 0) {
    throw new Error('kids must be a non-empty list');
  }
  const seasons = raw.seasons === undefined
    ? DEFAULT_SEASONS.map((s) => ({ ...s }))
    : Array.isArray(raw.seasons)
      ? raw.seasons.map(normalizeSeason)
      : (() => { throw new Error('seasons must be a list'); })();
  let reward_icons: Record<string, string> = {};
  if (raw.reward_icons !== undefined) {
    if (!isRecord(raw.reward_icons) || Object.values(raw.reward_icons).some((v) => typeof v !== 'string')) {
      throw new Error('reward_icons must map names to strings');
    }
    reward_icons = { ...(raw.reward_icons as Record<string, string>) };
  }
  return {
    type: typeof raw.type === 'string' ? raw.type : 'custom:family-board-card',
    overview_entity: nonEmptyString(raw.overview_entity) ? raw.overview_entity : 'sensor.taskmate_overview',
    rewards_entity: nonEmptyString(raw.rewards_entity) ? raw.rewards_entity : 'sensor.taskmate_rewards',
    kids: raw.kids.map(normalizeKid),
    seasons,
    reward_icons,
  };
}
