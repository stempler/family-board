# Family Board Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A custom Home Assistant Lovelace card (`family-board-card`) that draws both kids' TaskMate points and savings jars as a hand-drawn, themed scene on the living-room tablet. Also included: a theme playground, a one-command local Home Assistant with TaskMate and demo data, CI, and release/deploy tooling.

**Architecture:**
- The card is a Lit web component and only reads data.
- A pure adapter turns TaskMate's sensor attributes into a small `BoardModel`.
- A pure render pipeline (season → theme → per-kid half or shared seasonal scene → jars) turns that model into an SVG string. Strokes are drawn with seeded rough.js, so the picture is identical on every re-render.
- Everything except the custom element is a pure function and is unit tested in Vitest.
- The local Home Assistant runs in Docker Compose and is bootstrapped and seeded by Node scripts over Home Assistant's REST and WebSocket APIs.

**Tech Stack:** Node 26.13.1 (mise), TypeScript 7.0.2, Vite 8.3.8 (library build + dev server), Vitest 5.1.1 + jsdom 31.0.1, Lit 3.3.3, roughjs 4.6.6, Home Assistant 2026.11.2 (Docker), TaskMate v7.12.0, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-20-bonus-points-display-design.md` (mockups in `docs/superpowers/specs/mockups/`). TaskMate reference: https://github.com/tempus2016/taskmate/tree/v7.12.0/wiki (especially `Sensor-Reference.md`, `Services.md`, `Pool-Mode-(Savings-Jars).md`, `Kiosk-Mode.md`).

## Global Constraints

- Tools come from mise only (`mise.toml` at repo root). No globally installed Node.
- Pinned versions:
  - Node `26.13.1`, `typescript@7.0.2`, `vite@8.3.8`, `vitest@5.1.1`, `jsdom@31.0.1`, `lit@3.3.3`, `roughjs@4.6.6`.
  - Home Assistant image `ghcr.io/home-assistant/home-assistant:2026.11.2`.
  - TaskMate `v7.12.0`, kept in the single file `taskmate.version`.
- If a pinned latest version is incompatible (e.g. TypeScript 7 tooling), stop and report. Do not silently downgrade.
- The card never writes to Home Assistant: no service calls, no stored state. Its only side effect is navigation.
- Every TaskMate attribute name is read in `src/adapter.ts` and nowhere else. Entity IDs come from config, with defaults `sensor.taskmate_overview` and `sensor.taskmate_rewards`.
- Every string a kid can see is German and lives in `src/i18n.ts`. Parent-entered text (names, reward names) is shown as entered, **always escaped** for SVG/HTML.
- Config errors thrown from `setConfig` may be English, because only parents see them.
- Built artifact: a single ES module `dist/family-board-card.js`. Custom element tag `family-board-card`; Lovelace type `custom:family-board-card`.
- The board's SVG `viewBox` is `0 0 800 450` (landscape tablet).
- Commits use Conventional Commits. No `Co-authored-by`. There is no JIRA issue for this repo.

## Review Focus

1. **TaskMate sensors missing or `unavailable`** (Home Assistant still starting, integration not loaded): the card shows a friendly German message and does not throw. *Test in Task 3 and Task 9.*
2. **A configured kid ID not present in TaskMate** (child deleted or recreated): that half shows a German "nicht gefunden" placeholder, and the other kids still render. *Test in Task 3 and Task 9.*
3. **Extreme balances:** 0, negative after a penalty, or very large (e.g. 1000). Negative counts as 0. Large counts are grouped so the scene stays countable and inside the viewBox. *Tests in Task 5 and each theme task.*
4. **Frequent `hass` updates with unchanged data** (Home Assistant pushes state changes many times a minute): no re-render, no jitter, and the "new item" animation only plays when a kid's count actually increases. *Tests in Task 6 and Task 9.*
5. **Parent-entered text with markup or length** (`<b>`, `&`, emoji, 60-character reward names): escaped, never breaking the SVG, and truncated to fit. *Tests in Task 6 and Task 9.*

---

## File Structure

```
mise.toml                     tools + tasks (dev, test, build, ha:*)
package.json, tsconfig.json, vite.config.ts, vitest.config.ts
taskmate.version              "v7.12.0"
hacs.json                     HACS layout, kept compatible (deploy route undecided)
src/
  family-board-card.ts        Lit custom element (only DOM/HA glue)
  config.ts                   CardConfig types + normalizeConfig
  model.ts                    BoardModel types
  adapter.ts                  TaskMate states -> BoardModel (only place knowing TaskMate)
  season.ts                   season calendar + theme choice per kid
  items.ts                    grouping rule for large counts
  i18n.ts                     German strings
  draw/sketch.ts              seeded rough.js primitives -> SVG strings, esc(), hashSeed()
  draw/icon.ts                reward/avatar icon rendering (emoji or mdi)
  draw/jar.ts                 personal + shared jar drawing
  themes/types.ts             Theme interface
  themes/registry.ts          id -> Theme
  themes/christmas.ts, themes/lego.ts, themes/dino.ts
  board.ts                    renderBoard(): layout of halves / shared scene / shared jars
