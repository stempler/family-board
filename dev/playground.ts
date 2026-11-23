import '../src/family-board-card';
import type { FamilyBoardCard } from '../src/family-board-card';
import { DEFAULT_SEASONS } from '../src/config';
import { seasonStart } from '../src/season';
import { THEMES } from '../src/themes/registry';
import { makeFakeHass, type FakeJar, type FakeKid } from './fake-hass';

const kids: FakeKid[] = [
  { id: 'k1', name: 'Mia', points: 12, theme: 'bricks', colour: '#d9534f' },
  { id: 'k2', name: 'Ben', points: 30, theme: 'dino', colour: '#3b7dd8' },
];
const jars: FakeJar[] = [
  { id: 'j1', name: 'Bausteine-Set', icon: '🧱', goal: 50, allocations: { k1: 22 }, shared: false, assignedTo: ['k1'] },
  { id: 'j2', name: 'Familienausflug', icon: '✈️', goal: 40, allocations: { k1: 5, k2: 8 }, shared: true, assignedTo: [] },
];
let date = new Date();
let seasonsOff = false;
/** Screen shapes of the "Form" picker as width:height; `null` is "wie bisher" (the card does not fill). */
const SHAPES: [string, string, [number, number] | null][] = [
  ['', 'wie bisher', null],
  ['16:9', '16:9', [16, 9]],
  ['16:10', '16:10', [16, 10]],
  ['4:3', '4:3', [4, 3]],
  ['21:9', '21:9', [21, 9]],
  ['9:16', 'Hochformat (9:16)', [9, 16]],
];
let shape: [number, number] | null = null;
/** Kids who have their birthday on the playground date. */
const birthdayKids = new Set<string>();
let jarCounter = jars.length;

const card = document.querySelector('family-board-card') as FamilyBoardCard;
const controls = document.getElementById('controls')!;
const stage = document.getElementById('stage')!;

function applyConfig(): void {
  card.setConfig({
    kids: kids.map((k) => ({ id: k.id, theme: k.theme, colour: k.colour })),
    ...(seasonsOff ? { seasons: [] } : {}),
    ...(shape ? { fill: true } : {}),
  });
  applyShape();
}

/** Measures the largest box of the chosen shape that fits the stage, or nothing for "wie bisher". */
function applyShape(): void {
  if (!shape) {
    delete card.measure;
    card.style.width = '';
    card.style.margin = '';
  } else {
    const [sw, sh] = shape;
    card.measure = () => {
      const free = { w: stage.clientWidth - 24, h: window.innerHeight - 24 }; // the stage has 12px padding
      const scale = Math.min(free.w / sw, free.h / sh);
      // Take the shape's width too, so the card looks like a screen of that shape instead of leaving paper bars at its sides.
      card.style.width = `${sw * scale}px`;
      card.style.margin = '0 auto';
      return { w: sw * scale, h: sh * scale };
    };
  }
  card.refit();
}

