# More themes, a proper dino, and a bit of life on screen

Builds on `2026-11-20-bonus-points-display-design.md` (the card) and the code on
`feat/family-board-card`. Everything there still holds unless this document
says otherwise.

## Intent and why

The board only works as motivation if the kids *want* to look at it. Two things
wear that off:

- The same picture every day.
- A picture that is already "finished" and never moves.

So:

- **More themes**, so each kid can pick a world they're into right now and
  switch when that changes.
- **Small ambient animations**, so the tablet on the shelf feels alive: snow
  falling, the LEGO figure waving now and then, the dino blinking.
- **A fix for the dino theme.** Today the dino is a neck rising out of the
  ground behind the nest, with a disconnected tail on the other side. It looks
  weird because there is no body.

## Goals

- The dino gets a body. It sits behind the nest: the body shows above the nest
  rim, the neck rises from the body and curves towards the eggs, the tail
  comes out of the body, and the feet peek out beside the nest.
- A shared animation layer, and ambient animations for every theme, old and
  new.
- New favourite themes, each a scene that fills up as points grow, the same
  way the tree, tower and nest do today. They come in this order (this order
  is Claude's call, because the kids' favourites weren't named):
  1. **Zauberschule** (wizard school)
  2. **Rennstrecke** (race track)
  3. **Weltraum** (space)
  4. **Rettungshunde** (rescue dogs)
  5. **Schach** (chess)
- New season themes, which take over the screen like Christmas does:
  **Halloween** and **Ostern** (Easter).

## Non-goals

- A generic theme engine. Approach A was chosen, see below.
- Sound.
- "Celebration" animations for milestones such as streaks or a full jar. The
  existing drop-in for new items stays the only event animation.
- Themes with animated or 3D characters. Everything stays a hand-drawn,
  rough.js sketch.
- More ideas are parked for later: Piraten (pirates), Unterwasser
  (underwater), Garten (garden), Fußball (football).

## Anti-goals (would count as failure even if it technically works)

- **Recognisable copies of franchise characters, logos or names.** For
  example, no "Hogwarts", no lightsabers called that, no Chase or Lightning
  McQueen. The themes are *inspired by* what the kids like, as generic worlds:
  - wizard school, not Harry Potter;
  - space, not Star Wars;
  - rescue dogs, not Paw Patrol;
  - race track, not Cars.

  The repo may become public for HACS.
- **Restless motion.** Animation that competes with the points for attention,
  or that flickers. Ambient motion is slow and small, or occasional (once
  every several seconds).
- **A tablet that runs hot or drains its battery.** Animation must not
  keep the device busy.
- **Counting that gets harder.** The animations never move the counted items
  themselves away from their slots for long. A "wobble" is fine; drifting is
  not.
- **Themes that look alike.** Each scene is drawn on its own terms. Two
  themes that are "a container plus coloured dots" is the failure mode
  approach B was rejected for.

## Constraints

- Everything from the card spec and plan Global Constraints still applies:
  - Lit 3 and rough.js, with seeded, deterministic drawing (`hashSeed`).
  - Escape everything that reaches `unsafeSVG`.
  - German text for the kids.
  - Latest dependency releases, tools via mise.
- **No new runtime dependencies** for animation.
- **Animation is CSS only**, using `@keyframes` on `transform` and `opacity`.
  - No `requestAnimationFrame` or timers driving motion. (The card already
    re-renders only when the model or date changes.)
  - Animating a `<g>` in SVG needs `transform-box: fill-box` (or
    `view-box`) and an explicit `transform-origin`. Otherwise rotations and
    scales pivot around the SVG origin.
- **Reduced motion is respected.** Under `prefers-reduced-motion: reduce`,
  all ambient animation stops and the still frame looks complete. For
  example, snowflakes stay where they are, which also covers WebKit on an
  iPad.
- **Animation budget:**
  - At most about 60 animated elements on the whole board at once (both
    halves plus the season scene). Every element carrying the `fb-anim`
    class counts as one, so each snowflake counts.
  - Particle effects scale with their area so the cap holds: a half gets
    about half the particles of a full-width season scene.
  - This budget, together with "transform and opacity only" and no animated
    filters, is the whole performance rule. There is no separate measurement
    of heat or battery.
  - Durations of at least 2 s for loops.
  - "Occasional" gestures (waving, blinking, a hopping knight) are done as one
    long keyframe cycle (8–20 s) in which the gesture takes up a small part.
    This way they need no script.
- **Determinism stays.** Positions, durations and delays of ambient elements
  (snowflakes, stars, sparkles) come from the seeded random generator, so the
  same input renders the same SVG and tests stay stable.
  - Two kids' halves get different delays (seeded by `seedKey`), so the
    two LEGO figures don't wave in sync.
- **Theme ids stay English and lowercase**, like the existing ones:
  - `christmas`, `lego`, `dino`
  - `wizard`, `racing`, `space`, `rescue`, `chess`
  - `halloween`, `easter`

  The texts the kids see are German.

## Approaches considered

- **A. One hand-drawn file per theme plus a shared CSS animation layer
  (chosen).**
  - Each theme keeps its own scene.
  - Animations are CSS keyframes applied to named parts of the drawing.
  - It costs about 150–200 lines of careful drawing per theme.
  - Small helpers are pulled out only where two themes really repeat each
    other.
- **B. A mini theme engine** (background + container + item stamp). New themes
  would be cheaper, but they would start to look alike. Rejected: the charm is
  that each scene is its own picture.
- **C. Frame-by-frame script animation.** Richer motion, such as a car
  driving across the screen, but the tablet works all day for little visible
  gain over CSS. Rejected.

## What gets built

### 1. Animation layer

- A theme can contribute CSS: `Theme.css?: string`. The card builds its static
  styles once, at module load, from the base styles plus every registered
  theme's `css`.
  - Keyframe and class names are prefixed with the theme id, e.g.
    `fb-lego-wave`, so themes cannot collide.
- Themes mark animated parts with classes in the SVG they emit, e.g.
  `<g class="fb-lego-arm">`.
  - Per-element timing (delay, duration) goes into an inline `style`
    attribute with CSS custom properties, e.g. `style="--d:-3.2s;--t:9s"`.
    The values are numbers produced by the code, never user input.
- One shared rule turns all ambient animation off under reduced motion. It
  targets a common marker class `fb-anim`. The existing `fb-new` drop stays
  as is.
- Small shared helpers in `src/draw/anim.ts`, for the effects more than one
  theme uses:
  - **Falling particles** in a box. Used for snow, and for leaves or sparkles
    if a theme wants them.
  - **Twinkle** for stars.
  - **Seeded delay** for a given `seedKey` and part name.

  Effects used by only one theme stay in that theme.
- After a re-render the animations restart. That's acceptable: re-renders
  happen only when points or the date change.

### 2. Ambient animation per existing theme

- **Christmas:**
  - Snow falls over the whole half or the whole season scene: about 25–30
    flakes on the full-width season scene, about 12–15 per half, of different sizes and speeds, drifting slightly sideways.
  - The star on top of the tree twinkles.
- **LEGO:** the minifigure waves every ~10 s: the arm swings two or three
  times, then rests.
- **Dino** (with the new body):
  - Blinks every ~6 s.
  - Slow head bob.
  - The tail sways.
  - Now and then one egg wobbles, as if about to hatch. It's a small
    rotation in place.

### 3. Dino body

- The body is a large rounded shape behind the nest. The nest front still
  covers its lower part.
- The neck grows out of the body's top. The head stays roughly where it is
  today, looking at the eggs.
- The tail is attached to the body and curls out on the side away from the
  head.
- Two feet are visible beside the nest.
- The back spikes run along the neck *and* the body.
- Drawing order (back to front): ground, tail, body, neck and head, nest
  back, eggs, nest front. The scenery uses the existing early/late sketch
  split, so the dino's wobble does not change when eggs are added.

### 4. New favourite themes

Each has a "small" item (worth 1) and a "big" item (worth the grouping unit,
same as today). Each fills a fixed set of slots so earlier items never move.

| Theme | Scene | Small item | Big item | Ambient animation |
|---|---|---|---|---|
| `wizard` (Zauberschule) | A tall hourglass on a table in a castle tower room, a candle and a perched owl. The kid's colour is the gems' house colour. | A gem in the lower bulb, piling up from the bottom | A large crystal | Sand trickles from the upper bulb; the candle flickers; the owl blinks; sparkles drift up from the gems now and then |
| `racing` (Rennstrecke) | A podium and trophy shelf beside a race track with a chequered flag and a race car in the kid's colour | A medal hanging on the shelf | A big trophy cup | The flag waves; every ~15 s the car rolls a short way forward and back (the car isn't a counted item) |
| `space` (Weltraum) | A rocket on a little moon, the night sky above | A star appearing in the sky, at fixed spots that form shapes | A ringed planet | The stars twinkle; the rocket flame flickers; a comet crosses now and then |
| `rescue` (Rettungshunde) | A rescue-dog HQ (a doghouse tower) with a pup in the kid's colour scarf | A bone in a growing pile beside the house | A gold paw badge on the house wall | The tail wags; an ear twitches; the pup tilts its head now and then |
| `chess` (Schach) | A chessboard seen at an angle, with a big king at the side | A pawn on the next free square | A queen | Every ~12 s the knight hops (a short jump arc, then back in place); the king tips its crown |