dev/
  index.html, playground.ts, fake-hass.ts     theme playground (no HA)
  ha/compose.yaml                             local Home Assistant
scripts/
  fetch-taskmate.mjs          download pinned TaskMate into dev/ha/config/custom_components
  ha-client.mjs               tiny REST + WebSocket helper (Node built-in fetch/WebSocket)
  dev-bootstrap.mjs           onboarding, token, TaskMate entry, resource, dashboard, seed
  capture-fixtures.mjs        save real sensor states as test fixtures
  deploy.mjs                  copy release file to server + bump resource version
tests/
  fixtures/docs-sample.json   hand-written from TaskMate docs (Task 3)
  fixtures/taskmate-v7.12.0.json  captured from real TaskMate (Task 13)
  *.test.ts
.github/workflows/ci.yml, .github/workflows/release.yml
README.md
```

---

### Task 1: Project scaffold and CI

**Files:**
- Create: `mise.toml`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `taskmate.version`, `src/family-board-card.ts` (placeholder), `tests/smoke.test.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces:
  - mise tasks `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `build` (`vite build`), `dev` (`vite dev/`).
  - `npm run` equivalents.
  - Vite library build: entry `src/family-board-card.ts` → `dist/family-board-card.js`, format `es`, all deps bundled.

- [ ] **Step 1:** Write `mise.toml` with `[tools] node = "26.13.1"` and the four tasks above. Write `package.json` (`"type": "module"`, `"private": true`) with exactly the pinned versions from Global Constraints as dev dependencies. lit and roughjs are dependencies. Run `mise install && npm install`.
- [ ] **Step 2:** Write `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)` plus `import '../src/family-board-card'` and assert it doesn't throw. Configure Vitest with `environment: 'jsdom'`.
- [ ] **Step 3:** Run `mise run test` → PASS. Run `mise run typecheck` → no errors. Run `mise run build` → `dist/family-board-card.js` exists.
- [ ] **Step 4:** Write `.github/workflows/ci.yml`: on push and pull_request; `ubuntu-latest`; `actions/checkout` (latest major), `jdx/mise-action` (latest major), `npm ci`, `mise run typecheck`, `mise run test`, `mise run build`; upload `dist/family-board-card.js` as a workflow artifact. `.gitignore`: `node_modules/`, `dist/`, `dev/ha/config/`, `dev/ha/.token`, `.superpowers/`.
- [ ] **Step 5:** Commit `build: scaffold card project with mise, vite, vitest and CI`.

### Task 2: Config and model types

**Files:**
- Create: `src/model.ts`, `src/config.ts`, `tests/config.test.ts`

**Interfaces:**
- Produces (`src/model.ts`):
  ```ts
  export interface Jar { id: string; name: string; icon: IconRef; current: number; goal: number }
  export interface SharedJar { id: string; name: string; icon: IconRef; goal: number; contributions: Record<string, number> } // kidId -> points
  export type IconRef = { kind: 'emoji'; value: string } | { kind: 'mdi'; value: string } // value e.g. "mdi:gift"
  export interface Kid { id: string; name: string; colour: string; avatar: IconRef; avatarImage?: string; points: number; jars: Jar[]; found: boolean }
  export interface BoardModel { status: 'ok' | 'missing'; kids: Kid[]; sharedJars: SharedJar[] }
  ```
- Produces (`src/config.ts`):
  ```ts
  export interface KidConfig { id: string; theme: string; colour?: string; tap_path?: string; show_number: boolean }
  export interface SeasonRule { theme: string; from: string; to: string } // "MM-DD", inclusive, may wrap year end
  export interface CardConfig { type: string; overview_entity: string; rewards_entity: string; kids: KidConfig[]; seasons: SeasonRule[]; reward_icons: Record<string, string> } // key: reward id or name -> emoji or "mdi:..."
  export const DEFAULT_SEASONS: SeasonRule[] // [{ theme: 'christmas', from: '12-01', to: '12-26' }]
  export function normalizeConfig(raw: unknown): CardConfig // throws Error on invalid
  ```

- [ ] **Step 1: Write failing tests** in `tests/config.test.ts`:
  - `normalizeConfig({type:'custom:family-board-card', kids:[{id:'a', theme:'lego'}]})` has `overview_entity === 'sensor.taskmate_overview'`, `rewards_entity === 'sensor.taskmate_rewards'`, `seasons` deep-equals `DEFAULT_SEASONS`, `kids[0].show_number === false`, `reward_icons` deep-equals `{}`.
  - It throws `/kids/` for a missing or empty `kids`.
  - It throws `/id/` for a kid without `id`.
  - It throws `/MM-DD/` for a season `from: '2026-12-01'`.
  - It throws `/theme/` for a kid without `theme`. The theme *name* is not validated here; unknown themes fall back at render time (Task 8).
- [ ] **Step 2:** Run `mise run test -- config` → FAIL.
- [ ] **Step 3:** Implement `normalizeConfig` and the types.
- [ ] **Step 4:** Run `mise run test -- config` → PASS.
- [ ] **Step 5:** Commit `feat: add card config normalisation and board model types`.

### Task 3: TaskMate adapter

**Files:**
- Create: `src/adapter.ts`, `tests/fixtures/docs-sample.json`, `tests/adapter.test.ts`

**Interfaces:**
- Consumes: `CardConfig`, `BoardModel` (Task 2).
- Produces:
  ```ts
  export type HassStates = Record<string, { state: string; attributes: Record<string, unknown> }>
  export function toBoardModel(states: HassStates, config: CardConfig): BoardModel
  export function parseIcon(value: string | undefined, fallback: IconRef): IconRef // "mdi:x" -> mdi, anything else non-empty -> emoji
  ```

Mapping rules (from TaskMate `Sensor-Reference.md` v7.12.0):

| BoardModel field | Source |
|---|---|
| kids, in config order | config kids order; data from `overview.attributes.children[]` matched by `id` |
| `points` | `max(0, spendable_balance)` |
| `colour` | `config.kid.colour` ?? child `color` ?? the palette `['#d9534f', '#3b7dd8', '#5aa469', '#f0ad4e']` by kid index |
| `avatar` / `avatarImage` | `avatar` (mdi) / `avatar_image` (omit when empty) |
| `jars` | `rewards.attributes.rewards[]` where `pool_enabled && !is_jackpot && is_available !== false`, and `assigned_to` is empty or includes the kid. `current = pool_allocations[kidId] ?? 0`, `goal = calculated_costs[kidId] ?? cost` |
| `sharedJars` | rewards where `is_jackpot && is_available !== false`. `contributions` = `pool_allocations` restricted to configured kids. `goal = cost` |
| jar `icon` | `config.reward_icons[reward.id] ?? config.reward_icons[reward.name] ?? reward.icon ?? 'mdi:gift'`, via `parseIcon` |
| `status` | `'missing'` when the overview entity is absent, its state is `unavailable`/`unknown`, or `children` is not an array |
| a kid missing in TaskMate | `found: false`, `points: 0`, `jars: []`, `name` = the config id |

- [ ] **Step 1:** Write `tests/fixtures/docs-sample.json`: a `HassStates` object with:
  - `sensor.taskmate_overview`: two children, `id: "k1"`, `name: "Mia"`, `spendable_balance: 12`, `color: "#ff0000"`; and `id: "k2"`, `name: "Ben"`, `spendable_balance: -3`, no color.
  - `sensor.taskmate_rewards` with four rewards:
    - personal pool `r1`, assigned `["k1"]`, cost 50, `pool_allocations: {"k1": 22}`;
    - pool `r2`, assigned `[]`, cost 20, `pool_allocations: {}`;
    - jackpot `r3`, cost 40, `pool_allocations: {"k1": 5, "k2": 8, "kX": 3}`;
    - plain wallet reward `r4` (`pool_enabled: false`).
- [ ] **Step 2: Write failing tests** in `tests/adapter.test.ts`, against that fixture and config kids `[k1, k2]`:
  - `status === 'ok'`. Kid names are `['Mia', 'Ben']`. `kids[1].points === 0` (negative clamped). `kids[0].colour === '#ff0000'`, `kids[1].colour === '#3b7dd8'`.
  - `kids[0].jars` is `r1` (current 22, goal 50) and `r2` (current 0, goal 20). `kids[1].jars` is only `r2` (the empty jar is shown). `r4` is never a jar.
  - `sharedJars` is `[r3]` with `contributions` `{k1: 5, k2: 8}` (`kX` dropped), goal 40.
  - With config `reward_icons: {r1: '🧱'}`, `kids[0].jars[0].icon` deep-equals `{kind: 'emoji', value: '🧱'}`.
  - Config kids `[k1, kZ]` gives `kids[1].found === false` and `kids[1].name === 'kZ'`, while `kids[0]` is unaffected.
  - `toBoardModel({}, cfg).status === 'missing'`. An overview with `state: 'unavailable'` gives `'missing'`. A missing rewards entity gives `status 'ok'` with no jars.
- [ ] **Step 3:** Run `mise run test -- adapter` → FAIL.
- [ ] **Step 4:** Implement `toBoardModel` and `parseIcon`.
- [ ] **Step 5:** Run `mise run test -- adapter` → PASS.
- [ ] **Step 6:** Commit `feat: map TaskMate sensors to board model`.

### Task 4: Season calendar and theme choice

**Files:**
- Create: `src/season.ts`, `tests/season.test.ts`

**Interfaces:**
- Consumes: `SeasonRule`, `KidConfig` (Task 2).
- Produces:
  ```ts
  export function activeSeason(date: Date, seasons: SeasonRule[], knownThemes: string[]): SeasonRule | null // first matching rule whose theme is known
  ```
  The board uses: season active → shared scene with `season.theme`; otherwise each kid's `kid.theme`.

- [ ] **Step 1: Write failing tests:**
  - `activeSeason(new Date(2026, 11, 1), DEFAULT_SEASONS, ['christmas'])?.theme === 'christmas'`.
  - `new Date(2026, 11, 26)` → christmas (inclusive end). `new Date(2026, 11, 27)` → `null`.
  - A wrapping rule `{theme: 'christmas', from: '12-20', to: '01-06'}` matches `new Date(2027, 0, 3)`.
  - The rule `{theme: 'halloween', ...}` with knownThemes `['christmas']` → `null`.
  - Uses local date, not UTC: 2026-12-01 00:30 local still matches.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement by comparing `MM-DD` strings built from local month and day.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: add season calendar`.

