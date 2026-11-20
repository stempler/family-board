import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('imports the card module without throwing', async () => {
    await expect(import('../src/family-board-card')).resolves.toBeDefined();
  });
});
