import { chess } from './chess';
import { christmas } from './christmas';
import { dino } from './dino';
import { easter } from './easter';
import { halloween } from './halloween';
import { bricks } from './bricks';
import { pirates } from './pirates';
import { racing } from './racing';
import { dog } from './dog';
import { space } from './space';
import type { Theme } from './types';
import { underwater } from './underwater';
import { wizard } from './wizard';

export const THEMES: Record<string, Theme> = { christmas, bricks, dino, wizard, racing, space, dog, chess, halloween, easter, pirates, underwater };

export function getTheme(id: string): Theme {
  return Object.hasOwn(THEMES, id) ? THEMES[id] : THEMES.bricks;
}

/** Every registered theme's animation css, joined. */
export function themeCss(): string {
  return Object.values(THEMES).map((t) => t.css ?? '').filter(Boolean).join('\n');
}

/** Ids of the themes that draw a season scene. */
export function seasonThemeIds(): string[] {
  return Object.values(THEMES).filter((t) => t.renderSeasonScene).map((t) => t.id);
}
