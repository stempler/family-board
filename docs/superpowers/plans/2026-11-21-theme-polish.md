# Theme Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the family board after the parents' review: the exact number next to the name, minimal-replacement grouping, renamed themes, and reworked space, racing, dino and chess themes.

**Architecture:** The general changes live in `src/items.ts` (grouping, new-item range), `src/config.ts` and `src/board.ts` (header). The theme fixes stay one hand-drawn file per theme plus the CSS-only animation layer. Chess gets an authored position table (`src/themes/chess-positions.ts`, FEN strings) and an optional `items` hook on `Theme`, so it can count wins and captures instead of using the generic grouping.

**Tech Stack:** Lit 3.3.3, roughjs 4.6.6, TypeScript 7.0.2, Vite 8.3.8, Vitest 5.1.1, Node 26.13.1 via mise. Playwright 1.65.1 in Docker for gallery shots.

**Spec:** `docs/superpowers/specs/2026-11-21-theme-polish-design.md`. It continues `docs/superpowers/specs/2026-11-20-more-themes-and-animation-design.md`, which still binds.

## Global Constraints

**Carried over unchanged** from `docs/superpowers/plans/2026-11-20-more-themes-and-animation.md` → "Global Constraints":
- mise only; never write to Home Assistant; TaskMate names only in `src/adapter.ts`; German kid-visible strings in `src/i18n.ts`.
- `esc` on everything reaching `unsafeSVG`, numbers through `num`. viewBox `0 0 800 450`.
- CSS-only animation on `transform`/`opacity`. The reduced-motion still frame is complete. The ~60-element `fb-anim` budget holds per board; each half has 1–30 `fb-anim` elements; loops are ≥ 2 s.
- Theme CSS prefixed `fb-<id>-`, and sets only `animation-name`, `animation-timing-function`, `transform-origin` and `transform-box`. Never `fb-anim` on an `fb-item`.
- Seeded determinism; scenery drawn after the items keeps its wobble (separate sketch keys).
- No new dependencies. No franchise names. Conventional Commits, no `Co-authored-by`, no JIRA footer.

**New in this round:**
- **Theme ids** are `christmas`, `bricks`, `dino`, `wizard`, `racing`, `space`, `dog`, `chess`, `halloween`, `easter`. The German labels are `bricks` → "Bausteine" and `dog` → "Hund".
- **Renames get no aliases.** The unknown-theme fallback is `bricks`.
- **`show_number` defaults to `true`.**
- **Grouping units:** `[10, 50, 100, 500, 1000]` for every theme's items, and `[5, 25, 125]` for the chess shelf of won games.
- **When a merge happens, only the new big item(s) pop.** Small items never re-animate because of a merge.
- **Items never move to other spots** when a point is added. Merging small items into a big one is the only allowed change.

## Review Focus

1. **Five kids with long names and 4-digit totals:** the number chip stays fully visible inside the half and never overlaps the name. *Test in Task 2.*
2. **Points going down** (a reward redeemed) across a merge boundary, e.g. 41 → 39: nothing pops, and no index range goes out of bounds. *Test in Task 1.*
3. **A config still using `lego` or `rescue`:** it falls back to `bricks` without throwing. *Test in Task 3.*
4. **Chess at a game boundary** (31 → 32, and 175 → 176 where kings first merge into a trophy): the new king or trophy pops, and the cleared captured row doesn't. *Test in Task 8.*
5. **A chess-playing parent looks at any of the 16 positions:** no pawns on rank 1 or 8, no adjacent kings, and no impossible piece sets. *Tests in Task 7.*

## Visual check (every drawing task)

- Run `mise run gallery:shots` and look at `dev/screenshots/gallery-<id>.png` before committing.
- The scene must read at tablet size and the items must be countable.
- Nothing may overlap the header (top 17 %) or the jar row (bottom 21 %).
- Name the PNG path in the report.

---

### Task 1: Minimal-replacement grouping and the new-item range

**Files:**
- Modify: `src/items.ts`, `src/board.ts` (`newItemsFrom` → `newItemRange`, ctx wiring), `src/themes/types.ts` (`HalfContext`, `item`), all `src/themes/*.ts` (the `item(...)` call sites, mechanical).
- Test: `tests/items.test.ts`, `tests/board.test.ts`, `tests/themes/theme-contract.ts`, and any per-theme test that pins old big/small counts.

