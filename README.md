# family-board-card

## What it is

A custom Home Assistant Lovelace card that shows the kids' points from
[TaskMate](https://github.com/tempus2016/taskmate) (Home Assistant integration) as a hand-drawn-style picture (ornaments on a
tree, bricks in a LEGO tower, eggs in a dino nest), plus savings jars. It runs
on a landscape tablet in the living room. The kids tap it themselves; the card
is read-only and only navigates (tapping a kid opens their TaskMate view).
Everything shown to the kids is in German. Design:
`docs/superpowers/specs/2026-11-20-bonus-points-display-design.md`.

## Local development

Tools come from [mise](https://mise.jdx.dev).

```sh
mise install
mise run dev      # theme playground (no Home Assistant needed)
mise run test     # unit tests
mise run ha:up    # local Home Assistant with TaskMate, the card and demo data
```

Other tasks: `typecheck`, `build`, `ha:down`, `ha:reset`, `ha:seed`, `ha:screenshot`, `fixtures:capture`.

`ha:seed` overwrites the dev dashboard `/family-board` with the demo config, so
edits made to it in the UI are lost on the next seed.

`ha:screenshot` opens the board in the local Home Assistant with Playwright (in
Docker, `mcr.microsoft.com/playwright`), checks the tap navigation, a new item
after `taskmate.add_points` and the Christmas scene, and writes screenshots to
`dev/screenshots/` (or `$FB_SCREENSHOT_DIR`). Each run gives Mia one more point.

## Card configuration

| Field | Default | Description |
|---|---|---|
| `type` | `custom:family-board-card` | Card type. |
| `overview_entity` | `sensor.taskmate_overview` | TaskMate overview sensor. |
| `rewards_entity` | `sensor.taskmate_rewards` | TaskMate rewards sensor (savings jars). |
| `kids` | required, non-empty | One entry per kid, see below. |
| `seasons` | `[{theme: christmas, from: "12-01", to: "12-26"}]` | Seasonal theme overrides. `from`/`to` are `MM-DD`, inclusive, and may wrap the year end. A theme with its own seasonal scene (currently `christmas`) shows one shared scene across the board; any other theme is used for every kid's half. |
| `reward_icons` | `{}` | Map of reward id or name to an emoji or `mdi:...` icon. Default: TaskMate's own MDI icon. |

`kids[]` entries:

| Field | Default | Description |
|---|---|---|
| `id` | required | TaskMate child id (see below). |
| `theme` | required | Favourite theme: `christmas`, `lego` or `dino`. Unknown themes fall back to `lego`. |
| `colour` | TaskMate child colour | Accent colour for the kid. Without it the child's colour from TaskMate is used, else a built-in palette colour. |
| `tap_path` | none | Dashboard path (must start with `/`) opened when the kid is tapped. |
| `show_number` | `false` | Also show the point total as a number. |

```yaml
type: custom:family-board-card
overview_entity: sensor.taskmate_overview
rewards_entity: sensor.taskmate_rewards
kids:
  - id: b803da068e6a4b21
    theme: dino
    colour: "#4caf50"
    tap_path: /taskmate-anna
    show_number: true
  - id: 8e16ad66b23f404e
    theme: lego
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