### Task 5: Grouping rule for large counts

**Files:**
- Create: `src/items.ts`, `tests/items.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ItemGroups { unit: number; big: number; small: number } // big items worth `unit`, small worth 1
  export function groupItems(count: number, capacity: number): ItemGroups
  ```
  Rule: clamp `count` to an integer ≥ 0 (NaN → 0). If `count <= capacity`, return `{unit: 1, big: 0, small: count}`. Otherwise try units `[10, 50, 100, 500, 1000]` in order and take the first where `floor(count/unit) + count % unit <= capacity`. If none fits, use 1000 and clamp `big` so `big + small <= capacity`.

- [ ] **Step 1: Write failing tests:**
  - `groupItems(12, 30)` → `{unit: 1, big: 0, small: 12}`.
  - `groupItems(37, 30)` → `{unit: 10, big: 3, small: 7}`.
  - `groupItems(0, 30)` and `groupItems(-5, 30)` → `{unit: 1, big: 0, small: 0}`.
  - `groupItems(1000, 30)` → `big + small <= 30` and `big * unit + small === 1000`.
  - `groupItems(NaN, 30)` → small 0.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: add item grouping for large point counts`.

### Task 6: Sketch primitives, icons and jars

**Files:**
- Create: `src/draw/sketch.ts`, `src/draw/icon.ts`, `src/draw/jar.ts`, `tests/draw.test.ts`

**Interfaces:**
- Consumes: `Jar`, `SharedJar`, `IconRef` (Task 2).
- Produces:
  ```ts
  // sketch.ts
  export function esc(text: string): string                      // escapes & < > " '
  export function truncate(text: string, max: number): string    // adds "…" when cut
  export function hashSeed(key: string): number                  // stable positive int
  export interface Style { stroke?: string; fill?: string; strokeWidth?: number; fillStyle?: 'solid' | 'hachure'; roughness?: number }
  export interface Sketch {
    rect(x: number, y: number, w: number, h: number, s?: Style): string
    circle(cx: number, cy: number, d: number, s?: Style): string
    ellipse(cx: number, cy: number, w: number, h: number, s?: Style): string
    polygon(points: [number, number][], s?: Style): string
    line(x1: number, y1: number, x2: number, y2: number, s?: Style): string
    path(d: string, s?: Style): string
  }
  export function createSketch(seedKey: string): Sketch // each call derives its own seed from seedKey + call index
  export const INK = '#3a2f28'; export const PAPER = '#fdf8ee'
  // icon.ts
  export function renderIcon(icon: IconRef, x: number, y: number, size: number): string // emoji -> <text>, mdi -> <foreignObject> with <ha-icon icon="..."> (escaped)
  // jar.ts
  export interface Box { x: number; y: number; w: number; h: number }
  export function drawJar(jar: Jar, box: Box, colour: string, seedKey: string): string           // root <g data-jar="{id}">
  export function drawSharedJar(jar: SharedJar, box: Box, kidColours: Record<string, string>, seedKey: string): string // stacked fill per kid in kid colour; root <g data-shared-jar="{id}">
  ```
- Sketch output is `<g>` elements built from rough.js `rough.generator().toPaths(...)`, with `seed` set per shape. No DOM is needed.
- Jars:
  - The fill height is `min(current/goal, 1)`.
  - `goal <= 0` is treated as full.
  - The goal line is dashed green `#2e8b57`, as in the mockups.
  - The jar name is not drawn; the icon identifies it.

