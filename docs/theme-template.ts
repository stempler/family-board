// Template for a new theme. Copy to src/themes/<id>.ts and follow the checklist in README.md ("Adding a theme").
//
// 1. Placeholder: in the code the id is `template` (so this file typechecks and runs the theme contract);
//    replace every `template` (the id, the `fb-template-` css/class prefix, the exported const) with your
//    id. Comments write the placeholder as `<id>`.
// 2. Imports: they are written for docs/. Once the file is in src/themes/<id>.ts use
//      import { timing } from '../draw/anim';
//      import { createSketch, num, type Sketch } from '../draw/sketch';
//      import { at, placement, type Placement, type Units } from '../draw/units';
//      import { item, type HalfContext, type Theme } from './types';
//      // seasonal themes also:
//      import { seasonKid, seasonPlacement } from '../draw/season';
// 3. Set `label` (German display name) in the theme object.
//
// This file is not registered or bundled; it is typechecked and tests/themes/template.test.ts runs the
// theme contract on it, so it stays in sync with the Theme contract.
//
// The contract (src/themes/types.ts and tests/themes/theme-contract.ts): renderHalf draws one kid's
// scene inside ctx.box (no jars, no header), wraps every counted item with item(), keeps all
// coordinates inside the box and uses only esc/num for text and numbers.
import { timing } from '../src/draw/anim';
import { createSketch, num, type Sketch } from '../src/draw/sketch';
import { at, placement, type Placement, type Units } from '../src/draw/units';
import { item, type HalfContext, type Theme } from '../src/themes/types';

// Draw in your own units (a fixed coordinate system) and let placement() fit them into the scene band.
const UNITS: Units = { mid: 100, top: 0, w: 200, h: 120, fill: 0.92 };
const GROUND = 110;
const CAPACITY = 10; // max drawn items per kid; ctx.groups is already grouped for it (big = 10 small, see src/items.ts)
const SKY = '#dcedf6';
const GRASS = '#8cc66b';
const ITEM = '#f2c12e';

function scenery(sk: Sketch, p: Placement, ctx: HalfContext): string {
  const ground = sk.rect(...at(p, 0, GROUND), UNITS.w * p.s, (UNITS.h - GROUND) * p.s, { fill: GRASS, strokeWidth: 2, roughness: 0.8 });
  // Ambient animation: class "fb-anim fb-<id>-<name>", timing from a seeded key. Never on a fb-item itself.
  const [bx, by] = at(p, 170, 40);
  const blob = `<g class="fb-anim fb-template-bob" style="${timing(`${ctx.seedKey}:bob`, [2.5, 3.5])}">${sk.circle(bx, by, 16 * p.s, { fill: ctx.kid.colour })}</g>`;
  return `<g data-part="ground">${ground}</g><g data-part="blob">${blob}</g>`;
}

function renderHalf(ctx: HalfContext): string {
  const p = placement(ctx.box, UNITS);
  const bg = `<rect x="${num(ctx.box.x)}" y="${num(ctx.box.y)}" width="${num(ctx.box.w)}" height="${num(ctx.box.h)}" fill="${SKY}"/>`;
  const sk = createSketch(ctx.seedKey);
  let out = bg + scenery(sk, p, ctx);
  // Items: big ones first, then small ones. Use a separate sketch for the items and one for scenery drawn
  // after them, so adding an item never re-wobbles the scenery (see the other themes).
  const items = createSketch(`${ctx.seedKey}:items`);
  const { big, small } = ctx.groups;
  for (let i = 0; i < big + small && i < CAPACITY; i++) {
    const kind = i < big ? 'big' : 'small';
    const [x, y] = at(p, 20 + i * 14, GROUND - 6);
    out += item(kind, i, ctx, items.circle(x, y, (kind === 'big' ? 16 : 10) * p.s, { fill: ITEM, strokeWidth: 2 }));
  }
  return out;
}

// Only animation-name/-timing-function and transform-origin/-box here; duration, delay and iteration come
// from the shared .fb-anim rule through --t and --d. Keyframes and classes all start with fb-<id>-.
const css = `
  @keyframes fb-template-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .fb-template-bob { animation-name: fb-template-bob; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
`;

export const template: Theme = {
  id: 'template',
  label: 'Vorlage', // German display name; set your own
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  // renderSeasonScene(halves, box): one object per kid via seasonPlacement() + seasonKid(), see src/themes/christmas.ts.
  css,
};
