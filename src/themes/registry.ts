import { chess } from './chess';
import { christmas } from './christmas';
import { dino } from './dino';
import { easter } from './easter';
import { halloween } from './halloween';
import { lego } from './lego';
import { racing } from './racing';
import { rescue } from './rescue';
import { space } from './space';
import type { Theme } from './types';
import { wizard } from './wizard';

export const THEMES: Record<string, Theme> = { christmas, lego, dino, wizard, racing, space, rescue, chess, halloween, easter };

export function getTheme(id: string): Theme {
  return Object.hasOwn(THEMES, id) ? THEMES[id] : THEMES.lego;
}

/** Every registered theme's animation css, joined. */
export function themeCss(): string {
  return Object.values(THEMES).map((t) => t.css ?? '').filter(Boolean).join('\n');
}