function push(): void {
  card.now = () => date;
  // The birthday goes through the fake TaskMate payload (its birthday mode, the main path): the kid turns 7 today.
  card.hass = makeFakeHass(kids.map((k) => (birthdayKids.has(k.id) ? { ...k, birthday: { age: 7 } } : k)), jars);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

function slider(label: string, value: number, max: number, onInput: (v: number) => void): HTMLLabelElement {
  const out = el('span', { textContent: String(value) });
  const input = el('input', { type: 'range', min: '0', max: String(max), value: String(value) });
  input.addEventListener('input', () => { out.textContent = input.value; onInput(Number(input.value)); push(); });
  return el('label', {}, `${label}: `, out, input);
}

function renderControls(): void {
  controls.replaceChildren();

  const dateInput = el('input', { type: 'date' });
  const pad = (n: number) => String(n).padStart(2, '0');
  dateInput.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  dateInput.addEventListener('change', () => {
    const [y, m, d] = dateInput.value.split('-').map(Number);
    if (y) { date = new Date(y, m - 1, d); seasonsOff = false; applyConfig(); renderControls(); push(); }
  });
  const seasonSelect = el('select');
  const today = new Date();
  const year = date.getFullYear();
  const seasonOptions: [string, string, Date | null][] = [
    ['auto', 'nach Datum', null],
    ['', 'keine', today],
    ...DEFAULT_SEASONS.filter((r) => THEMES[r.theme]?.renderSeasonScene)
      .map((r): [string, string, Date | null] => [r.theme, THEMES[r.theme].label ?? r.theme, seasonStart(r, year)]),
  ];
  for (const [value, label] of seasonOptions) seasonSelect.append(el('option', { value, textContent: label }));
  seasonSelect.addEventListener('change', () => {
    const chosen = seasonOptions.find(([value]) => value === seasonSelect.value)!;
    if (chosen[2]) date = chosen[2];
    seasonsOff = chosen[0] === '';
    applyConfig();
    renderControls();
    push();
  });
  seasonSelect.value = seasonsOff ? '' : seasonOptions.find(([v, , d]) => v !== '' && d && d.toDateString() === date.toDateString())?.[0] ?? 'auto';
  controls.append(el('fieldset', {}, el('legend', { textContent: 'Datum' }), dateInput, el('label', {}, 'Saison: ', seasonSelect)));

  const shapeSelect = el('select');
  for (const [value, label] of SHAPES) shapeSelect.append(el('option', { value, textContent: label }));
  shapeSelect.value = shape ? `${shape[0]}:${shape[1]}` : '';
  shapeSelect.addEventListener('change', () => {
    shape = SHAPES.find(([value]) => value === shapeSelect.value)![2];
    applyConfig();
    push();
  });
  controls.append(el('fieldset', {}, el('legend', { textContent: 'Bildschirm' }), el('label', {}, 'Form: ', shapeSelect)));

  for (const k of kids) {
    const name = el('input', { type: 'text', value: k.name });
    name.addEventListener('input', () => { k.name = name.value; push(); });
    const theme = el('select');
    for (const [id, t] of Object.entries(THEMES)) theme.append(el('option', { value: id, textContent: t.label ?? id, selected: id === k.theme }));
    theme.addEventListener('change', () => { k.theme = theme.value; applyConfig(); push(); });
    const birthday = el('input', { type: 'checkbox', checked: birthdayKids.has(k.id) });
    birthday.addEventListener('change', () => { if (birthday.checked) birthdayKids.add(k.id); else birthdayKids.delete(k.id); push(); });
    controls.append(el('fieldset', {}, el('legend', { textContent: k.id }),
      el('label', {}, 'Name: ', name), el('label', {}, 'Theme: ', theme), el('label', {}, birthday, ' hat heute Geburtstag'), slider('Punkte', k.points, 200, (v) => { k.points = v; })));
  }

  for (const shared of [false, true]) {
    const box = el('fieldset', {}, el('legend', { textContent: shared ? 'Gemeinsame Gläser' : 'Persönliche Gläser' }));
    for (const j of jars.filter((x) => x.shared === shared)) {
      const remove = el('button', { textContent: 'Entfernen', type: 'button' });
      remove.addEventListener('click', () => { jars.splice(jars.indexOf(j), 1); renderControls(); push(); });
      const jarBox = el('div', {}, el('strong', { textContent: `${j.icon} ${j.name} (Ziel ${j.goal})` }), ' ', remove);
      for (const k of kids) {
        if (!shared && !j.assignedTo.includes(k.id)) continue;
        jarBox.append(slider(k.name, j.allocations[k.id] ?? 0, j.goal, (v) => { j.allocations[k.id] = v; }));
      }
      box.append(jarBox);
    }
    const add = el('button', { textContent: 'Hinzufügen', type: 'button' });
    add.addEventListener('click', () => {
      jarCounter += 1;
      jars.push({
        id: `j${jarCounter}`,
        name: shared ? `Gemeinsam ${jarCounter}` : `Glas ${jarCounter}`,
        icon: shared ? '🎁' : '🍦',
        goal: 40,
        allocations: {},
        shared,
        assignedTo: shared ? [] : kids.map((k) => k.id),
      });
      renderControls();
      push();
    });
    box.append(add);
    controls.append(box);
  }
}

applyConfig();
renderControls();
push();
