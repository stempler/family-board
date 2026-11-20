import type { Box } from '../draw/jar';
import type { ItemGroups } from '../items';
import type { Kid } from '../model';

export interface HalfContext { kid: Kid; box: Box; groups: ItemGroups; newFrom: number; seedKey: string } // newFrom: item index from which items get class "fb-new"

export interface Theme {
  id: string;
  capacity: number; // max drawn items per kid
  background: string; // half background colour
  renderHalf(ctx: HalfContext): string; // the kid's scene inside ctx.box, no jars or header
  renderSeasonScene?(halves: HalfContext[], box: Box): string; // shared landscape with one object per kid; only for seasonal themes
}

/** Wraps one drawn item in the marker group every theme must emit. */
export function item(kind: 'small' | 'big', index: number, newFrom: number, body: string): string {
  return `<g class="fb-item${index >= newFrom ? ' fb-new' : ''}" data-item="${kind}">${body}</g>`;
}
