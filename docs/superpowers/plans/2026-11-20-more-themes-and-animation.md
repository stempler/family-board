# More Themes and Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The board gets more to look at:
- a dino with a body;
- slow ambient CSS animations in every theme;
- five new favourite themes (wizard, racing, space, rescue, chess);
- two new season themes (halloween, easter), with Easter dates computed every year;
- a gallery page that shows every theme at once, for the parents' visual review.

**Architecture:**
- Themes stay one hand-drawn file each under `src/themes/`, as in the existing code (approach A in the spec).
- Animation is CSS only:
  - A theme may export a `css` string. The card adds it to its static styles at module load.
  - Animated parts carry the class `fb-anim` plus a theme-prefixed class.
  - Per-element timing goes in CSS custom properties.
- Season rules learn `easter±N`. Each rule is resolved to `MM-DD` for the date's year before the existing comparison runs.

**Tech Stack:** unchanged from `docs/superpowers/plans/2026-11-20-family-board-card.md`: Node 26.13.1 (mise), TypeScript 7.0.2, Vite 8.3.8, Vitest 5.1.1, Lit 3.3.3, roughjs 4.6.6, and Playwright 1.65.1 in Docker for screenshots. There are no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-20-more-themes-and-animation-design.md`. It builds on `docs/superpowers/specs/2026-11-20-bonus-points-display-design.md`.

## Global Constraints

**Carried over from the first plan:**
- Tools come from mise only.
- Never write to Home Assistant.
- TaskMate attribute names live only in `src/adapter.ts`.
- Kid-visible strings are German, in `src/i18n.ts`.
- Everything reaching `unsafeSVG` is escaped (`esc`), and numbers go through `num`.
- The viewBox is `0 0 800 450`.
- Conventional Commits, no `Co-authored-by`, no JIRA issue.

**Dependencies and animation technique:**
- **No new runtime dependencies** for animation, and no new dev dependencies.
- **Animation is CSS only**, using `@keyframes` on `transform` and `opacity`.
  - No `requestAnimationFrame` or timers driving motion. No animated SVG filters.
- Animating a `<g>` needs `transform-box: fill-box` (or `view-box`) and an explicit `transform-origin`.

**Reduced motion:**
- Under `prefers-reduced-motion: reduce`, all ambient animation stops.
- The still frame must look complete: snowflakes, stars and the rest stay at their resting positions.

**Animation budget:**
- At most about 60 animated elements on the whole board at once (both halves plus the season scene).
- Every element carrying the `fb-anim` class counts as one, so each snowflake counts.
- Particle effects scale with their area: a half gets about half the particles of a full-width season scene.
- Christmas snow: about 25–30 flakes on the full-width season scene, about 12–15 per half.
- Loops last at least 2 s.
- Occasional gestures run as one long keyframe cycle of 8–20 s, in which the gesture takes up a small part.

**Determinism:**
- Positions, durations and delays of ambient elements come from the seeded generator, so the same input renders the same SVG.
- Two kids' halves get different delays, seeded by `seedKey`.

**Theme ids and season dates:**
- Theme ids are English and lowercase: `christmas`, `lego`, `dino`, `wizard`, `racing`, `space`, `rescue`, `chess`, `halloween`, `easter`.
- Default seasons, in this order:
  1. christmas `12-01`–`12-26`
  2. halloween `10-24`–`10-31`
  3. easter `easter-7`–`easter+1`
- Season `from`/`to` accept `MM-DD`, `easter`, `easter-N` or `easter+N`, where N is a whole number from 0 to 60.
  - A rule may mix the forms.
  - A rule with a relative end does not wrap over the year end.

**Anti-goal: no franchise names, characters or logos.** No Hogwarts, no lightsaber, no Chase, no Lightning McQueen. The worlds are generic and *inspired by* them.

**Plan-level rules (decided here; they bind every task):**
- **Theme CSS:**
  - Every `@keyframes` name and class in a theme's `css` starts with `fb-<id>-`.
  - Theme CSS sets only `animation-name`, `animation-timing-function`, `transform-origin` and `transform-box`.
  - Duration, delay and iteration come from the shared `.fb-anim` rule, through `--t` and `--d`.
- **Never put `fb-anim` on an element that also has `fb-item`.** `fb-new` uses `transform` for its drop. To animate a counted item, wrap the item's body in an inner `<g class="fb-anim …">` inside the `fb-item` group.
- **Ambient shapes must not shift the wobble of existing shapes.**
  - Particles (snowflakes, stars, sparkles) are plain SVG elements, not rough.js shapes.
  - Any new rough.js scenery in an existing theme uses its own sketch key (e.g. `${seedKey}:anim`), so the call indices of existing shapes don't change.
- **Per half, a theme emits at least 1 and at most 30 `fb-anim` elements.** It must hold for 0, 7, 30 and 1000 points. A season scene emits at most 60.
- **Season scenes mark each kid's object with `data-season-kid="<kidId>" data-cx="<centre x>"`.** Christmas keeps its existing `data-tree` as well, because `scripts/browser-check.mjs` uses it.

## Review Focus

1. **A board where both kids pick the same busy theme at 1000 points:** it stays within the 60-element budget and inside its halves. *Tests: the contract cap in Task 3 and the board budget test in Task 3.*
2. **Reduced motion on the tablet or iPad:** nothing moves, and nothing is missing or stuck mid-move. For example, no snowflakes off-screen and no arm frozen mid-wave. *Tests: the card style test in Task 3; the gallery shots are taken with `reducedMotion: 'reduce'` (Task 1).*
3. **A new item arriving on an animated theme:** the `fb-new` drop still plays and the item lands in its slot. The ambient animation doesn't fight it. *Test: the "no element is both fb-item and fb-anim" contract check in Task 3.*
4. **Season rules a parent writes by hand:** for example `easter+70`, `easter-0`, `ostern`, a mixed `03-01`–`easter+1`, or a rule copied from last year. Valid ones work every year. Invalid ones give a clear English config error, not a silent no-op. *Tests in Task 4.*
5. **Adding an egg, gem or candy doesn't make the rest of the scene re-wobble:** the scenery drawn after the items keeps its strokes. *Tests: the "keeps its wobble" check in the theme task template.*

---

## Theme task template (Tasks 5–11 follow this)

Each new theme task has the same shape. The task itself lists only its specifics:

- **File:** `src/themes/<id>.ts`, exporting `const <id>: Theme`. Register it in `src/themes/registry.ts`.
- **Test file:** `tests/themes/<id>.test.ts` with:
  - `runThemeContract(THEMES.<id>)`;
  - a "scenery keeps its wobble when an item is added" test, comparing markup drawn after the last `fb-item` at points N and N+1. Use the `afterOrnaments` approach from `tests/themes/christmas.test.ts`, which Task 3 moves into `theme-contract.ts` as `afterItems`. Skip this test only if the theme draws nothing after its items.
- **Visual check:** run `mise run gallery:shots` (Task 1) and look at `dev/screenshots/gallery-<id>.png` before committing.
  - Check that it reads as the described scene at tablet size.
  - Check that the items are countable.
  - Check that nothing overlaps the header (top 17 %) or the jar row (bottom 21 %).
  - Mention the PNG path in the report.
- **CSS:** the theme exports `css` with its keyframes, following the plan-level rules above.
- **Steps:**
  1. Write the test file. Run `mise run test -- tests/themes/<id>.test.ts` and expect it to FAIL because the theme is not registered.
  2. Implement the theme.
  3. Run the test file and expect PASS.
  4. Run `mise run test` and `mise run typecheck`, both green.
  5. Run `mise run gallery:shots` and look at the PNG.
  6. Commit `feat: add <German name> theme (<id>)`.

The scene tables in the spec (§4, §5) are each theme's requirements. The task text adds only what the spec leaves open and the plan decides.

---

### Task 1: Theme gallery page and screenshots

**Files:**
- Create: `dev/gallery.html`, `dev/gallery.ts`, `scripts/gallery-shots.mjs`
- Modify: `mise.toml` (task `gallery:shots`), `src/season.ts` (export `easterSunday` early), `.gitignore` if `dev/screenshots/` is not ignored yet
- Test: `tests/season.test.ts`

**Interfaces:**
- Consumes:
  - `FamilyBoardCard` with its `now` hook and `setConfig`/`hass`;
  - `dev/fake-hass.ts` (as used by `dev/playground.ts`);
  - `THEMES` from `src/themes/registry.ts`.
- Produces:
  - `export function easterSunday(year: number): Date` in `src/season.ts`, using the anonymous Gregorian (Meeus/Jones/Butcher) algorithm.
  - The page `/gallery.html` on the `mise run dev` server. Each tile is wrapped in `<figure data-gallery-tile="<name>">`.
  - The mise task `gallery:shots`, which writes `dev/screenshots/gallery-<name>.png`.

**Tiles:**
- One tile per theme in `THEMES`, named `<id>`. Two kids (Mia 12 points, Ben 37 points) both use that theme, with `seasons: []` so no season interferes.
- Plus one tile per theme that has `renderSeasonScene`, named `season-<id>`. It uses the default seasons, with `now` set to a date inside that season:
  - christmas: 15 December of the current year;
  - halloween: 28 October;
  - easter: `easterSunday(year)`.
- Each tile has a caption with the tile name.
- The fake hass gives both kids one savings jar, and there is one shared jar, so tiles show the layout with jars.

**`scripts/gallery-shots.mjs`:**
- Runs in the Playwright image, like `browser-check.mjs`.
- Opens `http://localhost:5173/gallery.html` with `reducedMotion: 'reduce'`, then waits for `document.fonts.ready`.
- Screenshots each tile element.
- Fails (exit 1) on:
  - a console error;
  - a tile whose card has no `[data-theme]`, or whose first `[data-theme]` value differs from the expected theme id;
  - a tile with no `data-kid-half`.

