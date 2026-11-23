import '../src/family-board-card';
import type { FamilyBoardCard } from '../src/family-board-card';
import { DEFAULT_SEASONS } from '../src/config';
import { seasonStart } from '../src/season';
import { THEMES } from '../src/themes/registry';
import type { AreaSize } from '../src/board';
import { makeFakeHass, type FakeJar, type FakeKid } from './fake-hass';

const jars: FakeJar[] = [
  { id: 'j1', name: 'Bausteine-Set', icon: '🧱', goal: 50, allocations: { k1: 22 }, shared: false, assignedTo: ['k1'] },
  { id: 'j2', name: 'Eis', icon: '🍦', goal: 30, allocations: { k2: 9 }, shared: false, assignedTo: ['k2'] },
  { id: 'j3', name: 'Familienausflug', icon: '✈️', goal: 40, allocations: { k1: 5, k2: 8 }, shared: true, assignedTo: [] },
];

const year = new Date().getFullYear();
/** A date inside the theme's default season; null if it has no default rule. */
function seasonDate(id: string): Date | null {
  const rule = DEFAULT_SEASONS.find((r) => r.theme === id);
  return rule ? seasonStart(rule, year) : null;
}

function addTile(name: string, theme: string, season: Date | null, [p1, p2] = [12, 37], kidPatch: Record<string, Record<string, unknown>> = {}): void {
  const kids: FakeKid[] = [
    { id: 'k1', name: 'Mia', points: p1, theme, colour: '#d9534f' },
    { id: 'k2', name: 'Ben', points: p2, theme, colour: '#3b7dd8' },
  ].map((k) => {
    const patched = kidPatch[k.id]?.theme;
    return typeof patched === 'string' ? { ...k, theme: patched } : k;
  });
  addCardTile(name, kids, season, kidPatch);
}

/** A tile whose card fills `size`, as a card in a panel view of that shape would; the tile is as wide as `size`, so the shot has the screen's shape. */
function addShapeTile(name: string, size: AreaSize, themes: string[], season: Date | null = null): void {
  const names = ['Mia', 'Ben', 'Lea', 'Tom', 'Zoe'];
  const colours = ['#d9534f', '#3b7dd8', '#4caf50', '#f0a030', '#9b59b6'];
  const kids: FakeKid[] = themes.map((theme, i) => ({ id: `k${i + 1}`, name: names[i], points: [12, 37, 120, 5, 64][i], theme, colour: colours[i] }));
  addCardTile(name, kids, season, {}, size);
}

function addCardTile(name: string, kids: FakeKid[], season: Date | null, kidPatch: Record<string, Record<string, unknown>> = {}, size?: AreaSize): void {
  const figure = document.createElement('figure');
  figure.dataset.galleryTile = name;
  if (size) {
    figure.style.width = `${size.w}px`;
    figure.style.gridColumn = '1 / -1';
  }
  const card = document.createElement('family-board-card') as FamilyBoardCard;
  const caption = document.createElement('figcaption');
  caption.textContent = name;
  figure.append(card, caption);
  document.getElementById('gallery')!.append(figure);

  const config: Record<string, unknown> = { kids: kids.map((k) => ({ id: k.id, theme: k.theme, colour: k.colour, ...kidPatch[k.id] })) };
  if (!season) config.seasons = [];
  if (size) {
    config.fill = true;
    card.measure = () => size;
  }
  card.setConfig(config);
  card.now = () => season ?? new Date();
  card.hass = makeFakeHass(kids, jars);
}

/** A `YYYY-MM-DD` birthday that makes a kid `age` years old on `date` (born on 1 January). */
const bornAgo = (age: number, date: Date) => `${date.getFullYear() - age}-01-01`;

// The plain birthday tile shows candles: Mia is 7 and Ben 10 on the tile's date.
for (const id of Object.keys(THEMES)) {
  addTile(id, id, null, undefined, id === 'birthday' ? { k1: { birthday: bornAgo(7, new Date()) }, k2: { birthday: bornAgo(10, new Date()) } } : {});
}
// Chess shows games won and pieces captured; more point values show the start, a full row, a won game and trophies.
for (const points of [[0, 15], [16, 300]] as [number, number][]) addTile(`chess-points-${points.join('-')}`, 'chess', null, points);
for (const [id, theme] of Object.entries(THEMES)) {
  if (theme.renderSeasonScene) addTile(`season-${id}`, id, seasonDate(id) ?? new Date(year, 11, 15));
}
// Mia's 7th birthday on the first day of the Christmas default season: her half is the birthday picture, Ben's (dino favourite) the Christmas half, no shared tree.
// This tile uses the card config's `birthday` (the fallback path) on purpose; the playground's checkbox shows TaskMate's birthday mode.
{
  const christmas = seasonDate('christmas')!;
  const md = `${christmas.getFullYear() - 7}-${String(christmas.getMonth() + 1).padStart(2, '0')}-${String(christmas.getDate()).padStart(2, '0')}`;
  addTile('birthday-in-christmas', 'bricks', christmas, [12, 37], { k1: { birthday: md }, k2: { theme: 'dino' } });
}
// The garden with many points: the first big flowers and sunflowers, and the most small ones with 1000 points.
for (const points of [[199, 300], [1000, 112]] as [number, number][]) addTile(`garden-points-${points.join('-')}`, 'garden', null, points);
// The card filling a screen of a given shape (two kids: pirates and garden, the themes with a ground colour). 16:10 is 720x450 and 21:9 1050x450;
// five kids on 4:3 are too narrow for halves, so the picture gets taller (800x600), also with a season scene.
addShapeTile('shape-16-10', { w: 720, h: 450 }, ['pirates', 'garden']);
addShapeTile('shape-4-3', { w: 600, h: 450 }, ['pirates', 'garden']);
addShapeTile('shape-21-9', { w: 1050, h: 450 }, ['pirates', 'garden']);
addShapeTile('shape-4-3-five-kids', { w: 800, h: 600 }, ['pirates', 'garden', 'underwater', 'dino', 'construction']);
addShapeTile('shape-4-3-five-kids-christmas', { w: 800, h: 600 }, ['pirates', 'garden', 'underwater', 'dino', 'construction'], seasonDate('christmas'));
