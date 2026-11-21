import { timing } from '../draw/anim';
import type { Box } from '../draw/jar';
import { seasonKid, seasonPlacement } from '../draw/season';
import { createSketch, INK, num, type Sketch } from '../draw/sketch';
import { at, placement, type Placement, type Pt, type Units } from '../draw/units';
import { item, type HalfContext, type Theme } from './types';

// A spring meadow, drawn in "meadow units": a woven basket stands in the middle (rim x 70..230 at
// y 142, around the centre x 150) with a bow in the kid colour on its front. Painted eggs heap up in
// rows over the basket's rim, inside the handle's arch; every egg has its own slot and no two eggs
// touch, so they stay countable. Chocolate bunnies sit on the grass beside and in front of the
// basket, each in its own spot, so adding a bunny never moves an egg and adding an egg never moves a
// bunny. A real bunny sits at the far meadow edge and butterflies flutter about. The ground line is y 240.
const MID = 150;
const HALF_W = 150;
const TOP = 0;
const UNITS_H = 240;
/** The scene takes at most 47% of the width it stands in. */
const UNITS: Units = { mid: MID, top: TOP, w: HALF_W, h: UNITS_H, fill: 0.47 };
const HORIZON = 150;

const SKY = '#d4ecfb';
const MEADOW = '#9fd26f';
const SUN = '#ffe066';
const WICKER = '#d9a35f';
const WICKER_DARK = '#a8733a';
const RIM = '#c48a48';
const CHOC = '#7a4b2a';
const CHOC_LIGHT = '#9a6a44';
const FOIL = '#f2c94c';
const FUR = '#f6f3ee';
const PINK = '#f7a8b8';
const PASTEL = ['#f9c6d3', '#c9e4f6', '#fff2a8', '#cdeccb', '#e2d1f4', '#ffd8b0'];
const ACCENT = ['#e0607e', '#4a90c8', '#e0a800', '#4caf50', '#9b6dd6', '#f08a3c'];
const PATTERNS = ['stripes', 'dots', 'zigzag'] as const;
const WINGS = ['#f7a8c8', '#ffd23f', '#9fd3f2'];

const EGG_RX = 8;
const EGG_RY = 11;
const BUNNY = 0.58; // chocolate bunny scale: 17 x 38 units, a little taller than an egg

/** Rows of `n` egg slots centred on the basket, `dx` apart. */
function row(n: number, y: number, dx = 22): Pt[] {
  return Array.from({ length: n }, (_, i) => [MID + (i - (n - 1) / 2) * dx, y] as Pt);
}

/** Egg slots: a heap of staggered rows over the basket's rim, bottom row first, inside the handle's arch. */
const EGG_SLOTS: Pt[] = [...row(6, 130), ...row(5, 105), ...row(4, 80), ...row(3, 55), ...row(2, 30)];

const CAPACITY = EGG_SLOTS.length; // 20

/**
 * Chocolate bunny spots (base points), one per possible bunny and apart from every egg slot: the front
 * row on each side (nearest the basket first), then a row in front of the basket (centre outwards),
 * then a row further back on each side.
 */
const BUNNIES: Pt[] = [
  [54, 240], [246, 240], [33, 240], [267, 240], [12, 240], [288, 240],
  [140, 240], [160, 240], [120, 240], [180, 240], [100, 240], [200, 240], [80, 240], [220, 240],
  [54, 198], [246, 198], [33, 198], [267, 198], [12, 198], [288, 198],
];

export interface Spot { kind: 'big' | 'small'; x: number; y: number; slot: number } // meadow units; a bunny's y is its base

/** Where the items go: bunny `i` always on bunny spot `i`, egg `j` always on egg slot `j`. */
export function spots(big: number, small: number): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < Math.min(big, BUNNIES.length); i++) out.push({ kind: 'big', x: BUNNIES[i][0], y: BUNNIES[i][1], slot: i });
  const eggs = Math.min(small, CAPACITY - out.length);
  for (let j = 0; j < eggs; j++) out.push({ kind: 'small', x: EGG_SLOTS[j][0], y: EGG_SLOTS[j][1], slot: j });
  return out;
}