**The `gallery:shots` mise task:**
- Starts `vite dev/ --port 5173 --strictPort` in the background, waits until the port answers, and runs the Playwright container on the host network (same image and flags as `ha:screenshot`).
- Kills the dev server on exit, using `trap`.

- [ ] **Step 1:** Add to `tests/season.test.ts` a test that `easterSunday` returns the right date for these years:
  - 2026 → 2026-04-05
  - 2027 → 2027-03-28
  - 2028 → 2028-04-16
  - 2029 → 2029-04-01
  - 2030 → 2030-04-21

  Compare with `getFullYear`/`getMonth`/`getDate`. Run it and expect FAIL.
- [ ] **Step 2:** Implement `easterSunday`. Run it and expect PASS.
- [ ] **Step 3:** Build the gallery page and the shots script, and add the mise task.
- [ ] **Step 4:** Run `mise run gallery:shots`. Expect exit 0 and one PNG per tile: `christmas`, `lego`, `dino` and `season-christmas` at this point. Look at them.
- [ ] **Step 5:** Commit `chore: add theme gallery and gallery screenshots`.

### Task 2: Dino with a body

**Files:**
- Modify: `src/themes/dino.ts`
- Test: `tests/themes/dino.test.ts`

**Interfaces:**
- Consumes: the existing dino placement and egg slots. Egg positions must not change.
- Produces:
  - Groups `<g data-part="body">`, `<g data-part="tail">`, `<g data-part="feet">` and `<g data-part="head">` (head, eye, nostril, smile, cheek) inside the dino's scene markup, so Task 3 can animate them.