The scene descriptions are the intent. The builder draws them and may adjust
details so they read well at tablet size.

### 5. Season themes: Halloween and Easter

Like Christmas, each has both a per-half scene and a shared season scene with
one object per kid, told apart by kid colour and avatar.

| Theme | Shared scene | Per kid | Small | Big | Ambient |
|---|---|---|---|---|---|
| `halloween` | A night pumpkin patch with a crooked fence and a moon | A big carved-pumpkin candy bucket, the candy heaped in and around it | A wrapped candy | A jack-o'-lantern | A ghost floats up and down; a bat flutters across now and then; the lanterns' glow flickers |
| `easter` | A spring meadow with flowers | A woven basket | A painted egg (patterns vary) | A chocolate bunny | The bunny's ears twitch; it hops in place now and then; butterflies flutter |

**Default season calendar:**

- Christmas: `12-01`–`12-26`, unchanged.
- **Halloween: `10-24`–`10-31`.**
- **Easter: from Palm Sunday to Easter Monday**, computed every year.

To make Easter computable, a season rule's `from`/`to` also accepts
`easter`, `easter-N` or `easter+N` (days relative to Easter Sunday). The
default rule is `{theme: easter, from: easter-7, to: easter+1}`. Config
validation accepts both forms and rejects anything else in the existing (English)
config error style.