- [ ] **Step 1: Write failing tests:**
  - `createSketch('a').rect(0, 0, 10, 10)` called twice on two `createSketch('a')` instances gives identical strings. `createSketch('b')` differs.
  - No output contains `NaN`.
  - `esc('<b>&"\'')` → `'&lt;b&gt;&amp;&quot;&#39;'`. `truncate('x'.repeat(60), 20).length === 20`.
  - `renderIcon({kind: 'mdi', value: 'mdi:gift'}, 0, 0, 24)` contains `<ha-icon icon="mdi:gift"`. The emoji `'<x>'` renders escaped.
  - `drawJar({..., current: 60, goal: 50})` fill height equals the full inner height; check with a `data-fill="1"` attribute on the fill element. `current: 0` → `data-fill="0"`.
  - `drawSharedJar` with contributions `{k1: 5, k2: 8}`, goal 40, emits two fill segments with `data-kid="k1"` and `data-kid="k2"` in the kid colours.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: add seeded sketch primitives, icons and jars`.

### Task 7: Theme interface and Christmas theme

**Files:**
- Create: `src/themes/types.ts`, `src/themes/registry.ts`, `src/themes/christmas.ts`, `tests/themes/christmas.test.ts`, `tests/themes/theme-contract.ts` (shared contract checks reused by Tasks 7 and 8)

**Interfaces:**
- Consumes: `Sketch`, `createSketch`, `groupItems`, `Kid`.
- Produces:
  ```ts
  export interface HalfContext { kid: Kid; box: Box; groups: ItemGroups; newFrom: number; seedKey: string } // newFrom: item index from which items get class "fb-new"
  export interface Theme {
    id: string
    capacity: number                       // max drawn items per kid
    background: string                     // half background colour
    renderHalf(ctx: HalfContext): string   // the kid's scene inside ctx.box, no jars or header
    renderSeasonScene?(halves: HalfContext[], box: Box): string // shared landscape with one object per kid; only for seasonal themes
  }
  export const THEMES: Record<string, Theme>; export function getTheme(id: string): Theme // unknown id -> THEMES.lego
  ```
- Every drawn item is `<g class="fb-item[ fb-new]" data-item="small|big">`. Big items (worth `groups.unit`) are visibly bigger. For Christmas, a big ornament is a large bauble with a star.
- Christmas:
  - `renderHalf` draws a tree with ornaments, as in `mockups/metaphor.html` A. Capacity 30.
  - `renderSeasonScene` draws a snowy landscape: one tree per kid, the kid's colour as a ribbon under the tree, as in `mockups/shared-screen.html` 2.
  - Leave the horizontal centre band `x 360..440` free of trees for shared jars.

- [ ] **Step 1: Write the contract** in `tests/themes/theme-contract.ts`: `runThemeContract(theme)` registers Vitest cases that:
  - render the half for points 0, 7, 30 and 1000 (grouped with `groupItems`);
  - count `data-item` occurrences equal `big + small`;
  - output has no `NaN`;
  - all numeric `x`/`y`/`cx`/`cy` attribute values lie inside `box` (parse with a regex);
  - two renders with the same input are identical;
  - with `newFrom: 5` and 7 items, exactly 2 items carry `fb-new`.
- [ ] **Step 2:** Write `tests/themes/christmas.test.ts`: `runThemeContract(THEMES.christmas)`. Plus: `renderSeasonScene` with two halves contains two `data-tree` groups and no tree centre within `x 360..440`. Plus: `getTheme('nope').id === 'lego'`.
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement the types, registry and Christmas theme. Register a minimal `lego` stub so the fallback test can pass; Task 8 replaces it.
- [ ] **Step 5:** Run → PASS. Eyeball the output by writing one render to a scratch `.svg` file and opening it. It should look like the mockup.
- [ ] **Step 6:** Commit `feat: add theme interface and christmas theme`.

### Task 8: LEGO and dino themes

**Files:**
- Create: `src/themes/lego.ts`, `src/themes/dino.ts`, `tests/themes/lego.test.ts`, `tests/themes/dino.test.ts`
- Modify: `src/themes/registry.ts`

**Interfaces:**
- Consumes: `Theme`, `HalfContext`, `runThemeContract` (Task 7).
- Produces:
  - `THEMES.lego`: a tower of bricks, each with two studs, colours cycling, slight left/right offset. Capacity 20. A big item is a double-width golden brick.
  - `THEMES.dino`: a nest with eggs and a dinosaur peeking. Capacity 15. A big item is a large speckled golden egg.
  - Both as in `mockups/shared-screen.html` 1. Neither has `renderSeasonScene`.

- [ ] **Step 1:** Write both test files: `runThemeContract(THEMES.lego)` and `runThemeContract(THEMES.dino)`.
- [ ] **Step 2:** Run → FAIL (the lego stub fails the contract; dino is missing).
- [ ] **Step 3:** Implement both themes.
- [ ] **Step 4:** Run → PASS, and eyeball the scratch SVGs.
- [ ] **Step 5:** Commit `feat: add lego and dino themes`.

### Task 9: Board layout

**Files:**
- Create: `src/i18n.ts`, `src/board.ts`, `tests/board.test.ts`

**Interfaces:**
- Consumes: `BoardModel`, `CardConfig`, `activeSeason`, `getTheme`, `THEMES`, `groupItems`, `drawJar`, `drawSharedJar`, `renderIcon`, `esc`, `truncate`.
- Produces:
  ```ts
  // i18n.ts
  export const de = {
    missing: 'Die Punkte sind gerade nicht da. Ist TaskMate eingerichtet?',
    kidNotFound: 'Kind nicht gefunden',
    tapHint: 'Antippen → Aufgaben',
    noKids: 'Noch keine Kinder eingerichtet',
  } as const
  // board.ts
  export interface RenderOptions { date: Date; prevPoints?: Record<string, number> } // prevPoints: kidId -> previous points, drives fb-new
  export function renderBoard(model: BoardModel, config: CardConfig, opts: RenderOptions): string // full <svg viewBox="0 0 800 450">
  ```
- Layout:
  - The board width is split evenly by kid count. Each half is `<g data-kid-half="{id}">` with the theme background, a header (avatar via `renderIcon`, or `<image href>` for `avatarImage`; escaped name truncated to 18 characters; the number if `show_number`), the theme scene, a jar row at the bottom, and the hint `de.tapHint` small in the corner.
  - Shared jars are centred horizontally at the bottom. With 2 kids that is on the divider.
  - During an active season whose theme has `renderSeasonScene`, the whole board uses it. Headers and jars stay the same.
  - `found: false` → that half shows `de.kidNotFound` and no scene.
  - `status: 'missing'` → only `de.missing`.
  - Empty `kids` → `de.noKids`.
  - `newFrom` = the previous point count when the points increased, otherwise the current count (no animation).

- [ ] **Step 1: Write failing tests** with hand-built models:
  - 2 kids, no season (date 2026-06-01) → two `data-kid-half` groups. The half with kid theme `lego` contains bricks; check for a `data-theme="lego"` marker on the scene group.
  - Date 2026-12-10 with default seasons → one `data-theme="christmas"` scene, no lego.
  - A shared jar renders a `data-shared-jar` whose x-centre is 400 ± 40.
  - `status: 'missing'` → the output contains `de.missing`, with no `data-kid-half`.
  - The kid name `'<script>'` appears only escaped.
  - `prevPoints {k1: 10}` with points 12 → exactly 2 `fb-new`. `prevPoints {k1: 12}` with points 12 → 0. `prevPoints {k1: 14}` with points 12 → 0.
  - 1 kid → one half spanning the full width. 3 kids → three halves, no NaN.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: compose board layout with halves, season scene and shared jars`.