/** The box a drawn item covers, in meadow units: [left, top, right, bottom]. */
export function footprint(s: Spot): [number, number, number, number] {
  if (s.kind === 'big') return [s.x - 15 * BUNNY, s.y - 65 * BUNNY, s.x + 15 * BUNNY, s.y];
  return [s.x - EGG_RX, s.y - EGG_RY, s.x + EGG_RX, s.y + EGG_RY];
}

/** Half the width of an ellipse (rx, ry) at `dy` from its centre, pulled in a little so patterns stay inside the outline. */
const chord = (rx: number, ry: number, dy: number) => rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) * 0.82;

/** A painted egg centred at (x, y); the slot index picks its pastel colour and its pattern (stripes, dots or zigzag). */
function egg(sk: Sketch, x: number, y: number, rx: number, ry: number, slot: number): string {
  const kind = PATTERNS[slot % PATTERNS.length];
  const accent = ACCENT[(slot + 2) % ACCENT.length];
  const body = sk.ellipse(x, y, rx * 2, ry * 2, { fill: PASTEL[slot % PASTEL.length], strokeWidth: 1.6, roughness: 0.5 });
  const w = num(Math.max(1.2, ry * 0.16));
  let pattern = '';
  if (kind === 'stripes') {
    for (const dy of [-0.35, 0.3]) {
      const c = chord(rx, ry, dy * ry);
      pattern += `<line x1="${num(x - c)}" y1="${num(y + dy * ry)}" x2="${num(x + c)}" y2="${num(y + dy * ry)}" stroke="${accent}" stroke-width="${w}" stroke-linecap="round"/>`;
    }
  } else if (kind === 'dots') {
    for (const [dx, dy] of [[0, -0.55], [-0.42, -0.1], [0.42, -0.1], [0, 0.25], [-0.3, 0.6], [0.3, 0.6]]) {
      pattern += `<circle cx="${num(x + dx * rx)}" cy="${num(y + dy * ry)}" r="${num(rx * 0.16)}" fill="${accent}"/>`;
    }
  } else {
    const c = chord(rx, ry, 0.25 * ry);
    const teeth = 6;
    const pts = Array.from({ length: teeth + 1 }, (_, i) => `${num(x - c + (2 * c * i) / teeth)},${num(y + (i % 2 ? -0.2 : 0.2) * ry)}`);
    pattern = `<polyline points="${pts.join(' ')}" fill="none" stroke="${accent}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const shine = `<ellipse cx="${num(x - rx * 0.4)}" cy="${num(y - ry * 0.45)}" rx="${num(rx * 0.16)}" ry="${num(ry * 0.14)}" fill="#fff" opacity="0.8"/>`;
  return `<g data-egg="${kind}" data-at="${num(x)},${num(y)},${num(rx)},${num(ry)}">${body}${pattern}${shine}</g>`;
}

/** A chocolate bunny sitting on (x, base), `k` px per unit: brown, with a gold foil bow at its neck. */
function chocBunny(sk: Sketch, x: number, base: number, k: number): string {
  const ear = (d: number) => sk.ellipse(x + d * 5 * k, base - 52 * k, 8 * k, 26 * k, { fill: CHOC, strokeWidth: 1.4, roughness: 0.5 });
  const body = sk.ellipse(x, base - 15 * k, 30 * k, 30 * k, { fill: CHOC, strokeWidth: 1.8, roughness: 0.6 });
  const head = sk.circle(x, base - 36 * k, 22 * k, { fill: CHOC, strokeWidth: 1.6, roughness: 0.5 });
  const muzzle = `<ellipse cx="${num(x)}" cy="${num(base - 32 * k)}" rx="${num(5 * k)}" ry="${num(3.5 * k)}" fill="${CHOC_LIGHT}"/>`;
  const eye = (d: number) => `<circle cx="${num(x + d * 4.5 * k)}" cy="${num(base - 39 * k)}" r="${num(1.6 * k)}" fill="#fff"/>`;
  const by = base - 26 * k;
  const bow = `<polygon points="${num(x)},${num(by)} ${num(x - 7 * k)},${num(by - 4 * k)} ${num(x - 7 * k)},${num(by + 4 * k)}" fill="${FOIL}" stroke="${INK}" stroke-width="0.8"/>` +
    `<polygon points="${num(x)},${num(by)} ${num(x + 7 * k)},${num(by - 4 * k)} ${num(x + 7 * k)},${num(by + 4 * k)}" fill="${FOIL}" stroke="${INK}" stroke-width="0.8"/>`;
  return ear(-1) + ear(1) + body + head + muzzle + eye(-1) + eye(1) + bow;
}

/** Bunnies first, then eggs, each on its own fixed spot. Eggs use their own sketch, so adding a bunny never re-wobbles an egg. */
function items(sk: Sketch, eggs: Sketch, p: Placement, ctx: HalfContext): string {
  return spots(ctx.groups.big, ctx.groups.small).map((s, i) => {
    const [x, y] = at(p, s.x, s.y);
    if (s.kind === 'big') return item('big', i, ctx, chocBunny(sk, x, y, BUNNY * p.s));
    return item('small', i, ctx, egg(eggs, x, y, EGG_RX * p.s, EGG_RY * p.s, s.slot));
  }).join('');
}

/** The woven basket with its handle and a bow in the kid colour on its front; the eggs are drawn on top of it afterwards. */
function basket(sk: Sketch, p: Placement, colour: string): string {
  const u = (x: number, y: number) => at(p, x, y).map(num).join(' ');
  const side = (y: number): [number, number] => {
    const t = (y - 142) / 72; // the sides slope in from the rim (x 70..230) to the bottom (x 88..212)
    return [70 + 18 * t, 230 - 18 * t];
  };
  // The arch reaches up to about y 13, just over the top of a full egg heap, so the heap stays inside it.
  const handle = sk.path(`M ${u(80, 142)} C ${u(80, -30)} ${u(220, -30)} ${u(220, 142)}`, { stroke: WICKER_DARK, strokeWidth: 7 * p.s, roughness: 0.5 });
  const body = sk.polygon([at(p, 70, 142), at(p, 230, 142), at(p, 212, 214), at(p, 88, 214)], { fill: WICKER, strokeWidth: 2.4, roughness: 0.8 });
  let weave = '';
  for (const y of [162, 182, 202]) {
    const [l, r] = side(y);
    weave += `M ${u(l + 2, y)} L ${u(r - 2, y)} `;
  }
  for (let i = 0; i < 3; i++) {
    const y0 = 146 + i * 20;
    const [l, r] = side(y0 + 10);
    for (let x = l + 8 + (i % 2) * 8; x < r - 6; x += 16) weave += `M ${u(x, y0 + 4)} L ${u(x, y0 + 13)} `;
  }
  const lines = `<path d="${weave.trim()}" stroke="${WICKER_DARK}" stroke-width="${num(1.6 * p.s)}" stroke-linecap="round" fill="none"/>`;
  const rim = sk.ellipse(...at(p, MID, 142), 168 * p.s, 16 * p.s, { fill: RIM, strokeWidth: 2, roughness: 0.6 });
  const [bx, by] = at(p, MID, 178);
  const b = 16 * p.s;
  const loop = (d: number) => sk.polygon([[bx, by], [bx + d * b * 1.5, by - b * 0.75], [bx + d * b * 1.5, by + b * 0.75]], { fill: colour, strokeWidth: 1.6, roughness: 0.5 });
  const tail = (d: number) => sk.polygon([[bx, by], [bx + d * b * 0.9, by + b * 1.4], [bx + d * b * 0.4, by + b * 1.5]], { fill: colour, strokeWidth: 1.4, roughness: 0.5 });
  const knot = sk.circle(bx, by, b * 0.7, { fill: colour, strokeWidth: 1.6, roughness: 0.4 });
  return `<g data-part="basket">${handle}${body}${lines}${rim}${tail(-1)}${tail(1)}${loop(-1)}${loop(1)}${knot}</g>`;
}

function sun(sk: Sketch, x: number, y: number, r: number): string {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rays += `M ${num(x + Math.cos(a) * r * 1.3)} ${num(y + Math.sin(a) * r * 1.3)} L ${num(x + Math.cos(a) * r * 1.65)} ${num(y + Math.sin(a) * r * 1.65)} `;
  }
  const body = sk.circle(x, y, 2 * r, { fill: SUN, strokeWidth: 2, roughness: 0.6 });
  return `<g data-part="sun"><path d="${rays.trim()}" stroke="#f2b705" stroke-width="${num(Math.max(1.5, r * 0.14))}" stroke-linecap="round" fill="none"/>${body}</g>`;
}

const meadowPart = (sk: Sketch, d: string) => `<g data-part="meadow">${sk.path(d, { fill: MEADOW, strokeWidth: 2, roughness: 1 })}</g>`;

/** The season meadow: a gentle green hill with its top edge at `top`; its sides and bottom run past the board edge, so only its top outline shows. */
function meadowWide(sk: Sketch, box: Box, top: number): string {
  const o = 12;
  const x0 = box.x - o;
  const x1 = box.x + box.w + o;
  const bottom = box.y + box.h + o;
  return meadowPart(sk, `M ${num(x0)} ${num(bottom)} L ${num(x0)} ${num(top + 6)} Q ${num(box.x + box.w / 2)} ${num(top - 12)} ${num(x1)} ${num(top + 3)} L ${num(x1)} ${num(bottom)} Z`);
}

/** A half's meadow: a rounded mound from x0 to x1, flat on top at `top`, its round ends staying inside the half (no panel edges). */
function meadowMound(sk: Sketch, x0: number, x1: number, top: number, bottom: number): string {
  const w = x1 - x0;
  const ym = (top + bottom) / 2;
  const mid = (x0 + x1) / 2;
  const [a, b] = [w * 0.1, w * 0.28]; // how far in the round ends reach
  const d = `M ${num(x0)} ${num(ym)} C ${num(x0)} ${num(top + 2)} ${num(x0 + a)} ${num(top)} ${num(x0 + b)} ${num(top)} ` +
    `Q ${num(mid)} ${num(top - 8)} ${num(x1 - b)} ${num(top)} C ${num(x1 - a)} ${num(top)} ${num(x1)} ${num(top + 2)} ${num(x1)} ${num(ym)} ` +
    `C ${num(x1)} ${num(bottom)} ${num(x1 - a)} ${num(bottom)} ${num(x1 - b)} ${num(bottom)} L ${num(x0 + b)} ${num(bottom)} ` +
    `C ${num(x0 + a)} ${num(bottom)} ${num(x0)} ${num(bottom)} ${num(x0)} ${num(ym)} Z`;
  return meadowPart(sk, d);
}

const PETALS = ['#ffffff', '#fff2a8', '#f7a8c8', '#c9b6f2'];

/** Flowers at the given spots, `r` px petal size: daisies and tulips in turn. */
function flowers(spots: Pt[], r: number): string {
  let out = '';
  spots.forEach(([x, y], i) => {
    const colour = PETALS[i % PETALS.length];
    const stem = `<line x1="${num(x)}" y1="${num(y)}" x2="${num(x)}" y2="${num(y + r * 2.6)}" stroke="#4f8a2b" stroke-width="${num(Math.max(1, r * 0.35))}" stroke-linecap="round"/>`;
    if (i % 2 === 0) {
      let petals = '';
      for (let k = 0; k < 5; k++) {
        const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
        petals += `<circle cx="${num(x + Math.cos(a) * r)}" cy="${num(y + Math.sin(a) * r)}" r="${num(r * 0.62)}" fill="${colour}" stroke="${INK}" stroke-width="0.6"/>`;
      }
      out += `${stem}${petals}<circle cx="${num(x)}" cy="${num(y)}" r="${num(r * 0.5)}" fill="#f2b705"/>`;
    } else {
      const tulip = `M ${num(x - r)} ${num(y - r)} L ${num(x - r * 0.5)} ${num(y - r * 0.4)} L ${num(x)} ${num(y - r * 1.1)} L ${num(x + r * 0.5)} ${num(y - r * 0.4)} L ${num(x + r)} ${num(y - r)} Q ${num(x + r)} ${num(y + r)} ${num(x)} ${num(y + r)} Q ${num(x - r)} ${num(y + r)} ${num(x - r)} ${num(y - r)} Z`;
      out += `${stem}<path d="${tulip}" fill="${PINK}" stroke="${INK}" stroke-width="0.7"/>`;
    }
  });
  return `<g data-part="flowers">${out}</g>`;
}

/** The real bunny sitting at the meadow edge on (x, base), `k` px per unit: its ears twitch now and then and it hops in place once in a while. */
function bunny(sk: Sketch, x: number, base: number, k: number, key: string): string {
  const ear = (d: number) => sk.ellipse(x + d * 6 * k, base - 54 * k, 9 * k, 26 * k, { fill: FUR, strokeWidth: 1.5, roughness: 0.5 }) +
    `<ellipse cx="${num(x + d * 6 * k)}" cy="${num(base - 53 * k)}" rx="${num(2.2 * k)}" ry="${num(9 * k)}" fill="${PINK}"/>`;
  const ears = `<g class="fb-anim fb-easter-ears" style="${timing(`${key}:ears`, [6.5, 7.5])}">${ear(-1)}${ear(1)}</g>`;
  const body = sk.ellipse(x, base - 15 * k, 32 * k, 30 * k, { fill: FUR, strokeWidth: 1.8, roughness: 0.6 });
  const feet = sk.ellipse(x - 9 * k, base - 2 * k, 12 * k, 6 * k, { fill: FUR, strokeWidth: 1.2, roughness: 0.4 }) +
    sk.ellipse(x + 9 * k, base - 2 * k, 12 * k, 6 * k, { fill: FUR, strokeWidth: 1.2, roughness: 0.4 });
  const head = sk.circle(x, base - 36 * k, 24 * k, { fill: FUR, strokeWidth: 1.6, roughness: 0.5 });
  const eye = (d: number) => `<circle cx="${num(x + d * 4.5 * k)}" cy="${num(base - 39 * k)}" r="${num(1.7 * k)}" fill="${INK}"/>`;
  const cheek = (d: number) => `<ellipse cx="${num(x + d * 7 * k)}" cy="${num(base - 33 * k)}" rx="${num(2.6 * k)}" ry="${num(1.6 * k)}" fill="${PINK}"/>`;
  const nose = `<circle cx="${num(x)}" cy="${num(base - 34.5 * k)}" r="${num(1.5 * k)}" fill="#e0607e"/>`;
  return `<g data-part="bunny"><g class="fb-anim fb-easter-hop" style="${timing(`${key}:hop`, [14, 16])}">${ears}${body}${feet}${head}${eye(-1)}${eye(1)}${cheek(-1)}${cheek(1)}${nose}</g></g>`;
}

/** A butterfly, `w` wide, resting at (x, y): it flutters along a short loop, slowly, flapping its wings. */
function butterfly(x: number, y: number, w: number, colour: string, key: string): string {
  const r = w / 4;
  const wing = (d: number) => `<ellipse cx="${num(x + d * r)}" cy="${num(y - r * 0.45)}" rx="${num(r)}" ry="${num(r * 0.8)}" fill="${colour}" stroke="${INK}" stroke-width="0.8"/>` +
    `<ellipse cx="${num(x + d * r * 0.75)}" cy="${num(y + r * 0.55)}" rx="${num(r * 0.7)}" ry="${num(r * 0.6)}" fill="${colour}" stroke="${INK}" stroke-width="0.8"/>`;
  const body = `<ellipse cx="${num(x)}" cy="${num(y)}" rx="${num(r * 0.18)}" ry="${num(r * 1.1)}" fill="${INK}"/>`;
  const flap = `<g class="fb-anim fb-easter-flap" style="${timing(`${key}:flap`, [2.2, 3])}">${wing(-1)}${wing(1)}${body}</g>`;
  return `<g data-part="butterfly"><g class="fb-anim fb-easter-fly" style="${timing(`${key}:fly`, [11, 14])}">${flap}</g></g>`;
}

/** Flower spots on the meadow in meadow units, kept off the basket and the chocolate bunnies. */
const HALF_FLOWERS: Pt[] = [[8, 158], [34, 155], [76, 224], [224, 224], [238, 156], [294, 160]];

function renderHalf(ctx: HalfContext): string {
  const { box } = ctx;
  const sk = createSketch(ctx.seedKey);
  const late = createSketch(`${ctx.seedKey}:late`);
  const p = placement(box, UNITS);
  const [, top] = at(p, MID, HORIZON);
  const [, bottom] = at(p, MID, 244);
  const back = sun(sk, ...at(p, 34, 28), 15 * p.s) + meadowMound(sk, box.x + 6, box.x + box.w - 6, top, bottom) +
    flowers(HALF_FLOWERS.map(([x, y]) => at(p, x, y)), 4.5 * p.s);
  const front = bunny(late, ...at(p, 268, 152), 0.9 * p.s, ctx.seedKey) +
    butterfly(...at(p, 22, 92), 26 * p.s, WINGS[0], `${ctx.seedKey}:b0`) +
    butterfly(...at(p, 236, 52), 26 * p.s, WINGS[1], `${ctx.seedKey}:b1`);
  return `<g>${back}${basket(sk, p, ctx.kid.colour)}${items(sk, createSketch(`${ctx.seedKey}:eggs`), p, ctx)}${front}</g>`;
}

function renderSeasonScene(halves: HalfContext[], box: Box): string {
  const key = `season:${halves.map((h) => h.seedKey).join('|')}`;
  const sk = createSketch(key);
  const late = createSketch(`${key}:late`);
  const mid = box.x + box.w / 2;
  const top = box.y + box.h * 0.6;
  const sky = `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}" fill="${SKY}"/>`;
  // Flowers only where no basket or chocolate bunny stands: the board edges and either side of the real bunny.
  const spots: Pt[] = [[0.015, 0.66], [0.015, 0.75], [0.445, 0.66], [0.46, 0.75], [0.54, 0.75], [0.555, 0.66], [0.985, 0.66], [0.985, 0.75]];
  const back = sun(sk, mid, box.y + box.h * 0.27, Math.min(26, box.h * 0.06)) + meadowWide(sk, box, top) +
    flowers(spots.map(([fx, fy]) => [box.x + fx * box.w, box.y + fy * box.h] as Pt), Math.min(5, box.h * 0.011));
  const baskets = halves.map((ctx) => {
    const { cx, p } = seasonPlacement(box, ctx.box, UNITS);
    const ksk = createSketch(ctx.seedKey);
    return seasonKid(ctx.kid.id, cx, basket(ksk, p, ctx.kid.colour) + items(ksk, createSketch(`${ctx.seedKey}:eggs`), p, ctx));
  }).join('');
  const k = Math.min(1.1, box.h / 400);
  const front = bunny(late, mid, top + 4, k, key) +
    [[0.12, 0.3], [0.6, 0.42], [0.8, 0.26]].map(([fx, fy], i) => butterfly(box.x + fx * box.w, box.y + fy * box.h, 28 * k, WINGS[i], `${key}:b${i}`)).join('');
  return `<g>${sky}${back}${baskets}${front}</g>`;
}

