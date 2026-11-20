import type { IconRef } from '../model';
import { esc, INK, num } from './sketch';

const MAX_GRAPHEMES = 2;

/** An emoji value cut to a couple of graphemes, so a long text cannot spill out of its icon box. */
function shortEmoji(value: string): string {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), (s) => s.segment).slice(0, MAX_GRAPHEMES).join('');
  }
  return Array.from(value).slice(0, MAX_GRAPHEMES).join('');
}

export function renderIcon(icon: IconRef, x: number, y: number, size: number): string {
  if (icon.kind === 'mdi') {
    return `<foreignObject x="${num(x)}" y="${num(y)}" width="${num(size)}" height="${num(size)}"><ha-icon icon="${esc(icon.value)}" style="--mdc-icon-size:${num(size)}px;width:${num(size)}px;height:${num(size)}px"></ha-icon></foreignObject>`;
  }
  return `<text x="${num(x + size / 2)}" y="${num(y + size * 0.85)}" font-size="${num(size)}" text-anchor="middle" fill="${INK}">${esc(shortEmoji(icon.value))}</text>`;
}
