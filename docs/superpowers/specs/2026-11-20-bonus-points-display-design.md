# Stempler: family bonus points with a themed living-room display

Design document, 2026-11-20.

## Intent and why

Two kids (aged 6 and 9) earn bonus points for taking over tasks and cooperating
well during the morning and bedtime routines. Parents grant points (with a
reason), approve completed tasks, and deduct points when the kids spend them,
mostly on screen time.

The motivation comes from the kids **seeing** their progress and **doing it
themselves**:

- A tablet in the living room shows both kids' points as a hand-drawn-style
  picture: ornaments on a tree, bricks in a LEGO tower, eggs in a dino nest.
- The kids tap the tablet themselves to mark tasks done and to move points into
  savings jars.
- Themes can be swapped and change with the seasons, which keeps it fresh.

There is a second, personal goal behind this: it's a concrete, daily-use reason
to (re)adopt Home Assistant at home. The family wants to step by step replace
Google Home, or let the two coexist.

## Goals

- Kids see their own points at a glance on a shared screen, without having to
  read.
- Kids use the tablet themselves: tap their face, see their tasks, mark them
  done, deposit points into savings jars.
- Parents approve tasks, grant ad-hoc bonus or penalty points with a reason,
  approve reward claims, and convert points into screen time.
- Tasks, streaks, badges and other gamification are available.
- Swappable, hand-drawn-style visual themes (Christmas, Halloween, LEGO-like,
  dinosaurs, …): a favourite per kid plus automatic seasonal themes.
- Everything shown to the kids is in German. Text entered by parents, like
  task names or reasons, appears as entered.
- Runs in the local network on the family's own home servers, deployed with
  Docker Compose.

## Non-goals

- Building our own chore, points, approval, streak or reward engine. TaskMate
  does this.
- Cloud hosting, accounts, or access from outside the home network.
- Supporting other families or making a public product. Publishing the card
  later is possible but not a goal.
- Replacing Google Home as part of this project.

## Anti-goals (would count as failure even if it technically works)

- The display needs reading to be understood by the 6-year-old.
- Points or history get lost or silently go wrong after a TaskMate or Home
  Assistant update.
- Our card keeps its own copy of balances that can drift from TaskMate.
- The display looks like a generic dashboard rather than a drawing.

## Constraints

- **Runtime:** Home Assistant Container on one of the family's home servers,
  run with Docker Compose. There is no Supervisor and no add-ons, but HACS and
  custom integrations and cards work. Home Assistant was tried in Docker before
  and is currently disabled; it will be re-enabled for this project.
- **Engine:** TaskMate (https://github.com/tempus2016/taskmate), MIT licence,
  in HACS default, needs Home Assistant ≥ 2024.7. It releases very often
  (v7.12.0 on 2026-11-20, about 15 releases in 4 weeks) and has a single
  maintainer.
- **Language:** German UI. TaskMate ships `de.json` for the integration and
  for its cards and follows each Home Assistant user's language setting. Our
  card must ship German strings and must not show raw English labels.
- **Device:** most likely a tablet, but not decided yet. The display must work
  in any modern browser in landscape. Portrait support is nice to have.

## Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | **TaskMate in Home Assistant, plus our own themed card** | TaskMate covers chores, approval, bonus/penalty with a reason, rewards, a Screen-Time Bank, savings jars, streaks, badges, a mode for kids who can't read, and a shared-tablet kiosk. Risk: it changes fast and has one maintainer. | **Chosen** |
| B | ChoreOps in Home Assistant, plus our own card | Calmer releases, more users, a required reason on manual points. But it has no mode for kids who can't read, so we'd also have to build the tapping interface; its dashboards need regenerating after updates; history is kept 14 days by default. | Fallback |
| C | Build everything ourselves | Full control, but we'd rebuild the whole chore/approval/streak engine. | Rejected |

Standalone apps (Donetick, FamQuest, KinKudos, OpenFamilyCompass, Questboard)
were ruled out. Donetick has no reason on points and no streaks, and isn't
kid-first. KinKudos has no API and no German. Questboard has no approval and a
non-commercial licence. FamQuest's stable API is too thin. OpenFamilyCompass is
alpha and stalling. KidsChores is archived.

**Containing the TaskMate dependency** (agreed): pin the TaskMate version in
HACS and update on purpose after reading the release notes. All reads from
TaskMate go through one small adapter in our card, and entity IDs come from
configuration, not hard-coded. A TaskMate rename then means one fix, and
switching to approach B later would mostly mean rewriting the adapter.

## What gets built

### 1. Home Assistant + TaskMate setup (configuration, not code)

- Home Assistant Container in Docker Compose on one home server, with a
  persistent config volume and HACS installed.
- TaskMate installed from HACS at a pinned version, with two child profiles
  (avatar or photo, colour).
- **Parent side:** TaskMate's admin panel and approvals card on the parents'
  phones (Home Assistant companion app or browser) are the parent page. They
  cover approving chores and rewards, bonus/penalty points with a reason, the
  Screen-Time Bank, and setting up chores, rewards and savings jars. Use
  TaskMate's non-admin parent role where it fits.
- **Kid side:** TaskMate's kiosk card (pick your face, optional PIN, big
  buttons) with Pre-Reader Mode on for the 6-year-old.
