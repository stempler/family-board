import { expect, it } from 'vitest';
import { template } from '../../docs/theme-template';
import { THEMES } from '../../src/themes/registry';
import { runThemeContract } from './theme-contract';

// The template for new themes (docs/theme-template.ts) must keep satisfying the theme contract, but must
// never ship: it is neither registered nor bundled.
runThemeContract(template);

it('the template stays unregistered', () => {
  expect(Object.keys(THEMES)).not.toContain(template.id);
});