### Task 10: The custom card element

**Files:**
- Modify: `src/family-board-card.ts`
- Create: `tests/card.test.ts`

**Interfaces:**
- Consumes: `normalizeConfig`, `toBoardModel`, `renderBoard`.
- Produces:
  - `class FamilyBoardCard extends LitElement`, registered as `family-board-card`.
  - Members: `setConfig(raw)`, `set hass(h)`, `getCardSize(): 8`, `static getStubConfig()` returning `{kids: [{id: '', theme: 'lego'}]}`.
  - It pushes `{type: 'family-board-card', name: 'Family Board', description: 'Gezeichnete Punkteanzeige für TaskMate'}` to `window.customCards`.
- Behaviour:
  - The `hass` setter computes the model and re-renders **only if** `JSON.stringify(model)` changed, or the local date changed (so the season switches at midnight).
  - Keeps `prevPoints` from the last rendered model.
  - Renders `unsafeSVG(renderBoard(...))` inside an `ha-card` with no padding and the background `PAPER`.
  - CSS keyframes for `.fb-new`: drop from `translateY(-40px)`, fade in over 700ms, `prefers-reduced-motion` → none.
  - Click on `[data-kid-half]` → if the kid has `tap_path`, `history.pushState(null, '', path)` and dispatch `new Event('location-changed', {bubbles: true, composed: true})` on `window`.

