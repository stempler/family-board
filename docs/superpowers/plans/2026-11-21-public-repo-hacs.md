# Public Repo and HACS Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo fit to publish and switch the documented install route to HACS (issue #10).

**Architecture:** No product code changes behaviour. The work is a licence file, renames of a demo name and one internal function, removal of the deploy script, README and CI edits, and a few settings on GitHub after the merge.

**Tech Stack:** TypeScript, Vitest, mise, GitHub Actions, HACS.

**Spec:** `docs/superpowers/specs/2026-11-21-public-repo-hacs-design.md`

## Global Constraints

- No visual change: `git status tests/__snapshots__` must be clean after every task. Never run the tests with `-u`.
- Do not edit anything under `docs/superpowers/` except this plan's checkboxes.
- Do not rewrite git history.
- `getTheme('lego')` keeps returning the `bricks` theme (test in `tests/themes/christmas.test.ts:49` stays).
- `/local/family-board/...` stays wherever it describes the local dev setup (`scripts/dev-bootstrap.mjs`, README "Local Home Assistant").
- Commits follow Conventional Commits, without a `Co-authored-by` footer.
- After every task: `mise run typecheck && mise run test` passes.

## Review Focus

- **An old dashboard config with `theme: lego`:** still shows the bricks theme. Pinned by the existing fallback test; Task 2 must not remove it.
- **A local dev Home Assistant seeded before this change:** it still holds the reward under the old name, and `ha:seed` would add a second one. The README must say to run `mise run ha:reset` once (Task 2).
- **A dashboard in YAML mode:** HACS does not register the resource by itself there. The README must give the URL to add by hand (Task 3).
- **A reader following the README before the first release exists:** HACS finds nothing to install. The README must say a release is required (Task 3).
- **The HACS CI job on a private repo:** it fails. It must be a separate job so the existing `ci` job result stays readable (Task 4).

---

### Task 1: MIT licence

**Files:**
- Create: `LICENSE`
- Modify: `package.json`, `README.md`

- [ ] **Step 1:** Create `LICENSE` with the standard MIT text, unchanged, and the copyright line `Copyright (c) 2026 Simon Templer`.
- [ ] **Step 2:** Add `"license": "MIT",` to `package.json` directly after the `"private": true,` line. Leave `"private": true`.
- [ ] **Step 3:** Append to `README.md`:

```markdown
## License

[MIT](LICENSE)
```

- [ ] **Step 4:** Run `npm install --package-lock-only` and check that `package-lock.json` changes only by the added `license` field (if it changes at all).
- [ ] **Step 5:** Run `mise run typecheck && mise run test`. Expected: pass.
- [ ] **Step 6:** Commit `chore: add the MIT licence`.

### Task 2: Naming check

**Files:**
- Modify: `dev/gallery.ts:9`, `dev/playground.ts:13`, `scripts/dev-bootstrap.mjs:121,137`, `src/themes/bricks.ts:76,99`
- Modify: `tests/adapter.test.ts:81`, `tests/draw.test.ts:75`, `tests/fake-hass.test.ts:12,21`, `tests/fixtures/docs-sample.json:15`, `tests/fixtures/taskmate-v7.12.0.json:333`
- Modify: `README.md` ("Local Home Assistant", the "Stop or reset" list)

The demo savings jar is renamed everywhere to one name, `Bausteine-Set`:

| Old | New |
|---|---|
| `Lego Set`, `LEGO-Set` | `Bausteine-Set` |
| `Lego` (`tests/draw.test.ts`) | `Bausteine` |
| function `minifig` | `figure` |

- [ ] **Step 1:** Apply the renames in the files above. In `tests/fixtures/taskmate-v7.12.0.json` change only the `name` value on line 333 by hand; do not re-capture the fixture.
- [ ] **Step 2:** In `README.md`, add to the `mise run ha:reset` bullet: a Home Assistant seeded before the jar was renamed needs one `ha:reset`, otherwise `ha:seed` adds the jar a second time.
- [ ] **Step 3:** Run `git grep -n -i -E "lego|minifig" -- . ':!docs/superpowers'`. Expected: exactly one hit, `tests/themes/christmas.test.ts:49`, plus the fallback itself if `src/themes/registry.ts` names it.
- [ ] **Step 4:** Run `mise run typecheck && mise run test`, then `git status --short tests/__snapshots__`. Expected: tests pass, no snapshot file changed.
- [ ] **Step 5:** Read `label`, `id` and every visible text string of all ten themes in `src/themes/*.ts`, and the theme table in `README.md`. Look for brand, franchise or character names. Change nothing; write the result (either "nothing found" or a list with file and line) into the commit body and report it at the end of the task.
- [ ] **Step 6:** Commit `chore: rename the demo jar and the brick figure helper`.

