import type { CardConfig } from './config';
import { drawJar, drawSharedJar, type Box } from './draw/jar';
import { renderIcon } from './draw/icon';
import { esc, INK, num, PAPER, truncate } from './draw/sketch';
import { de } from './i18n';
import { groupItems, newItemRange } from './items';
import type { BoardModel, Kid } from './model';
import { activeSeason, ageOn, ageTurning, isBirthday } from './season';
import { getTheme, THEMES } from './themes/registry';
import type { HalfContext, Theme } from './themes/types';

export interface AreaSize { w: number; h: number }
export interface RenderOptions { date: Date; prevPoints?: Record<string, number>; size?: AreaSize } // prevPoints: kidId -> previous points, drives fb-new; size: the free area the board should fill

export const SCENE_H = 450; // the fixed scene height; the board's width (and, when narrow, its height) follows the free area
const DEFAULT_W = 800;
const MIN_KID_W = 160;
const MIN_W = 400;
const MAX_W = 1600;

/** The picture size for a free area: scene height 450, width from the area's shape within [max(160 x kids, 400), 1600]; narrower areas get a taller picture. */
export function boardSize(size: AreaSize | undefined, kids: number): { w: number; h: number } {
  if (!size || !Number.isFinite(size.w) || !Number.isFinite(size.h) || size.w <= 0 || size.h <= 0) return { w: DEFAULT_W, h: SCENE_H };
  const w = Math.round(SCENE_H * size.w / size.h);
  if (w > MAX_W) return { w: MAX_W, h: SCENE_H };
  const minW = Math.max(MIN_KID_W * kids, MIN_W);
  if (w < minW) return { w: minW, h: Math.round(minW * size.h / size.w) };
  return { w, h: SCENE_H };
}

const FONT = `'Patrick Hand', 'Comic Sans MS', cursive`;

const MARGIN = 14;
const AVATAR = 44;
const AVATAR_Y = 14;
const NAME_Y = 47;
const HINT_Y = 68;
const NAME_SIZE = 30;
const MIN_NAME_SIZE = 12;
const NUMBER_SIZE = 18; // chip text size; the chip (about 23 high) matches the height of the name's letters
const CHIP_SIZES = [NUMBER_SIZE, 14, 11]; // tried in turn when the half is narrow
const MIN_CHARS = 4; // 3 glyphs plus the ellipsis
const NAME_GAP = 20; // space between the name and the chip
const GLYPH_W = 0.55; // average glyph width in em, on the wide side

// Jar row in the bottom ~21% of the board, below every theme's scene band (ends at 0.79h).
const JAR_W = 40;
const JAR_H = 74;
const JAR_Y = 366; // for a scene height of 450; a taller picture centres the row in the extra height
const GAP = 12;
const SHARED_GAP = 34; // clear space around the shared jars so they don't read as part of a kid's row

interface Half { kid: Kid; box: Box; theme: Theme; showNumber: boolean; ctx: HalfContext }

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="${esc(FONT)}"><rect x="0" y="0" width="${w}" height="${h}" fill="${PAPER}"/>${body}</svg>`;
}

function text(x: number, y: number, size: number, content: string, anchor = 'middle', extra = '', fill = INK): string {
  return `<text x="${num(x)}" y="${num(y)}" font-size="${num(size)}" text-anchor="${anchor}" fill="${fill}"${extra}>${esc(content)}</text>`;
}

function avatar(kid: Kid, x: number, index: number): string {
  if (kid.avatarImage) {
    const id = `fb-avatar-${index}`;
    const r = AVATAR / 2;
    return `<clipPath id="${id}"><circle cx="${num(x + r)}" cy="${num(AVATAR_Y + r)}" r="${num(r)}"/></clipPath>` +
      `<image href="${esc(kid.avatarImage)}" x="${num(x)}" y="${AVATAR_Y}" width="${AVATAR}" height="${AVATAR}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
  }
  return renderIcon(kid.avatar, x, AVATAR_Y, AVATAR);
}

