# New Themes Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the themes `pirates`, `underwater`, `football`, `construction`, `garden`, the season themes `martin` and `summer`, and a `birthday` theme that takes over one kid's half on their birthday (issues #1 and #6).

**Architecture:** Every theme is one hand-drawn file in `src/themes/` built from `docs/theme-template.ts`, registered in `THEMES`; tests, gallery, playground and browser check read that registry. `martin` and `summer` add a `renderSeasonScene` and a rule in `DEFAULT_SEASONS`. Birthdays are a per-kid `birthday: "MM-DD"` config field, a pure `isBirthday()` in `src/season.ts`, and a per-half override in `renderBoard` that also switches the shared season scene off for that day.

**Tech Stack:** Lit 3, roughjs, TypeScript, Vite, Vitest, Node via mise. Playwright in Docker for gallery shots. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-21-new-themes-round-design.md`. It continues `2026-11-20-more-themes-and-animation-design.md` and `2026-11-21-theme-polish-design.md` in the same folder, which still bind.

## Global Constraints

- Tools through mise only: `mise run test`, `mise run typecheck`, `mise run build`, `mise run gallery:shots`.
- README → "Adding a theme" is the recipe for every theme. Read it and `docs/theme-template.ts` first.
- `esc` on everything reaching the SVG as text or attribute, numbers through `num`. Everything inside the half's box.
- Animation: CSS only, `transform` and `opacity`. Classes `fb-anim fb-<id>-…`, 1 to 30 animated elements per half, at most 60 in a season scene and at most 60 on any board. Loops last at least 2 s. Never `fb-anim` on an `fb-item`. The reduced-motion still picture is complete.
- Theme css sets only `animation-name`, `animation-timing-function`, `transform-origin`, `transform-box`; every keyframe and class starts with `fb-<id>-`.
- Deterministic rendering (seeded sketches). Scenery drawn after the items uses its own sketch key so adding an item never re-wobbles it.
- Items never move when a point is added; merging small items into a big one is the only change.
- Existing snapshot files in `tests/__snapshots__/svg/` must not change. Only new files are added.
- Existing themes (`src/themes/*.ts` already there) are not changed.
- Kid-visible text is German. Theme ids are English and lowercase. No franchise names, characters or logos.
- Capacity: the largest count that keeps every item fully visible and apart, in a 400-wide half and in a 160-wide half.
- Nothing in a scene overlaps the header (top 17 % of the half) or the jar row (bottom 21 %); `placement()` handles this when you draw in your units.
- Conventional Commits. No `Co-authored-by`. No JIRA footer. One commit per task, footer `Refs #1` (Tasks 5 to 7: `Refs #1, #6`).

## Review Focus

1. **A five-kid board (160-wide halves) with a 4-digit total:** every new theme keeps all coordinates inside its half. *Test in each theme task (Step 1, "narrow half").*
2. **Points change on the birthday itself:** the new item pops in the birthday half, counted with the birthday theme's capacity, not the favourite's. *Test in Task 6.*
3. **The tablet stays on over midnight:** the board switches to and from the birthday picture on the next update without a reload. *Test in Task 6 (card test).*
4. **A birthday kid with 0 points:** the half still shows a complete birthday picture (a cake without candles), not an empty half. *Test in Task 5.*
5. **A parent writes `birthday` in another form** (`10.12.`, `2019-12-10`, an unquoted number): a clear config error naming the kid, not a silently ignored birthday. *Test in Task 6.*

## Theme recipe (Tasks 1 to 5 and 8 to 10)

Each theme task follows these steps; the task only lists what is specific.

- [ ] **Step 1: Write the failing test** `tests/themes/<id>.test.ts`, modelled on `tests/themes/halloween.test.ts` (seasonal) or `tests/themes/dog.test.ts` (favourite only):
  - `runThemeContract(THEMES.<id>)`; for a season theme also `runSeasonContract(THEMES.<id>)`.
  - `it('has its parts')`: every `data-part` name listed in the task is in `renderHalf` at 7 points.
  - `it('animates …')`: the class counts listed in the task, at 0, 7 and 1000 points.
  - `it('puts big items first')`: `data-item` kinds at 37 points equal `groupItems(37, capacity)` big then small.
  - `it('holds <capacity> small items')`: `capacity` points give `capacity` `data-item="small"`.
  - `it('keeps the scenery wobble when an item is added')`: `afterItems(half(8))` equals `afterItems(half(7))`.
  - `it('uses the kid colour')`: `half(0)` contains `#d9534f`.
  - `it('fits a narrow half')` (Review Focus 1): `coordsOutside(theme.renderHalf(contractCtx(theme, 4321, undefined, narrow)), narrow)` is `[]` for `narrow = { x: 160, y: 0, w: 160, h: 450 }`.
  - `it('draws no two items on top of each other')`: export the theme's item spots and their footprint as `halloween.ts` does (`spots(big, small)`, `footprint(spot)`), and check no overlap at `capacity`, 37, 199 and 1000 points.
- [ ] **Step 2: Run it:** `mise run test -- tests/themes/<id>.test.ts`. Expected: FAIL, `THEMES.<id>` is undefined.
- [ ] **Step 3: Write `src/themes/<id>.ts`** from `docs/theme-template.ts` (fix the imports as its header says, replace `template`), set `label`, and register it in `THEMES` in `src/themes/registry.ts` (append at the end of the object). Draw in own units with `placement()`/`at()`; items through `item()`; big items first.
- [ ] **Step 4: Add the theme to `FIVE_KID_BOARDS`** in `tests/snapshots.test.ts`, in the list the task names. Existing lists stay as they are.
- [ ] **Step 5: Season themes only:** append the default rule to `DEFAULT_SEASONS` in `src/config.ts`; extend the expected list in `tests/config.test.ts` ("defaults to … seasons", rename the test to list all rules' themes); add the rule to the `seasons` row of the README configuration table.
- [ ] **Step 6: Write the snapshots:** `mise run test -- -u tests/snapshots.test.ts`, then `git status --short tests/__snapshots__` must show only new files (`??`) plus, when a five-kid list grew, that list's `five-kids-<n>.svg`. No file of an earlier task's list may be modified once that list is full.
- [ ] **Step 7: README:** add the row to the theme table (name equal to `label`, one sentence on what the kid sees). Season themes: also name them in the sentence below the table that lists the themes with a season scene.
- [ ] **Step 8: Verify:** `mise run test` and `mise run typecheck`. Expected: all pass.
- [ ] **Step 9: Look at it:** `mise run gallery:shots`, then open `dev/screenshots/gallery-<id>.png` (and `gallery-season-<id>.png`). The scene reads at tablet size, the items are countable, big items are clearly bigger, nothing touches the header or the jars. Fix and repeat until it does. Name the PNG paths in the report. (`dev/screenshots/` is not committed.)
- [ ] **Step 10: Commit:** `git add -A src tests README.md && git commit -m "feat: add <Label> theme (<id>)" -m "Refs #1"`.

---

### Task 1: Piraten (`pirates`)

**Files:** Create `src/themes/pirates.ts`, `tests/themes/pirates.test.ts`. Modify `src/themes/registry.ts`, `tests/snapshots.test.ts`, `README.md`.

**Interfaces:** Produces `export const pirates: Theme` (`id: 'pirates'`, `label: 'Piraten'`), `spots`, `footprint`.

- Scene: a beach in front of the sea. An open treasure chest (`data-part="chest"`) with the lid up; the sea with a horizon (`data-part="sea"`); a small sailing ship on the water (`data-part="ship"`), its flag in the kid's colour and plain (no skull-and-bones logo copied from any franchise; a simple generic shape is fine); a palm (`data-part="palm"`).
- Small item: a gold coin, piling up in and in front of the chest. Big item: a gold bar, stacked beside the chest.
- Animation: `fb-pirates-bob` on the ship (exactly 1 per half: slow up-down with a slight tilt); `fb-pirates-wave` on 2 to 4 wave lines.
- `FIVE_KID_BOARDS`: start a third list `['pirates']`.

### Task 2: Unterwasser (`underwater`)

**Files:** Create `src/themes/underwater.ts`, `tests/themes/underwater.test.ts`. Modify registry, snapshots test, README.

**Interfaces:** Produces `export const underwater: Theme` (`label: 'Unterwasser'`), `spots`, `footprint`.

- Scene: below the surface. Blue water as the half background, a sandy sea floor (`data-part="floor"`), seaweed (`data-part="weed"`), a rock or coral (`data-part="coral"`), one fish (`data-part="fish"`) with the kid's colour.
- Small item: a shell lying on the sea floor in rows. Big item: an open shell with a pearl in it, clearly larger.
- Animation: `fb-underwater-bubble` on 6 to 10 rising bubbles (seeded positions and timing); `fb-underwater-swim` on the fish (exactly 1: one long cycle of 14 to 20 s in which it crosses the half and is out of view the rest of the time; clip it to the half as `racing.ts` clips its car; reduced motion shows the fish at rest inside the half); `fb-underwater-sway` on the seaweed.
- `FIVE_KID_BOARDS`: add to the third list.

### Task 3: Fußball (`football`)

**Files:** Create `src/themes/football.ts`, `tests/themes/football.test.ts`. Modify registry, snapshots test, README.

**Interfaces:** Produces `export const football: Theme` (`label: 'Fußball'`), `spots`, `footprint`.

- Scene: a pitch (`data-part="pitch"`) with a goal and net (`data-part="goal"`), a corner flag in the kid's colour (`data-part="flag"`).
- Small item: a football, lined up in rows on the grass beside the goal. Big item: a trophy. It must differ from the racing trophy (`src/themes/racing.ts`): a tall two-handled cup on a round foot with a ball on top.
- Animation: `fb-football-shot` on one extra, uncounted ball (`data-part="shot"`, exactly 1: a cycle of 10 to 14 s in which it bounces into the net during a small part and rests in the net otherwise, so the still picture shows a ball in the net); `fb-football-flag` on the corner flag.
- `FIVE_KID_BOARDS`: add to the third list.

### Task 4: St. Martin (`martin`, season)

**Files:** Create `src/themes/martin.ts`, `tests/themes/martin.test.ts`. Modify registry, `src/config.ts`, `tests/config.test.ts`, snapshots test, README.

**Interfaces:** Produces `export const martin: Theme` (`label: 'St. Martin'`) with `renderHalf` and `renderSeasonScene`; `DEFAULT_SEASONS` gains `{ theme: 'martin', from: '11-01', to: '11-11' }` (appended).

- Half: a dusk sky with a few stars, a row of dark house silhouettes with lit windows (`data-part="houses"`), a moon (`data-part="moon"`), and the kid's lantern stick with a line (`data-part="line"`) on which the lanterns hang in rows.
- Small item: a small paper lantern in varied warm colours. Big item: a big round sun-or-moon lantern in the kid's colour.
- Animation: `fb-martin-flicker` on the glow of at most the first 8 lanterns (opacity only; the glow is a separate element behind the lantern, never the `fb-item`); `fb-martin-twinkle` on 3 to 5 stars.
- Season scene: one continuous dusk street across the board; one lantern line per kid via `seasonPlacement()` and `seasonKid()`, as `halloween.ts` places its buckets. Keep the middle band free of figures. At most 30 `fb-anim` elements in the scene: add `it('animates at most 30 elements in the season scene')` at `scene(1000, 1000)`.
- No horse, rider or saint figure: lanterns only.
- `FIVE_KID_BOARDS`: add to the third list.

### Task 5: Geburtstag theme (`birthday`)

**Files:** Create `src/themes/birthday.ts`, `tests/themes/birthday.test.ts`. Modify registry, snapshots test, README (theme table row only; the config docs come in Task 6).

**Interfaces:** Produces `export const birthday: Theme` (`id: 'birthday'`, `label: 'Geburtstag'`, `renderHalf` only, **no** `renderSeasonScene`), `spots`, `footprint`. Task 6 reads it as `THEMES.birthday`.

- Scene: a table (`data-part="table"`) with a big cake (`data-part="cake"`, icing in the kid's colour), a bunting line across the top of the scene band (`data-part="bunting"`), one balloon on a string (`data-part="balloon"`).
- Small item: a candle on the cake, in rows over the cake's tiers (the cake is wide; candles also stand on a second and third tier). Big item: a wrapped present with a bow, beside the cake on the table and floor.
- Animation: `fb-birthday-flame` on the flames of at most the first 8 candles (the flame is a separate element drawn after the candle item, not the `fb-item` itself); `fb-birthday-sway` on the balloon (exactly 1). At most 15 `fb-anim` per half: test it at 1000 points.
- Extra test (Review Focus 4): at 0 points the half contains `data-part="cake"`, `data-part="table"`, `data-part="bunting"` and no `data-item`.
- Extra test: `seasonThemeIds()` does not contain `'birthday'`.
- `FIVE_KID_BOARDS`: add to the third list (now full: `['pirates', 'underwater', 'football', 'martin', 'birthday']`).

### Task 6: Birthday override (config, date check, board)

**Files:**
- Modify: `src/config.ts`, `src/season.ts`, `src/board.ts`, `README.md`
- Test: `tests/config.test.ts`, `tests/season.test.ts`, `tests/board.test.ts`, `tests/card.test.ts`, `tests/snapshots.test.ts`

**Interfaces:**
- Consumes: `THEMES.birthday` (Task 5).
- Produces: `KidConfig.birthday?: string` (`"MM-DD"`, a real calendar day); `export function isBirthday(birthday: string, date: Date): boolean` in `src/season.ts`.

- [ ] **Step 1: Failing tests for `isBirthday`** in `tests/season.test.ts`:

```ts
describe('isBirthday', () => {
  it('is true on the day only', () => {
    expect(isBirthday('12-10', new Date(2026, 11, 10))).toBe(true);
    expect(isBirthday('12-10', new Date(2026, 11, 9))).toBe(false);
    expect(isBirthday('12-10', new Date(2026, 11, 11))).toBe(false);
  });
  it('uses the local date', () => {
    expect(isBirthday('12-10', new Date(2026, 11, 10, 23, 59))).toBe(true);
    expect(isBirthday('12-10', new Date(2026, 11, 10, 0, 0))).toBe(true);
  });
  it('shows a 29 February birthday on 28 February in non-leap years', () => {
    expect(isBirthday('02-29', new Date(2027, 1, 28))).toBe(true);
    expect(isBirthday('02-29', new Date(2027, 2, 1))).toBe(false);
  });
  it('shows a 29 February birthday only on the 29th in leap years', () => {
    expect(isBirthday('02-29', new Date(2028, 1, 29))).toBe(true);
    expect(isBirthday('02-29', new Date(2028, 1, 28))).toBe(false);
  });
  it('leaves a 28 February birthday alone', () => {
    expect(isBirthday('02-28', new Date(2028, 1, 29))).toBe(false);
    expect(isBirthday('02-28', new Date(2028, 1, 28))).toBe(true);
  });
});
```

- [ ] **Step 2: Failing config tests** in `tests/config.test.ts` (Review Focus 5), using the file's `base` config pattern:
  - `birthday: ' 12-10 '` normalizes to `'12-10'`; `'02-29'` is accepted; a kid without it has no `birthday` key.
  - Each of `'10.12.'`, `'2019-12-10'`, `'12-1'`, `'13-01'`, `''`, and the numbers `1210` and `12` throws `kids[0]: birthday must be formatted MM-DD`.
  - Each of `'02-30'`, `'04-31'`, `'06-31'`, `'11-31'` throws `kids[0]: birthday is not a calendar day`.
- [ ] **Step 3: Failing board tests** in `tests/board.test.ts`, new `describe('birthday')`. Board: `k1` (`bricks`, `birthday: '12-10'`) and `k2` (`dino`). `halfOf(svg, id)` = the markup of `<g data-kid-half="id">…` (the file has helpers for cutting halves; reuse them).
  - 10 June birthday, date 10 June (no season): k1's half has `data-theme="birthday"`, k2's has `data-theme="dino"`.
  - The day before and after: k1's half has `data-theme="bricks"`.
  - 10 December (Christmas season): no `data-season-kid` anywhere; k1's half has `data-theme="birthday"`; k2's half has `data-theme="christmas"` and a `<rect` filled with `THEMES.christmas.background`; no `fill="transparent"` hit rect.
  - 10 December without any `birthday`: unchanged, two `data-season-kid`.
  - Both kids on birthday in December: both halves `data-theme="birthday"`, no `data-season-kid`.
  - Birthday kid not found in TaskMate (`found: false`) in December: the season scene stays, with one `data-season-kid` (k2), and k1's half shows `de.kidNotFound`.
  - A kid on the board without a config entry is never a birthday kid.
  - Review Focus 2: k1 on birthday with `prevPoints: { k1: 31 }` and 32 points: exactly one `fb-new` in k1's half, and the half's `data-item` count equals `groupItems(32, THEMES.birthday.capacity)` big + small.
  - Tap: with `tap_path` set, the birthday half keeps `data-tappable="true"`.
  - Budget: for every theme with a season scene, on a date in its default season, k1 on birthday: at most 60 `class="fb-anim`.
- [ ] **Step 4: Failing card test** in `tests/card.test.ts` (Review Focus 3), following the file's existing pattern for the date key: a card with `k1` `birthday: '12-10'`, `card.now` returning 9 December, `hass` set, then `card.now` returning 10 December and `hass` set again with the same states: the rendered SVG now contains `data-theme="birthday"`; one more day later it no longer does.
- [ ] **Step 5: Run them:** `mise run test -- tests/season.test.ts tests/config.test.ts tests/board.test.ts tests/card.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 6: Implement `isBirthday(birthday: string, date: Date): boolean`** in `src/season.ts` (reuse `mmdd`): true when `mmdd(date) === birthday`, or when `birthday === '02-29'`, the date is 28 February and its year is not a leap year.
- [ ] **Step 7: Implement the config field** in `src/config.ts`: `birthday?: string` on `KidConfig`; in `normalizeKid`, when `raw.birthday !== undefined`: not a string or not matching `MM_DD` after trimming → `kids[i]: birthday must be formatted MM-DD`; not a day of that month in a leap year (use `new Date(2028, m - 1, d)` and compare the month) → `kids[i]: birthday is not a calendar day`. The season date check stays as it is.
- [ ] **Step 8: Implement the override** in `renderBoard` (`src/board.ts`):
  - `birthdayIds`: ids of kids with `found`, a config entry with `birthday`, and `isBirthday(kc.birthday, opts.date)`.
  - `seasonal` is null when `birthdayIds` is not empty (the shared scene is not drawn that day).
  - A half's theme: `THEMES.birthday` for a birthday kid, else as today (`seasonal ?? seasonTheme ?? favourite`).
  - Nothing else changes: with `seasonal` null every half takes the existing non-season path (opaque background, `renderHalf`).
- [ ] **Step 9: Two snapshots** in `tests/snapshots.test.ts`: give `board()` an optional `birthdays: Record<string, string>` (kid id → `MM-DD`) that sets `birthday` on the kid configs, and add
  - `birthday-beside-dino`: `board(['bricks', 'dino'], [12, 37], JUNE, false, { k1: '06-01' })`;
  - `birthday-in-christmas`: `board(['bricks', 'dino'], [12, 37], new Date(2026, 11, 10), true, { k1: '12-10' })`.

  Add both file names to the `expected` list of the orphan check. Write them with `mise run test -- -u tests/snapshots.test.ts`; `git status --short tests/__snapshots__` shows only these two new files.
- [ ] **Step 10: README:**
  - `kids[]` table: `birthday` | none | `MM-DD`. On that day the kid's half shows the Geburtstag theme, whatever their favourite and the season. A 29 February birthday is shown on 28 February in other years.
  - Add `birthday: "12-10"` to one kid in the YAML example.
  - Below the theme table: Geburtstag is not a season; on a birthday inside a season with a shared scene, the shared scene is not drawn that day and the other kids see the season theme's own half picture.
- [ ] **Step 11: Verify:** `mise run test && mise run typecheck`. Expected: all pass, no existing snapshot changed.
- [ ] **Step 12: Commit:** `git commit -m "feat: show the birthday theme on a kid's half on their birthday" -m "Refs #1, #6"`.

### Task 7: Birthday in the playground, the gallery and the browser check

**Files:** Modify `dev/playground.ts`, `dev/gallery.ts`, `scripts/gallery-shots.mjs`, `scripts/browser-check.mjs`, `README.md`. Read `dev/fake-hass.ts` first.

**Interfaces:** Consumes `kids[].birthday` (Task 6).

- [ ] **Step 1: Playground:** per kid a checkbox "hat heute Geburtstag". When set, `applyConfig()` passes `birthday` as the playground date's `MM-DD` for that kid, so it follows the date field and can be combined with every "Saison" option.
- [ ] **Step 2: Gallery:** one extra tile named `birthday-in-christmas`: Mia (`k1`) with `birthday` on the Christmas default season's start date and that date as `card.now`, default seasons on, favourites `bricks` and `dino`. Extend `addTile` with an optional per-kid config patch instead of copying it.
- [ ] **Step 3: `scripts/gallery-shots.mjs`:** the expected first `[data-theme]` also strips a `-in-<season>` suffix (`birthday-in-christmas` → `birthday`). For this tile also fail when the card contains a `[data-season-kid]` or when the second half's `[data-theme]` is not `christmas`.
- [ ] **Step 4: `scripts/browser-check.mjs`:** after the season loop, two checks with Mia's `birthday` set to today (`mmdd(today)`): seasons off → themes are `birthday` and Ben's own theme, screenshot `ha-birthday.png`; a `christmas` season covering today → themes are `birthday` and `christmas`, no `[data-season-kid]`, screenshot `ha-birthday-season.png`. Restore the original dashboard config afterwards as the script already does. Update the header comment listing the screenshots.
- [ ] **Step 5: README:** mention the playground checkbox in the Themes section and the two new screenshots in the `ha:screenshot` paragraph.
- [ ] **Step 6: Verify:** `mise run typecheck && mise run test && mise run gallery:shots`. Expected: all pass; open `dev/screenshots/gallery-birthday-in-christmas.png` and check that the birthday half and the Christmas half are both complete pictures. `mise run ha:screenshot` needs the local Home Assistant (`mise run ha:up`); run it if it comes up, otherwise say in the report that it was not run.
- [ ] **Step 7: Commit:** `git commit -m "feat: preview birthdays in the playground, the gallery and the browser check" -m "Refs #1, #6"`.

### Task 8: Baustelle (`construction`)

**Files:** Create `src/themes/construction.ts`, `tests/themes/construction.test.ts`. Modify registry, snapshots test, README.

**Interfaces:** Produces `export const construction: Theme` (`label: 'Baustelle'`), `spots`, `footprint`.

- It must not read as the toy-brick tower of `src/themes/bricks.ts` (look at `tests/__snapshots__/svg/bricks-12-37.svg`): this is a building site.
- Scene: bare earth (`data-part="ground"`), a yellow excavator (`data-part="excavator"`) with a cab stripe in the kid's colour, a traffic cone and a barrier (`data-part="barrier"`), a wall under construction.
- Small item: a plain red clay brick laid into a wall in running bond (every second row offset by half a brick), growing from the bottom left. Big item: a wooden pallet stacked with bricks, standing beside the wall.
- Animation: `fb-construction-arm` on the excavator's arm (exactly 1: slow swing around its joint at the cab; set `transform-origin` at the joint); `fb-construction-blink` on a warning light on the barrier (opacity).
- `FIVE_KID_BOARDS`: start a fourth list `['construction']`.

### Task 9: Garten (`garden`)

**Files:** Create `src/themes/garden.ts`, `tests/themes/garden.test.ts`. Modify registry, snapshots test, README.

**Interfaces:** Produces `export const garden: Theme` (`label: 'Garten'`), `spots`, `footprint`.

- Scene: a flower bed (`data-part="bed"`) in front of a wooden fence (`data-part="fence"`), a watering can in the kid's colour (`data-part="can"`), a sun or cloud.
- Small item: a small flower on a short stem, petals in varied colours, in staggered rows in the bed. Big item: a tall sunflower standing at the fence behind the bed, clearly taller than the flowers.
- Animation: `fb-garden-bee` on 2 or 3 bees (`data-part="bee"`; each flies a small loop near the flowers; seeded positions and timing); `fb-garden-sway` on at most 4 sunflower heads or leaves (a separate element, not the `fb-item`).
- `FIVE_KID_BOARDS`: add to the fourth list.

### Task 10: Sommer (`summer`, season)

**Files:** Create `src/themes/summer.ts`, `tests/themes/summer.test.ts`. Modify registry, `src/config.ts`, `tests/config.test.ts`, snapshots test, README.

**Interfaces:** Produces `export const summer: Theme` (`label: 'Sommer'`) with `renderHalf` and `renderSeasonScene`; `DEFAULT_SEASONS` gains `{ theme: 'summer', from: '07-15', to: '08-31' }` (appended).

- It must differ from `underwater` (Task 2): a sunny beach above the water, warm palette.
- Half: sand (`data-part="sand"`), sea and sky with a sun (`data-part="sun"`), a sandcastle with a flag in the kid's colour (`data-part="castle"`), a bucket in the kid's colour (`data-part="bucket"`).
- Small item: a shell, in and around the bucket on the sand. Big item: a starfish, clearly larger, on the sand beside the castle.
- Animation: `fb-summer-flag` on the castle flag (exactly 1 per kid); `fb-summer-wave` on 2 to 4 wave lines; `fb-summer-ray` on the sun's rays (one group, slow rotation).
- Season scene: one continuous beach across the board; one bucket-and-castle group per kid via `seasonPlacement()` and `seasonKid()`. Middle band free of figures. At most 30 `fb-anim` elements: test at `scene(1000, 1000)`.
- `FIVE_KID_BOARDS`: add to the fourth list (`['construction', 'garden', 'summer']`).

### Task 11: Final check and screenshots for the parents

**Files:** Modify `README.md` only if something is missing.

- [ ] **Step 1:** `mise run typecheck && mise run test && mise run build`. Expected: all pass.
- [ ] **Step 2:** `git diff master --stat -- tests/__snapshots__` shows only added files (no modified existing snapshot). `git diff master --stat -- src/themes` shows only new files and `registry.ts`.
- [ ] **Step 3:** `mise run gallery:shots`. Expected: every tile passes, including the eight new themes, `season-martin`, `season-summer` and `birthday-in-christmas`.
- [ ] **Step 4:** Look at all new PNGs side by side for the "themes that look alike" check: `construction` vs `bricks`, `underwater` vs `summer`, `football` vs `racing`. Report any pair that reads alike.
- [ ] **Step 5:** README read-through: theme table has 18 rows with names equal to the labels; the `seasons` row lists five default rules; the `kids[]` table has `birthday`; the "Adding a theme" section still matches what was done.
- [ ] **Step 6:** Commit any README fix: `git commit -m "docs: …" -m "Refs #1"`. Report the screenshot paths for the parents' review.
