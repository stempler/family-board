import { describe, expect, it } from 'vitest';
import notices from '../THIRD-PARTY-NOTICES.md?raw';
import pkg from '../package.json';

describe('THIRD-PARTY-NOTICES.md', () => {
  // The built card bundles every runtime dependency, so each one needs its licence notice shipped with the repo.
  const dependencies = Object.keys(pkg.dependencies);

  it.each(dependencies)('has a section for %s', (name) => {
    expect(notices).toContain(`## ${name}\n`);
  });

  it('has no section for a package that is not a runtime dependency', () => {
    const sections = [...notices.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(sections.sort()).toEqual([...dependencies].sort());
  });
});
