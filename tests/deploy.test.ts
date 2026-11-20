// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { missingEnv, planResourceUpdate } from '../scripts/deploy.mjs';

describe('planResourceUpdate', () => {
  it('updates the existing family-board resource', () => {
    const plan = planResourceUpdate(
      [
        { id: 'a', url: '/local/other.js' },
        { id: 'b', url: '/local/family-board/family-board-card.js?v=1.1.0' },
      ],
      '1.2.0',
    );
    expect(plan).toEqual({ action: 'update', id: 'b', url: '/local/family-board/family-board-card.js?v=1.2.0' });
  });

  it('creates the resource when absent', () => {
    expect(planResourceUpdate([{ id: 'a', url: '/local/other.js' }], '1.2.0')).toEqual({
      action: 'create',
      url: '/local/family-board/family-board-card.js?v=1.2.0',
    });
  });
});

describe('missingEnv', () => {
  it('returns the names of missing variables', () => {
    expect(missingEnv({ FB_SSH_TARGET: 'u@h', FB_HA_URL: '' })).toEqual(['FB_HA_WWW', 'FB_HA_URL', 'FB_HA_TOKEN']);
    expect(missingEnv({ FB_SSH_TARGET: 'a', FB_HA_WWW: 'b', FB_HA_URL: 'c', FB_HA_TOKEN: 'd' })).toEqual([]);
  });
});
