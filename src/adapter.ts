import type { CardConfig } from './config';
import type { BoardModel, IconRef, Jar, Kid, SharedJar } from './model';

export type HassStates = Record<string, { state: string; attributes: Record<string, unknown> }>;

const PALETTE = ['#d9534f', '#3b7dd8', '#5aa469', '#f0ad4e'];
const DEFAULT_AVATAR: IconRef = { kind: 'mdi', value: 'mdi:account-circle' };
const DEFAULT_REWARD_ICON: IconRef = { kind: 'mdi', value: 'mdi:gift' };

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function recs(v: unknown): Rec[] {
  return Array.isArray(v) ? v.filter(isRec) : [];
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function dict(v: unknown): Rec {
  return isRec(v) ? v : {};
}

export function parseIcon(value: string | undefined, fallback: IconRef): IconRef {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return value.startsWith('mdi:') ? { kind: 'mdi', value } : { kind: 'emoji', value };
}

function rewardIcon(r: Rec, config: CardConfig): IconRef {
  const id = str(r.id);
  const name = str(r.name);
  const raw = config.reward_icons[id] ?? config.reward_icons[name] ?? (str(r.icon) || undefined);
  return parseIcon(raw, DEFAULT_REWARD_ICON);
}

export function toBoardModel(states: HassStates, config: CardConfig): BoardModel {
  const overview = states[config.overview_entity];
  const children = overview?.attributes?.children;
  if (!overview || overview.state === 'unavailable' || overview.state === 'unknown' || !Array.isArray(children)) {
    return { status: 'missing', kids: [], sharedJars: [] };
  }
  const childList = recs(children);
  const rewards = recs(states[config.rewards_entity]?.attributes?.rewards).filter((r) => r.is_available !== false);
  const kidIds = new Set(config.kids.map((k) => k.id));

  const kids: Kid[] = config.kids.map((kc, i) => {
    const child = childList.find((c) => str(c.id) === kc.id);
    if (!child) {
      return { id: kc.id, name: kc.id, colour: kc.colour ?? PALETTE[i % PALETTE.length], avatar: DEFAULT_AVATAR, points: 0, jars: [], found: false };
    }
    const jars: Jar[] = rewards
      .filter((r) => r.pool_enabled === true && r.is_jackpot !== true)
      .filter((r) => {
        const assigned = Array.isArray(r.assigned_to) ? r.assigned_to : [];
        return assigned.length === 0 || assigned.includes(kc.id);
      })
      .map((r) => ({
        id: str(r.id),
        name: str(r.name),
        icon: rewardIcon(r, config),
        current: num(dict(r.pool_allocations)[kc.id]),
        goal: dict(r.calculated_costs)[kc.id] !== undefined ? num(dict(r.calculated_costs)[kc.id]) : num(r.cost),
      }));
    const kid: Kid = {
      id: kc.id,
      name: str(child.name) || kc.id,
      colour: kc.colour ?? (str(child.color) || PALETTE[i % PALETTE.length]),
      avatar: parseIcon(str(child.avatar), DEFAULT_AVATAR),
      points: Math.max(0, num(child.spendable_balance)),
      jars,
      found: true,
    };
    const img = str(child.avatar_image);
    if (img) kid.avatarImage = img;
    return kid;
  });

  const sharedJars: SharedJar[] = rewards
    .filter((r) => r.is_jackpot === true)
    .map((r) => {
      const contributions: Record<string, number> = {};
      for (const [kidId, pts] of Object.entries(dict(r.pool_allocations))) {
        if (kidIds.has(kidId)) contributions[kidId] = num(pts);
      }
      return { id: str(r.id), name: str(r.name), icon: rewardIcon(r, config), goal: num(r.cost), contributions };
    });

  return { status: 'ok', kids, sharedJars };
}
