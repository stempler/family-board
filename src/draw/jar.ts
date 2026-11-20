import type { Jar, SharedJar } from '../model';
import { renderIcon } from './icon';
import { createSketch, esc, num } from './sketch';

export interface Box { x: number; y: number; w: number; h: number }

const GLASS = '#eef7fb';
const LID = '#c0392b';
const GOAL_LINE = '#2e8b57';

function fraction(current: number, goal: number): number {
  if (!(goal > 0)) return 1;
  const f = current / goal;
  return Number.isFinite(f) ? Math.min(Math.max(f, 0), 1) : 0;
}

interface Geometry { bx: number; by: number; bw: number; bh: number; iconSize: number; iconX: number; iconY: number; innerX: number; innerW: number; innerTop: number; innerH: number }

function geometry(box: Box): Geometry {
  const iconSize = Math.min(box.w * 0.6, box.h * 0.22);
  const bh = box.h - iconSize - 6;
  const bx = box.x + box.w * 0.05;
  const bw = box.w * 0.9;
  const lidH = Math.min(14, bh * 0.1);
  const innerTop = box.y + lidH + 4;
  return {
    bx, by: box.y + lidH, bw, bh: bh - lidH, iconSize,
    iconX: box.x + (box.w - iconSize) / 2, iconY: box.y + bh + 6,
    innerX: bx + 4, innerW: bw - 8, innerTop, innerH: box.y + bh - 4 - innerTop,
  };
}

function frame(g: Geometry, box: Box, sk: ReturnType<typeof createSketch>): string {
  const lidH = g.by - box.y;
  return sk.rect(g.bx, g.by, g.bw, g.bh, { fill: GLASS }) +
    sk.rect(box.x + box.w * 0.1, box.y - 2, box.w * 0.8, lidH + 2, { fill: LID });
}

function goalLine(g: Geometry): string {
  const y = g.innerTop + 4;
  return `<line x1="${num(g.innerX)}" y1="${num(y)}" x2="${num(g.innerX + g.innerW)}" y2="${num(y)}" stroke="${GOAL_LINE}" stroke-width="2.5" stroke-dasharray="6 5" stroke-linecap="round"/>`;
}

export function drawJar(jar: Jar, box: Box, colour: string, seedKey: string): string {
  const sk = createSketch(seedKey);
  const g = geometry(box);
  const f = fraction(jar.current, jar.goal);
  const h = g.innerH * f;
  const fill = `<rect data-fill="${num(f)}" x="${num(g.innerX)}" y="${num(g.innerTop + g.innerH - h)}" width="${num(g.innerW)}" height="${num(h)}" rx="6" fill="${esc(colour)}" opacity="0.75"/>`;
  return `<g data-jar="${esc(jar.id)}">${frame(g, box, sk)}${fill}${goalLine(g)}${renderIcon(jar.icon, g.iconX, g.iconY, g.iconSize)}</g>`;
}

export function drawSharedJar(jar: SharedJar, box: Box, kidColours: Record<string, string>, seedKey: string): string {
  const sk = createSketch(seedKey);
  const g = geometry(box);
  let bottom = g.innerTop + g.innerH;
  let used = 0;
  let segments = '';
  for (const [kid, pts] of Object.entries(jar.contributions)) {
    const remaining = 1 - used;
    const f = Math.min(fraction(pts, jar.goal), remaining);
    if (!(f > 0)) continue;
    used += f;
    const h = g.innerH * f;
    bottom -= h;
    segments += `<rect data-kid="${esc(kid)}" data-fill="${num(f)}" x="${num(g.innerX)}" y="${num(bottom)}" width="${num(g.innerW)}" height="${num(h)}" fill="${esc(kidColours[kid] ?? '#bbb')}" opacity="0.75"/>`;
  }
  return `<g data-shared-jar="${esc(jar.id)}">${frame(g, box, sk)}${segments}${goalLine(g)}${renderIcon(jar.icon, g.iconX, g.iconY, g.iconSize)}</g>`;
}