**Drawing:**
- **Body:** a large rounded body behind the nest. The nest front covers its lower part.
  - Its visible top sits above the nest rim, on the side the head is on today.
  - It covers roughly from the nest's centre to just past its right rim.
- **Neck:** grows out of the body's top and curves towards the eggs. The head stays roughly where it is.
- **Tail:** attached to the body. It curls out to the right of the body, away from the eggs. The tail on the left side today goes away.
- **Feet:** two clawed feet visible beside the nest's right rim.
- **Spikes:** run along the neck and down the body's back.
- **Drawing order:** ground, tail, body, neck and head, nest back, eggs, nest front.
  - The nest front, drawn after the eggs, keeps using its own `:nest` sketch, so adding an egg never changes its strokes.

- [ ] **Step 1:** In `tests/themes/dino.test.ts`, add these tests, then run them and expect FAIL:
  - `has a body, tail and feet`: the output for 7 points contains `data-part="body"`, `data-part="tail"`, `data-part="feet"` and `data-part="head"`.
  - `keeps the nest front's wobble when an egg is added`: use the after-last-item comparison.
- [ ] **Step 2:** Redraw the dino. Run the dino tests and the contract, and expect PASS.
- [ ] **Step 3:** Run `mise run gallery:shots` and check `gallery-dino.png`. It should read as one animal sitting behind the nest, with no floating parts. Then run `mise run test`.
- [ ] **Step 4:** Commit `fix: give the dino a body behind the nest`.

