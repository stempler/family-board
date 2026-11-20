import { christmas } from './christmas';
import { dino } from './dino';
import { lego } from './lego';
import type { Theme } from './types';

export const THEMES: Record<string, Theme> = { christmas, lego, dino };

export function getTheme(id: string): Theme {
  return Object.hasOwn(THEMES, id) ? THEMES[id] : THEMES.lego;
}
