import type { HassStates } from '../src/adapter';

/** `birthday`: TaskMate reports the kid's birthday today (its birthday mode), with the age when given. */
export interface FakeKid { id: string; name: string; points: number; theme: string; colour: string; birthday?: { age?: number } }
export interface FakeJar { id: string; name: string; icon: string; goal: number; allocations: Record<string, number>; shared: boolean; assignedTo: string[] }

/** Builds TaskMate-shaped states, to be consumed through the real adapter. */
export function makeFakeHass(kids: FakeKid[], jars: FakeJar[]): { states: HassStates } {
  return {
    states: {
      'sensor.taskmate_overview': {
        state: String(kids.length),
        attributes: {
          children: kids.map((k) => ({
            id: k.id, name: k.name, spendable_balance: k.points, color: k.colour,
            // TaskMate's shape on the birthday: `{ multiplier, age?, chores_off? }`.
            ...(k.birthday ? { birthday: { multiplier: 2, ...k.birthday } } : {}),
          })),
        },
      },
      'sensor.taskmate_rewards': {
        state: String(jars.length),
        attributes: {
          rewards: jars.map((j) => ({
            id: j.id,
            name: j.name,
            cost: j.goal,
            icon: j.icon,
            pool_enabled: true,
            is_jackpot: j.shared,
            is_available: true,
            assigned_to: j.shared ? [] : j.assignedTo,
            pool_allocations: { ...j.allocations },
          })),
        },
      },
    },
  };
}
