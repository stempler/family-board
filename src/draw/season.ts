import type { Box } from './jar';
import { esc, num } from './sketch';
import { placement, type Placement, type Units } from './units';

const BAND = 40; // half-width of the middle band of a season scene, kept clear for the shared jars

/**
 * Places a kid's object in a season scene spanning `box`: centred in the widest part of the kid's
 * `half` that keeps clear of the middle band.
 */
export function seasonPlacement(box: Box, half: Box, u: Units): { cx: number; p: Placement } {
  const mid = box.x + box.w / 2;
  const bandL = mid - BAND;
  const bandR = mid + BAND;
  const l = half.x;
  const r = half.x + half.w;
  const left = [l, Math.min(r, bandL)];
  const right = [Math.max(l, bandR), r];
  const [a, b] = left[1] - left[0] >= right[1] - right[0] ? left : right;
  const cx = (a + b) / 2;
  return { cx, p: placement(box, u, cx, Math.max(b - a, 0)) };
}

/** Wraps a kid's object in a season scene in the group that marks whose it is and where it stands; `attrs` (if any) go first, separated by a space. */
export function seasonKid(id: string, cx: number, body: string, attrs = ''): string {
  return `<g ${attrs ? `${attrs} ` : ''}data-season-kid="${esc(id)}" data-cx="${num(cx)}">${body}</g>`;
}