### Task 3: Animation layer and existing themes come alive

**Files:**
- Create: `src/draw/anim.ts`, `tests/anim.test.ts`
- Modify:
  - `src/themes/types.ts` (`css?: string`)
  - `src/themes/registry.ts` (`themeCss()`)
  - `src/family-board-card.ts` (styles, the static `themeIds`)
  - `src/themes/christmas.ts`, `lego.ts`, `dino.ts`
  - `tests/themes/theme-contract.ts`, `tests/themes/christmas.test.ts`, `tests/card.test.ts`, `tests/board.test.ts`

**Interfaces:**
- Produces:
  - `Theme.css?: string` (in `types.ts`).
  - `export function themeCss(): string` in `registry.ts`: every registered theme's `css`, joined.
  - `FamilyBoardCard.styles = [baseStyles, unsafeCSS(themeCss())]`.
    - `baseStyles` is the existing CSS plus a `.fb-anim` rule:
      - `animation-duration: var(--t, 10s)`
      - `animation-delay: var(--d, 0s)`
      - `animation-iteration-count: infinite`
      - `transform-box: fill-box`
    - The `prefers-reduced-motion: reduce` block also sets `.fb-anim { animation: none !important; }`.
  - `static get themeIds(): string[]` on `FamilyBoardCard`, returning `Object.keys(THEMES)`. Task 12's browser check reads it from the page.
  - In `src/draw/anim.ts`:
    - `rand(key: string): number`: in [0, 1), from `hashSeed`.
    - `timing(key: string, t: [number, number], dSpan?: number): string`: returns an inline style value `--t:<s>s;--d:-<s>s`. The duration is seeded within `[min, max]` and the delay is seeded negative, within `[0, dSpan ?? max]`. Values are rounded to 2 decimals.
    - `particles(key: string, box: Box, count: number, kind: 'snow' | 'sparkle'): string`: `count` plain `<circle>` elements. Each sits at a seeded resting position inside `box`, carries `class="fb-anim fb-fall"` (snow) or `class="fb-anim fb-sparkle"` (sparkle), and has a `timing` style.
    - `twinkle(key: string): string`: the attribute string `class="fb-anim fb-twinkle" style="…"`, for a group to spread.
    - `animCss: string`: the shared keyframes `fb-fall`, `fb-sparkle` and `fb-twinkle`. Shared names have no theme prefix; `baseStyles` includes them.
- `fb-fall` moves a flake from about 40 px above its resting position to about 40 px below it, with a slight sideways drift. So a reduced-motion still frame shows every flake at its resting position, inside the box, without crossing into the other half.

**Theme animations (spec §2):**
- **christmas:**
  - Snow with `particles(..., 'snow')`: 13 per half and 28 on the season scene, over the full box.
  - The tree-top star twinkles. Use the `twinkle` attribute on its group.
  - Snowflakes are plain elements appended last, so they don't touch any rough.js call index.
- **lego:**
  - The minifigure's raised arm and hand go into `<g class="fb-anim fb-lego-wave" style="${timing(seedKey+':wave',[9,11])}">`. The pivot is at the shoulder.
  - Keyframes `fb-lego-wave`: at rest for the first 80 %, then two or three swings of ±20°, then back to rest.
- **dino:**
  - Blink: a lid or scale on the eye, about every 6 s.
  - Slow head bob of 2–3 px over 4–5 s, on `data-part="head"` plus the neck top. Alternatively, a slight rotation of the head group around the neck join.
  - Tail sway: a few degrees, 3–4 s, pivot at the body.
  - Egg wobble: exactly one egg, the last small egg if there is one, wobbles about every 12 s. Use an inner `<g>` inside its `fb-item`.
  - Classes `fb-dino-blink`, `fb-dino-bob`, `fb-dino-sway`, `fb-dino-wobble`.

- [ ] **Step 1:** In `tests/anim.test.ts`, write these tests:
  - `rand` is deterministic and in [0, 1).
  - `timing('a', [9, 11])` matches `/^--t:\d+(\.\d+)?s;--d:-\d+(\.\d+)?s$/`, with t in [9, 11].
  - `particles('k', box, 13, 'snow')` gives 13 `class="fb-anim fb-fall"` circles, all `cx`/`cy` inside the box, no `NaN`, deterministic, and different for key `'k2'`.

  Run them and expect FAIL.