- Savings jars use TaskMate's Pool Mode: the kid moves points from their
  spendable balance into a jar for a specific goal. Points in a jar are
  locked. When the jar is full, the kid requests the reward and a parent
  approves.
- Optional: TaskMate's read-aloud through a speaker for the 6-year-old.
- Turn off TaskMate's own seasonal colour themes if they clash with ours
  (builder's call).

### 2. The themed card: a custom Lovelace card (our code)

A custom Home Assistant card (web component) that draws both kids' points as a
hand-drawn-style scene. It sits on the tablet dashboard.

**Data:** read-only, from TaskMate sensors through the card's `hass` object:

- From `sensor.taskmate_overview` → `children[]`: `id`, `name`, `avatar` /
  `avatar_image`, `points`, `spendable_balance`, `allocated_points`,
  `current_streak`, and the active `season`.
- From `sensor.taskmate_rewards`: rewards with `pool_enabled`,
  `pool_allocations` per child, cost or goal, name and icon. These are the
  savings jars.
- No data is stored or changed by the card. The only exception is navigation:
  tapping a kid opens their TaskMate view.
- One adapter module maps TaskMate's data to the card's own model:
  `{kids: [{id, name, colour, avatar, points, jars: [{name, icon, current, goal}]}], sharedJars: [{name, icon, goal, contributions: {kidId: points}}], season}`.
  A jar reward with an empty `assigned_to` counts as assigned to every kid.
  Entity IDs are configurable.

**What it shows (agreed in the mockups):**

- **One screen, both kids side by side**, landscape. Each kid has their own
  half, background and avatar, so it's clear whose side is whose. Both kids
  always visible was chosen on purpose. If comparing turns into a problem
  later, a per-kid default view can be added.
- **General points** are a *collection picture*. Each point is one item: an
  ornament on a tree, a brick in a tower, an egg in a nest, a cookie in an
  open jar. There is no goal line, and it's readable without numbers. A small
  number may appear as an extra for the 9-year-old.
- **Savings jars** are small jars with a fill level and a dashed goal line,
  with the reward's icon (e.g. 🧱 LEGO, 🎬 cinema). Every savings-jar reward
  assigned to a kid is shown on that kid's side, **including empty ones**, so
  the kid is invited to start saving.
- **Shared family jars** (TaskMate "Jackpot" rewards, `is_jackpot`,
  `jackpot_pool_total`; agreed) are drawn **in the middle, on the line
  between the two halves**, and in the seasonal shared scene in the middle of
  the landscape. The fill shows each kid's contribution in that kid's colour.
  This fits the "collaborating well" idea behind the whole project.
- **Themes:** each kid has a favourite theme. During a season (December →
  Christmas, end of October → Halloween, …) a **seasonal theme takes over the
  whole screen as one shared scene**, for example a snowy landscape with one
  tree per kid, the kids told apart by colour and avatar.
- **Style:** a sketchy, hand-drawn look. SVG with a roughening filter (or a
  library like rough.js), a handwriting font, warm paper background. This is
  the look from the mockups in `docs/superpowers/specs/mockups/` (open them
  in a browser; they are fragments without the brainstorm frame, so styling
  is minimal).
- **Tap a kid's half** to open that kid's TaskMate kiosk/task view. Afterwards
  the screen returns to the picture.
- **Points arriving or leaving** is animated, e.g. an ornament drops onto the
  tree. Kept light.

**Theme system:** a theme is a module that, given the number of items and the
jars, draws a scene for one kid's half and optionally a shared scene. Every
theme leaves room in the middle for shared jars. Adding a
theme should mean adding one module. The first set: Christmas (tree), plus
two "favourite" themes, e.g. LEGO-style tower and dino nest. Halloween and
more come later. The mapping of kid → favourite theme and the season → theme
calendar live in the card's configuration.

**How many items to draw:** the picture has a practical limit, e.g. about 30
ornaments on a tree. Above that, the builder chooses a grouping, e.g. a big
ornament worth 10. It must stay countable at a glance for a 6-year-old.

### 3. Tablet setup

- A tablet in landscape, always on, showing one Home Assistant dashboard in
  fullscreen. It holds our card and the TaskMate kiosk view(s).
- It is logged in as a dedicated non-admin Home Assistant user for the kids.
- Kiosk mode: the builder chooses the browser or kiosk app (e.g. the Home
  Assistant companion app with a kiosk setting, or a kiosk browser).

### 4. Running and testing locally (goal: easy)

- Tools come from mise, including Node and the task runner.
- **Theme playground** without Home Assistant: a dev page with made-up kids,
  points and jars, with sliders and instant reload. Most of the drawing work
  happens here.
- **Tests:**
  - The adapter is tested against saved copies of real TaskMate sensor data,
    so TaskMate renames show up as failing tests.
  - The theme rules (item counts, grouping, jar fill) get tests.
  - Optional: screenshot tests of each theme.
- **Local Home Assistant:** `docker compose up` starts Home Assistant with
  TaskMate pinned and installed without HACS, e.g. by downloading its release
  zip into `custom_components`. Our built card is mounted into `/config/www`.
  A seed script creates demo kids, chores, rewards (including a personal and a
  shared savings jar) and points through Home Assistant's API.
- **CI:** GitHub Actions on the private repo runs the tests and builds the
  card file. Free-plan minutes are enough.

### 5. Deployment to the home server (route decided later)

- Production Home Assistant runs from Docker Compose on one home server, with
  a persistent config volume. TaskMate is installed through HACS (public) at
  a pinned version.
- The card ships as a single JS file attached to a GitHub release by CI.
- How it gets onto the server is **decided later**:
  - **Keep the repo private:** a deploy script or Ansible playbook copies the
    release file into `/config/www` and bumps the resource URL version.
  - **Make the repo public:** install through HACS as a custom repository.
    HACS cannot install from private repos.
- Build the repo so both routes keep working: a HACS-compatible layout
  (`hacs.json`, release asset named after the card) plus a deploy script.

### Calls made while writing this up (check these)

- The picture counts `spendable_balance`, the points the kid can spend or
  deposit right now. Points already in jars show in the jars, so nothing is
  counted twice.
- The season → theme calendar is the card's own and doesn't depend on
  TaskMate's `season` attribute, because that attribute disappears when
  TaskMate's own seasonal themes are off.
- Streaks are not part of the picture in the first version. The adapter may
  read them for later.
- Reward icons: draw TaskMate's MDI icon by default. The card configuration
  can override the icon per reward, e.g. with an emoji or a drawn icon.

## Left to the builder

- How the card is built and packaged (language, build tooling, the drawing
  library, how it's installed as a Lovelace resource). Use mise for the tools.
- The exact drawings and how items are placed in each theme, the grouping
  rule for large counts, and the animations.
- The season calendar's exact dates (TaskMate's own seasons can be reused).
- Dashboard layout details and how navigation to the TaskMate kiosk view
  works.
- The Docker Compose setup for Home Assistant: image tag, volumes, network
  mode, backups.
- Whether a small point number is shown alongside the picture.

## Open for later (not blocking)

- Whether a goal jar should ever fill on its own (points granted directly into
  it, or tasks that pay into it) instead of the kid moving points. For now,
  TaskMate's way: kids move points themselves.
- Real-money savings.
- Deploy route for the card: private repo plus a deploy script, or a public
  repo through HACS.
- Which tablet.
- Coexistence with Google Home.