const css = `
  @keyframes fb-easter-ears {
    0%, 86%, 100% { transform: rotate(0deg); }
    88% { transform: rotate(-10deg); }
    90% { transform: rotate(7deg); }
    92% { transform: rotate(-5deg); }
    94% { transform: rotate(0deg); }
  }
  @keyframes fb-easter-hop {
    0%, 90%, 100% { transform: translate(0, 0); }
    92% { transform: translate(0, -22%); }
    94% { transform: translate(0, 0); }
    96% { transform: translate(0, -12%); }
    98% { transform: translate(0, 0); }
  }
  @keyframes fb-easter-fly {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(110%, -70%); }
    50% { transform: translate(190%, 10%); }
    75% { transform: translate(80%, 60%); }
  }
  @keyframes fb-easter-flap {
    0%, 40%, 100% { transform: scale(1, 1); }
    10%, 30% { transform: scale(0.35, 1); }
    20% { transform: scale(1, 1); }
  }
  .fb-easter-ears { animation-name: fb-easter-ears; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
  .fb-easter-hop { animation-name: fb-easter-hop; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
  .fb-easter-fly { animation-name: fb-easter-fly; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
  .fb-easter-flap { animation-name: fb-easter-flap; animation-timing-function: ease-in-out; transform-box: fill-box; transform-origin: 50% 50%; }
`;

export const easter: Theme = {
  id: 'easter',
  capacity: CAPACITY,
  background: SKY,
  renderHalf,
  renderSeasonScene,
  css,
};
