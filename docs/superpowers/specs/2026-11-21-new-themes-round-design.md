# New themes round — design

Date: 2026-11-21. Issues: [#1](https://github.com/stempler/family-board/issues/1) (the themes) and
[#6](https://github.com/stempler/family-board/issues/6) (per-kid seasons, needed for Geburtstag; section 3 is its design). Base: `master`.
Follows [2026-11-20-more-themes-and-animation-design.md](2026-11-20-more-themes-and-animation-design.md) and
[2026-11-21-theme-polish-design.md](2026-11-21-theme-polish-design.md). Everything there still binds unless changed here.

## Why

The board only motivates the kids if they want to look at it, and the same picture every day wears off. After the
polish round the parents agreed the next set of worlds: five favourites the kids can pick, two more seasons that take
over the board, and a birthday picture that shows up for one kid on their day.

## Goals

1. Five new favourite themes: `pirates`, `underwater`, `football`, `construction`, `garden`.
2. Two new season themes with a shared season scene: `martin` (St. Martin) and `summer` (Sommer).
3. A `birthday` theme and a per-kid `birthday` config field: on the kid's birthday only that kid's half shows it.
4. Gallery screenshots of everything for one batch visual review by the parents.

## Non-goals

- General per-kid season rules (a `kid` field on `seasons`). Only birthdays are per kid.
- Holiday dates per Bundesland or per year. Sommer has one fixed default range.
- Changes to the existing themes, the grouping rule, the header or the jars.
- A theme engine. Each theme stays its own hand-drawn file.

## Anti-goals

- Franchise names, characters or logos. Generic worlds only (the repo may become public).
- Themes that look alike. This round has three risks, see "Keeping the themes apart".
- Items moving to another spot when a point is added (merging small items into a big one stays the only change).
- Restless motion, or going over the animation budget.
- A birthday that is skipped or shown on the wrong day.

## Constraints

- README → "Adding a theme" is the recipe for every theme: file from `docs/theme-template.ts`, entry in `THEMES`,
  `tests/themes/<id>.test.ts` with `runThemeContract` (and `runSeasonContract` for `martin` and `summer`),
  `FIVE_KID_BOARDS`, snapshots, README table row.
- Animation: CSS only, `transform` and `opacity`, classes `fb-anim fb-<id>-…`, 1 to 30 animated elements per half,
  at most 60 in a season scene, complete still picture under reduced motion.
- The whole-board cap of about 60 animated elements (first themes doc, enforced in `tests/board.test.ts`) holds for
  every board, including one that mixes a birthday half with other themes' halves.
- Deterministic rendering; existing snapshots must not change (only new files are added, and `five-kids-*.svg` files
  for new lists).
- Kids see German only. Ids are English and lowercase.
- No new dependencies.

## Approaches

**The seven regular themes** have one sensible way: the established recipe above. A theme engine was rejected in the
first themes round and nothing has changed.

**Geburtstag** had three candidates:

- **A. A `birthday` field per kid, checked in `renderBoard` (chosen).** Least config for the parents and the smallest
  change. It only does birthdays.
- **B. A `kid` field on season rules.** General per-kid rules, but the parents would repeat the kid id, write the date
  twice and lose the default seasons as soon as they set `seasons`. "First matching rule wins" would need a second
  meaning.
- **C. The field from A, expanded internally into a rule from B.** Machinery nobody asked for, and the 29 February
  rule does not fit a `from`/`to` rule.

The parent picked A.

## Decisions

### 1. Favourite themes

Items and animations as agreed in the issue. Scene details beyond the table are the builder's.

| Id | Label | Small item | Big item | Ambient animation |
|---|---|---|---|---|
| `pirates` | Piraten | gold coins in an open treasure chest | gold bar | a ship bobs on the waves in the background |
| `underwater` | Unterwasser | shells on the sea floor | pearl (in an open shell) | bubbles rise; a fish swims through now and then |
| `football` | Fußball | footballs | trophy | a ball bounces into the net now and then |
| `construction` | Baustelle | bricks | pallet of bricks | the excavator arm swings |
| `garden` | Garten | flowers | sunflower | bees fly around |

The issue calls the big item "×10". It is the normal big item of `groupItems` (10, 50, 100, … as needed), as in every
other theme.

### 2. Season themes St. Martin and Sommer

| Id | Label | Default rule | Kid's object in the season scene | Scene and animation |
|---|---|---|---|---|
| `martin` | St. Martin | `11-01` .. `11-11` | lanterns (small) and a big lantern, e.g. hanging on the kid's lantern stick or line | evening sky, flickering candlelight |
| `summer` | Sommer | `07-15` .. `08-31` | a bucket with shells (small) and a starfish or similar big item, beside a sandcastle | beach with sea and sun; a small animation of the builder's choice (waves, a flag on the castle) |

- Both work like `christmas`, `halloween` and `easter`: `renderHalf` (so they can also be picked as a favourite) and
  `renderSeasonScene` with one object per kid via `seasonPlacement()` and `seasonKid()`.
- Both rules are appended to `DEFAULT_SEASONS`. They overlap no existing rule (Halloween ends `10-31`).
- The Sommer dates are a default, approved by the parent; they are changed like any other season, in `seasons`.
- The README `seasons` row lists the two new default rules.

### 3. Geburtstag

**Config.** `kids[].birthday`, optional, `"MM-DD"`.

- It must be a string formatted `MM-DD` (trimmed) that is a real calendar day; `02-29` is valid. Anything else is a
  config error: `kids[i]: birthday must be formatted MM-DD`, or `kids[i]: birthday is not a calendar day` for dates
  such as `02-30` or `06-31`, which would otherwise pass and never show. This is a birthday validator of its own; the
  looser season date check stays as it is. *(Builder-check call.)*
- No year: the board does not show an age. *(Claude's call.)*

**When.** A kid has birthday when the board's date (`opts.date`, local) has that month and day.

- One day only. *(Claude's call, shown to the parent.)*
- A `02-29` birthday is shown on `02-28` in non-leap years and only on `02-29` in leap years.
  *(Claude's call, shown to the parent.)*
- This lives in a small pure function (e.g. `isBirthday(birthday, date)` in `src/season.ts`) with its own tests.

**What is shown.** The `birthday` theme: label "Geburtstag", small items candles on a cake, big items presents, a
small animation (flickering candle flames, perhaps a swaying balloon).

- It is a normal theme with `renderHalf` only, no `renderSeasonScene`. So it is not a season theme
  (`seasonThemeIds()` does not list it), and it can also be picked as a favourite `theme`.
  *(Claude's call, shown to the parent.)*

**Birthday wins for that kid's half** (the parent's decision). In `renderBoard`:

- A birthday kid's half uses the `birthday` theme, whatever the kid's favourite and whatever season is active.
- No season, or a season rule naming a theme without a season scene: the other halves are unchanged.
- A season with a shared scene (e.g. Christmas on 10 December): on that day the shared scene is not drawn. Every
  other kid's half shows the season theme's own half picture (`renderHalf`), the one a kid gets who picks that theme
  as a favourite outside the season. So nothing is cut: each half is a complete picture. *(The parent's decision; it
  replaces an earlier idea of covering one half of the shared scene.)*
  - In code: with at least one birthday half on the board, `renderBoard` treats the season as one without a season
    scene (`seasonal` is null). `renderSeasonScene` is never called with a subset of the kids, and no theme changes.
  - Only a kid who is found in TaskMate and has birthday counts. A kid not found in TaskMate shows "not found" as
    today, and their birthday does not switch the shared scene off. *(Claude's call.)*
- Every kid has birthday on the same day: every half is a birthday half.
- Header, number chip, jars, tap target and tap hint work as on any half.
- Item counting (`newItemRange`, `groupItems`) uses the theme actually drawn for the half.

```
10 December, Mia's birthday
+---------------------------+---------------------------+
| Mia  [42]                 | Ben  [17]                 |
|  cake with candles,       |   Ben's own tree with     |
|  presents (birthday half) |   ornaments (christmas    |
|                           |   half, not the scene)    |
| [jars]                    | [jars]                    |
+---------------------------+---------------------------+
```

**Docs and tooling.**

- README: `birthday` row in the `kids[]` table, a line in the example, a row in the theme table and a sentence on
  how it differs from a season.
- Playground: a birthday date per kid (or a "hat heute Geburtstag" switch), so the override can be tried, including
  inside a season. *(Claude's call; form left to the builder.)*
- Gallery: `birthday` appears as a favourite tile by itself. One extra tile shows a birthday half beside a Christmas half on a date
  inside the Christmas season, since that is the picture the parents need to judge.
- `ha:screenshot`: one check that sets a kid's `birthday` to today and expects that half to show `birthday` and the other half its own theme; and once more with a season covering today, expecting no season scene and the
  season theme on the other half.

### 4. Keeping the themes apart

*(Claude's calls; the issue fixes the items, not the look.)*

- `construction` vs `bricks`: both count bricks. Baustelle is a building site: plain red clay bricks laid as a wall
  in running bond, pallets beside it, excavator and site scenery. It must not read as the coloured toy-brick tower.
- `underwater` vs `summer`: both use shells. Unterwasser is below the surface (blue water, sea floor, plants);
  Sommer is a sunny beach with bucket and sandcastle. Different shell placement and palette.
- `football` vs `racing`: both have trophies. The football trophy is a different cup shape, and the pitch, goal and
  net carry the scene.

### 5. Order and delivery

One plan, one commit per theme, in the issue's order: `pirates`, `underwater`, `football`, `martin`, then the
birthday mechanism and `birthday`, then `construction`, `garden`, `summer`. Gallery screenshots at the end for the
parents' batch review; fixes from that review are a follow-up. The pull request closes #1 and #6.

## Testing

- Per theme: the theme contract, the season contract for `martin` and `summer`, and a few theme-specific checks
  (item counts at 0, capacity, capacity + 1; the animated parts exist).
- Snapshots: the automatic `<id>-12-37`, `<id>-0-1000`, `season-martin`, `season-summer`; the eight themes on new
  `FIVE_KID_BOARDS` lists (existing lists untouched); and two birthday boards added by hand to
  `tests/snapshots.test.ts` and to its orphan check: a birthday half beside a favourite half, and a birthday half
  beside a Christmas half on a date inside the Christmas season.
- Config tests: `birthday` accepted, trimmed like the other strings, rejected when malformed, not a string or not a
  calendar day (`02-30`, `06-31`); `02-29` accepted.
- Animation budget: for every season theme, a two-kid board with one birthday kid stays at or below 60 animated
  elements.
- `isBirthday` tests: the day, the day before and after, `02-29` in a leap and a non-leap year.
- Board tests for the override: favourite replaced; during a season with a shared scene there is no
  `data-season-kid` at all and the other half has the season theme's `data-theme` and opaque background; the
  birthday half has `data-theme="birthday"`; a birthday kid not found in TaskMate leaves the season scene in place; a kid without `birthday` is never affected.

## Left to the builder

Geometry, colours, capacities (the largest that keeps every item fully visible and apart, as before), the exact
animations within the budget, the big items of `martin` and `summer`, the form of the playground's birthday control,
and the names of the two birthday snapshot files.

## Amendment after the first look (2026-11-21)

The parent looked at the gallery and asked for a different birthday picture and one fix. This section overrides
section 3 where they differ.

### Geburtstag: candles are the age, balloons are the points

- **Candles show the kid's age** (the parent's decision). They are not counted items any more. They stand on the
  cake symmetrically about its centre line: up to 10 in one centred row, 11 to 20 in two centred rows. More than 20
  are drawn as 20. *(Claude's call for the rows and the cap.)*
- **The age needs the birth year**, and TaskMate does not have it. `kids[].birthday` therefore takes two forms:
  `"YYYY-MM-DD"` (age known) or `"MM-DD"` (as before, no age). *(Claude's call.)*
  - `YYYY-MM-DD` must be a real calendar day in that year (`2019-02-29` is an error). Errors as before:
    `kids[i]: birthday must be formatted YYYY-MM-DD or MM-DD` and `kids[i]: birthday is not a calendar day`.
  - The age is the number of completed years on the board's date, so on the birthday it is the new age. The 29
    February rule applies to the age too: on 28 February of a non-leap year the kid already has the new age.
  - Without a year, or when the age would be below 1, the cake has no candles and carries a topper instead (a
    cherry, a star or similar). A wrong number of candles is worse than none.
  - The age is known on every day, so a kid who picks `birthday` as a favourite also sees their current age.
- **Balloons are the points** (the parent's suggestion): a balloon is the small item, in tidy countable groups left
  and right of the cake, each on its string. A present stays the big item and should be clearly bigger than a
  balloon. *(Presents as the big item: Claude's call.)*
- **The cake is smaller** (the parent's suggestion), to make room for the balloons.
- **A greeting** is written in the picture, on a banner across the top of the scene in place of the bunting. Kids see
  German only, so the text is "Alles Gute zum Geburtstag!" and, where a half is too narrow for it, "Alles Gute!".
  Both live in `src/i18n.ts`. *(The parent asked for "Happy birthday"; the German wording is Claude's call.)*
- Animation: candle flames (at most 8) and the banner or its pennants. Balloons are counted items and so do not
  move.

### Christmas season scene: the right tree floats

In the shared Christmas scene the snow hill dips on the right, so the right tree's trunk ends above the ground line.
The ground is moved up so that every tree's trunk and ribbon stand in the snow, for two and for five kids. This is
an intended change to an existing theme: `season-christmas.svg` changes, and no other existing snapshot does.
