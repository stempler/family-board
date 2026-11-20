import type { HassStates } from '../src/adapter';

export interface FakeKid { id: string; name: string; points: number; theme: string; colour: string }
export interface FakeJar { id: string; name: string; icon: string; goal: number; allocations: Record<string, number>; shared: boolean; assignedTo: string[] }

/** Builds TaskMate-shaped states, to be consumed through the real adapter. */
export function makeFakeHass(kids: FakeKid[], jars: FakeJar[]): { states: HassStates } {
  return {
    states: {
      'sensor.taskmate_overview': {
        state: String(kids.length),
        attributes: {
          children: kids.map((k) => ({ id: k.id, name: k.name, spendable_balance: k.points, color: k.colour })),
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
