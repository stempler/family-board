import '../src/family-board-card';
import type { FamilyBoardCard } from '../src/family-board-card';
import { DEFAULT_SEASONS } from '../src/config';
import { seasonStart } from '../src/season';
import { THEMES } from '../src/themes/registry';
import { makeFakeHass, type FakeJar, type FakeKid } from './fake-hass';

const jars: FakeJar[] = [
  { id: 'j1', name: 'Lego Set', icon: '🧱', goal: 50, allocations: { k1: 22 }, shared: false, assignedTo: ['k1'] },
  { id: 'j2', name: 'Eis', icon: '🍦', goal: 30, allocations: { k2: 9 }, shared: false, assignedTo: ['k2'] },
  { id: 'j3', name: 'Familienausflug', icon: '✈️', goal: 40, allocations: { k1: 5, k2: 8 }, shared: true, assignedTo: [] },
];

const year = new Date().getFullYear();
/** A date inside the theme's default season; null if it has no default rule. */
function seasonDate(id: string): Date | null {
  const rule = DEFAULT_SEASONS.find((r) => r.theme === id);
  return rule ? seasonStart(rule, year) : null;
}

function addTile(name: string, theme: string, season: Date | null, [p1, p2] = [12, 37]): void {
  const kids: FakeKid[] = [
    { id: 'k1', name: 'Mia', points: p1, theme, colour: '#d9534f' },
    { id: 'k2', name: 'Ben', points: p2, theme, colour: '#3b7dd8' },
  ];
  const figure = document.createElement('figure');
  figure.dataset.galleryTile = name;
  const card = document.createElement('family-board-card') as FamilyBoardCard;
  const caption = document.createElement('figcaption');
  caption.textContent = name;
  figure.append(card, caption);
  document.getElementById('gallery')!.append(figure);

  const config: Record<string, unknown> = { kids: kids.map((k) => ({ id: k.id, theme: k.theme, colour: k.colour })) };
  if (!season) config.seasons = [];
  card.setConfig(config);
  card.now = () => season ?? new Date();
  card.hass = makeFakeHass(kids, jars);
}

for (const id of Object.keys(THEMES)) addTile(id, id, null);
// Chess shows games won and pieces captured; more point values show the start, a full row, a won game and trophies.
for (const points of [[0, 15], [16, 300]] as [number, number][]) addTile(`chess-points-${points.join('-')}`, 'chess', null, points);
for (const [id, theme] of Object.entries(THEMES)) {
  if (theme.renderSeasonScene) addTile(`season-${id}`, id, seasonDate(id) ?? new Date(year, 11, 15));
}
