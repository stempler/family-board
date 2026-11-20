import { describe, expect, it } from 'vitest';
import { particles, rand, scaledCount, timing, twinkle } from '../src/draw/anim';

const box = { x: 400, y: 0, w: 400, h: 450 };

describe('rand', () => {
  it('is deterministic and in [0, 1)', () => {
    expect(rand('a')).toBe(rand('a'));
    for (const k of ['a', 'b', 'k1:lego:wave', '', 'x'.repeat(50)]) {
      expect(rand(k)).toBeGreaterThanOrEqual(0);
      expect(rand(k)).toBeLessThan(1);
    }
    expect(rand('a')).not.toBe(rand('b'));
  });
});

describe('timing', () => {
  it('gives a seeded duration within the range and a negative delay', () => {
    const t = timing('a', [9, 11]);
    expect(t).toMatch(/^--t:\d+(\.\d+)?s;--d:-\d+(\.\d+)?s$/);
    const [, dur, delay] = t.match(/^--t:([\d.]+)s;--d:-([\d.]+)s$/)!.map(Number);
    expect(dur).toBeGreaterThanOrEqual(9);
    expect(dur).toBeLessThanOrEqual(11);
    expect(delay).toBeLessThanOrEqual(11);
    expect(timing('a', [9, 11])).toBe(t);
  });
  it('keeps the delay within dSpan', () => {
    for (const k of ['a', 'b', 'c', 'd']) {
      const delay = Number(timing(k, [9, 11], 2).match(/--d:-([\d.]+)s/)![1]);
      expect(delay).toBeLessThanOrEqual(2);
    }
  });
});

describe('particles', () => {
  const out = particles('k', box, 13, 'snow');

  it('draws count snow circles inside the box', () => {
    const circles = out.match(/<circle [^>]*>/g) ?? [];
    expect(circles).toHaveLength(13);
    for (const c of circles) {
      expect(c).toContain('class="fb-anim fb-fall"');
      const cx = Number(c.match(/cx="([^"]+)"/)![1]);
      const cy = Number(c.match(/cy="([^"]+)"/)![1]);
      expect(cx).toBeGreaterThanOrEqual(box.x);
      expect(cx).toBeLessThanOrEqual(box.x + box.w);
      expect(cy).toBeGreaterThanOrEqual(box.y);
      expect(cy).toBeLessThanOrEqual(box.y + box.h);
    }
    expect(out).not.toContain('NaN');
  });
  it('rests snow far enough from the top and bottom that the fall stays in the box', () => {
    for (const m of out.matchAll(/cy="([^"]+)"/g)) {
      expect(Number(m[1])).toBeGreaterThanOrEqual(box.y + 40);
      expect(Number(m[1])).toBeLessThanOrEqual(box.y + box.h - 40);
    }
  });
  it('is deterministic and differs per key', () => {
    expect(particles('k', box, 13, 'snow')).toBe(out);
    expect(particles('k2', box, 13, 'snow')).not.toBe(out);
  });
  it('marks sparkles', () => {
    expect(particles('k', box, 5, 'sparkle').match(/class="fb-anim fb-sparkle"/g) ?? []).toHaveLength(5);
  });
});

describe('twinkle', () => {
  it('is a class and timing style attribute string', () => {
    expect(twinkle('s')).toMatch(/^class="fb-anim fb-twinkle" style="--t:[\d.]+s;--d:-[\d.]+s"$/);
  });
});

describe('scaledCount', () => {
  it('scales a per-half count with the box width, keeping at least 1', () => {
    expect(scaledCount(13, { x: 400, y: 0, w: 400, h: 450 })).toBe(13);
    expect(scaledCount(14, { x: 0, y: 0, w: 800, h: 450 })).toBe(28);
    expect(scaledCount(13, { x: 0, y: 0, w: 160, h: 450 })).toBe(5);
    expect(scaledCount(6, { x: 0, y: 0, w: 10, h: 450 })).toBe(1);
  });
});
