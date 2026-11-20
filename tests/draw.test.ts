import { describe, expect, it } from 'vitest';
import { createSketch, esc, hashSeed, truncate } from '../src/draw/sketch';
import { renderIcon } from '../src/draw/icon';
import { drawJar, drawSharedJar } from '../src/draw/jar';

const box = { x: 10, y: 10, w: 60, h: 120 };

describe('sketch', () => {
  it('is deterministic per seed key', () => {
    const a1 = createSketch('a').rect(0, 0, 10, 10);
    const a2 = createSketch('a').rect(0, 0, 10, 10);
    expect(a1).toBe(a2);
    expect(createSketch('b').rect(0, 0, 10, 10)).not.toBe(a1);
    expect(a1).not.toContain('NaN');
  });
  it('varies between calls of one sketch', () => {
    const s = createSketch('a');
    expect(s.rect(0, 0, 10, 10)).not.toBe(s.rect(0, 0, 10, 10));
  });
  it('supports all shapes without NaN', () => {
    const s = createSketch('x');
    const out = [s.circle(5, 5, 8), s.ellipse(5, 5, 8, 4), s.polygon([[0, 0], [5, 0], [3, 4]]), s.line(0, 0, 5, 5), s.path('M0 0 L10 10'), s.rect(0, 0, 4, 4, { fill: '#f00', fillStyle: 'hachure' })].join('');
    expect(out).not.toContain('NaN');
    expect(out).toContain('<path');
  });
  it('hashSeed is a stable positive int', () => {
    expect(hashSeed('a')).toBe(hashSeed('a'));
    expect(hashSeed('')).toBeGreaterThan(0);
    expect(Number.isInteger(hashSeed('abc'))).toBe(true);
  });
  it('escapes and truncates', () => {
    expect(esc('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
    expect(truncate('x'.repeat(60), 20).length).toBe(20);
    expect(truncate('short', 20)).toBe('short');
  });
});

describe('icons', () => {
  it('renders mdi via ha-icon', () => {
    expect(renderIcon({ kind: 'mdi', value: 'mdi:gift' }, 0, 0, 24)).toContain('<ha-icon icon="mdi:gift"');
  });
  it('rounds coordinates to 2 decimals', () => {
    for (const icon of [{ kind: 'emoji' as const, value: 'a' }, { kind: 'mdi' as const, value: 'mdi:gift' }]) {
      expect(renderIcon(icon, 0.1 + 0.2, 13.2000000001, 7.333333)).not.toMatch(/\d+\.\d{3,}/);
    }
    expect(drawJar({ id: 'j', name: 'n', icon: { kind: 'emoji', value: 'a' }, current: 1, goal: 3 }, { x: 0.1, y: 0.2, w: 33.33333, h: 77.7777 }, '#f00', 'k')).not.toMatch(/\d+\.\d{3,}/);
  });
  it('escapes emoji and mdi values', () => {
    const out = renderIcon({ kind: 'emoji', value: '<>' }, 0, 0, 24);
    expect(out).toContain('&lt;&gt;');
    expect(out).not.toContain('<>');
    expect(renderIcon({ kind: 'mdi', value: '"><b>' }, 0, 0, 24)).not.toContain('<b>');
  });
});

describe('emoji length', () => {
  const shown = (value: string) => renderIcon({ kind: 'emoji', value }, 0, 0, 24).match(/>([^<]*)<\/text>$/)![1];
  it('keeps at most 2 graphemes', () => {
    expect(shown('👨‍👩‍👧🎉🚀')).toBe('👨‍👩‍👧🎉');
    expect(shown('Pizza-Abend')).toBe('Pi');
    expect(shown('🦁')).toBe('🦁');
  });
  it('falls back to code points without Intl.Segmenter', () => {
    const seg = Intl.Segmenter;
    try {
      (Intl as any).Segmenter = undefined;
      expect(shown('🦁🐯🐻')).toBe('🦁🐯');
    } finally {
      (Intl as any).Segmenter = seg;
    }
  });
});

describe('jars', () => {
  const base = { id: 'j1', name: 'Lego', icon: { kind: 'emoji' as const, value: '🧱' }, goal: 50 };
  it('clamps to full', () => {
    const out = drawJar({ ...base, current: 60 }, box, '#f4b942', 'k');
    expect(out).toContain('data-jar="j1"');
    expect(out).toContain('data-fill="1"');
    expect(out).toContain('#2e8b57');
    expect(out).not.toContain('NaN');
  });
  it('empty and zero goal', () => {
    expect(drawJar({ ...base, current: 0 }, box, '#f4b942', 'k')).toContain('data-fill="0"');
    expect(drawJar({ ...base, current: 0, goal: 0 }, box, '#f4b942', 'k')).toContain('data-fill="1"');
  });
  it('is deterministic', () => {
    const j = { ...base, current: 20 };
    expect(drawJar(j, box, '#f4b942', 'k')).toBe(drawJar(j, box, '#f4b942', 'k'));
  });
  it('shared jar stacks kid segments', () => {
    const out = drawSharedJar({ id: 's1', name: 'Trip', icon: { kind: 'mdi', value: 'mdi:gift' }, goal: 40, contributions: { k1: 5, k2: 8 } }, box, { k1: '#e74c3c', k2: '#3498db' }, 'k');
    expect(out).toContain('data-shared-jar="s1"');
    expect(out).toMatch(/data-kid="k1"[^>]*fill="#e74c3c"/);
    expect(out).toMatch(/data-kid="k2"[^>]*fill="#3498db"/);
    expect(out).not.toContain('NaN');
  });
});
