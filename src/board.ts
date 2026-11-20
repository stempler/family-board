import type { CardConfig } from './config';
import { drawJar, drawSharedJar, type Box } from './draw/jar';
import { renderIcon } from './draw/icon';
import { esc, INK, num, PAPER, truncate } from './draw/sketch';
import { de } from './i18n';
import { groupItems } from './items';
import type { BoardModel, Kid } from './model';
import { activeSeason } from './season';
import { getTheme, THEMES } from './themes/registry';
import type { HalfContext, Theme } from './themes/types';

export interface RenderOptions { date: Date; prevPoints?: Record<string, number> } // prevPoints: kidId -> previous points, drives fb-new

const W = 800;
const H = 450;
const BOARD: Box = { x: 0, y: 0, w: W, h: H };
const FONT = `'Patrick Hand', 'Comic Sans MS', cursive`;

const MARGIN = 14;
const AVATAR = 44;
const AVATAR_Y = 14;
const NAME_Y = 47;
const HINT_Y = 68;
const NAME_SIZE = 30;
const MIN_NAME_SIZE = 12;
const NUMBER_SIZE = 34;
const NAME_GAP = 20; // space between the name and the number
const GLYPH_W = 0.55; // average glyph width in em, on the wide side

// Jar row in the bottom ~21% of the board, below every theme's scene band (ends at 0.79h).
const JAR_W = 40;
const JAR_H = 74;
const JAR_Y = 366;
const GAP = 12;
const SHARED_GAP = 34; // clear space around the shared jars so they don't read as part of a kid's row