**Interfaces:**
- Produces:
  - `export const ITEM_UNITS: readonly number[] = [10, 50, 100, 500, 1000]`.
  - `groupItems(count: number, capacity: number, units: readonly number[] = ITEM_UNITS): ItemGroups`.
  - `export interface NewRange { newFrom: number; newTo: number }` in `src/items.ts`.
  - `newItemRange(prev: number | undefined, points: number, capacity: number, units?: readonly number[]): NewRange`, moved to `src/items.ts`.
  - `HalfContext` replaces `newFrom: number` with `newFrom: number; newTo: number`.
  - `item(kind, index, ctx: NewRange, body)`: marks `fb-new` when `newFrom <= index < newTo`.

- [ ] **Step 1: Write the failing tests** in `tests/items.test.ts`:

```ts
it('replaces as few small items as possible', () => {
  expect(groupItems(29, 30)).toEqual({ unit: 1, big: 0, small: 29 });
  expect(groupItems(31, 30)).toEqual({ unit: 10, big: 1, small: 21 });
  expect(groupItems(37, 30)).toEqual({ unit: 10, big: 1, small: 27 });
  expect(groupItems(40, 30)).toEqual({ unit: 10, big: 2, small: 20 });
  expect(groupItems(300, 30)).toEqual({ unit: 10, big: 30, small: 0 });
  expect(groupItems(301, 30)).toEqual({ unit: 50, big: 6, small: 1 });
});
it('draws the most items that fit for the chosen unit', () => {
  for (const cap of [15, 20, 30, 36]) for (let n = 0; n <= 2000; n++) {
    const g = groupItems(n, cap);
    expect(g.big * g.unit + g.small).toBe(n); // always exact up to 2000 for these capacities
    expect(g.big + g.small).toBeLessThanOrEqual(cap);
    if (g.unit > 1 && g.big > 0) expect(g.big - 1 + (n - (g.big - 1) * g.unit)).toBeGreaterThan(cap); // one fewer big would not fit
  }
});
it('accepts custom units', () => {
  expect(groupItems(7, 5, [5, 25])).toEqual({ unit: 5, big: 1, small: 2 });
});
describe('newItemRange', () => {
  it('pops nothing without previous points or when points did not go up', () => {
    expect(newItemRange(undefined, 12, 30)).toEqual({ newFrom: 12, newTo: 12 });
    expect(newItemRange(41, 39, 30)).toEqual({ newFrom: 30, newTo: 30 });
  });
  it('pops the new small items', () => {
    expect(newItemRange(10, 12, 30)).toEqual({ newFrom: 10, newTo: 12 });
    expect(newItemRange(32, 34, 30)).toEqual({ newFrom: 23, newTo: 25 }); // 1 big + 22 → 1 big + 24
  });
  it('pops only the new big item when a merge happens', () => {
    expect(newItemRange(30, 31, 30)).toEqual({ newFrom: 0, newTo: 1 });
    expect(newItemRange(39, 40, 30)).toEqual({ newFrom: 1, newTo: 2 });
  });
  it('pops nothing when the unit changes', () => {
    expect(newItemRange(300, 301, 30)).toEqual({ newFrom: 7, newTo: 7 });
  });
});
```

  Remove the old "groups into tens" expectation (37 → 3 + 7).

- [ ] **Step 2:** Run `mise run test -- tests/items.test.ts` and expect it to FAIL.

- [ ] **Step 3: Implement.**
  - **`groupItems`:** for `n > cap`, for each unit `u` ascending, take `big = ceil((n − cap) / (u − 1))`. Accept it when `big ≤ floor(n / u)` and `big + (n − big·u) ≤ cap`, giving `small = n − big·u`. Keep the existing no-fit fallback.
  - **`newItemRange`:**
    - No previous points, points not higher, or the unit changed between two *grouped* units (`prev.unit > 1 && prev.unit !== cur.unit`, e.g. 10 → 50): `{total, total}`. Going from ungrouped (`unit 1`) to grouped is a merge, not a unit change.
    - `cur.big > prev.big`: `{prev.big, cur.big}`.
    - Otherwise: `{cur.big + prev.small, total}`.
  - **Wiring:** delete `newItemsFrom` from `board.ts` and fill `ctx.newFrom`/`ctx.newTo` from `newItemRange`. Update every theme's `item(...)` call to pass `ctx` (or `{newFrom, newTo}`).
  - **Contract:** update `contractCtx` and the "marks items from newFrom" contract test in `theme-contract.ts` to the range.

