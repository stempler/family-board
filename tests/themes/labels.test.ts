import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';

const readme = Object.values(import.meta.glob('../../README.md', { query: '?raw', import: 'default', eager: true }))[0] as string;

describe('theme labels', () => {
  for (const theme of Object.values(THEMES)) {
    it(`${theme.id} has a German label that the README theme table repeats`, () => {
      expect(theme.label, `set \`label\` in src/themes/${theme.id}.ts`).toBeTruthy();
      expect(readme, `README theme table row for ${theme.id}`).toContain(`| \`${theme.id}\` | ${theme.label} |`);
    });
  }
});
