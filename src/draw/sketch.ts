import rough from 'roughjs';

export const INK = '#3a2f28';
export const PAPER = '#fdf8ee';

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return chars.slice(0, Math.max(0, max - 1)).join('') + '…';
}

/** Stable positive integer derived from a string (FNV-1a). */
export function hashSeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2147483646 + 1;
}

export interface Style {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  fillStyle?: 'solid' | 'hachure';
  roughness?: number;
}

export interface Sketch {
  rect(x: number, y: number, w: number, h: number, s?: Style): string;
  circle(cx: number, cy: number, d: number, s?: Style): string;
  ellipse(cx: number, cy: number, w: number, h: number, s?: Style): string;
  polygon(points: [number, number][], s?: Style): string;
  line(x1: number, y1: number, x2: number, y2: number, s?: Style): string;
  path(d: string, s?: Style): string;
}

const gen = rough.generator();

/** Round to 2 decimals for compact, stable output. */
export function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function createSketch(seedKey: string): Sketch {
  let call = 0;
  const opts = (s: Style = {}) => ({
    seed: hashSeed(`${seedKey}:${call++}`),
    stroke: s.stroke ?? INK,
    strokeWidth: s.strokeWidth ?? 2.5,
    roughness: s.roughness ?? 1.2,
    fillStyle: s.fillStyle ?? 'solid',
    ...(s.fill ? { fill: s.fill } : {}),
  });
  const toSvg = (drawable: ReturnType<typeof gen.line>): string => {
    const paths = gen.toPaths(drawable).map((p) => {
      const d = p.d.replace(/-?\d+\.\d+/g, (m) => num(parseFloat(m)));
      return `<path d="${d}" stroke="${esc(p.stroke)}" stroke-width="${num(p.strokeWidth)}" fill="${esc(p.fill ?? 'none')}" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    return `<g>${paths.join('')}</g>`;
  };
  return {
    rect: (x, y, w, h, s) => toSvg(gen.rectangle(x, y, w, h, opts(s))),
    circle: (cx, cy, d, s) => toSvg(gen.circle(cx, cy, d, opts(s))),
    ellipse: (cx, cy, w, h, s) => toSvg(gen.ellipse(cx, cy, w, h, opts(s))),
    polygon: (points, s) => toSvg(gen.polygon(points, opts(s))),
    line: (x1, y1, x2, y2, s) => toSvg(gen.line(x1, y1, x2, y2, opts(s))),
    path: (d, s) => toSvg(gen.path(d, opts(s))),
  };
}