### Task 3: Remove the deploy script and document HACS

**Files:**
- Delete: `scripts/deploy.mjs`, `tests/deploy.test.ts`
- Modify: `README.md` (line 129 and the "Deploy" section, lines 211-240), `deploy/compose.yaml:16`

- [ ] **Step 1:** Delete the two files. Check with `git grep -n "deploy.mjs"` that nothing outside `docs/superpowers/` refers to the script. `scripts/ha-client.mjs` stays.
- [ ] **Step 2:** Replace `README.md` line 129 with: with HACS the resource is `/hacsfiles/family-board/family-board-card.js` (type: JavaScript module); the local dev setup uses `/local/family-board/family-board-card.js`.
- [ ] **Step 3:** Rewrite the "Deploy" section. Rename it to "Install". Keep the first paragraph about production and `deploy/compose.yaml`. Remove the "undecided" sentence and both route subsections. Add these steps:
  1. HACS → three-dot menu → Custom repositories → add `https://github.com/stempler/family-board`, type Dashboard.
  2. Search for "Family Board Card" in HACS and download it. This needs at least one release (see "Release").
  3. Dashboards in storage mode get the resource added by HACS. For a YAML-mode dashboard, add `/hacsfiles/family-board/family-board-card.js` as a JavaScript module by hand.
  4. Add the card to a dashboard (see "Card configuration").
  5. Updates: HACS shows new releases; update there and reload the tablet.
- [ ] **Step 4:** In `deploy/compose.yaml` replace line 16 with: `# 3. Install the card through HACS: see README, "Install".`
- [ ] **Step 5:** Run `git grep -n -i -E "undecided|route \(a\)|route \(b\)|FB_SSH_TARGET" -- . ':!docs/superpowers'`. Expected: no hits.
- [ ] **Step 6:** Run `mise run typecheck && mise run test`. Expected: pass, with the deploy tests gone.
- [ ] **Step 7:** Commit `docs: install through HACS and remove the deploy script` with the footer `Closes #10`.

### Task 4: HACS validation in CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1:** Add a second job after `ci`:

```yaml
  hacs:
    runs-on: ubuntu-latest
    steps:
      # hacs/action publishes no current release tags, so this follows its main branch,
      # pinned to a commit. The "# main" comment lets Renovate update the digest.
      - uses: hacs/action@1ebf01c408f29afcb6406bd431bc98fd8cbb15aa # main
        with:
          category: plugin
```

- [ ] **Step 2:** Push the branch and read the job log with `gh run view --log --job <id>`. Expected: the `ci` job is green. The `hacs` job is red while the repo is private; note which checks it lists as failing.
- [ ] **Step 3:** Commit `ci: validate the repo for HACS`. In the PR description, state that the `hacs` job is expected to fail until the repo is public, has a description and topics, and (probably) has its first release (#12), since HACS looks for `family-board-card.js` in a release.

### Task 5: GitHub settings (after the merge, only with Simon's go-ahead)

These change the public state of the repo. Do none of them without Simon saying so in the session.

- [ ] **Step 1:** Set description and topics:

```sh
gh repo edit stempler/family-board \
  --description "Home Assistant dashboard card that shows kids' TaskMate points as hand-drawn pictures" \
  --add-topic home-assistant --add-topic hacs --add-topic lovelace --add-topic custom-card
```

- [ ] **Step 2:** Simon makes the repo public (Settings → Danger Zone), or asks for `gh repo edit stempler/family-board --visibility public --accept-visibility-change-consequences`.
- [ ] **Step 3:** Re-run CI on `master` (`gh run rerun <id>`) and read the `hacs` job. Fix what it reports in a follow-up commit; add an `ignore` entry only with a comment saying why. If the only remaining failure is the missing release, record that on #12 and leave it.
- [ ] **Step 4:** Check that #10 is closed.
