# Theme polish round — design

Date: 2026-11-21. Branch: `feat/more-themes` (continues it; base `feat/family-board-card`).
Follows [2026-11-20-more-themes-and-animation-design.md](2026-11-20-more-themes-and-animation-design.md) — everything there still binds unless changed here.

## Why

The parents reviewed the gallery after the themes round. Christmas, Halloween and Easter are fine. The rest needs one polishing round so every theme reads well on the tablet before new themes (Piraten, Unterwasser, Fußball, Baustelle, Garten, St. Martin, Sommer, Geburtstag) are added in a later round.

The two general complaints matter most: the kids cannot tell their exact total from the picture, and a total just above the capacity looks *smaller* than one just below it (29 small items vs. 3 big + 7 small for 37).

## Goals

1. **Exact number visible.** Every kid's point total is shown as a number, next to the name.
2. **Grouping that never looks like less.** Replace as few small items with 10-items as needed to fit.
3. **Dino** with a believable whole body.
4. **Racing** car drives most of the time.
5. **Space** without the ringed planets.
6. **Chess** reworked into a chess-meaningful representation.
7. **Renames:** `lego` → `bricks`, `rescue` → `dog`.

## Non-goals

- New themes or seasons (next round).
- Changes to christmas, halloween, easter, wizard beyond what the general changes (number, grouping) bring.
- The deferred visual nits from the last round (wizard crystals at 260+, bunnies over the basket at 60+) — unless the new grouping rule touches them anyway.

## Anti-goals

- Items moving to other spots when a point is added (still forbidden; merging small items into a big one is the only allowed change).
- Chess positions that a chess-playing parent would laugh at (pawns on the back rank, adjacent kings, impossible piece counts).

## Decisions

### 1. Number next to the name

- `show_number` stays as a per-kid option but **defaults to `true`**. Setting `show_number: false` hides it.
- The number sits right after the name ("Mia 12"), bold, same baseline, not at the far right. It is drawn in ink on a small rounded chip filled with the kid's colour, so it reads on dark theme backgrounds (space, halloween) and with pale kid colours. *(Builder-check call: chip instead of coloured text.)* Long names still shrink so name and number fit the half.
- README, gallery and playground follow the new default.

### 2. Minimal-replacement grouping (`groupItems`)

New rule for `n > capacity`: take the smallest unit `u` from `[10, 50, 100, 500, 1000]` for which
`big = ceil((n − cap) / (u − 1))` satisfies `big ≤ floor(n / u)` and `big + (n − big·u) ≤ cap`; then `small = n − big·u`.
Fallback when no unit fits stays as today.

Examples with capacity 30, unit 10: 29 → 29 small; 31 → 1 big + 21 small; 37 → 1 big + 27 small; 40 → 2 big + 20 small; 300 → 30 big; 301 → unit 50: 6 big + 1 small.
The drop at a unit change (300 → 301) is unavoidable with two item kinds; the visible number covers it.

This yields the **largest possible number of drawn items** for every total; the count still drops when a merge is forced (30 → 31: 30 → 22 items), but by the minimum possible, and the big item is drawn visibly larger than a small one. *(Builder-check call.)*

`newItemsFrom` keeps its meaning (mark the new items; nothing when the unit changes). When a merge happens, **only the new big item pops**; the remaining small items do not re-animate. "Small items keep their slot" means their slot within the small-item group. *(Builder-check call.)* Every theme gets the new rule for free; per-theme tests that pin old big/small counts are updated.

### 3. Dino

Redraw the dino as a whole animal **standing beside the nest**, in profile, looking down at its eggs: round belly, two sturdy legs with toes on the ground line, small arms, tail curling behind, back spikes kept. Nothing of the body hides behind the nest except possibly the tail tip. The current animations (blink, head bob, tail sway, egg wobble) stay. The nest may shift or shrink a little to make room; capacity stays unless the eggs no longer fit (then: the builder picks the largest capacity that keeps every egg fully visible and non-overlapping).

### 4. Racing: driving car

- The kid's car loops: enters from the left edge of the half, drives to the finish line (where it stands today), stops there, then drives out at the right edge. One loop ~8–12 s, stop ~2–3 s, staggered per kid via `timing()`.
- The car is clipped to its half, so it never drives into the other kid's half.
- Wheels spin while driving (optional, cheap).
- Reduced motion: the car stands still at the finish line — today's picture.
- Stays inside the existing animation budget (one `fb-anim` group for the car, plus wheels).