- [ ] **Step 2:** Extend `tests/themes/theme-contract.ts`:
  - Move `afterOrnaments` there as `export function afterItems(svg: string): string`.
  - Inside `runThemeContract`, for each points value, add these tests:
    - `animates between 1 and 30 elements`: the count of `class="fb-anim` is ≥ 1 and ≤ 30.
    - `never animates a counted item directly`: no `class="` attribute contains both `fb-item` and `fb-anim`.
  - Once per theme, add `prefixes its css`: every `@keyframes (name)` and every `.fb-<x>-` class in `theme.css ?? ''` starts with `fb-${theme.id}-`.

  In `tests/card.test.ts`, add `styles include reduced motion and every theme's css`. Join the `cssText` of `FamilyBoardCard.styles`. It contains `prefers-reduced-motion`, `.fb-anim` and `animation: none`, and for every theme with `css`, a substring of that css.

  In `tests/board.test.ts`, add `stays within the animation budget`:
  - Render with two kids, 1000 and 37 points.
  - Run it once with both kids on each favourite theme and `seasons: []`.
  - Run it again with the default seasons, on a date inside each season whose theme has `renderSeasonScene`.
  - Every render has ≤ 60 `class="fb-anim`.

  Run them and expect FAIL.
- [ ] **Step 3:** Implement `anim.ts`, the types, registry and card styles, and the three theme animations. Update `christmas.test.ts` to use `afterItems`.
- [ ] **Step 4:** Run `mise run test` and `mise run typecheck`, and expect all PASS. Run `mise run build`.
- [ ] **Step 5:** Run `mise run gallery:shots`. It uses reduced motion, so check that the stills look complete. Then open `mise run dev` → `/gallery.html` in a normal browser, or take one extra Playwright screenshot without reduced motion, to confirm that motion happens. Say which in the report.
- [ ] **Step 6:** Commit `feat: add ambient animations to christmas, lego and dino`.

### Task 4: Easter-relative season rules and new default seasons

**Files:**
- Modify: `src/config.ts`, `src/season.ts`, `README.md` (seasons section)
- Test: `tests/config.test.ts`, `tests/season.test.ts`

**Interfaces:**
- Consumes: `easterSunday` (Task 1).
- Produces:
  - `DEFAULT_SEASONS`:
    ```
    [{theme:'christmas',from:'12-01',to:'12-26'},
     {theme:'halloween',from:'10-24',to:'10-31'},
     {theme:'easter',from:'easter-7',to:'easter+1'}]
    ```
  - `activeSeason(date, seasons, knownThemes)` keeps its signature.
    - It resolves each end for `date.getFullYear()` to `MM-DD`.
    - A rule with any relative end matches only if `from <= to`, so it does not wrap.
    - Absolute-only rules keep the existing wrap behaviour.
  - `normalizeSeason` accepts `MM-DD` or `/^easter([+-](\d{1,2}))?$/` with N ≤ 60. It also trims the theme, the same way kid ids are trimmed.
  - The error stays `seasons[i]: from must be formatted MM-DD or easter±N`.

- [ ] **Step 1:** Write these tests, then run them and expect FAIL:
  - **config:**
    - `easter`, `easter-7`, `easter+1` and `easter+60` are accepted.
    - `easter+61`, `easter-61`, `ostern`, `easter+`, `easter 7` and `Easter-7` are rejected with `/MM-DD or easter/`.
    - The defaults equal the three rules above.
  - **season**, with the default seasons and `knownThemes` set to all three:
    - 2027-03-21 → easter
    - 2027-03-29 → easter
    - 2027-03-20 → null
    - 2027-03-30 → null
    - 2028-04-09 → easter
    - 2026-10-28 → halloween
    - 2026-12-24 → christmas
    - `{theme:'x', from:'03-01', to:'easter+1'}` on 2027-03-15 → x
    - `{theme:'x', from:'easter+1', to:'03-01'}` on 2027-01-15 → null (no wrap)
    - Unknown season themes are still skipped.
- [ ] **Step 2:** Implement it. Run `mise run test` and `mise run typecheck`, and expect PASS.
- [ ] **Step 3:** In the README seasons section, document the syntax, the new defaults, and that an empty `seasons: []` turns seasons off.
- [ ] **Step 4:** Commit `feat: add easter-relative season dates and halloween/easter defaults`.

