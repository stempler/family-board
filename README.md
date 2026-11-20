# family-board-card

## What it is

A custom Home Assistant Lovelace card that shows the kids' points from
TaskMate (Home Assistant integration) as a hand-drawn-style picture (ornaments on a
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

Other tasks: `typecheck`, `build`, `ha:down`, `ha:reset`, `ha:seed`, `fixtures:capture`.

## Card configuration

| Field | Default | Description |
|---|---|---|
| `type` | `custom:family-board-card` | Card type. |
| `overview_entity` | `sensor.taskmate_overview` | TaskMate overview sensor. |
| `rewards_entity` | `sensor.taskmate_rewards` | TaskMate rewards sensor (savings jars). |
| `kids` | required, non-empty | One entry per kid, see below. |
| `seasons` | `[{theme: christmas, from: "12-01", to: "12-26"}]` | Seasonal theme overrides. `from`/`to` are `MM-DD`, inclusive, and may wrap the year end. |
| `reward_icons` | `{}` | Map of reward id or name to an emoji or `mdi:...` icon. Default: TaskMate's own MDI icon. |

`kids[]` entries:

| Field | Default | Description |
|---|---|---|
| `id` | required | TaskMate child id. |
| `theme` | required | Favourite theme: `christmas`, `lego` or `dino`. Unknown themes fall back to `lego`. |
| `colour` | theme default | Accent colour for the kid. |
| `tap_path` | none | Dashboard path (must start with `/`) opened when the kid is tapped. |
| `show_number` | `false` | Also show the point total as a number. |

```yaml
type: custom:family-board-card
overview_entity: sensor.taskmate_overview
rewards_entity: sensor.taskmate_rewards
kids:
  - id: anna
    theme: dino
    colour: "#4caf50"
    tap_path: /taskmate-anna
    show_number: true
  - id: ben
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

How the card reaches the server is **noch nicht entschieden / decide later**.
Both routes are kept working.

### Route (a): private repo plus deploy script (undecided)

```sh
export FB_SSH_TARGET=user@server               # scp target
export FB_HA_WWW=/path/to/config/www/family-board  # server path of /config/www/family-board
export FB_HA_URL=http://server:8123
export FB_HA_TOKEN=<long-lived access token>
node scripts/deploy.mjs v1.2.0
```

It downloads the release asset with `gh release download`, copies it via
`scp`, and sets the Lovelace resource
`/local/family-board/family-board-card.js?v=<version>` (updated, or created if
absent) over the WebSocket API. Missing variables abort with a clear message.

### Route (b): public repo plus HACS custom repository (undecided)

Make the repo public and add it in HACS as a custom repository (category
Dashboard). `hacs.json` and the release asset name are already HACS-compatible.
HACS cannot install from private repos.