/** Relative luminance of a #rgb or #rrggbb colour, or null for anything else. */
function luminance(colour: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? Array.from(m[1], (c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const INK_LUMINANCE = 0.0309; // relative luminance of INK (#3a2f28)

/** Chip text: white on a dark hex colour (better contrast than ink), ink otherwise. */
function chipInk(colour: string): string {
  const l = luminance(colour);
  return l !== null && 1.05 / (l + 0.05) > (l + 0.05) / (INK_LUMINANCE + 0.05) ? '#ffffff' : INK;
}

function header(half: Half, index: number): string {
  const { kid, box } = half;
  const right = box.x + box.w - MARGIN;
  const nameX = box.x + MARGIN + AVATAR + 10;
  const avail = right - nameX;
  const digits = String(Math.floor(kid.points));
  const minName = MIN_CHARS * MIN_NAME_SIZE * GLYPH_W;
  // Chip at the right edge: full size when the shortest name still fits beside it, otherwise smaller and tighter.
  const chipFor = (size: number) => ({ size, gap: size === NUMBER_SIZE ? NAME_GAP : 8, w: digits.length * size * GLYPH_W + size * 0.6 });
  const chip = half.showNumber && kid.found ? (CHIP_SIZES.map(chipFor).find((c) => c.w + c.gap + minName <= avail) ?? chipFor(CHIP_SIZES[CHIP_SIZES.length - 1])) : null;
  const room = avail - (chip ? chip.w + chip.gap : 0);
  // Shrink the name first (estimated width; the real font is narrower), then truncate it, never below 3 glyphs and the ellipsis.
  const maxChars = Math.min(18, Math.max(MIN_CHARS, Math.floor(room / (MIN_NAME_SIZE * GLYPH_W))));
  const shown = truncate(kid.name, maxChars);
  const glyphs = Math.max(1, Array.from(shown).length);
  const nameSize = Math.max(MIN_NAME_SIZE, Math.min(NAME_SIZE, room / (glyphs * GLYPH_W)));
  const name = text(nameX, NAME_Y, nameSize, shown, 'start');
  let points = '';
  if (chip) {
    const h = Math.round(chip.size * 1.3);
    const x = right - chip.w;
    const cy = NAME_Y - nameSize * 0.35; // the middle of the name's letters
    points = `<g data-points="${esc(kid.id)}"><rect x="${num(x)}" y="${num(cy - h / 2)}" width="${num(chip.w)}" height="${num(h)}" rx="8" fill="${esc(kid.colour)}" stroke="${INK}" stroke-width="2"/>` +
      text(x + chip.w / 2, cy + chip.size * 0.35, chip.size, digits, 'middle', ' font-weight="bold"', chipInk(kid.colour)) + '</g>';
  }
  return avatar(kid, box.x + MARGIN, index) + name + points;
}

/** How many shared jars fit across the board. */
function sharedFit(total: number, w: number): number {
  return Math.min(total, Math.max(0, Math.floor((w - 2 * MARGIN + GAP) / (JAR_W + GAP))));
}

/** Horizontal span [left, right] of the shared jar row, centred on the board. */
function sharedSpan(total: number, w: number): [number, number] | null {
  const count = sharedFit(total, w);
  if (count === 0) return null;
  const width = count * JAR_W + (count - 1) * GAP;
  return [(w - width) / 2, (w + width) / 2];
}

/** Kid jars left-aligned in the widest part of the half that keeps clear of the shared jars; as many as fit. */
function jarRow(half: Half, shared: [number, number] | null, jarY: number): string {
  const { kid, box } = half;
  const a = box.x + MARGIN;
  const b = box.x + box.w - MARGIN;
  const segments: [number, number][] = shared ? [[a, Math.min(b, shared[0] - SHARED_GAP)], [Math.max(a, shared[1] + SHARED_GAP), b]] : [[a, b]];
  const [left, right] = segments.reduce((best, s) => (s[1] - s[0] > best[1] - best[0] ? s : best));
  const fit = Math.max(0, Math.floor((right - left + GAP) / (JAR_W + GAP)));
  return kid.jars.slice(0, fit).map((jar, i) =>
    drawJar(jar, { x: left + i * (JAR_W + GAP), y: jarY, w: JAR_W, h: JAR_H }, kid.colour, `${kid.id}:jar:${jar.id}`),
  ).join('');
}

function scene(theme: Theme, body: string): string {
  return `<g data-theme="${esc(theme.id)}">${body}</g>`;
}

export function renderBoard(model: BoardModel, config: CardConfig, opts: RenderOptions): string {
  const { w: W, h: H } = boardSize(opts.size, model.kids.length);
  const BOARD: Box = { x: 0, y: 0, w: W, h: SCENE_H };
  if (model.status === 'missing') return svg(W, H, text(W / 2, H / 2, 24, de.missing));
  if (model.kids.length === 0) return svg(W, H, text(W / 2, H / 2, 24, de.noKids));

  const season = activeSeason(opts.date, config.seasons, Object.keys(THEMES));
  const seasonTheme = season ? getTheme(season.theme) : null;
  // TaskMate's birthday mode is the main source; the card's `birthday` is the fallback.
  const birthdayIds = new Set(model.kids.filter((kid) => {
    const birthday = config.kids.find((k) => k.id === kid.id)?.birthday;
    return kid.found && (kid.birthday !== undefined || (birthday !== undefined && isBirthday(birthday, opts.date)));
  }).map((kid) => kid.id));
  // On a birthday the shared scene is not drawn, so the birthday half is not covered by it.
  const seasonal = seasonTheme?.renderSeasonScene && birthdayIds.size === 0 ? seasonTheme : null;

  const hw = W / model.kids.length;
  const halves: Half[] = model.kids.map((kid, i) => {
    const kc = config.kids.find((k) => k.id === kid.id);
    const theme = birthdayIds.has(kid.id) ? THEMES.birthday : seasonal ?? seasonTheme ?? getTheme(kc?.theme ?? '');
    const box: Box = { x: i * hw, y: 0, w: hw, h: SCENE_H };
    const prev = opts.prevPoints?.[kid.id];
    const { newFrom, newTo } = theme.items ? theme.items(kid.points, prev) : newItemRange(prev, kid.points, theme.capacity);
    // TaskMate's age first; on TaskMate's birthday (whatever the card's day) the age the kid turns this year.
    const cardAge = kc?.birthday === undefined ? undefined
      : kid.birthday !== undefined ? ageTurning(kc.birthday, opts.date) : ageOn(kc.birthday, opts.date);
    const age = kid.birthday?.age ?? cardAge;
    const ctx: HalfContext = { kid, box, groups: groupItems(kid.points, theme.capacity), newFrom, newTo, seedKey: `${kid.id}:scene`, ...(age !== undefined ? { age } : {}) };
    return { kid, box, theme, showNumber: kc?.show_number ?? true, ctx };
  });

  const span = sharedSpan(model.sharedJars.length, W);
  const jarY = JAR_Y + (H - SCENE_H) / 2;
  const colours = Object.fromEntries(model.kids.map((k) => [k.id, k.colour]));

  let body = '';
  if (seasonal) {
    // A picture taller than the scene: the season's background fills the band below it.
    if (H > SCENE_H) body += `<rect x="0" y="${SCENE_H}" width="${W}" height="${H - SCENE_H}" fill="${esc(seasonal.background)}"/>`;
    body += scene(seasonal, seasonal.renderSeasonScene!(halves.filter((h) => h.kid.found).map((h) => h.ctx), BOARD));
  }
  body += halves.map((half, i) => {
    const { kid, box, theme } = half;
    let inner = '';
    // Season mode: the shared scene sits below every half, so each half gets a transparent hit target above it.
    inner += seasonal
      ? `<rect x="${num(box.x)}" y="0" width="${num(box.w)}" height="${num(H)}" fill="transparent" pointer-events="all"/>`
      : `<rect x="${num(box.x)}" y="0" width="${num(box.w)}" height="${num(H)}" fill="${esc(theme.background)}"/>`;
    if (!kid.found) inner += text(box.x + box.w / 2, H / 2, 22, de.kidNotFound);
    else if (!seasonal) inner += scene(theme, theme.renderHalf(half.ctx));
    inner += header(half, i) + jarRow(half, span, jarY);
    const tappable = kid.found && !!config.kids.find((k) => k.id === kid.id)?.tap_path;
    if (tappable) inner += text(box.x + box.w - MARGIN, HINT_Y, 11, de.tapHint, 'end', ' opacity="0.6"');
    return `<g data-kid-half="${esc(kid.id)}"${tappable ? ' data-tappable="true"' : ''}>${inner}</g>`;
  }).join('');
  if (span) {
    body += model.sharedJars.slice(0, sharedFit(model.sharedJars.length, W)).map((jar, i) =>
      drawSharedJar(jar, { x: span[0] + i * (JAR_W + GAP), y: jarY, w: JAR_W, h: JAR_H }, colours, `shared:${jar.id}`),
    ).join('');
  }
  return svg(W, H, body);
}
