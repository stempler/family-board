export interface ItemGroups { unit: number; big: number; small: number } // big items worth `unit`, small worth 1

const UNITS = [10, 50, 100, 500, 1000];

export function groupItems(count: number, capacity: number): ItemGroups {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const cap = Number.isFinite(capacity) ? Math.max(1, Math.floor(capacity)) : 1;
  if (n <= cap) return { unit: 1, big: 0, small: n };
  for (const unit of UNITS) {
    const big = Math.floor(n / unit);
    const small = n % unit;
    if (big + small <= cap) return { unit, big, small };
  }
  // No exact fit: the smallest unit whose big items fit, topped up with as many small items as room allows.
  for (const unit of UNITS) {
    const big = Math.floor(n / unit);
    if (big <= cap) return { unit, big, small: Math.min(n % unit, cap - big) };
  }
  return { unit: UNITS[UNITS.length - 1], big: cap, small: 0 };
}
