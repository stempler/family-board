# Fill the Screen and Ground-Coloured Jar Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a panel view the board fills the free area on any common screen shape, and six themes show their ground colour behind the jars.

**Architecture:** `renderBoard` gets an optional free-area size and derives the picture's width from it (scene height stays 450, extra ground below as fallback). Themes name an optional `ground` colour that the board paints over the jar section. The card decides whether to fill (`fill` option, panel-view lookup), measures the free area, and redraws on changes.

**Tech Stack:** TypeScript, Lit 3, roughjs, Vitest (jsdom), Vite, mise tasks, Playwright in Docker for gallery shots.

**Spec:** `docs/superpowers/specs/2026-11-23-fill-screen-and-ground-colour-design.md`

## Global Constraints

- With no `size`, `renderBoard` output is byte-identical to today except the jar section of pirates, underwater, birthday, construction, garden, summer (and garden's raised bed). No other snapshot file may change.
- Scene height is always 450; every half's `box.h` stays 450. No theme other than the six is edited.
- Width limits: `minW = max(160 × kids, 400)`, `maxW = 1600`.
- Config error text, verbatim: `fill must be auto, true or false`.
- Jar outline contrast: `INK` (`#3a2f28`) against every ground colour is at least 3:1.
- No new dependencies. Rendering stays deterministic (no `Math.random`, no `Date` in themes).
- Commits follow Conventional Commits, no `Co-authored-by`. Never commit `REVIEW_NOTES.md`, `.claude/`, `dev/screenshots/`.
- Never run `mise run ha:*` tasks (they recreate the user's Home Assistant container). Allowed: `mise run test`, `mise run typecheck`, `mise run build`, `mise run gallery:shots`.
- Snapshots are updated with `mise run test -- -u`; after every update, `git status` must show only the snapshot files the task names.

## Review Focus

1. A kiosk plugin hides the top bar after the first draw: the card moves up without resizing and must re-fill (Task 5).
2. The board nested in a stack inside a panel view must not fill under `auto` (Task 5).
3. Five kids on a 4:3 or portrait area: halves stay 160 wide, the picture grows taller, jars stay centred in the taller jar section, shared jars stay centred (Task 1).
4. A size-only redraw (rotation) must not mark any item as new (Task 5).
5. A season theme without `ground` in the taller fallback must not leave paper-coloured area below 450 (Task 1).

---

### Task 1: Board size from the free area

**Files:**
- Modify: `src/board.ts`
- Test: `tests/board.test.ts`

**Interfaces:**
- Produces:
  - `export interface AreaSize { w: number; h: number }`
  - `RenderOptions.size?: AreaSize`
  - `export function boardSize(size: AreaSize | undefined, kids: number): { w: number; h: number }`
  - `export const SCENE_H = 450` (the fixed scene height)

- [ ] **Step 1: Write failing tests for `boardSize`**

```ts
describe('boardSize', () => {
  it.each([
    [undefined, 2, 800, 450],
    [{ w: 1600, h: 900 }, 2, 800, 450],
    [{ w: 2304, h: 1440 }, 2, 720, 450],   // 16:10
    [{ w: 1024, h: 768 }, 2, 600, 450],    // 4:3
    [{ w: 2100, h: 900 }, 2, 1050, 450],   // 21:9
    [{ w: 4000, h: 900 }, 2, 1600, 450],   // capped
    [{ w: 1024, h: 768 }, 5, 800, 600],    // fallback: 5 × 160, taller
    [{ w: 900, h: 1600 }, 2, 400, 711],    // portrait, floor 400
    [{ w: 1024, h: 768 }, 0, 600, 450],
    [{ w: 0, h: 768 }, 2, 800, 450],
    [{ w: NaN, h: 768 }, 2, 800, 450],
  ])('%o with %i kids -> %i x %i', (size, kids, w, h) => {
    expect(boardSize(size, kids)).toEqual({ w, h });
  });
});
```

- [ ] **Step 2: Run** `mise run test -- tests/board.test.ts` — expected: FAIL, `boardSize` is not exported.

- [ ] **Step 3: Implement `boardSize`**

`w = round(450 × size.w / size.h)`. Above 1600: `{1600, 450}`. Below `minW`: `{minW, round(minW × size.h / size.w)}`. Missing, non-finite or non-positive size: `{800, 450}`.

- [ ] **Step 4: Write failing tests for `renderBoard` with a size** (use the existing helpers in `tests/board.test.ts` for model and config)

  - 16:10, two kids: `viewBox="0 0 720 450"`; the two `data-kid-half` background rects are 360 wide.
  - No size: output equals `renderBoard` without the option (string equality with a call that omits `size`).
  - 4:3, five kids: `viewBox="0 0 800 600"`; every kid jar and shared jar has `y` = 366 + 75; each half's background rect has height 600.
  - Shared jars at 720 and 1050 wide: the shared row's left and right margins are equal.
  - `status: 'missing'` and no kids with a 16:10 size: viewBox `0 0 720 450`, message at x 360.
  - Season (date in December, default seasons), 4:3 with five kids: a rect in the christmas theme's `background` covers y 450 to 600 across the full width, drawn before the halves.
  - Season, 16:10: `renderSeasonScene` receives a box 720 wide (assert via the scene's sky rect width).

- [ ] **Step 5: Run** the file — expected: FAIL on the new cases.

- [ ] **Step 6: Make `renderBoard` size-aware**

Replace the module constants `W`, `H`, `BOARD` by values computed per call from `boardSize(opts.size, model.kids.length)`. Thread them through `svg()`, `sharedFit`, `sharedSpan`, `jarRow` (jar y = `366 + (h − 450) / 2`), the halves (`box.h` = 450, background and hit rects use the full picture height), the season scene box (`{0, 0, w, 450}`) and the messages. In season mode with `h > 450`, paint `seasonal.background` from 450 to `h` before the scene.

- [ ] **Step 7: Run** `mise run test` and `mise run typecheck` — expected: all pass, `git status` shows no snapshot changes.

- [ ] **Step 8: Commit** `feat: draw the board for a given free-area shape`

---

### Task 2: Ground colour for five themes

**Files:**
- Modify: `src/themes/types.ts`, `src/board.ts`, `src/themes/{pirates,underwater,birthday,construction,summer}.ts`
- Test: `tests/board.test.ts`, `tests/themes/theme-contract.ts`
- Snapshots: only files of these five themes under `tests/__snapshots__/svg/`

**Interfaces:**
- Consumes: `SCENE_H`, size handling from Task 1; `SCENE_BOTTOM` from `src/draw/units.ts`.
- Produces: `Theme.ground?: string` — colour of the jar section; the board paints it from `SCENE_BOTTOM × 450` to the picture's bottom.

- [ ] **Step 1: Write failing tests**

  - Board, pirates for both kids: each half contains a rect with `data-ground`, `y` = 355.5, height 94.5, the half's x and width, fill `THEMES.pirates.ground`; it comes after the half's `data-theme` group and before the first jar.
  - Board, 4:3 with five kids on pirates: the ground rects reach `y + height` = 600.
  - Board, a kid that was not found on pirates: the ground rect is still drawn.
  - Board, summer season (date 1 August, default seasons): exactly one `data-ground` rect, x 0, full board width.
  - Board, bricks: no `data-ground` rect.
  - Registry-wide: `Object.values(THEMES).filter(t => t.ground).map(t => t.id).sort()` equals `['birthday','construction','pirates','summer','underwater']`. Task 3 adds `'garden'` to this list.
  - Contrast (in `theme-contract.ts`, run for themes with `ground`): WCAG contrast ratio between `#3a2f28` and `theme.ground` ≥ 3.
  - Contract: `theme.ground` appears as a fill in `renderHalf` output (it is a colour the scene already draws).

- [ ] **Step 2: Run** — expected: FAIL.

- [ ] **Step 3: Implement**

Add `ground?: string` to `Theme` with a one-line comment. Set it on the five themes to the colour each scene draws at its bottom edge: pirates `SAND`, underwater `SAND`, summer `SAND`, birthday `FLOOR` colour, construction `EARTH`. In `renderBoard`, paint `<rect data-ground …>` per half (or one across the board in season mode) after the scene and before header and jars.

- [ ] **Step 4: Update snapshots** with `mise run test -- -u`; check `git status` lists only pirates, underwater, birthday, construction and summer snapshot files, and that each diff is the added rect only.

- [ ] **Step 5: Run** `mise run test`, `mise run typecheck` — expected: pass.

- [ ] **Step 6: Commit** `feat: continue the ground colour behind the jars on five themes`

---

### Task 3: Garden — raised bed and grass behind the jars

**Files:**
- Modify: `src/themes/garden.ts`
- Test: `tests/themes/garden.test.ts`, the six-theme assertion from Task 2
- Snapshots: only garden files

**Interfaces:**
- Consumes: `Theme.ground` from Task 2.
- Produces: `garden.ground` = the `GRASS` colour; exported `BED_BOTTOM` (units) for the tests.

- [ ] **Step 1: Write failing tests**

  - `garden.ground` equals the lawn's fill colour; the Task 2 list assertion now names all six themes.
  - The bed path (`data-part="bed"`) has no point below `BED_BOTTOM`, and `BED_BOTTOM` is at least 6 units above the scene's bottom (260).
  - Every item footprint from `spots()` (all `mixes` from `tests/themes/layout.ts`) lies inside the bed: bottom edge ≤ `BED_BOTTOM`. The existing no-overlap and nothing-moves layout tests still pass.
  - Every soil clod lies above `BED_BOTTOM`.

- [ ] **Step 2: Run** `mise run test -- tests/themes/garden.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement**

Close the bed at `BED_BOTTOM` with rounded lower corners matching the upper ones, outlined in `SOIL_DARK`. Raise it only as far as a clearly visible lawn strip needs (start with 8 units). If the lowest flower row or clods no longer fit, re-space the rows evenly between `BED_TOP` and `BED_BOTTOM`; item sizes do not change.

- [ ] **Step 4: Update snapshots** (`mise run test -- -u`); `git status` lists only garden snapshot files.

- [ ] **Step 5: Look at it.** Run `mise run gallery:shots`, open the garden shots in `dev/screenshots/` with the Read tool, and check: lawn strip visible below the bed, no flower crossing the bed's edge, jars readable on the grass. Adjust `BED_BOTTOM` if not, then repeat step 4.

- [ ] **Step 6: Run** `mise run test`, `mise run typecheck` — expected: pass.

- [ ] **Step 7: Commit** `feat: end the garden bed above the lawn and show grass behind the jars`

---

### Task 4: `fill` option

**Files:**
- Modify: `src/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces: `CardConfig.fill: 'auto' | boolean` (always set after `normalizeConfig`, default `'auto'`).

- [ ] **Step 1: Write failing tests**

```ts
it.each([[undefined, 'auto'], ['auto', 'auto'], [true, true], [false, false]])('fill %o -> %o', (given, want) => {
  expect(normalizeConfig({ kids: [{ id: 'a' }], ...(given === undefined ? {} : { fill: given }) }).fill).toBe(want);
});
it.each(['yes', 1, null, 'true'])('rejects fill %o', (bad) => {
  expect(() => normalizeConfig({ kids: [{ id: 'a' }], fill: bad })).toThrow('fill must be auto, true or false');
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3:** implement in `normalizeConfig`; add `fill` to every hand-built `CardConfig` literal in tests that `tsc` then flags (`fill: 'auto'`). **Step 4:** `mise run test`, `mise run typecheck` — pass.

- [ ] **Step 5: Commit** `feat: add the fill option to the card config`

---

### Task 5: The card fills the free area

**Files:**
- Modify: `src/family-board-card.ts`
- Test: `tests/card.test.ts`

**Interfaces:**
- Consumes: `RenderOptions.size`, `AreaSize` (Task 1); `CardConfig.fill` (Task 4).
- Produces:
  - `card.measure?: () => AreaSize` — public override next to `now`; when set it replaces the window measurement.
  - `card.refit(): void` — public; measures again and redraws if the size changed (used by tests and the playground).

**Behaviour to implement**

- Filling is on when `fill === true`, or `fill === 'auto'` and the card is the panel view's own card: walking up from the card through `parentNode` and shadow hosts, the only elements allowed before `hui-panel-view` are `hui-card` wrappers; any other element first means "not in a panel view". Before coding the walk, confirm the nesting in the Home Assistant frontend source for the version in `dev/ha/compose.yaml` (`gh api repos/home-assistant/frontend/contents/src/panels/lovelace/views/hui-panel-view.ts`, and `hui-card.ts`), and note the version in a comment.
- Measurement (no `measure` override): `w` = the card's `getBoundingClientRect().width`, `h` = `window.innerHeight − rect.top`, both rounded to whole pixels. Either below 100: not filling for this draw.
- When filling: `ha-card` gets that height in px, the svg gets `width: 100%; height: 100%`, and `renderBoard` gets `size`. When not filling: exactly today's markup and styles.
- Re-measure triggers, all funnelled into `refit()`: a `ResizeObserver` on the card (skip when the class does not exist, as in jsdom), `window` `resize`, every `hass` set, and a 2 s interval while connected. All are removed in `disconnectedCallback`. The first measurement runs when the card is connected and has a config.
- The render cache key includes the size, so an unchanged size never redraws.
- A size-only redraw passes the stored previous points, which already equal the current points, so no item is new. Keep it that way: do not reset `_prevPoints` on a size change.

- [ ] **Step 1: Write failing tests** (attach the card to `document.body`; build a panel with `document.createElement('hui-panel-view')`, `attachShadow`, a `hui-card` child, the card inside)

  - `fill: true` with `measure = () => ({ w: 1152, h: 720 })`: svg viewBox is `0 0 720 450`; `ha-card` style height is `720px`.
  - `fill: 'auto'` inside the fake panel view with the same `measure`: fills.
  - `fill: 'auto'` inside `hui-panel-view` → `hui-card` → `hui-vertical-stack-card` → card: viewBox `0 0 800 450`, no inline height.
  - `fill: 'auto'` directly in `document.body`: not filling. `fill: false` inside the panel view: not filling.
  - `measure` returning `{ w: 80, h: 720 }`: not filling.
  - Without `measure`: stub `getBoundingClientRect` (`top: 56, width: 1152`) and `window.innerHeight = 776`: fills at 1152×720. Then the stub's `top` changes to 0 and `refit()` is called: `ha-card` height becomes `776px` and the viewBox width changes. With fake timers, the same change is picked up after 2 s without calling `refit()`, and by the next `hass` set.
  - Size-only redraw: after a points increase rendered `fb-new` items, change `measure`'s result and call `refit()`: the new svg has no `.fb-new`.
  - Same size on `refit()`: the svg string object is unchanged (no redraw).
  - After `card.remove()`, advancing timers and dispatching `resize` do not call `measure`.

- [ ] **Step 2: Run** `mise run test -- tests/card.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** as described above.

- [ ] **Step 4: Run** `mise run test`, `mise run typecheck`, `mise run build` — expected: pass.

- [ ] **Step 5: Commit** `feat: fill the free area of a panel view`

---

### Task 6: Dev tooling and docs

**Files:**
- Modify: `dev/playground.ts` (and its html if the controls live there), `dev/gallery.ts`, `scripts/browser-check.mjs`, `README.md`

**Interfaces:**
- Consumes: `card.measure`, `card.refit()`, `fill`, `RenderOptions.size`.

- [ ] **Step 1: Playground.** Add a shape picker next to the existing controls: "wie bisher" (no fill), 16:9, 16:10, 4:3, 21:9, Hochformat (9:16). A shape sets `fill: true`, sets `card.measure` to a box of that ratio that fits the playground's stage, and calls `card.refit()`; "wie bisher" removes both.

- [ ] **Step 2: Gallery.** Add tiles that pass a size, following how the existing special tiles (e.g. `birthday-in-christmas`) are defined: `shape-16-10`, `shape-4-3`, `shape-21-9` (two kids, pirates and garden), `shape-4-3-five-kids` (the taller fallback, mixed themes), `shape-4-3-five-kids-christmas` (season). Make sure `scripts/gallery-shots.mjs` captures them at their own aspect ratio.

- [ ] **Step 3: Look at them.** `mise run gallery:shots`, then open the new shots and the six ground themes with the Read tool. Check: no cut between scene and jar section on the six themes, jars centred in the taller jar section, nothing clipped at 720 and 1050 wide, no paper-coloured area in the season fallback. Report anything that looks wrong instead of tuning themes outside this plan's scope.

- [ ] **Step 4: Browser check.** In `scripts/browser-check.mjs` add, for viewports 1280×720, 1280×800 and 1024×768: the card's bottom edge is within 1 px of the viewport's bottom and `document.scrollingElement.scrollHeight <= innerHeight`. The dev dashboard is a panel view, so this exercises `auto`. The script needs the live Home Assistant and cannot be run in the sandbox: check it with `node --check scripts/browser-check.mjs` and say in the report that it was not run.

- [ ] **Step 5: README.** Add `fill` to the card options table (`auto` default: fills a panel view; `true`/`false` force it), one short paragraph on the behaviour (width follows the screen shape, taller ground when halves would get too narrow), and the `ground` property to the "Adding a theme" steps. Remove any text recommending the view-background workaround, if present.

- [ ] **Step 6: Run** `mise run test`, `mise run typecheck`, `mise run build` — expected: pass.

- [ ] **Step 7: Commit** `feat: shape picker, gallery tiles and browser checks for filling the screen` and `docs: describe the fill option and theme ground colour` (two commits).