interface Half { kid: Kid; box: Box; theme: Theme; showNumber: boolean; ctx: HalfContext }

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="${esc(FONT)}"><rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>${body}</svg>`;
}

function text(x: number, y: number, size: number, content: string, anchor = 'middle', extra = ''): string {
  return `<text x="${num(x)}" y="${num(y)}" font-size="${num(size)}" text-anchor="${anchor}" fill="${INK}"${extra}>${esc(content)}</text>`;
}

/**
 * Item index from which a theme marks items as new. Themes draw big items first (0..big-1), then small ones.
 * No animation (the item count) without previous points, when points did not go up, or when the grouping unit changed.
 */
export function newItemsFrom(prevPoints: number | undefined, points: number, capacity: number): number {
  const cur = groupItems(points, capacity);
  const total = cur.big + cur.small;
  if (typeof prevPoints !== 'number' || !(points > prevPoints)) return total;
  const prev = groupItems(prevPoints, capacity);
  if (prev.unit !== cur.unit) return total;
  return cur.big > prev.big ? prev.big : cur.big + prev.small;
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

function header(half: Half, index: number): string {
  const { kid, box } = half;
  const right = box.x + box.w - MARGIN;
  const nameX = box.x + MARGIN + AVATAR + 10;
  const number = String(kid.points);
  const numberW = half.showNumber ? number.length * NUMBER_SIZE * GLYPH_W + NAME_GAP : 0;
  const shown = truncate(kid.name, 18);
  // Shrink long names so they never run into the number (estimated width; the real font is narrower).
  const nameSize = Math.max(MIN_NAME_SIZE, Math.min(NAME_SIZE, (right - numberW - nameX) / (Math.max(1, Array.from(shown).length) * GLYPH_W)));
  const name = text(nameX, NAME_Y, nameSize, shown, 'start');
  const points = half.showNumber ? text(right, NAME_Y, NUMBER_SIZE, number, 'end', ' font-weight="bold"') : '';
  return avatar(kid, box.x + MARGIN, index) + name + points;
}

/** How many shared jars fit across the board. */
function sharedFit(total: number): number {
  return Math.min(total, Math.max(0, Math.floor((W - 2 * MARGIN + GAP) / (JAR_W + GAP))));
}

/** Horizontal span [left, right] of the shared jar row, centred on the board. */
function sharedSpan(total: number): [number, number] | null {
  const count = sharedFit(total);
  if (count === 0) return null;
  const width = count * JAR_W + (count - 1) * GAP;
  return [(W - width) / 2, (W + width) / 2];
}

/** Kid jars left-aligned in the widest part of the half that keeps clear of the shared jars; as many as fit. */
function jarRow(half: Half, shared: [number, number] | null): string {
  const { kid, box } = half;
  const a = box.x + MARGIN;
  const b = box.x + box.w - MARGIN;
  const segments: [number, number][] = shared ? [[a, Math.min(b, shared[0] - SHARED_GAP)], [Math.max(a, shared[1] + SHARED_GAP), b]] : [[a, b]];
  const [left, right] = segments.reduce((best, s) => (s[1] - s[0] > best[1] - best[0] ? s : best));
  const fit = Math.max(0, Math.floor((right - left + GAP) / (JAR_W + GAP)));
  return kid.jars.slice(0, fit).map((jar, i) =>
    drawJar(jar, { x: left + i * (JAR_W + GAP), y: JAR_Y, w: JAR_W, h: JAR_H }, kid.colour, `${kid.id}:jar:${jar.id}`),
  ).join('');
}

function scene(theme: Theme, body: string): string {
  return `<g data-theme="${esc(theme.id)}">${body}</g>`;
}

export function renderBoard(model: BoardModel, config: CardConfig, opts: RenderOptions): string {
  if (model.status === 'missing') return svg(text(W / 2, H / 2, 24, de.missing));
  if (model.kids.length === 0) return svg(text(W / 2, H / 2, 24, de.noKids));

  const season = activeSeason(opts.date, config.seasons, Object.keys(THEMES));
  const seasonTheme = season ? getTheme(season.theme) : null;
  const seasonal = seasonTheme?.renderSeasonScene ? seasonTheme : null;

  const hw = W / model.kids.length;
  const halves: Half[] = model.kids.map((kid, i) => {
    const kc = config.kids.find((k) => k.id === kid.id);
    const theme = seasonal ?? getTheme(kc?.theme ?? '');
    const box: Box = { x: i * hw, y: 0, w: hw, h: H };
    const ctx: HalfContext = { kid, box, groups: groupItems(kid.points, theme.capacity), newFrom: newItemsFrom(opts.prevPoints?.[kid.id], kid.points, theme.capacity), seedKey: `${kid.id}:scene` };
    return { kid, box, theme, showNumber: kc?.show_number ?? false, ctx };
  });

  const span = sharedSpan(model.sharedJars.length);
  const colours = Object.fromEntries(model.kids.map((k) => [k.id, k.colour]));

  let body = '';
  if (seasonal) {
    body += scene(seasonal, seasonal.renderSeasonScene!(halves.filter((h) => h.kid.found).map((h) => h.ctx), BOARD));
  }
  body += halves.map((half, i) => {
    const { kid, box, theme } = half;
    let inner = '';
    if (!seasonal) inner += `<rect x="${num(box.x)}" y="0" width="${num(box.w)}" height="${H}" fill="${esc(theme.background)}"/>`;
    if (!kid.found) inner += text(box.x + box.w / 2, H / 2, 22, de.kidNotFound);
    else if (!seasonal) inner += scene(theme, theme.renderHalf(half.ctx));
    inner += header(half, i) + jarRow(half, span);
    inner += text(box.x + box.w - MARGIN, HINT_Y, 11, de.tapHint, 'end', ' opacity="0.6"');
    return `<g data-kid-half="${esc(kid.id)}">${inner}</g>`;
  }).join('');
  if (span) {
    body += model.sharedJars.slice(0, sharedFit(model.sharedJars.length)).map((jar, i) =>
      drawSharedJar(jar, { x: span[0] + i * (JAR_W + GAP), y: JAR_Y, w: JAR_W, h: JAR_H }, colours, `shared:${jar.id}`),
    ).join('');
  }
  return svg(body);
}
