import { groupItems } from '../../src/items';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/themes/registry';
import { afterItems, contractBox, contractCtx, runThemeContract } from './theme-contract';

runThemeContract(THEMES.racing);

const racing = THEMES.racing;
const half = (points: number) => racing.renderHalf(contractCtx(racing, points));

/** The markup of the group with data-part="<name>". */
function part(svg: string, name: string): string {
  const open = svg.indexOf(`<g data-part="${name}"`);
  expect(open).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (const m of svg.slice(open).matchAll(/<g[\s>]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(open, open + m.index! + 4);
  }
  throw new Error('unclosed group');
}

describe('racing', () => {
  it('has a shelf, a podium, a track, a chequered flag and a car', () => {
    const out = half(7);
    for (const name of ['shelf', 'podium', 'track', 'flag', 'car']) expect(out).toContain(`data-part="${name}"`);
  });
  it('waves the flag once and spins both hubs in step with the drive', () => {
    const out = half(7);
    expect(out.match(/fb-racing-flag/g) ?? []).toHaveLength(1);
    expect(out).not.toContain('fb-racing-roll');
    expect(out.match(/fb-racing-spin/g) ?? []).toHaveLength(2);
    const timings = [...out.matchAll(/class="fb-anim fb-racing-(?:drive|spin)" style="([^"]*)"/g)].map((m) => m[1].match(/--t:[^;]*;--d:[^;"]*/)![0]);
    expect(timings).toHaveLength(3);
    expect(new Set(timings).size).toBe(1);
  });
  it('never counts the car as an item', () => {
    for (const points of [0, 7, 30]) expect(part(half(points), 'car')).not.toContain('fb-item');
  });
  it('has one drive element with a 7-9 s loop that carries the car fully outside the half', () => {
    const car = part(half(7), 'car');
    expect(car.match(/fb-racing-drive/g) ?? []).toHaveLength(1);
    const style = car.match(/class="fb-anim fb-racing-drive" style="([^"]*)"/)![1];
    const t = parseFloat(style.match(/--t:([\d.]+)s/)![1]);
    expect(t).toBeGreaterThanOrEqual(7);
    expect(t).toBeLessThanOrEqual(9);
    const inPx = parseFloat(style.match(/--in:(-?[\d.]+)px/)![1]);
    const outPx = parseFloat(style.match(/--out:(-?[\d.]+)px/)![1]);
    expect(inPx).toBeLessThan(0);
    expect(outPx).toBeGreaterThan(0);
    // extent of the resting car (tyres and wing included), without the clipPath rect
    const art = car.replace(/<clipPath[\s\S]*?<\/clipPath>/, '');
    const pathXs = [...art.matchAll(/\bd="([^"]*)"/g)].flatMap((m) => [...m[1].matchAll(/-?\d+(?:\.\d+)?/g)].map((n) => parseFloat(n[0])).filter((_, i) => i % 2 === 0));
    const attrXs = [...art.matchAll(/\b(?:c?x|x1|x2)="(-?[\d.]+)"/g)].map((m) => parseFloat(m[1]));
    const xs = [...pathXs, ...attrXs];
    expect(pathXs.length).toBeGreaterThan(0);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(contractBox.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(contractBox.x + contractBox.w);
    expect(Math.max(...xs) + inPx).toBeLessThan(contractBox.x);
    expect(Math.min(...xs) + outPx).toBeGreaterThan(contractBox.x + contractBox.w);
  });
  it('clips the car to the half with a clipPath referenced by an ancestor of the drive group', () => {
    const out = half(7);
    const id = out.match(/<clipPath id="(fb-racing-clip-[\w-]+)"><rect x="400" y="0" width="400" height="450"\/>/)![1];
    const car = part(out, 'car');
    expect(car.indexOf(`clip-path="url(#${id})"`)).toBeGreaterThan(0);
    expect(car.indexOf(`clip-path="url(#${id})"`)).toBeLessThan(car.indexOf('fb-racing-drive'));
    expect(car).not.toMatch(/class="fb-anim fb-racing-drive"[^>]*clip-path/);
  });
  it('gives each kid its own drive offset and a unique clip id', () => {
    const a = racing.renderHalf(contractCtx(racing, 7, 7, contractBox, 'k1'));
    const b = racing.renderHalf(contractCtx(racing, 7, 7, contractBox, 'k2'));
    const d = (s: string) => s.match(/fb-racing-drive" style="[^"]*--d:(-[\d.]+)s/)![1];
    expect(d(a)).not.toBe(d(b));
    expect(a.match(/clipPath id="([^"]+)"/)![1]).not.toBe(b.match(/clipPath id="([^"]+)"/)![1]);
  });
  it('drives in and out quickly, stops a while and keeps the wheels still while stopped', () => {
    const frames = (name: string) => racing.css!.split(`@keyframes ${name} {`)[1].split('\n  }')[0];
    const drive = frames('fb-racing-drive');
    const spin = frames('fb-racing-spin');
    const [, inEnd, stopEnd] = drive.match(/(\d+)%, (\d+)% \{ transform: translateX\(0\)/)!.map(Number);
    expect(spin).toContain(`${inEnd}%, ${stopEnd}% {`); // the wheels hold exactly while the car stands
    expect(inEnd).toBeLessThanOrEqual(20); // driving in takes at most a fifth of the 7-9 s loop
    expect(stopEnd - inEnd).toBeGreaterThanOrEqual(30); // and it stands at the finish line for a good while
    const outEnd = Number(drive.match(/(\d+)%, 100% \{ transform: translateX\(var\(--out\)\)/)![1]);
    expect(outEnd - stopEnd).toBeLessThanOrEqual(20);
  });

  it('defines the drive keyframes', () => {
    expect(racing.css).toContain('@keyframes fb-racing-drive');
  });
  it('puts trophies first', () => {
    const kinds = [...half(37).matchAll(/data-item="(small|big)"/g)].map((m) => m[1]);
    const g = groupItems(37, racing.capacity);
    expect(kinds).toEqual([...Array(g.big).fill('big'), ...Array(g.small).fill('small')]);
  });
  it('hangs medals on ribbons in the kid colour', () => {
    const fills = (points: number) => (half(points).match(/fill="#d9534f"/g) ?? []).length;
    expect(fills(3) - fills(0)).toBeGreaterThanOrEqual(3);
  });
  it('keeps the scenery wobble when a medal is added', () => {
    expect(afterItems(half(8))).toBe(afterItems(half(7)));
  });
});