- [ ] **Step 4:** Run `mise run test` and `mise run typecheck`, both green. Fix per-theme tests that pinned old big/small counts to the new grouping. Do not loosen any assertion other than the count.

- [ ] **Step 5:** Run `mise run gallery:shots`, then look at `gallery-christmas.png` and `gallery-dino.png`. Ben (37) now shows 1 big and 27 small.

- [ ] **Step 6:** Commit `feat: replace only as many items as needed when grouping into tens`.

---

### Task 2: The number next to the name

**Files:**
- Modify: `src/config.ts` (default), `src/board.ts` (`header`), `README.md` (option table and examples), `dev/gallery.ts`, `dev/playground.ts` (drop explicit `show_number` where it now matches the default).
- Test: `tests/config.test.ts`, `tests/board.test.ts`.

**Interfaces:**
- Produces: the header emits `<g data-points="<kidId>">` containing a rounded `rect` filled with the kid colour (escaped once) and a bold ink `text` with the points.

- [ ] **Step 1: Write the failing tests.**

```ts
// config.test.ts
expect(normalizeConfig({ type: 'custom:family-board-card', kids: [{ id: 'a', theme: 'dino' }] }).kids[0].show_number).toBe(true);
expect(normalizeConfig({ type: 'custom:family-board-card', kids: [{ id: 'a', theme: 'dino', show_number: false }] }).kids[0].show_number).toBe(false);
// board.test.ts
it('puts the number chip right after the name', ...)
  // render 2 kids (Mia 12, Ben 37), parse each data-points group:
  // chip rect x ≥ name text x + estimated name width (GLYPH_W rule) and chip x ≤ name end + 40;
  // the chip text content is the points.
it('keeps the chip inside the half for 5 kids with long names and 4-digit points', ...)
  // names 'Maximiliane-Sophie', points 1000..5000; chip rect x + width ≤ box.x + box.w - MARGIN
  // and chip x ≥ name x + shrunk name width estimate; name font-size ≥ MIN_NAME_SIZE.
it('hides the chip with show_number: false', ...)
```

  Replace the old "shows the number only when show_number is set" test.

- [ ] **Step 2:** Run the two test files and expect FAIL.

- [ ] **Step 3: Implement.**
  - Set `show_number: raw.show_number !== false`.
  - The chip goes right after the name, separated by `NAME_GAP`, on the same baseline.
  - Rect: height ≈ `NUMBER_SIZE`, rx ≈ 8. Fill is the kid colour with an ink stroke; the text is bold `INK`.
  - The name shrinks first so that the name plus the chip fits between the avatar and the right margin. If the chip still does not fit, the name is truncated further, but never below 3 glyphs plus "…".

- [ ] **Step 4:** Run `mise run test` and `mise run typecheck`, both green. Run `mise run gallery:shots` and check the header on the dark `gallery-space.png` and `gallery-season-halloween.png`.

- [ ] **Step 5:** Commit `feat: show the point total as a chip next to the name by default`.

---

### Task 3: Rename `lego` → `bricks` and `rescue` → `dog`

**Files:**
- Rename with `git mv`:
  - `src/themes/lego.ts` → `bricks.ts`
  - `src/themes/rescue.ts` → `dog.ts`
  - `tests/themes/lego.test.ts` → `bricks.test.ts`
  - `tests/themes/rescue.test.ts` → `dog.test.ts`
- Modify:
  - `src/themes/registry.ts`, where the fallback becomes `THEMES.bricks`.
  - `src/family-board-card.ts`: `STUB_THEMES` and the stub config.
  - `dev/playground.ts`, `dev/gallery.ts`, `scripts/dev-bootstrap.mjs`, `scripts/browser-check.mjs`.
  - `README.md`, and the theme labels wherever they live (i18n, playground select).
  - Every test that names `lego` or `rescue`.
  - The CSS prefixes `fb-lego-` → `fb-bricks-` and `fb-rescue-` → `fb-dog-`, and the sketch seed strings that contain the theme id. The wobble may change once; that is accepted.