The season themes `halloween` and `easter` are unknown until Tasks 10 and 11. Until then, `activeSeason` skips them, which the existing known-theme filter already handles.

### Task 5: Zauberschule (`wizard`)

Follow the theme task template. The spec §4 row is the requirement.

- **Slots:** gems fill the hourglass's lower bulb from the bottom up, in fixed slots (rows narrowing to the bulb's shape). Capacity is about 30.
- **Big item:** a large crystal, about 2×2 slots, placed bottom-first, the same way big bricks come first in LEGO.
- **Kid colour:** the gems are in the kid colour, as their "house colour". Big crystals are lighter or white-edged, so they read as special.
- **Animations:**
  - Sand trickle: a thin dashed line between the bulbs with a moving dash offset. Use `transform: translateY` on a dash pattern group, not `stroke-dashoffset`, to stay within transform and opacity.
  - Candle flame flicker (scale and opacity).
  - Owl blink about every 7 s.
  - 3–5 sparkles over the gems, using `particles(..., 'sparkle')`.
- **German name in the commit:** Zauberschule.

### Task 6: Rennstrecke (`racing`)

Follow the theme task template, using spec §4.

- **Slots:**
  - Medals hang on a two- or three-row shelf, in fixed hooks, filling left to right, top row first. Capacity is about 24.
  - Trophies stand on the top of the shelf or on a podium beside it. They come first.
- **Car:** the race car in the kid colour sits on a track strip at the bottom of the scene band, above the jar row. It is not an item.
- **Animations:**
  - Chequered flag wave (a skew or scale on the flag).
  - Every ~15 s, the car rolls about 20 px forward and back. Its translate must stay inside the half: the resting position plus the travel stays in the box.
  - The medal ribbons do not move.
- **German name in the commit:** Rennstrecke.

### Task 7: Weltraum (`space`)

Follow the theme task template, using spec §4.

- **Slots:**
  - Stars appear at fixed sky positions arranged as 3–4 simple constellations, with connecting lines drawn only between stars that both exist. Capacity is about 30.
  - Ringed planets take fixed larger slots first.
- **Scene:** a rocket stands on a small moon at the bottom of the scene band.
- **Animations:**
  - Stars twinkle through an inner group. Animate at most about 12 of them, chosen by seed, to stay within the budget.
  - Rocket flame flicker.
  - A comet crosses the sky's top band every ~18 s. It is visible for about 10 % of the cycle and stays inside the box.
- **Background:** dark, so the header and jar text must stay readable. Check the gallery shot. If it isn't readable, use a dusk blue rather than black and say so in the report.
- **German name in the commit:** Weltraum.

### Task 8: Rettungshunde (`rescue`)

Follow the theme task template, using spec §4.

- **Slots:**
  - Bones pile up beside the dog house in fixed pile slots, bottom row first. Capacity is about 30.
  - Gold paw badges hang on the dog house wall in fixed spots.
- **Pup:** a generic, round-eared puppy sitting by the house, with a scarf in the kid colour.
  - No uniforms, badges with letters, vehicles or other franchise cues.
- **Animations:**
  - Tail wag, about 1.5–2 s, small angle.
  - Ear twitch about every 8 s.
  - Head tilt about every 14 s.
- **German name in the commit:** Rettungshunde.

### Task 9: Schach (`chess`)

Follow the theme task template, using spec §4.

- **Board:** drawn at a slight angle (a parallelogram, 6×6 squares to stay readable). Capacity is 36.
- **Pieces:**
  - Pawns fill squares in reading order, starting at the near-left corner.
  - Queens take squares first, the same way the other themes put big items first.
- **King:** a big king at the side of the board. It is not an item.
- **Animations:**
  - A knight stands beside the board, not on it, so it isn't confused with an item. Every ~12 s it hops in a short arc and back.
  - The king tips its crown (a small rotation) about every 16 s.
- **German name in the commit:** Schach.

### Task 10: Halloween (`halloween`, season theme)

Follow the theme task template, using spec §5, and also:

