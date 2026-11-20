import { christmas } from './christmas';
import { dino } from './dino';
import { lego } from './lego';
import type { Theme } from './types';

export const THEMES: Record<string, Theme> = { christmas, lego, dino };

export function getTheme(id: string): Theme {
  return Object.hasOwn(THEMES, id) ? THEMES[id] : THEMES.lego;
}

/** Every registered theme's animation css, joined. */
export function themeCss(): string {
  return Object.values(THEMES).map((t) => t.css ?? '').filter(Boolean).join('\n');
}