- Delete the stale screenshots `dev/screenshots/{gallery,ha-theme}-{lego,rescue}.png` and regenerate the gallery shots.
- Do **not** touch `dev/ha/config/custom_components/taskmate/**`, which is the vendored TaskMate.

**Interfaces:**
- Produces: `THEMES.bricks` and `THEMES.dog`. `getTheme('lego')` and `getTheme('rescue')` return `THEMES.bricks`.

- [ ] **Step 1: Write the failing tests** in `tests/board.test.ts` or `tests/themes/registry` (wherever registry tests live):

```ts
expect(Object.keys(THEMES)).toEqual(['christmas', 'bricks', 'dino', 'wizard', 'racing', 'space', 'dog', 'chess', 'halloween', 'easter']);
expect(getTheme('lego').id).toBe('bricks');
expect(getTheme('rescue').id).toBe('bricks');
expect(() => renderBoard(model, config([{ id: 'k1', theme: 'rescue', show_number: true }]), opts)).not.toThrow();
```

- [ ] **Step 2:** Run the tests and expect FAIL.

- [ ] **Step 3:** Do the renames and edits. Afterwards, `grep -rn "lego\|rescue\|Rettungshund" src tests dev/*.ts dev/*.html scripts README.md` must return nothing except prose in old `docs/`.

- [ ] **Step 4:** Run `mise run test`, `mise run typecheck`, `mise run build` and `mise run gallery:shots`, all green, with no `gallery-lego.png` or `gallery-rescue.png` left.

- [ ] **Step 5:** Commit `refactor: rename the lego theme to bricks and rescue to dog` (not a breaking change: nothing is released or in use yet).

---

### Task 4: Space — white stars, gold tens, no planets

**Files:** modify `src/themes/space.ts` and `tests/themes/space.test.ts`.

- **Small items:** white stars with fill `#fffaf0` and an ink outline.
- **Big items:** today's gold star colour, about 1.4× the small star's size, with a soft glow behind them: a plain blurred-free circle at low opacity, not an SVG filter.
- Remove the ringed planets and every helper only they use. Constellation lines, the rocket, the comet and the twinkle stay.

- [ ] **Step 1: Tests.**
  - Every `data-item="small"` group contains `#fffaf0`.
  - Every `data-item="big"` group contains the gold constant and not `#fffaf0`.
  - The markup has no planet or ring part (assert on whatever marker the old planet code emitted, e.g. its `data-part` or ring `ellipse`).
  - The theme contract still passes.
- [ ] **Step 2:** Run and expect FAIL. **Step 3:** Implement. **Step 4:** Tests and typecheck green, then do the visual check.
- [ ] **Step 5:** Commit `feat: draw space items as white stars with gold stars for tens`.

---

### Task 5: Racing — the car drives

**Files:** modify `src/themes/racing.ts` and `tests/themes/racing.test.ts`.

- **The loop**, in the car's outer group, which gets a new `fb-anim fb-racing-drive` class:
  1. The car enters from just beyond the half's left edge.
  2. It drives to its resting spot at the finish line, which is today's position.
  3. It stands there for about 25 % of the cycle.
  4. It drives out beyond the right edge.
- **Timing and CSS:** loop length comes from `timing(\`${seedKey}:drive\`, [8, 12])`. The keyframes use `translateX` in px of the 800-wide viewBox. Store the needed distances as CSS custom properties on the element (`--in`, `--out`, as negative and positive px). The theme CSS still sets only the allowed properties; custom properties live in the element's inline style, next to `--t`/`--d`.
- **Resting position:** the untransformed car stands at the finish line. Under reduced motion, it stays there.
- **Clipping:** the car is clipped to the half with a `<clipPath id="fb-racing-clip-<escaped seedKey>">` sized to the half box. The clip-path goes on a wrapper, not on the `fb-anim` element.
- **Wheels:** the existing `fb-racing-roll` wheel spin stays.

- [ ] **Step 1: Tests.**
  - The `data-part="car"` group contains exactly one `fb-racing-drive` element whose `--t` is between 8 and 12.
  - `--in` < 0 and `--out` > 0, and their magnitudes carry the car fully outside the half box.
  - A clipPath with the half's box exists and is referenced by an ancestor of the drive group.
  - Two kids get different `--d`.
  - The css contains `@keyframes fb-racing-drive`.
  - The budget contract still passes.