- [ ] **Step 1: Write failing tests** (jsdom; create the element, call `setConfig`, set `hass = {states: fixture}`, await `updateComplete`):
  - The shadow root contains 2 `[data-kid-half]`.
  - `setConfig({})` throws.
  - Setting the same `hass` object content twice → `render` is called once; spy on `renderBoard` via a module mock.
  - Clicking k1's half with `tap_path: '/family-board/aufgaben'` → `location.pathname === '/family-board/aufgaben'` and `location-changed` fired.
  - `hass` with no states → the text contains `de.missing`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS, and `mise run build` succeeds.
- [ ] **Step 5:** Commit `feat: add family-board-card custom element`.

### Task 11: Theme playground

**Files:**
- Create: `dev/index.html`, `dev/playground.ts`, `dev/fake-hass.ts`
- Modify: `mise.toml` (`dev` task already runs `vite dev/`; make sure `vite.config.ts` serves `dev/` with `src` importable)

**Interfaces:**
- Produces:
  ```ts
  export interface FakeKid { id: string; name: string; points: number; theme: string; colour: string }
  export interface FakeJar { id: string; name: string; icon: string; goal: number; allocations: Record<string, number>; shared: boolean; assignedTo: string[] }
  export function makeFakeHass(kids: FakeKid[], jars: FakeJar[]): { states: HassStates } // TaskMate-shaped states, consumed via the real adapter
  ```
- The page mounts a real `<family-board-card>`. Controls:
  - per kid: a points slider (0–200), a theme select (from `THEMES`), a name field;
  - a date input (for seasons);
  - add/remove a personal jar, add/remove a shared jar, with allocation sliders.

  Any change rebuilds `hass` and sets it on the card. Icons default to emoji (no `ha-icon` outside Home Assistant).

