import '../src/family-board-card';
import type { FamilyBoardCard } from '../src/family-board-card';
import { easterSunday } from '../src/season';
import { THEMES } from '../src/themes/registry';
import { makeFakeHass, type FakeJar, type FakeKid } from './fake-hass';

const kids: FakeKid[] = [
  { id: 'k1', name: 'Mia', points: 12, theme: 'lego', colour: '#d9534f' },
  { id: 'k2', name: 'Ben', points: 30, theme: 'dino', colour: '#3b7dd8' },
];
const jars: FakeJar[] = [
  { id: 'j1', name: 'Lego Set', icon: '🧱', goal: 50, allocations: { k1: 22 }, shared: false, assignedTo: ['k1'] },
  { id: 'j2', name: 'Familienausflug', icon: '✈️', goal: 40, allocations: { k1: 5, k2: 8 }, shared: true, assignedTo: [] },
];
let date = new Date();
let seasonsOff = false;
let jarCounter = jars.length;

const card = document.querySelector('family-board-card') as FamilyBoardCard;
const controls = document.getElementById('controls')!;

function applyConfig(): void {
  card.setConfig({ kids: kids.map((k) => ({ id: k.id, theme: k.theme, colour: k.colour })), ...(seasonsOff ? { seasons: [] } : {}) });
}

function push(): void {
  card.now = () => date;
  card.hass = makeFakeHass(kids, jars);
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
    ['christmas', 'Weihnachten', new Date(year, 11, 15)],
    ['halloween', 'Halloween', new Date(year, 9, 28)],
    ['easter', 'Ostern', easterSunday(year)],
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

  for (const k of kids) {
    const name = el('input', { type: 'text', value: k.name });
    name.addEventListener('input', () => { k.name = name.value; push(); });
    const theme = el('select');
    for (const id of Object.keys(THEMES)) theme.append(el('option', { value: id, textContent: id, selected: id === k.theme }));
    theme.addEventListener('change', () => { k.theme = theme.value; applyConfig(); push(); });
    controls.append(el('fieldset', {}, el('legend', { textContent: k.id }),
      el('label', {}, 'Name: ', name), el('label', {}, 'Theme: ', theme), slider('Punkte', k.points, 200, (v) => { k.points = v; })));
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
