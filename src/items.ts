export interface ItemGroups { unit: number; big: number; small: number } // big items worth `unit`, small worth 1

export const ITEM_UNITS: readonly number[] = [10, 50, 100, 500, 1000];

export interface NewRange { newFrom: number; newTo: number } // item indices [newFrom, newTo) get class "fb-new"

export function groupItems(count: number, capacity: number, units: readonly number[] = ITEM_UNITS): ItemGroups {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const cap = Number.isFinite(capacity) ? Math.max(1, Math.floor(capacity)) : 1;
  if (n <= cap) return { unit: 1, big: 0, small: n };
  // Minimal replacement: as few big items as possible, so the most small items stay.
  for (const unit of units) {
    const big = Math.ceil((n - cap) / (unit - 1));
    if (big <= Math.floor(n / unit) && big + (n - big * unit) <= cap) return { unit, big, small: n - big * unit };
  }
  // No exact fit: the smallest unit whose big items fit, topped up with as many small items as room allows.
  for (const unit of units) {
    const big = Math.floor(n / unit);
    if (big <= cap) return { unit, big, small: Math.min(n % unit, cap - big) };
  }
  return { unit: units[units.length - 1], big: cap, small: 0 };
}

/**
 * Range of item indices a theme marks as new. Themes draw big items first (0..big-1), then small ones.
 * Nothing pops without previous points, when points did not go up, or when the unit changed between grouped units.
 * A merge (more big items) pops only the new big items.
 */
export function newItemRange(prev: number | undefined, points: number, capacity: number, units: readonly number[] = ITEM_UNITS): NewRange {
  const cur = groupItems(points, capacity, units);
  const total = cur.big + cur.small;
  const none = { newFrom: total, newTo: total };
  if (typeof prev !== 'number' || !(points > prev)) return none;
  const p = groupItems(prev, capacity, units);
  if (p.unit > 1 && p.unit !== cur.unit) return none;
  if (cur.big > p.big) return { newFrom: p.big, newTo: cur.big };
  return { newFrom: cur.big + p.small, newTo: total };
}