- [ ] **Step 1:** Write a test that `makeFakeHass` output passed through `toBoardModel` gives back the same kids, points, jars and contributions. Cover one personal and one shared jar.
- [ ] **Step 2:** Run → FAIL. Implement `fake-hass.ts`. Run → PASS.
- [ ] **Step 3:** Build `index.html` and `playground.ts`. Run `mise run dev` and open the printed URL. Sliding points animates new items, and switching the date to 10 December shows the Christmas scene.
- [ ] **Step 4:** Commit `feat: add theme playground`.

### Task 12: Local Home Assistant with TaskMate and demo data

**Files:**
- Create: `dev/ha/compose.yaml`, `scripts/fetch-taskmate.mjs`, `scripts/ha-client.mjs`, `scripts/dev-bootstrap.mjs`, `tests/ha-client.test.ts`
- Modify: `mise.toml`

**Interfaces:**
- Produces:
  - mise tasks:
    - `ha:up`: fetch TaskMate, `build`, then `docker compose -f dev/ha/compose.yaml up -d`, wait for `GET /api/` to respond, then bootstrap.
    - `ha:down`.
    - `ha:reset`: down, then delete `dev/ha/config` and `dev/ha/.token`.
    - `ha:seed`: bootstrap only.
  - `ha-client.mjs`:
    ```js
    export async function connect(baseUrl, token) // -> { call(msg): Promise<result>, close() }, via Node's global WebSocket, auth handshake, incremental ids
    export async function rest(baseUrl, token, method, path, body)
    ```
  - The dev login is `dev` / `dev` at `http://localhost:8123`.
- `compose.yaml`: service `homeassistant`, the pinned image, port `8123:8123`, volumes `./config:/config` and `../../dist:/config/www/family-board:ro`, `TZ=Europe/Berlin`.
- `fetch-taskmate.mjs`: reads `taskmate.version`, downloads `https://github.com/tempus2016/taskmate/releases/download/<version>/taskmate.zip`, and unzips it into `dev/ha/config/custom_components/taskmate/`. It is skipped if `manifest.json` there already has that version.
- `dev-bootstrap.mjs` is **idempotent**; each step checks first:
  1. If onboarding isn't done: `POST /api/onboarding/users` (`client_id` = `http://localhost:8123/`, name `Dev`, username `dev`, password `dev`, `language: 'de'`). Exchange the `auth_code` at `/auth/token`. Then `POST /api/onboarding/core_config`, `/api/onboarding/analytics`, `/api/onboarding/integration`.
  2. If `dev/ha/.token` is missing: WebSocket `auth/long_lived_access_token` (`client_name: 'family-board-dev'`, `lifespan: 3650`) and write it to the file. If onboarding was already done and there is no token, fail with a hint to run `ha:reset`.
  3. If there's no `taskmate` config entry: `POST /api/config/config_entries/flow {handler: 'taskmate'}`, then submit `{}`.
  4. Lovelace resource `/local/family-board/family-board-card.js` as `module`, if absent (`lovelace/resources`, then `lovelace/resources/create`).
  5. Demo data:
     - WebSocket `taskmate/setup_wizard/apply` with children `Mia` (ref `a`, colour `#d9534f`) and `Ben` (ref `b`, colour `#3b7dd8`) and two chores. The wizard skips existing names.
     - Rewards via `taskmate/add_reward`, only if no reward with that name exists:
       - `LEGO-Set`: cost 50, `pool_enabled`, assigned to Mia.
       - `Kino`: cost 20, `pool_enabled`, assigned to all.
       - `Pizza-Abend`: cost 40, `is_jackpot`.
       - `30 Min. Bildschirmzeit`: cost 10, plain.
     - Points via the services `taskmate/add_points` (reason `Demo`) and `taskmate/allocate_points_to_pool`, only when the kid's `total_points_earned` is 0, so points aren't duplicated. Target spendable balances 12 and 7, LEGO jar 22, Pizza-Abend `{Mia: 5, Ben: 8}`.
  6. Dashboard `family-board` (`lovelace/dashboards/create` if absent, then `lovelace/config/save`) with two views:
     - `board`: a panel view with `custom:family-board-card`, kids Mia → `lego`, Ben → `dino`, `tap_path: /family-board/aufgaben`;
     - `aufgaben`: `custom:taskmate-kiosk-card` for both kids plus a button card navigating back to `/family-board/board`.
- [ ] **Step 1: Write failing tests** for `ha-client.mjs` against a local `ws` test server (built-in `node:http` + Vitest; or mock the global `WebSocket`):
  - `connect` sends `{type: 'auth', access_token}` after `auth_required` and rejects on `auth_invalid`.
  - `call` resolves by matching `id` and rejects on `success: false` with the error message.
- [ ] **Step 2:** Run → FAIL. Implement `ha-client.mjs`. Run → PASS.
- [ ] **Step 3:** Implement compose, fetch and bootstrap. Run `mise run ha:up`. Expected: it finishes without error, and `http://localhost:8123/family-board/board` (login `dev`/`dev`) shows the LEGO tower with 12 bricks for Mia, the dino nest with 7 eggs for Ben, Mia's LEGO jar 22/50, a Kino jar on both sides, and the Pizza-Abend jar in the middle.
- [ ] **Step 4:** Run `mise run ha:seed` again. Expected: no duplicate kids, rewards or points (check the TaskMate panel).
- [ ] **Step 5:** Commit `feat: add local Home Assistant with TaskMate and demo data`.

