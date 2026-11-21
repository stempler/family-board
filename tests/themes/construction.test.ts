import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { footprint, spots } from '../../src/themes/construction';
import { THEMES } from '../../src/themes/registry';
import { type Footprint, layout, mixes, movedItems } from './layout';
import { beforeItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const construction = THEMES.construction;

runThemeContract(construction);

const half = (points: number) => construction.renderHalf(contractCtx(construction, points));
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('construction half', () => {
  it('has bare earth, an excavator, a barrier and a wall foundation', () => {
    const out = half(7);
    for (const name of ['ground', 'excavator', 'barrier', 'wall']) expect(out).toContain(`data-part="${name}"`);
  });
  it('swings the excavator arm and blinks the warning light', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      expect(count(out, /fb-anim fb-construction-arm/g)).toBe(1);
      expect(count(out, /fb-anim fb-construction-blink/g)).toBe(1);
    }
  });
  it('swings the arm slowly around its joint at the cab', () => {
    const out = half(7);
    const arm = out.match(/class="fb-anim fb-construction-arm" style="--t:([\d.]+)s;--d:-[\d.]+s;--ox:([\d.]+)px;--oy:([\d.]+)px"/);
    expect(Number(arm![1])).toBeGreaterThanOrEqual(5);
    // The joint lies inside the half, in the left part where the excavator stands.
    expect(Number(arm![2])).toBeGreaterThan(400);
    expect(Number(arm![2])).toBeLessThan(600);
    expect(Number(arm![3])).toBeGreaterThan(0);
    expect(Number(arm![3])).toBeLessThan(450);
    expect(construction.css).toMatch(/\.fb-construction-arm \{[^}]*transform-box: view-box; transform-origin: var\(--ox\) var\(--oy\);/);
  });
  it('puts pallets first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, construction.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 30 bricks', () => {
    expect(construction.capacity).toBe(30);
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('keeps the scenery wobble when a brick is added', () => {
    expect(beforeItems(half(8))).toBe(beforeItems(half(7)));
  });
  it('uses the kid colour on the excavator', () => {
    const out = half(0);
    expect(out.slice(out.indexOf('data-part="excavator"'))).toContain('#d9534f');
  });
  it('fits a narrow half', () => {
    const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
    expect(coordsOutside(construction.renderHalf(contractCtx(construction, 4321, undefined, narrow)), narrow)).toEqual([]);
  });
});

describe('construction item layout', () => {
  const { overlapping, area, size, onScenery } = layout(footprint);

  it('has a spot for as many big items as the grouping can ask for', () => {
    expect(spots(construction.capacity, 0)).toHaveLength(construction.capacity);
  });

  it('lays the bricks in running bond from the bottom left, five to a row', () => {
    const bricks = spots(0, 10);
    expect(bricks[0].x).toBe(Math.min(...bricks.map((s) => s.x)));
    expect(bricks[0].y).toBe(Math.max(...bricks.map((s) => s.y)));
    const pitch = bricks[1].x - bricks[0].x; // a brick and its joint
    for (let i = 0; i < 5; i++) {
      expect(bricks[i].y).toBe(bricks[0].y);
      expect(bricks[i + 5].y).toBeLessThan(bricks[0].y);
      expect(bricks[i + 5].x - bricks[i].x).toBeCloseTo(pitch / 2); // every second row offset by half a brick
    }
  });
  const small = () => area(spots(0, 1)[0]);
  const pallets = () => spots(construction.capacity, 0);

  it('makes the first five pallets big, at least four times a brick\'s area, in one row in front', () => {
    const five = pallets().slice(0, 5);
    for (const s of five) expect(area(s)).toBeGreaterThanOrEqual(4 * small());
    expect(new Set(five.map((s) => s.y)).size).toBe(1);
    expect(five[0].y).toBe(Math.max(...pallets().map((s) => s.y)));
  });
  it('keeps every pallet at least twice a brick\'s area', () => {
    for (const s of pallets()) expect(area(s)).toBeGreaterThanOrEqual(2 * small());
  });
  it('gives pallets 6 to 30 one medium size, clearly smaller than the first five', () => {
    const rest = pallets().slice(5);
    expect(rest).toHaveLength(25);
    for (const s of rest) expect(size(s)).toEqual(size(rest[0]));
    expect(area(pallets()[0])).toBeGreaterThan(2 * area(rest[0]));
  });
  it('lays the medium pallets in a row of ten in front, then in rows of five where the wall would rise', () => {
    const rows = new Map<number, number>();
    for (const s of pallets().slice(5)) rows.set(s.y, (rows.get(s.y) ?? 0) + 1);
    expect([...rows.values()]).toEqual([10, 5, 5, 5]);
  });
  it('keeps every pallet inside the site units, below the horizon', () => {
    for (const s of pallets()) {
      const [l, t, r, b] = footprint(s);
      expect(l >= 0 && r <= 320 && t >= 100 && b <= 260, `pallet at ${s.x},${s.y}`).toBe(true);
    }
  });
  it('keeps every pallet clear of the excavator, the heap, the foundation and the barrier (the bricks rest on the foundation)', () => {
    const scenery: Record<string, Footprint> = {
      excavator: [44, 104, 150, 186], heap: [2, 152, 58, 188], foundation: [170, 186, 316.5, 191],
      barrier: [182, 62, 280, 100], cone: [290, 78, 314, 102],
    };
    for (const { big, small } of mixes(construction.capacity)) expect(onScenery(spots(big, small).filter((s) => s.kind === 'big'), scenery), `${big} big, ${small} small`).toEqual([]);
  });
  it('never moves or resizes an item when one is added', () => {
    expect(movedItems(spots, footprint, construction.capacity)).toEqual([]);
  });
  it('draws no two items on top of each other at any total up to 1000', () => {
    for (const { big, small, points } of mixes(construction.capacity)) {
      const list = spots(big, small);
      expect(list, `${points} points`).toHaveLength(big + small);
      expect(overlapping(list), `${points} points`).toEqual([]);
    }
  });
});
