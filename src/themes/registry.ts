import { christmas } from './christmas';
import type { Theme } from './types';

// Placeholder until Task 8 adds the real LEGO theme.
const lego: Theme = { id: 'lego', capacity: 20, background: '#e8f1fb', renderHalf: () => '' };

export const THEMES: Record<string, Theme> = { christmas, lego };

export function getTheme(id: string): Theme {
  return Object.hasOwn(THEMES, id) ? THEMES[id] : THEMES.lego;
}