- [ ] **Steps 2–4:** As in Task 4. Also check the live motion once with `mise run dev` → `/gallery.html`, and say so in the report.
- [ ] **Step 5:** Commit `feat: let the race car drive through and stop at the finish line`.

---

### Task 6: Dino — a whole dino beside the nest

**Files:** modify `src/themes/dino.ts` and `tests/themes/dino.test.ts`.

- **Drawing:** redraw the dino in profile, standing to the right of the nest and looking down at it.
  - Body: a round belly.
  - Two sturdy legs with toes on the ground line. Small arms.
  - A tail curling behind, keeping the back spikes.
  - The head is lowered toward the nest.
- **Part markers:** `data-part="body"`, two `data-part="leg"`, `data-part="arm"`, `data-part="tail"`, `data-part="head"`, `data-part="nest"`.
- **Animations stay:** blink, head bob on the head group, tail sway, egg wobble.
- **Nest and capacity:** the nest may move left or shrink. Capacity stays unless the eggs no longer fit fully visible and non-overlapping; in that case use the largest capacity that does.
- **Old parts:** the old `feet` part goes away.

- [ ] **Step 1: Tests.**
  - The body group's min x ≥ the nest group's max x − 10, because the dino stands beside the nest.
  - Each leg group's max y is within 6 of the nest's max y, so the feet are on the ground.
  - All of body, two legs, arm, tail and head are present.
  - The existing animation and wobble tests and the theme contract pass.
  - Use `coordsOutside`-style coordinate parsing for the bounds.
- [ ] **Steps 2–4:** As in Task 4. Take a close visual look at 0, 12, 37 and 300 points; the parents said the old dino "looks strange".
- [ ] **Step 5:** Commit `feat: draw the dino as a whole animal standing beside its nest`.

---

### Task 7: Chess positions table

**Files:**
- Create: `src/themes/chess-positions.ts`.
- Test: `tests/themes/chess-positions.test.ts`.

**Interfaces:**
- Produces:
  - `export const CAPTURE_ORDER: readonly string[]`: 15 lowercase FEN letters, a multiset of exactly 8 `p`, 2 `n`, 2 `b`, 2 `r` and 1 `q`. Order them plausibly, with pawns and minors early and rooks and queen late.
  - `export const POSITIONS: readonly string[]`: 16 FEN *placement* fields. Index k means the first k entries of `CAPTURE_ORDER` are captured. Index 0 is `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR`.
  - `export function parsePlacement(fen: string): (string | null)[][]`: 8 ranks, rank 8 first, 8 files each.
- White (uppercase) is the kid. Black (lowercase) is the opponent.

- [ ] **Step 1: Tests**, one `it` per rule, looping over all 16 positions:
  - `parsePlacement` yields 8×8 for every position.
  - Black pieces on the board plus `CAPTURE_ORDER.slice(0, k)` equal the full black set `{p:8, n:2, b:2, r:2, q:1, k:1}` as a multiset.
  - There is exactly one king per side.
  - The kings are not on adjacent squares, including diagonally.
  - No pawn of either colour stands on rank 1 or 8.
  - White never has more of a piece type than the start set (no promotions).
  - White misses at most `k + 2` pieces and always has its king.
  - A side with both bishops has them on opposite square colours.
  - The positions are distinct.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Author the table. The positions should look like one game going on: pieces develop, pawns advance, and later positions thin out.
- [ ] **Step 4:** Green.
- [ ] **Step 5:** Commit `feat: add the chess position table for captured pieces`.

---

### Task 8: Chess — games won and pieces captured

**Files:**
- Modify: `src/themes/types.ts`, `src/board.ts`, `src/themes/chess.ts` (rewrite), `tests/themes/theme-contract.ts`, `tests/themes/chess.test.ts`, `README.md` (the chess line in the theme table).

