import type { Box } from '../draw/jar';
import type { ItemGroups, NewRange } from '../items';
import type { Kid } from '../model';

export interface HalfContext { kid: Kid; box: Box; groups: ItemGroups; newFrom: number; newTo: number; seedKey: string } // items with newFrom <= index < newTo get class "fb-new"

export interface Theme {
  id: string;
  label?: string; // German display name for pickers (dev playground); the id is shown without one
  capacity: number; // max drawn items per kid (with `items`, only the upper bound; grouping is the theme's own)
  background: string; // half background colour
  renderHalf(ctx: HalfContext): string; // the kid's scene inside ctx.box, no jars or header
  renderSeasonScene?(halves: HalfContext[], box: Box): string; // shared landscape with one object per kid; only for seasonal themes
  /**
   * Optional own item counting, used instead of `capacity`-based grouping: how many data-item elements the
   * theme draws for `points` and which of them are new since `prev`. `ctx.groups` is still filled but unused.
   */
  items?(points: number, prev: number | undefined): { total: number } & NewRange;
  css?: string; // keyframes and classes for this theme's ambient animation, all prefixed fb-<id>-
}

/** Wraps one drawn item in the marker group every theme must emit. */
export function item(kind: 'small' | 'big', index: number, ctx: NewRange, body: string): string {
  return `<g class="fb-item${index >= ctx.newFrom && index < ctx.newTo ? ' fb-new' : ''}" data-item="${kind}">${body}</g>`;
}
