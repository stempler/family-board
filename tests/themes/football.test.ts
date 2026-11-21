import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/draw/jar';
import { groupItems } from '../../src/items';
import { footprint, SHOT_FROM, SHOT_R, spots } from '../../src/themes/football';
import { THEMES } from '../../src/themes/registry';
import { type Footprint, GAP, layout, mixes, movedItems } from './layout';
import { beforeItems, contractCtx, coordsOutside, runThemeContract } from './theme-contract';

const football = THEMES.football;

runThemeContract(football);

const half = (points: number) => football.renderHalf(contractCtx(football, points));
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe('football half', () => {
  it('has a pitch, a goal, a corner flag and a shot ball', () => {
    const out = half(7);
    for (const name of ['pitch', 'goal', 'flag', 'shot']) expect(out).toContain(`data-part="${name}"`);
  });
  it('shoots one ball and waves the corner flag', () => {
    for (const points of [0, 7, 1000]) {
      const out = half(points);
      expect(count(out, /fb-anim fb-football-shot/g)).toBe(1);
      expect(count(out, /fb-anim fb-football-flag/g)).toBe(1);
    }
  });
  it('shoots the ball in a 10 to 14 s cycle and leaves it in the net most of the time', () => {
    const shot = half(7).match(/class="fb-anim fb-football-shot" style="--t:([\d.]+)s/);
    expect(Number(shot![1])).toBeGreaterThanOrEqual(10);
    expect(Number(shot![1])).toBeLessThanOrEqual(14);
    // The ball's resting place (no transform) is in the net; the keyframes hold it there from `from` to `to`.
    const rest = football.css!.match(/@keyframes fb-football-shot \{[^]*?([\d.]+)%, ([\d.]+)% \{ transform: translate\(0, 0\)/);
    expect(Number(rest![1])).toBeLessThanOrEqual(20);
    expect(Number(rest![2])).toBeGreaterThanOrEqual(90);
  });
  it('draws the shot ball in the kid colour, unlike the counted balls', () => {
    for (const points of [7, 37]) {
      const out = half(points);
      const shot = out.slice(out.indexOf('data-part="shot"'), out.indexOf('data-part="flag"'));
      expect(shot).toContain('#d9534f');
      const items = out.slice(out.indexOf('<g class="fb-item'));
      expect(items).toContain('data-item="small"');
      expect(items).not.toContain('#d9534f');
    }
  });
  it('puts trophies first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, football.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('holds 30 balls', () => {
    expect(football.capacity).toBe(30);
    expect(count(half(30), /data-item="small"/g)).toBe(30);
  });
  it('keeps the scenery wobble when a ball is added', () => {
    expect(beforeItems(half(8))).toBe(beforeItems(half(7)));
  });
  it('uses the kid colour on the corner flag', () => {
    const out = half(0);
    expect(out.slice(out.indexOf('data-part="flag"'))).toContain('#d9534f');
  });
  it('fits a narrow half', () => {
    const narrow: Box = { x: 160, y: 0, w: 160, h: 450 };
    expect(coordsOutside(football.renderHalf(contractCtx(football, 4321, undefined, narrow)), narrow)).toEqual([]);
  });
});

describe('football item layout', () => {
  const { overlapping, area, size, onScenery } = layout(footprint);

  it('has a spot for as many big items as the grouping can ask for', () => {
    expect(spots(football.capacity, 0)).toHaveLength(football.capacity);
  });

  const small = () => area(spots(0, 1)[0]);
  const trophies = () => spots(football.capacity, 0);

  it('makes the first five trophies big, at least four times a ball\'s area, in one row in front', () => {
    const five = trophies().slice(0, 5);
    for (const s of five) expect(area(s)).toBeGreaterThanOrEqual(4 * small());
    expect(new Set(five.map((s) => s.y)).size).toBe(1);
    expect(five[0].y).toBe(Math.max(...trophies().map((s) => s.y)));
  });
  it('keeps every trophy at least twice a ball\'s area', () => {
    for (const s of trophies()) expect(area(s)).toBeGreaterThanOrEqual(2 * small());
  });
  it('gives trophies 6 to 30 one medium size, clearly smaller than the first five', () => {
    const rest = trophies().slice(5);
    expect(rest).toHaveLength(25);
    for (const s of rest) {
      expect(size(s).w).toBeCloseTo(size(rest[0]).w, 9);
      expect(size(s).h).toBeCloseTo(size(rest[0]).h, 9);
    }
    expect(area(trophies()[0])).toBeGreaterThan(2 * area(rest[0]));
  });
  it('lays the medium trophies in rows of ten and five', () => {
    const rows = new Map<number, number>();
    for (const s of trophies().slice(5)) rows.set(s.y, (rows.get(s.y) ?? 0) + 1);
    expect([...rows.values()]).toEqual([10, 10, 5]);
  });
  it('kicks the shot ball off clear of every item', () => {
    const [x, y] = SHOT_FROM;
    for (const s of [...trophies(), ...spots(0, football.capacity)]) {
      const [l, t, r, b] = footprint(s);
      expect(l >= x + SHOT_R + GAP || x - SHOT_R >= r + GAP || t >= y + SHOT_R + GAP || y - SHOT_R >= b + GAP, `${s.kind} at ${s.x},${s.y}`).toBe(true);
    }
  });
  it('keeps every item inside the pitch units', () => {
    for (const s of [...trophies(), ...spots(0, football.capacity)]) {
      const [l, t, r, b] = footprint(s);
      expect(l >= 0 && r <= 320 && t >= 0 && b <= 260, `${s.kind} at ${s.x},${s.y}`).toBe(true);
    }
  });
  it('keeps every item clear of the goal, the corner flag and the lines', () => {
    const scenery: Record<string, Footprint> = {
      goal: [11, 110, 149, 192], flag: [282, 11, 308, 50], touchline: [-2, 48.5, 312, 51.5], goalLine: [-2, 190.5, 160, 193.5],
    };
    for (const { big, small } of mixes(football.capacity)) expect(onScenery(spots(big, small), scenery), `${big} big, ${small} small`).toEqual([]);
  });
  it('never moves or resizes an item when one is added', () => {
    expect(movedItems(spots, footprint, football.capacity)).toEqual([]);
  });
  it('draws no two items on top of each other at any total up to 1000', () => {
    for (const { big, small, points } of mixes(football.capacity)) {
      const list = spots(big, small);
      expect(list, `${points} points`).toHaveLength(big + small);
      expect(overlapping(list), `${points} points`).toEqual([]);
    }
  });
});