**Interfaces:**
- Consumes: `POSITIONS`, `CAPTURE_ORDER` and `parsePlacement` from Task 7; `groupItems`, `newItemRange` and `NewRange` from Task 1.
- Produces:
  - The optional `Theme.items?(points: number, prev: number | undefined): { total: number } & NewRange`.
  - When `items` is present, `board.ts` and `contractCtx` take `newFrom`/`newTo` from it; `ctx.groups` stays filled from `groupItems` but is unused by chess.
  - The contract asserts `data-item` count equals `theme.items ? theme.items(p, undefined).total : big + small`.
  - Constants in `chess.ts`: `SHELF_CAP = 10` and `SHELF_UNITS = [5, 25, 125]`. Kings merge into trophies only once more than 10 games are won (minimal-replacement rule).

**Mapping:**
- `wins = floor(points / 16)` and `captured = points % 16`.
- **Item order:** shelf trophies (big), then shelf kings (small), then the captured pieces in capture order. The shelf comes from `groupItems(wins, SHELF_CAP, SHELF_UNITS)`.
- **New-item range:**
  - When `wins` went up: the range is `newItemRange(prevWins, wins, SHELF_CAP, SHELF_UNITS)`. That pops only the new king or trophy, never the captured row.
  - When `wins` is the same and `captured` went up: the range is offset by the shelf count, `[shelf + prevCaptured, shelf + captured)`.
  - Otherwise nothing pops.

**Scene:**
- **Board:** a full 8×8 board, smaller than today, showing `POSITIONS[captured]`. White pieces are drawn in the kid colour (escaped once) with an ink outline; black pieces are dark ink.
- **Captured row:** sits beside the board, at most 2 rows of 8.
- **Shelf:** won games as toppled dark kings and trophies. It sits below or above the board, clear of the header and the jar row.
- **Idle animation:** one of the kid's pieces hops once every ~10 s (`timing(..., [9, 11])`). Remove the old king and knight scenery and its animations if they no longer fit.

- [ ] **Step 1: Tests.**

```ts
// chess.test.ts
it.each([[0, 0, 0], [15, 0, 15], [16, 1, 0], [17, 1, 1], [31, 1, 15], [32, 2, 0], [80, 5, 0], [81, 5, 1]])(
  '%i points → %i wins, %i captured', (p, w, c) => { /* count data-item in shelf and captured row */ });
it('pops only the new king at a game boundary', () => {
  expect(chess.items!(32, 31)).toEqual({ total: 2, newFrom: 1, newTo: 2 });
});
it('pops only the new trophy when kings merge', () => {
  expect(chess.items!(176, 175)).toEqual({ total: 7, newFrom: 0, newTo: 1 }); // 10 kings + 15 captured → 1 trophy + 6 kings
});
it('pops the newest captured piece', () => {
  expect(chess.items!(19, 18)).toEqual({ total: 4, newFrom: 3, newTo: 4 }); // 1 king + 3 captured
});
it('pops nothing when points go down', () => {
  expect(chess.items!(31, 33)).toMatchObject({ newFrom: 16, newTo: 16 });
});
it('shows POSITIONS[captured] on the board', () => { /* count dark/kid pieces on the board vs parsePlacement */ });
```

  Also: `runThemeContract(THEMES.chess)` passes with the hook, and the other themes' contract runs are unchanged.

- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement the hook, then the scene.
- [ ] **Step 4:** Run `mise run test` and `mise run typecheck`, both green. Do the visual check at 0, 12, 15, 16, 37 and 300 points; adding these values to the gallery's chess tile is allowed.
- [ ] **Step 5:** Commit `feat: show chess as games won and pieces captured`.

---

### Task 9: Docs, HA browser check, final shots

**Files:** modify `README.md` and `scripts/browser-check.mjs` where needed; refresh `dev/screenshots/`.

- [ ] **Step 1:** Check the README against the new behaviour:
  - the number chip and its default;
  - the grouping rule, with the examples 31 → 1 big + 21 small and 301 → 6 × 50 + 1;
  - the theme table names and descriptions (bricks/Bausteine, dog/Hund, space stars, the racing drive, chess wins and captures);
  - the "Adding a theme" section, which mentions the optional `items` hook.
- [ ] **Step 2:** Run `mise run test`, `mise run typecheck`, `mise run build`, `mise run gallery:shots` and `mise run ha:screenshot`, all green. Check every `ha-theme-*.png` for the new ids.
- [ ] **Step 3:** Commit `docs: describe the number chip, the new grouping and the reworked themes`.
