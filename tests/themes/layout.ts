// Layout checks for themes that export their item spots and the footprint of a drawn item.
import { groupItems } from '../../src/items';

/** The box a drawn item covers, in the theme's units: [left, top, right, bottom]. */
export type Footprint = [number, number, number, number];

/** What a theme's spot has at least: the kind of item and where it stands. */
export interface LaidOut { kind: string; x: number; y: number }

/** Units of air between two drawn items. */
export const GAP = 2;

/** The layout helpers for a theme's `footprint`. */
export function layout<S extends LaidOut>(footprint: (s: S) => Footprint) {
  const apart = (a: S, b: S) => {
    const [l1, t1, r1, b1] = footprint(a);
    const [l2, t2, r2, b2] = footprint(b);
    return l1 >= r2 + GAP || l2 >= r1 + GAP || t1 >= b2 + GAP || t2 >= b1 + GAP;
  };
  /** Every pair of spots in `list` that are not at least GAP apart, as readable strings. */
  const overlapping = (list: S[]) => {
    const bad: string[] = [];
    list.forEach((a, i) => list.slice(i + 1).forEach((b) => { if (!apart(a, b)) bad.push(`${a.kind}@${a.x},${a.y} ${b.kind}@${b.x},${b.y}`); }));
    return bad;
  };
  const size = (s: S) => { const [l, t, r, b] = footprint(s); return { w: r - l, h: b - t, area: (r - l) * (b - t) }; };
  const area = (s: S) => size(s).area;
  /** Every spot in `list` that is not at least GAP clear of every box in `scenery`, as readable strings. */
  const onScenery = (list: S[], scenery: Record<string, Footprint>) => {
    const bad: string[] = [];
    for (const s of list) {
      const [l1, t1, r1, b1] = footprint(s);
      for (const [name, [l2, t2, r2, b2]] of Object.entries(scenery)) {
        if (!(l1 >= r2 + GAP || l2 >= r1 + GAP || t1 >= b2 + GAP || t2 >= b1 + GAP)) bad.push(`${s.kind}@${s.x},${s.y} on ${name}`);
      }
    }
    return bad;
  };
  return { overlapping, size, area, onScenery };
}

/** The (big, small) mixes the grouping produces for every total from 1 to `max`, each once. */
export function mixes(capacity: number, max = 1000): { big: number; small: number; points: number }[] {
  const seen = new Map<string, { big: number; small: number; points: number }>();
  for (let points = 1; points <= max; points++) {
    const { big, small } = groupItems(points, capacity);
    if (!seen.has(`${big}/${small}`)) seen.set(`${big}/${small}`, { big, small, points });
  }
  return [...seen.values()];
}

/**
 * Every item that changes its spot or size when one point is added without a unit change, for every total from 1 to
 * `max`, as readable strings. Items are matched by kind and order: the i-th big item before is the i-th big item after.
 */
export function movedItems<S extends LaidOut>(spots: (big: number, small: number) => S[], footprint: (s: S) => Footprint, capacity: number, max = 1000): string[] {
  const bad: string[] = [];
  for (let points = 1; points <= max; points++) {
    const a = groupItems(points - 1, capacity);
    const b = groupItems(points, capacity);
    if (a.unit !== b.unit) continue;
    const [before, after] = [spots(a.big, a.small), spots(b.big, b.small)];
    for (const kind of new Set([...before, ...after].map((s) => s.kind))) {
      const [x, y] = [before.filter((s) => s.kind === kind), after.filter((s) => s.kind === kind)];
      for (let i = 0; i < Math.min(x.length, y.length); i++) {
        const [f, g] = [footprint(x[i]).join(','), footprint(y[i]).join(',')];
        if (f !== g) bad.push(`${kind} #${i} at ${points - 1} -> ${points} points: ${f} -> ${g}`);
      }
    }
  }
  return bad;
}