### Task 13: Fixtures captured from real TaskMate

**Files:**
- Create: `scripts/capture-fixtures.mjs`, `tests/fixtures/taskmate-v7.12.0.json`
- Modify: `tests/adapter.test.ts`, `mise.toml` (task `fixtures:capture`)

**Interfaces:**
- Consumes: `ha-client.mjs` (`rest`), `dev/ha/.token`, `taskmate.version`.
- Produces: `capture-fixtures.mjs` writes `tests/fixtures/taskmate-<version>.json` containing only `sensor.taskmate_overview` and `sensor.taskmate_rewards` from `GET /api/states/<id>`, as a `HassStates` object.

- [ ] **Step 1:** With the local Home Assistant running (Task 12), run `mise run fixtures:capture` and check that the file exists.
- [ ] **Step 2:** Add a `describe.each` over every `tests/fixtures/taskmate-*.json`, with config kids = the fixture's children ids. Assert:
  - `status === 'ok'`, 2 kids found, points `[12, 7]`;
  - Mia's jars include `LEGO-Set` (22/50) and `Kino`;
  - Ben's jars are exactly `[Kino]`;
  - one shared jar `Pizza-Abend` with contributions summing to 13.
- [ ] **Step 3:** Run `mise run test -- adapter` → PASS. If it fails, the docs-based assumptions in Task 3 were wrong. Fix the adapter, not the fixture, and note the difference in the commit message.
- [ ] **Step 4:** Add a section "Updating TaskMate" to `README.md`:
  1. Bump `taskmate.version`.
  2. `mise run ha:reset && mise run ha:up`.
  3. `mise run fixtures:capture`.
  4. `mise run test`.
  5. Read the TaskMate release notes.
- [ ] **Step 5:** Commit `test: verify adapter against captured TaskMate v7.12.0 data`.

### Task 14: Release and deploy tooling

**Files:**
- Create: `.github/workflows/release.yml`, `hacs.json`, `scripts/deploy.mjs`, `deploy/compose.yaml`, `README.md` (complete)

**Interfaces:**
- Consumes: `ha-client.mjs` (`connect`), the built `dist/family-board-card.js`.
- Produces:
  - `release.yml`: on tag push `v*`, run typecheck, test and build, then create a GitHub release with `dist/family-board-card.js` attached (use `gh release create` with the default `GITHUB_TOKEN`).
  - `hacs.json`: `{"name": "Family Board Card", "filename": "family-board-card.js", "render_readme": true}`. This keeps the public-HACS route open.
  - `deploy.mjs`:
    - Usage: `node scripts/deploy.mjs <version>`.
    - Env: `FB_SSH_TARGET` (e.g. `user@server`), `FB_HA_WWW` (server path of `/config/www/family-board`), `FB_HA_URL`, `FB_HA_TOKEN`.
    - Downloads the release asset with `gh release download <version> -p family-board-card.js`, copies it with `scp`, then over the WebSocket updates the Lovelace resource whose url starts with `/local/family-board/family-board-card.js` to `...js?v=<version>`, creating it if absent.
    - Exits non-zero with a clear message on any missing env var.
  - `deploy/compose.yaml`: an example production Home Assistant (pinned image, `network_mode: host`, `restart: unless-stopped`, config volume) with comments on installing HACS, TaskMate pinned via HACS, the non-admin kids user, and the tablet kiosk.
  - `README.md` sections:
    - What it is.
    - Local development: `mise install`, `mise run dev`, `mise run test`, `mise run ha:up`.
    - Card configuration reference: every `CardConfig` field, with a full example YAML.
    - Updating TaskMate (from Task 13).
    - Release (`git tag vX.Y.Z && git push --tags`).
    - Deploy: the private route via `deploy.mjs`, and the public route via HACS, marked as undecided.
- [ ] **Step 1: Write a failing test** `tests/deploy.test.ts`:
  - `planResourceUpdate(resources, version)` (exported from `deploy.mjs`) returns `{action: 'update', id, url: '/local/family-board/family-board-card.js?v=1.2.0'}` when a resource `/local/family-board/family-board-card.js?v=1.1.0` exists, and `{action: 'create', url}` when none does.
  - The env check returns the missing variable names.
- [ ] **Step 2:** Run → FAIL. Implement `deploy.mjs` with `planResourceUpdate` and `missingEnv` exported. Run → PASS.
- [ ] **Step 3:** Write `release.yml`, `hacs.json`, `deploy/compose.yaml` and `README.md`. Validate the workflow YAML with `npx --yes @action-validator/cli .github/workflows/release.yml` (or `actionlint` via mise, if available).
- [ ] **Step 4:** Commit `ci: add release workflow and deploy tooling`.
