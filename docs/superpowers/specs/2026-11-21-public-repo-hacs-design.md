# Public repo and HACS install (issue #10)

## Intent

Issue #10 left the deploy route open. Decision: the repo becomes public and the
card is installed through HACS as a custom repository (category Dashboard).
The private-repo route with `scripts/deploy.mjs` is dropped.

## Goals

- The repo is fit to publish: it has a licence and the current files no longer
  use the trademarked brick name.
- The README describes one install route, HACS.
- CI checks that the repo stays valid for HACS.

## Non-goals

- The first release tag (issue #12). HACS can only install the card once it
  exists; it is the next step, not part of this change.
- Rewriting git history. The history is published as it is: the old theme name
  and the author's email address stay visible there. This was decided knowingly.
- Editing the old plan and spec documents under `docs/superpowers/`. They are a
  historical record and keep their wording.

## Anti-goals

- No visual change. The snapshot files in `tests/__snapshots__/svg/` must stay
  untouched.
- The local dev setup keeps working as before, including its `/local/...`
  resource path.

## Approaches

The history question was the only real choice:

1. **Publish as is** and clean only the current files. Least work; the old name
   and the work email stay in history. **Chosen** by Simon.
2. Start public with a single fresh commit. Exposes nothing old, but loses the
   commits and the links from the merged PRs.
3. Rewrite history. Keeps the commits, but is fiddly and the PR pages on GitHub
   would still show the old diffs.

For the rest there was one sensible way, described below.

## Design

### Licence (decided by Simon: MIT)

- Add `LICENSE` with the MIT text, copyright "2026 Simon Templer".
- Add `"license": "MIT"` to `package.json`. `"private": true` stays; it only
  prevents publishing to npm.

### Naming check

- Rename the demo jar `Lego Set` in `dev/gallery.ts` and `dev/playground.ts` to
  `Bausteine-Set`.
- Rename the function `minifig` in `src/themes/bricks.ts` to `figure`. It is an
  internal name; the output does not change.
- Read through the labels, ids and visible texts of all ten themes once more
  and report anything doubtful to Simon rather than changing it silently.
- Afterwards, a case-insensitive search for `lego` and `minifig` finds nothing
  outside `docs/superpowers/` and the compatibility fallback (`getTheme('lego')`
  returns `bricks`, with its test), which stays so old configs keep working.

### Route (a) is removed

- Delete `scripts/deploy.mjs` and its tests.
- Keep `scripts/ha-client.mjs`; the dev scripts use it.

### README and deploy notes

- Replace the "Deploy" section with HACS install steps: add the repo as a
  custom repository (category Dashboard), install the card, add it to a
  dashboard. Keep the paragraph about the production setup and
  `deploy/compose.yaml`.
- The production resource URL is
  `/hacsfiles/family-board/family-board-card.js`. HACS registers it by itself
  when dashboards are in storage mode. `/local/family-board/...` stays only
  where the README describes the local dev setup.
- Update step 3 in `deploy/compose.yaml` ("Deploy the card") to the HACS route.
- Add a "License" line at the end of the README.

### CI

- Add a second job to `.github/workflows/ci.yml` that runs the HACS validation
  action (`hacs/action`, category `plugin`, its `main` branch pinned to a commit, because
  the action publishes no current release tags). It needs a public
  repo with a description and topics, so it is expected to be red until the
  GitHub steps below are done.

### Steps on GitHub, after the merge

1. Set a repo description and topics (HACS validation requires both).
2. Make the repo public. Simon does this, or says when to do it.
3. Re-run CI to see the HACS job green, then close #10.

## Left to the builder

- The exact wording of the HACS install steps.
- Whether the HACS job needs `ignore` entries. Prefer fixing what it reports;
  ignore a check only with a comment saying why.
