# family-board-card

## What it is

A custom Home Assistant Lovelace card that shows the kids' points from
[TaskMate](https://github.com/tempus2016/taskmate) (Home Assistant integration) as a hand-drawn-style picture (ornaments on a
tree, bricks in a brick tower, eggs in a dino nest, stars in a night sky), plus savings jars. It runs
on a landscape tablet in the living room. The kids tap it themselves; the card
is read-only and only navigates (tapping a kid opens their TaskMate view).
Everything shown to the kids is in German. Design:
`docs/superpowers/specs/2026-11-20-bonus-points-display-design.md`.

## Local development

Tools come from [mise](https://mise.jdx.dev).

```sh
mise install
mise run dev      # theme playground (no Home Assistant needed), gallery at /gallery.html
mise run test     # unit tests
mise run ha:up    # local Home Assistant with TaskMate, the card and demo data
```

Other tasks: `typecheck`, `build`, `gallery:shots`, `ha:down`, `ha:reset`, `ha:seed`, `ha:screenshot`, `fixtures:capture`.

`ha:seed` overwrites the dev dashboard `/family-board` with the demo config, so
edits made to it in the UI are lost on the next seed.

`ha:screenshot` opens the board in the local Home Assistant with Playwright (in
Docker, `mcr.microsoft.com/playwright`), checks the tap navigation, a new item
after `taskmate.add_points`, the Christmas scene, every favourite theme (both
kids on it, seasons off, animated) and every season scene, and writes
screenshots (`ha-theme-<id>.png`, `ha-season-<id>.png`, ...) to
`dev/screenshots/` (or `$FB_SCREENSHOT_DIR`). Each run gives Mia one more point.

## Card configuration

| Field | Default | Description |
|---|---|---|
| `type` | `custom:family-board-card` | Card type. |
| `overview_entity` | `sensor.taskmate_overview` | TaskMate overview sensor. |
| `rewards_entity` | `sensor.taskmate_rewards` | TaskMate rewards sensor (savings jars). |
| `kids` | required, non-empty | One entry per kid, see below. |
| `seasons` | christmas `12-01`..`12-26`, halloween `10-24`..`10-31`, easter `easter-7`..`easter+1` | Seasonal theme overrides; the first matching rule wins. `from`/`to` are `MM-DD` or `easter`, `easter-N`, `easter+N` (days relative to Easter Sunday, N from 0 to 60), inclusive. Forms may be mixed. Rules with only `MM-DD` ends may wrap the year end; rules with an Easter-relative end do not, and one whose `from` is after its `to` wherever Easter falls is a config error. `seasons: []` turns seasons off. A theme with its own seasonal scene (`christmas`, `halloween`, `easter`) shows one shared scene across the board; any other theme is used for every kid's half. |
| `reward_icons` | `{}` | Map of reward id or name to an emoji or `mdi:...` icon. Default: TaskMate's own MDI icon. |

`kids[]` entries:

| Field | Default | Description |
|---|---|---|
| `id` | required | TaskMate child id (see below). |
| `theme` | required | Favourite theme, any id from [Themes](#themes). Unknown themes fall back to `bricks`. |
| `colour` | TaskMate child colour | Accent colour for the kid. Without it the child's colour from TaskMate is used, else a built-in palette colour. |
| `tap_path` | none | Dashboard path (must start with `/`) opened when the kid is tapped. |
| `show_number` | `true` | Show the point total as a number chip next to the name. Set `false` to hide it. |

```yaml
type: custom:family-board-card
overview_entity: sensor.taskmate_overview
rewards_entity: sensor.taskmate_rewards
kids:
  - id: b803da068e6a4b21
    theme: dino
    colour: "#4caf50"
    tap_path: /taskmate-anna
  - id: 8e16ad66b23f404e
    theme: bricks
    tap_path: /taskmate-ben
    show_number: false
seasons:
  - theme: christmas
    from: "12-01"
    to: "12-26"
reward_icons:
  Eis: "🍦"
  Bildschirmzeit: mdi:television
```

The child id is TaskMate's internal id, not the name: Developer Tools → States →
`sensor.taskmate_overview` → attribute `children`, field `id` of each entry.
Adding the card in the dashboard editor pre-fills the ids of all TaskMate
children.

The card resource is `/local/family-board/family-board-card.js` (type: JavaScript module).

## Themes

| Id | Name | What the kid sees |
|---|---|---|
| `christmas` | Weihnachten | Ornaments on a Christmas tree; falling snow. Season scene: one big tree per kid in a snowy landscape. |
| `bricks` | Bausteine | A tower of bricks. |
| `dino` | Dino | Eggs in a dino nest. |
| `wizard` | Zauberschule | Gems filling an hourglass in a wizard's tower room, with an owl and a candle. |
| `racing` | Rennstrecke | Medals and trophies on a shelf and podium, a race car on the track. |
| `space` | Weltraum | Stars and planets in constellations; a rocket on the moon, an occasional comet. |
| `dog` | Hund | Badges and bones at a dog house with a pup. |
| `chess` | Schach | A chessboard where every point captures an opponent piece; 16 points win a game, shown as a toppled king (5 wins make a trophy) on the shelf. |
| `halloween` | Halloween | Candy in a pumpkin bucket. Season scene: a spooky night with a ghost. |
| `easter` | Ostern | Painted eggs in a basket on a meadow with a bunny. Season scene: one basket per kid. |

`christmas`, `halloween` and `easter` also have a season scene (see `seasons`
above); all others are favourites only. Preview them with `mise run dev`: the
playground has a theme picker per kid and a "Saison" switch: "nach Datum" (the
default) uses the date field with seasons on, "keine" sets today and turns
seasons off, and each season option sets a date inside that season.

### Animations

Every theme has a little ambient animation (snow, twinkling stars, a wagging
tail, ...). It is pure CSS (`@keyframes` on `transform` and `opacity`), no
timers, and it is deterministic: the same input gives the same picture. A board
keeps to about 60 animated elements. Under `prefers-reduced-motion: reduce`
all ambient animation and the drop of a new item stop, and the still picture
looks complete.

### Gallery

`mise run dev` also serves `/gallery.html`, with every theme (and each season
scene) side by side. `mise run gallery:shots` screenshots it with reduced
motion into `dev/screenshots/` (or `$FB_SCREENSHOT_DIR`), which is handy for
reviewing all themes in one go.

### Adding a theme

1. Create `src/themes/<id>.ts` exporting a `Theme` (`renderHalf`, and for a seasonal theme `renderSeasonScene`) and register it in `src/themes/registry.ts`. The id is English and lowercase.
2. Give it `css` for its ambient animation:
   - every `@keyframes` name and class starts with `fb-<id>-`;
   - the rules set only `animation-name`, `animation-timing-function`, `transform-origin` and `transform-box`; duration, delay and iteration come from the shared `.fb-anim` rule through `--t` and `--d`;
   - animated elements carry `class="fb-anim fb-<id>-..."`, at least 1 and at most 30 per half (a season scene at most 60), and never together with `fb-item` (wrap the item's body in an inner group instead).
3. Use only escaped text (`esc`) and `num` for numbers, keep the drawing inside the half, and draw extra scenery with its own sketch key so existing shapes don't re-wobble when items are added.
   Sketch keys: scenery drawn after the items uses its own sketch key (`${seedKey}:<name>`), so adding an item never re-wobbles it.
4. Add `tests/themes/<id>.test.ts` calling `runThemeContract(theme)` and, for a seasonal theme, `runSeasonContract(theme)`, plus theme-specific checks.
5. For a seasonal theme: add a default rule to `seasons` (config) and mark each kid's object with `data-season-kid` and `data-cx`.
6. The gallery lists every registered theme (and every season scene) by itself: look at it with `mise run dev` and `mise run gallery:shots`, then run `mise run ha:screenshot` (it checks each theme in the local Home Assistant).

## Updating TaskMate

1. Bump `taskmate.version`.
2. `mise run ha:reset && mise run ha:up`.
3. `mise run fixtures:capture`.
4. `mise run test`.
5. Read the TaskMate release notes.

## Release

```sh
git tag vX.Y.Z && git push --tags
```

The `Release` workflow runs typecheck, tests and build, then creates a GitHub
release with `dist/family-board-card.js` attached.

## Deploy

Production is Home Assistant in Docker Compose on one home server with a
persistent config volume; see `deploy/compose.yaml` for an example including
notes on HACS, pinned TaskMate, the non-admin kids user and the tablet kiosk
(landscape, fullscreen, screen always on).

How the card reaches the server is **undecided — decide later**.
Both routes are kept working.

### Route (a): private repo plus deploy script (undecided)

```sh
export FB_SSH_TARGET=user@server               # scp target
export FB_HA_WWW=/path/to/config/www/family-board  # server path of /config/www/family-board
export FB_HA_URL=http://server:8123
# long-lived access token, kept in a file only you can read (chmod 600)
FB_HA_TOKEN="$(cat ~/.config/family-board/ha-token)" node scripts/deploy.mjs v1.2.0
```

It downloads the release asset with `gh release download`, copies it via
`scp`, and sets the Lovelace resource
`/local/family-board/family-board-card.js?v=<version>` (updated, or created if
absent) over the WebSocket API. Missing variables abort with a clear message.

### Route (b): public repo plus HACS custom repository (undecided)

Make the repo public and add it in HACS as a custom repository (category
Dashboard). `hacs.json` and the release asset name are already HACS-compatible.
HACS cannot install from private repos.

## Tablet: back to the picture (open item)

Tapping a kid opens the TaskMate view (`tap_path`), and **nothing brings the
tablet back to the picture yet**. TaskMate's kiosk card only returns to its own
face picker after its idle `timeout` (or shows its own ambient mode); it has no
option to leave for another view or URL, and leaving the dashboard just locks
it. Options, still to decide:

- Kiosk browser idle reload: e.g. Fully Kiosk Browser "Timer to Reload/Go to
  Start URL" with the board as start URL.
- browser_mod: navigate back to the board after an idle time.
- The "Zurück" button card in the task view (as in the dev dashboard), which
  needs a kid to tap it.
