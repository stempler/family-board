# Fill the screen and ground-coloured jar section

Covers [issue #21](https://github.com/stempler/family-board/issues/21) and one visual request from the same conversation. The pull request closes #21.

## Why

- **Fill the screen.** The board is always drawn 800×450 (16:9) and scaled to the card's width. In a panel view on a 16:10 tablet an empty strip stays below the board; on an area flatter than 16:9 the board needs scrolling. The board is a wall display for kids, so it should fill the free area on 16:9, 16:10 and 4:3 screens.
- **Ground colour.** Each half is one rectangle in the theme's `background` colour. The scene's ground (sand, floor, earth, grass) ends at 79% of the height, and the jar section below shows the sky colour again. On six themes this reads as a hard cut.

## Goals

1. In a panel view the board fills the area from the card's top edge to the bottom of the window, at the card's width, without scrolling and without an empty strip.
2. On pirates, underwater, birthday, construction, garden and summer the jar section has the ground colour of the scene above it.
3. A dashboard that shows the board in a panel view improves without a config change.

## Non-goals

- Scenes that stretch vertically. The scene band keeps its height; only the board's width and the ground below the scene vary.
- Sections or masonry views: no new grid sizing. Outside a panel view the card behaves as today unless `fill: true` is set.
- Ground colours for the other themes.

## Anti-goals

- The default drawing must not change: with no size given, `renderBoard` returns today's 800×450 picture, apart from the jar section of the six themes.
- A resize or rotation must not replay the "new item" drop.

## Approaches

**Shape of the board on a non-16:9 area**

1. *Vary the width, keep the height (chosen).* The themes already draw for any half width, because the board splits its width by the number of kids. A 16:10 area gets a 720×450 board, a flat area a wider one. No theme changes. Catch: halves can get too narrow, handled by the fallback below.
2. *Keep 16:9, add ground below.* Simple, but a 4:3 screen gets a ground band about twice as high as today. Kept only as the fallback.
3. *Stretch the scenes.* Touches every theme and all snapshots. Rejected for cost.

The user picked 1.

**When the card fills**

1. *Automatic in panel views with an override (chosen).* New option `fill`, default `auto`.
2. *Only when switched on.* No dependence on Home Assistant's element nesting, but nothing improves until the config is edited.

The user picked 1.

## Design

### Board size (`src/board.ts`)

- `RenderOptions` gets an optional `size: { w: number; h: number }`, the free area in any unit (only the ratio matters). Without it the board is 800×450.
- The scene height stays 450. Every half's `box` keeps `h: 450`, so themes are untouched.
- Board width: `W = round(450 × size.w / size.h)`, limited to `minW ≤ W ≤ 1600`.
  - `minW = max(160 × number of kids, 400)`. 160 is today's five-kid half. 400 as the floor for one or two kids is my call.
  - 1600 as the upper limit is my call. Beyond it the picture is centred with paper colour left and right.
- Fallback when `W` was raised to `minW`: the picture gets taller instead, `H = round(W × size.h / size.w)`, so it still matches the area. The extra `H − 450` is added below the scene as more jar section. The jar row (kid jars and shared jars) moves down by half of the extra, so it stays centred in the jar section.
- Everything that uses the fixed `W` today follows the board width: the halves, the shared jar span and fit, the season scene's box, the `missing` and `no kids` messages. `errorSvg()` in the card stays 800×450.

### Ground colour (`src/themes/types.ts`, six themes, `src/board.ts`)

- `Theme` gets `ground?: string`. Pirates, underwater and summer use their sand colour, birthday its floor, construction its earth, garden its grass; each is the colour the scene already draws at its bottom edge.
- The board paints the jar section in that colour, from the scene's bottom edge (`0.79 × 450`) to the bottom of the picture, after the scene and before the header and jars. In season mode (summer) it is one band across the whole board; otherwise one per half. A half whose kid was not found gets it too.
- Garden is the one theme whose scene changes. Its soil bed runs to the scene's bottom edge today, so a grass band would meet it in a straight cut. The user chose grass and allowed moving the bed's dark bottom line up: the bed closes a little above the scene's edge (rounded lower corners like the upper ones, outlined in the dark soil colour), with a strip of lawn below it that runs into the jar section. Raise it only as far as needed for a visible strip of grass. Flowers and soil clods stay inside the bed; if the lowest row has to move up for that, the rows are re-spaced and the garden layout tests and snapshots follow.
- Themes without `ground` keep their `background` there, also in the extra ground of the fallback.
- Jars must stay readable on every ground colour. Jars have no labels; their outline is drawn in the ink colour (`INK`, `#3a2f28`). A test pins a contrast ratio of at least 3:1 between `INK` and each ground colour. Jar drawing code does not change.

### Card (`src/config.ts`, `src/family-board-card.ts`)

- New option `fill: auto | true | false`, default `auto`. Any other value is rejected with `fill must be auto, true or false`.
- `auto` fills only when the card is the panel view's own card: it sits directly in a `hui-panel-view` (through Home Assistant's own card wrapper and shadow roots), not inside a stack, grid or layout card. Nested there, filling would push the sibling cards off the screen. `true` always fills, `false` never.
- When filling, the card measures its own width and the height from its top edge to the bottom of the window (`window.innerHeight − top`), sets that height on itself and passes the size to `renderBoard`. The picture fills the card.
- It measures again when the card or the window changes size (rotation, sidebar) and when the card's top edge moves without a size change. The second case is the one from the issue: a kiosk plugin hides the top bar after the first draw, so the card only moves up. How the move is noticed is the builder's choice (for example a check on every `hass` update plus a slow timer); a strip left behind after the top bar disappears is a failure. The dev Home Assistant has no kiosk plugin, so the test moves the card by changing the layout above it.
- Measuring happens once the card is attached; before the first measurement it draws 800×450.
- The card has a size override next to `now`: `measure?: () => { w: number; h: number }`. When set, it replaces the window measurement and the card takes that height. The playground uses it.
- A measured area smaller than 100 px in either direction is ignored and the card draws as when not filling.
- A redraw caused only by a new size passes the current points as the previous points, so no item counts as new. Ambient animations start over on such a redraw; that is accepted.
- When not filling, nothing changes: width 100%, height from the picture.

### Dev tooling and docs

- Playground: a shape picker (16:9, 16:10, 4:3, 21:9, portrait) that sets a size through the card's `measure` override, so the shapes can be judged without resizing a window.
- `scripts/browser-check.mjs`: with `fill: true`, at 16:9, 16:10 and 4:3 viewports the card's bottom edge meets the window's bottom edge and the page does not scroll.
- The dev Home Assistant dashboard is already a panel view, so `mise run ha:screenshot` shows the result of `auto`.
- README: the `fill` option, and the note that the board fills a panel view.

## Tests

- Board: default output unchanged except the six jar sections; width follows the ratio; lower and upper limits; the fallback's height and jar position; shared jars centred at any width; season scene spans the board width.
- All themes render at the narrowest and widest half that the limits allow, without throwing and inside the animation budget.
- Ground: the six themes paint the jar section in their ground colour, the others do not; jar contrast.
- Config: `fill` values and the error text.
- Card: fills in a panel view and with `fill: true`, not otherwise; a size-only redraw marks no item as new.
- Snapshots: the six themes' files change by the ground band only, except garden, which also shows the raised bed.

## Left to the builder

- How the size is quantised so that tiny measurement changes do not cause redraws.
- The exact element lookup for the panel view and how the card observes size changes.
- How far the garden bed is raised and whether its rows need re-spacing.
- Whether the six themes export the colour they already use or name a new constant.
