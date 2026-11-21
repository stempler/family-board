import type { Box } from './jar';
import { num } from './sketch';

// Every theme draws its scene in its own "units" (a fixed coordinate system from the mockups) and
// fits them into the scene band of a half: below the board header, above the jar row.

export type Pt = [number, number];

export const SCENE_TOP = 0.17; // leave room for the board header
export const SCENE_BOTTOM = 0.79; // leave room for the jar row

/** A theme's unit system and how it fits into the scene band. */
export interface Units {
  mid: number; // x of the units' centre line, placed on the placement's cx
  top: number; // y of the units' top edge
  w: number; // width in units that has to fit `fill` of the available width
  h: number; // height in units that has to fit the scene band
  fill: number; // share of the available width the `w` units may take
  align?: 'bottom' | 'centre'; // vertical position in the scene band, bottom by default
}

/** Where the units land in the half: unit x `mid` at board x `cx`, unit y `top` at board y `top`, scaled by `s`. */
export interface Placement { cx: number; top: number; s: number; units: Units }

/** Fits `u` into the scene band of `box`, horizontally centred on `cx` within `width` (by default the whole box). */
export function placement(box: Box, u: Units, cx = box.x + box.w / 2, width = box.w): Placement {
  const top = box.y + box.h * SCENE_TOP;
  const height = box.h * (SCENE_BOTTOM - SCENE_TOP);
  const s = Math.min(height / u.h, (width * u.fill) / u.w);
  const y = u.align === 'centre' ? top + (height - u.h * s) / 2 : top + (height - u.h * s);
  return { cx, top: y, s, units: u };
}

/** A point in units, in board coordinates. */
export function at(p: Placement, x: number, y: number): Pt {
  return [p.cx + (x - p.units.mid) * p.s, p.top + (y - p.units.top) * p.s];
}

/** `pts` given relative to (x, y) in units, in board coordinates. */
export function around(p: Placement, x: number, y: number, pts: Pt[]): Pt[] {
  return pts.map(([dx, dy]) => at(p, x + dx, y + dy));
}

/** Rewrites every "x y" pair of a path with `f`. */
export function mapPath(d: string, f: (x: number, y: number) => Pt): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => f(+x, +y).map(num).join(' '));
}

/** Rewrites every "x y" pair of a path in units into board coordinates. */
export function moved(p: Placement, d: string): string {
  return mapPath(d, (x, y) => at(p, x, y));
}

/** A list of points for an SVG `points` attribute. */
export const points = (pts: Pt[]): string => pts.map((q) => q.map(num).join(',')).join(' ');

/** The ten corners of a five-pointed star centred on (cx, cy) with outer radius r, top point first. */
export function starPoints(cx: number, cy: number, r: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}