### 5. Space

- Small items: **white stars** (slightly warm white with ink outline so they read on the dark sky).
- Big items (×10): today's **gold/yellow stars**, a bit larger, with a soft glow.
- The ringed planets are removed entirely. Constellation lines, rocket and twinkling stay.

### 6. Chess: games won and pieces captured

The chess theme stops using the generic item grouping. Points map as follows:

- `wins = floor(points / 16)`, `captured = points mod 16` (0–15).
- Rationale: an opponent has 16 pieces, but the king is never captured. 15 captures + the 16th point = checkmate = a won game.

The scene:

- **Board:** a full **8×8 board**, drawn smaller than today, showing a believable middle- or endgame position in which the opponent (dark pieces) has lost exactly `captured` pieces. The kid's pieces are in the kid's colour.
- **Captured row:** the `captured` opponent pieces stand beside the board in a neat row (or 2 rows), like players line them up — this is the countable part. Capture order is plausible: pawns and minor pieces first, rooks and queen late.
- **Won games shelf:** one **toppled dark king** per won game. Kings merge into a **trophy** worth 5 wins, using the same minimal-replacement rule (units `[5, 25, 125]`, capacity chosen by the builder to fit the shelf, ~10).
- **One fixed capture order** of the 15 non-king opponent pieces; position k has exactly the first k of them captured (nested — a captured piece never reappears). Pieces on the board may stand on different squares from one position to the next. *(Builder-check call.)*
- **16 hand-authored positions** (`captured` 0…15), position 0 = start position. Each position is data (piece list per square), checked by tests:
  - opponent piece count = 16 − captured, always includes its king; captured-row pieces + board pieces = the full opponent set;
  - no pawns on rank 1 or 8; exactly one king per side; kings not adjacent;
  - the kid's side has a plausible set: in every position it is missing at most `captured + 2` pieces and never its king.
- **Animations:** the newest captured piece gets the "new" pop; a light idle animation of the builder's choice (e.g. one of the kid's pieces hops once every ~10 s), within the budget.
- **Items and the contract** *(builder-check call)*: chess's `data-item` elements are the captured pieces plus the shelf kings/trophies — board pieces are scenery. The `Theme` interface gets an optional hook (e.g. `items(points) → { total, newFrom(prevPoints) }`) that `board.ts` uses instead of `capacity`-based grouping when present; the theme contract checks `data-item` count against that hook for chess and against `groupItems` for every other theme, unchanged. A new capture marks that piece; a new win marks the new king or trophy and does not re-pop the captured row.
- Reduced motion: still picture is complete.

### 7. Renames

- `lego` → id **`bricks`**, label **"Bausteine"**; `rescue` → id **`dog`**, label **"Hund"**. Files, tests, registry, gallery, playground, README, browser check and screenshots follow.
- The unknown-theme fallback (`getTheme`, the editor's stub config) becomes `bricks`. *(Builder-check call.)*
- No aliases: nothing is released yet. A parent config using `lego`/`rescue` needs a one-line edit (falls back to the unknown-theme behaviour otherwise, as today).

## Approaches

The general changes (number, grouping) have one sensible way each — they live in `board.ts` and `items.ts` and all themes inherit them. For the theme fixes the established approach from the last round stays: one hand-drawn file per theme plus the CSS-only animation layer. For chess, two alternatives were considered:

- **Keep pieces-as-items on a smaller grid** (today's model): simple, but not meaningful as chess — rejected by the parents.
- **Wins + captures with authored positions** (chosen): meaningful for a chess-playing family; costs 16 hand-authored positions and its own counting rule.

## Testing and review

- Unit tests for the new `groupItems` rule: the examples above, and a property test that for every n in 0..2000 the drawn item count is the maximum achievable within capacity for the chosen unit.
- Header tests: number shown by default, hidden with `show_number: false`, never overlapping the name.
- Chess position tests as listed; mapping tests for 0, 15, 16, 17, 31, 32, 80, 81 points.
- Racing: animation stays within budget; reduced motion shows the car at the finish line.
- Existing contracts (theme, season, budget) keep passing.
- Gallery screenshots refreshed; parents do one batch visual review at the end.

## Left to the builder

Exact geometry and colours, the 16 chess positions themselves, the chess shelf capacity, wheel spin, the chess idle animation, and the dino's nest placement — within the constraints above.
