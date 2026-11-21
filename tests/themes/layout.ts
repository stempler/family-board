// Layout checks for themes that export their item spots and the footprint of a drawn item.

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
  return { overlapping, size, area };
}
