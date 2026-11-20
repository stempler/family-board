import type { Box } from './jar';
import { hashSeed, num } from './sketch';

// Shared helpers for ambient animation. Motion is CSS only: elements carry the marker class
// `fb-anim` (duration/delay/iteration come from `--t`/`--d`, see the card styles) plus a class
// that picks the keyframes. Without animation every element shows at its resting position.

/** Seeded number in [0, 1). */
export function rand(key: string): number {
  return (hashSeed(key) - 1) / 2147483646;
}

/** Inline style value with a seeded duration in `t` and a seeded negative delay within `dSpan` (default: the longest duration). */
export function timing(key: string, [min, max]: [number, number], dSpan?: number): string {
  const t = min + rand(`${key}:t`) * (max - min);
  const d = rand(`${key}:d`) * (dSpan ?? max);
  return `--t:${num(t)}s;--d:-${num(d)}s`;
}

/** A particle count that scales with the box width: `perHalf` in a standard 400-wide half, at least 1. */
export function scaledCount(perHalf: number, box: Box): number {
  return Math.max(1, Math.round(perHalf * box.w / 400));
}

const FALL = 40; // px a flake moves above and below its resting position

/** `count` plain circles resting at seeded positions inside `box`; snow falls through its resting point, sparkles pulse in place. */
export function particles(key: string, box: Box, count: number, kind: 'snow' | 'sparkle'): string {
  const snow = kind === 'snow';
  const mx = Math.min(8, box.w / 4);
  const my = Math.min(snow ? FALL : 8, box.h / 2);
  let out = '';
  for (let i = 0; i < count; i++) {
    const k = `${key}:${i}`;
    const x = box.x + mx + rand(`${k}:x`) * (box.w - 2 * mx);
    const y = box.y + my + rand(`${k}:y`) * (box.h - 2 * my);
    const r = snow ? 1.6 + rand(`${k}:r`) * 1.8 : 1.4 + rand(`${k}:r`) * 1.4;
    const fill = snow ? '#ffffff' : '#fff6c2';
    const t = snow ? timing(k, [6, 11]) : timing(k, [2.5, 4.5]);
    out += `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${fill}" opacity="0.9" class="fb-anim fb-${snow ? 'fall' : 'sparkle'}" style="${t}"/>`;
  }
  return out;
}

/** Attribute string that makes a group (e.g. a star) twinkle in place. */
export function twinkle(key: string): string {
  return `class="fb-anim fb-twinkle" style="${timing(`${key}:twinkle`, [2.5, 3.5])}"`;
}

/** Keyframes shared by every theme; no theme prefix. */
export const animCss = `
  @keyframes fb-fall {
    0% { transform: translate(0, -${FALL}px); opacity: 0; }
    15% { opacity: 0.9; }
    50% { transform: translate(4px, 0); }
    85% { opacity: 0.9; }
    100% { transform: translate(-2px, ${FALL}px); opacity: 0; }
  }
  @keyframes fb-sparkle {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(0.4); opacity: 0.2; }
  }
  @keyframes fb-twinkle {
    0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
    50% { transform: scale(0.88) rotate(6deg); opacity: 0.8; }
  }
  .fb-fall { animation-name: fb-fall; animation-timing-function: linear; }
  .fb-sparkle { animation-name: fb-sparkle; animation-timing-function: ease-in-out; transform-origin: 50% 50%; }
  .fb-twinkle { animation-name: fb-twinkle; animation-timing-function: ease-in-out; transform-origin: 50% 50%; }
`;