- N is a whole number from 0 to 60.
- A rule may mix the forms, e.g. `from: 03-01, to: easter+1`.
- Both ends are resolved to dates in the current year. A rule with a relative
  end does not wrap over the year end.
- `activeSeason` gets the year it needs from the date it is already given.

These dates are Claude's call. Parents can override the whole list in the
card config, as today.

### 6. Registry, config, docs

- All new themes are registered. Unknown ids still fall back to `lego`.
- README:
  - lists every theme with a one-line description;
  - documents the new season syntax, and the reduced-motion behaviour.
- Dev playground: a theme picker shows every theme. A "season" switch shows
  the shared scenes.

### 7. Testing

- **Contract tests.** Every new theme runs the existing theme contract tests
  (item count, no NaN, inside the box, deterministic, `fb-new`). Season
  themes also run the season-scene checks the Christmas tests do.
- **Animation tests:**
  - every theme emits at least one `fb-anim` element;
  - the reduced-motion rule exists;
  - the number of `fb-anim` elements on a full board (both kids, high points)
    is within the budget.
- **Season tests:** Easter dates for a few known years, e.g. 2027-03-28 and
  2028-04-16, and the relative rule parsing.
- **Browser check.** `mise run ha:screenshot` takes one screenshot per theme
  and one per season scene, for review by eye. Getting a theme right is a
  visual job, so these screenshots go to the parents for feedback.
  - All themes are built and registered first. The parents then review all
    the screenshots in one batch, followed by one polishing round on what
    they say.
  - Waiting for that feedback does not block the build.

## Calls made while writing this up (check these)

- The order of themes (wizard, racing, space, rescue, chess), because no
  favourites were named.
- The names and ids of the generic, inspired-by worlds.
- The scene, small item and big item for each theme (tables above).
- The Halloween and Easter default dates, and the `easter±N` syntax.
- The rescue-dog theme's id is `rescue`, not `pups`, to keep it further
  from the franchise.
- One batch review of all screenshots, then a polishing round, instead of
  one sign-off per theme.
- Particle counts scale with area so the 60-element cap holds.
- Chess as "pieces filling a board". The other idea was "captured pieces
  lined up beside the board".
- The race car moves only a little, back and forth. A car driving all the
  way across would need it to leave the half.

## Left to the builder

- The exact drawing of every scene, the slot layouts and the capacities (the
  existing grouping into big items applies).
- The keyframe timings within the stated ranges.
- Where helpers are worth extracting.
- How to batch the work into reviewable tasks. Suggested: the animation
  layer, existing-theme animations and the dino body first, then one task per
  new theme.

## Open for later

- Piraten, Unterwasser, Garten, Fußball.
- Milestone celebrations (streak, full jar).
- Whether a kid may pick a season theme as a favourite outside its season.
  Technically it already works, since season themes also draw a half.
  That's why the per-half Halloween and Easter scenes get their animations
  too, although during the season only the shared scene shows.
