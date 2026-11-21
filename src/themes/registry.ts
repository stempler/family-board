import { birthday } from './birthday';
import { bricks } from './bricks';
import { chess } from './chess';
import { christmas } from './christmas';
import { construction } from './construction';
import { dino } from './dino';
import { dog } from './dog';
import { easter } from './easter';
import { football } from './football';
import { garden } from './garden';
import { halloween } from './halloween';
import { martin } from './martin';
import { pirates } from './pirates';
import { racing } from './racing';
import { space } from './space';
import { summer } from './summer';
import type { Theme } from './types';
import { underwater } from './underwater';
import { wizard } from './wizard';

export const THEMES: Record<string, Theme> = { christmas, bricks, dino, wizard, racing, space, dog, chess, halloween, easter, pirates, underwater, football, martin, birthday, construction, garden, summer };

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