- `renderSeasonScene(halves, box)` draws a night pumpkin patch with a crooked fence and a moon, plus one carved-pumpkin candy bucket per kid.
- Each bucket is in a group carrying `data-season-kid="<id>" data-cx="<x>"`. Bucket centres stay out of the centre band (x 360–440), as the Christmas trees do.
- **Small items:** candy heaped in and around the bucket, in fixed slots. Capacity is about 30.
- **Big items:** jack-o'-lanterns beside the bucket.
- **The kid's colour** is used on the bucket's handle or ribbon.
- **Animations:**
  - One ghost floating up and down: on the season scene, between the buckets above the shared jars; in a half, at the side.
  - A bat flutters across the sky band every ~15 s.
  - Lantern glow flicker (opacity) on at most the first 6 jack-o'-lanterns.
- **Tests:**
  - Create `tests/themes/season-contract.ts` with `runSeasonContract(theme)`, generalised from the Christmas season tests. For two kids (k1 12 points, k2 7 points) on the 800×450 box, it checks:
    - two `data-season-kid`;
    - centres outside 360–440;
    - 19 `data-item`;
    - no `NaN`;
    - coordinates inside the box;
    - the kid colour `#d9534f` appears;
    - ≤ 60 `fb-anim`.
  - Run it for halloween.
  - Add `data-season-kid`/`data-cx` to the Christmas trees as well, and run the contract for christmas too.
- **Default season:** `10-24`–`10-31` comes from Task 4.

### Task 11: Ostern (`easter`, season theme)

Same as Task 10, using spec §5:

- **Shared scene:** a spring meadow with flowers and one woven basket per kid, marked with `data-season-kid`/`data-cx`.
- **Small items:** painted eggs in fixed slots in and around the basket. Patterns vary by slot index: stripes, dots and zigzags. Colours come from a fixed pastel list, not random.
- **Big items:** chocolate bunnies beside the basket.
- **Kid colour:** the basket's bow.
- **Animations:**
  - A bunny sits at the meadow edge. Its ears twitch about every 7 s, and it hops in place about every 15 s.
  - 2–3 butterflies flutter along a short path, slowly.
- **Tests:** `runSeasonContract(THEMES.easter)` plus the template tests.
- **Note for the "keeps its wobble" check:** Easter eggs and dino eggs must look different. Easter eggs are painted and colourful; dino eggs are speckled cream.

### Task 12: Playground season switch, HA browser check per theme, README

**Files:**
- Modify: `dev/playground.ts`, `scripts/browser-check.mjs`, `README.md`

**Playground:**
- Add a "Saison" select next to the date field, with these options:
  - `keine`: today, with `seasons: []`.
  - `Weihnachten`: 15 December.
  - `Halloween`: 28 October.
  - `Ostern`: `easterSunday(year)`.
- Choosing an option sets the date and the config.
- The existing theme picker already lists every theme.

**Browser check** (`scripts/browser-check.mjs`), after the existing checks:
- Read `customElements.get('family-board-card').themeIds` in the page.
- **For each favourite theme** (one without a season scene):
  - Save the dashboard with both kids on that theme and `seasons: []`.
  - Open the board and screenshot it to `ha-theme-<id>.png`.
  - Check that `[data-theme]` equals the id and that at least one `.fb-anim` exists.
- **For each season theme:** save a rule covering today, screenshot it to `ha-season-<id>.png`, and check that the season scene's theme equals the id.
- Restore the original dashboard in the existing `finally`.
- The existing tree tap check stays.

**README:**
- Theme list: a table of id, German name and one line each.
- Animations and reduced motion.
- The `gallery:shots` and gallery page workflow.
- How to add a theme: the file, `css` rules, the contract tests and the gallery.

- [ ] **Step 1:** Implement the playground switch. Run `mise run dev` and pick each season once to check it by hand.
- [ ] **Step 2:** Extend the browser check. Run `mise run build`, `mise run ha:up` (or `ha:seed` if it is already up) and `mise run ha:screenshot`. Expect all checks ok, including one screenshot per theme.
- [ ] **Step 3:** Update the README. Run `mise run test` and `mise run typecheck`, and expect green.
- [ ] **Step 4:** Commit `docs: document themes and animations; check every theme in the browser`. If the browser-check change is substantial, split it into its own `test:` commit.

### After Task 12 (controller, not an implementer task)

- Run `mise run gallery:shots` once more and hand the parents the whole set for the batch review (spec §7).
- Their feedback becomes one polishing round, which is a new short plan or a direct fix list. It is not part of this plan.
