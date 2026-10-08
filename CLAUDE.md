# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Errata 5e** (`fvtt-mod-errata5e`) is a house Foundry VTT module of stopgap fixes for bugs
in upstream packages we depend on. Most are in the premium dnd5e compendium books. The books in
scope are the ones in [VERSIONS.md](VERSIONS.md): the Player's Handbook, Dungeon Master's Guide and
Monster Manual (2024), Heroes of Faerûn, Arcana Unleashed and Ravenloft: The Horrors Within. All
are enabled in the sandbox world. The dnd5e system (its SRD 2024 packs included) and Foundry under
the books count as upstream too. Adding a book means adding it to VERSIONS.md and to `PACKAGES` in
`tools/lib/upstream.mjs`, and enabling it in the sandbox world. Vendors
ship updates often (each book several times a year, sometimes several books in one day), but on
their own schedule: a given bug may be fixed in the next release, or never. Each fix stays only
until the vendor ships a real fix, and every vendor update gets a
[version review](#vendor-updates-version-reviews) to find out. When upstream fixes the bug, the
fix is retired.

### Where a fix belongs

- **Here:** a bug in something we did not write and cannot fix at the source. That means a
  premium book's data (a broken effect key, a bad activity, a wrong formula, a bad item or
  monster), the dnd5e system, Foundry itself, or a third-party module.
- **`../fvtt-mod-battleflow`:** rules of the game. Never put rules here, and never use a vendor
  fix as a crutch for a house module's own gaps.

**Only game-breaking bugs get a fix.** Every vendor bug we find is filed as an issue, but there
are hundreds, and fixing them all would be too much. Write an in-memory Errata 5e fix only for a bug the
user judges game-breaking for our tables or for the house modules being built now. Everything
else stays open as an issue, re-checked at each version review, until the vendor fixes it or it
starts to matter. Don't propose or write a fix just because an issue exists.

**Every fix has its issue.** The bug is filed first, in the usual format. When an Errata 5e fix ships,
the issue gets the `worked-around` label and a **Resolution** header row naming the fix and its
release, and it **stays open**: the vendor's data is still wrong, and open issues
are what each version review re-checks. It closes when the vendor fixes the bug, as the fix goes
`upstream-fixed` and then `retired`. The register's **Issue** column links the two.

## Commands

There is no build, bundler, linter or unit-test runner. The module is plain ES modules loaded
straight from `scripts/`.

- `node tools/check-register.mjs`: checks that the register parses and agrees with the code, the
  manifest, the suites and VERSIONS.md (offline, no dependencies). Add `--json` to print the
  register as JSON. Run it before every commit; CI runs it on every push. `npm run check` runs
  the same thing.
- `node tools/check-issues.mjs`: checks every issue on GitHub, open and closed, for a test on the
  version reviewed: the Package row at VERSIONS.md's Reviewed version, the Live check row with a
  result on it, and the test itself on record (a comment opening with a dated verdict, or on a
  closed issue an Evidence section), and that no upstream report is named in more than one
  issue (bodies and comments). Exit 1 on any gap; a "Not tested live" row is only a warning. Run it at the end of a version review; CI runs it on every push. `--json` prints
  every issue's findings. `npm run check:issues` runs the same thing.
- `node tools/suites/<suite>.mjs`: runs one fix's live suite against the local sandbox (see
  below). For example, `node tools/suites/e-004-754-sword-of-sharpness-crit.mjs` tests E-004.
- `node tools/vendor-review.mjs snapshot|versions|diff …`: snapshots a vendor package's packs
  (outside the repo) and diffs two versions against the open issues, for a
  [version review](#vendor-updates-version-reviews). Run it with no arguments for usage.
- `node tools/recheck.mjs <package> <old> <new> [--apply]`: sorts a package's open issues by
  whether the documents they cite changed between two snapshots, and records the unchanged ones;
  see [the review](#vendor-updates-version-reviews).
- `node tools/sandbox-probe.mjs <probe.mjs>`: runs a sandbox test with the house rules built in
  (refuses while another session is connected, cleans up afterwards); see
  [Verifying issues on the sandbox](#verifying-issues-on-the-sandbox).
- `node tools/record-live-check.mjs <issue> --result …`: records a sandbox test on an issue
  (header rows, comment, closing a non-issue). Add `--dry` to preview.
- `node tools/upstream-watch.mjs`: the daily upstream watch, run by a GitHub Action; see
  [Upstream watch](#upstream-watch). `--record <ours>=<upstream>` cites a confirmed pair,
  `--different <ours>=<upstream>` dismisses one.
- `powershell -ExecutionPolicy Bypass -File tools/build-release.ps1`: builds the release zip in
  `dist/`.

## Layout and conventions (shared with the sister modules)

- `module.json` has a single `esmodules` entry, `scripts/errata5e.js`. It only imports
  `core.js` (`MODULE_ID`, `TITLE`, nothing else) and one file per fix under `scripts/patches/`,
  named `e-NNN-<issue>-<name>.js` after the fix's register row and the issue it works around
  (`e-004-754-sword-of-sharpness-crit.js`); the checker enforces the name. Each fix file registers its own
  hooks and no setting: the module is one switch, every fix on when it is enabled and nothing
  touched when it is not. The fixes share nothing. The sandbox must be restarted after a fix
  file is added.
- A fix's live suite, when it has one, is `tools/suites/e-NNN-<issue>-<name>.mjs`, named like
  the fix file.
- **Each fix file opens with a doc comment:** `E-NNN · NAME`, then **THE PROBLEM** (what is
  broken, in which book/package and document, how it was measured, with dates and versions) and
  **THE FIX**. That comment holds the full write-up; the register row is its summary. Keep the
  pure logic exported (e.g. `sharpnessCritValue(change, effect)`) so a suite can test it without a world.
- **Correct at runtime; never edit the vendor's pack.** Fix the data as it loads or prepares
  (hooks, or the system's tables at `setup`). That way every copy is fixed, including items
  already on actors.
- **Be a no-op on already-correct data,** so an upstream fix is never applied twice and the
  retirement check can confirm the fix has gone quiet.
- Wrap `setup`/`ready` work in `try/catch` and log with the `TITLE` prefix, so one broken fix
  cannot stop the world loading.
- Author `Txpple` (no personal name), MIT license. The dnd5e system relationship and the
  Foundry compatibility (minimum 13 / verified 14) match the sisters' `module.json`.

## The register (`REGISTER.md`)

`REGISTER.md` is the single, clean list of every vendor fix. It is **one Markdown table, one row
per fix**, readable as-is by a person and parsed by `tools/check-register.mjs` (`parseRegister`
is exported for any other tool, and `--json` emits the rows). **A fix is not done until its row
is complete and lands in the same commit as the code.** The README carries no per-fix table and
`module.json`'s description names no fix: both point at the register. The check fails on a
row with no code behind it, a file in `scripts/patches/` or `tools/suites/` with no live row, a
file not named after its row and issue, a fix file that does not open with its ID or that registers
a setting, an entry point that does not import exactly the live files, and a VERSIONS.md that
does not list the watch's packages.

The table sits between `<!-- register:start -->` and `<!-- register:end -->`. The columns are
fixed, in this order. Changing them means changing `COLUMNS` in the checker in the same commit.

| Column | Contents |
| --- | --- |
| ID | `E-001`, `E-002`, …, in row order. Never reused, never renumbered. |
| Status | `active`, `upstream-fixed` (the vendor has fixed it; ours is a no-op pending removal), or `retired` |
| Issue | The bug's issue in this repo (`#709`), labelled `worked-around`; one issue per fix |
| Vendor | Publisher or maintainer that owns the bug |
| Package | Foundry package id where the bug lives (`dnd-players-handbook`, `dnd5e`, …) |
| Source | Book or component (PHB, DMG, MM, a system class), with the pack id if relevant |
| Documents | Affected documents, UUIDs where known |
| Bug | What is wrong in the data, and what it does at the table |
| Fix | What the fix does, in one line |
| File | `scripts/patches/e-NNN-<issue>-<name>.js` (must exist and open with the ID unless retired) |
| Measured on | Upstream versions tested against, with dates |
| Dependents | Every module that relies on the fix, and what it relies on (`none known` if none) |
| Upstream report | Link to the bug report, or `not reported` |
| Retire when | How to tell the vendor has fixed it, and what the fix does then |
| Added | When and in which release |
| Retired | Release and date, or `—` while not retired |

**Cell rules, so the table stays machine-readable:**
- Never put a `|` in a cell. Separate several values with `; `.
- Use `—` for an empty value; a blank cell fails the check.
- Keep cells plain text: no links or line breaks.
- Rows are never deleted. A retired fix keeps its row, with `Status` set to `retired` and
  `Retired` filled in.

**Dependents are part of the contract.** When work in a sister repo turns out to rely on a
vendor fix, add that module to the row. Before changing or retiring a fix, read its Dependents
and tell the user which modules are affected. When a vendor package updates, run a
[version review](#vendor-updates-version-reviews), which includes each `active` row's Retire-when
check.

## Test environment

- **The LOCAL sandbox is the test box, never prod.** It is a byte copy of the Molten prod world
  run headless: `node ../fvtt-mcp-dnd5e/scripts/local-foundry.mjs start|stop|status|restart`.
  Never launch the Electron app for suites.
- **Deploy to the sandbox:** `node ../fvtt-mcp-dnd5e/scripts/deploy-house-module.mjs fvtt-mod-errata5e --local`.
  Restart the sandbox when `module.json` changes. A world reload is enough for script edits.
  A sandbox refresh from prod wipes locally deployed modules, so re-deploy after every refresh.
- **Suites** use the MCP repo's Foundry client (`fvtt-mcp-dnd5e/client`, a `file:` devDependency;
  run `npm install` once; credentials come from that repo's `.env`; the suite identity is
  "Tester Assistant"). The module must be enabled in the sandbox world. Disconnect the MCP
  bridge (`disconnect-bridge`) before a suite or a restart, because one connected user blocks
  the restart.
- The `foundry-local5e` MCP tools (sandbox) are good for inspecting the vendor documents a fix
  targets (`read-pack`, `get-compendium-entry`, `search-compendium`).
- **Prod (Molten):** deploy only on the user's explicit say-so, using the same script with
  `FOUNDRY_HOST=molten` and without `--local`. A `module.json` change needs the prod process
  restarted, which is not ours to do. Never force-reload the user's prod window.
- **All vendor-fix work happens on the sandbox, never in prod.** Reviews, live checks and suites
  run there, and the versions they record are the sandbox's. A refresh from prod can change those
  versions, so check them after one (`local-foundry.mjs status` for Foundry and dnd5e, the module
  list for the books).

## Verifying issues on the sandbox

Every vendor issue is tested on the sandbox whenever that is possible and useful: when it is
filed, and again at every version review. Offline pack reads mislead too often: what duration an
applied effect really gets, whether an effect transfers, how consumption behaves, and what a
prepared spell copy keeps. A claim about what dnd5e *does* is confirmed only once dnd5e has done it.

- **Test it.** Prefer in-memory documents (`new Actor.implementation(data)`): nothing is saved, and
  other sessions' work isn't disturbed. When a test has to write (a combat, a cast, a transform),
  name everything `Errata Live …`. `node tools/sandbox-probe.mjs <probe.mjs>` runs a probe with the
  rules built in: it refuses while another session is connected, and afterwards deletes the run's
  `Errata Live …` documents, its combats and the chat messages it caused.
- **Document it in the issue.** `node tools/record-live-check.mjs <issue> --result <result> --notes <file.md>`
  sets the header's **Package** and **Live check** rows to the version tested and posts the test
  as a comment: what was built, what was run, and the numbers seen. Preview with `--dry`. A test
  that compares with and without a fix says *Errata 5e on* and *Errata 5e off* (the module
  enabled or not), never a fix's id as a switch: no fix has a setting.
- **Not a bug: close it.** If the test shows the issue isn't real, or the version tested fixed it,
  record that with the evidence and close the issue as *not planned*. `--result not-reproduced`
  and `--result fixed-upstream` do both.
- **Worse, narrower or different:** `--result worse` records it. Then correct the title,
  severity, summary and proposed fix by hand.
- **Can't be tested live** (the stored value itself is the defect, or the book isn't enabled in
  the sandbox world): record that with `--result not-run --reason "…"`, so nobody mistakes an
  offline reading for a live result. Load the documents from a snapshot and test them in memory
  where you can.

## Vendor updates (version reviews)

Vendors ship often: the dnd5e system, Foundry and the premium books all release several times a
year, and one "Update All" on the setup screen can move several packages at once (2026-10-01:
Heroes of Faerûn 1.1.0 → 2.0.0, Arcana Unleashed 1.0.1 → 1.0.2 and Ravenloft 1.0.1 → 2.0.0
together). Any update can fix one of our issues, change data a fix matches on, or bring new bugs.
**Every vendor update gets a version review**, as routine work, not a one-off.

**Snapshot before updating.** Foundry's update overwrites the old version, and a review needs both.
Snapshot the sandbox's version before updating a package there (or as soon as you see an update
pending), and snapshot the new version after:
- `node tools/vendor-review.mjs snapshot <package> …` extracts the installed version's packs to
  `vendor-snapshots/<package>/<version>/` two levels above the main checkout
  (`D:\Workbench\FVTT\vendor-snapshots`), from any checkout including a worktree. That is outside
  every repo (the tools refuse a path inside one): premium pack data is never committed.
  `ERRATA_SNAPSHOT_DIR` overrides the location.
- `node tools/vendor-review.mjs diff <package> <old> <new> --issues` lists every changed, added and
  removed document, and the open issues that cite one.
- `node tools/vendor-review.mjs versions` lists the snapshots on disk. Baselines taken 2026-10-03:
  dnd5e 6.0.5, PHB 2.2.0, MM 1.4.0, DMG 2.0.0, Heroes of Faerûn 2.0.0, Arcana Unleashed 1.0.2 and
  Ravenloft 2.0.0. No earlier version was kept, so a bug reported against one can't be re-run.

**The review**, for each package that moved (steps 1 to 4, then 5):
1. **Read what changed.** Run the diff, and read the package's own changelog: each book ships one
   as a journal page, and dnd5e and Foundry publish release notes.
2. **Our fixes.** For each `active` register row on that package, run its suite and its
   Retire-when check, and update the row's **Measured on** with the new version and date. A fix
   the vendor made unnecessary goes `upstream-fixed`, then `retired`. Read its Dependents first.
3. **Every open issue on that package.** First `node tools/recheck.mjs <package> <old> <new>`:
   it sorts the open issues by whether the documents they cite changed between the snapshots. An
   issue whose documents are unchanged still has its bug by construction, and `--apply` records
   that in its header (the Package row at the new version; the Live check row: not re-tested on
   it, the cited documents unchanged) with no sandbox. The rest are re-checked live, tested and
   recorded as in [Verifying issues on the sandbox](#verifying-issues-on-the-sandbox): every issue
   whose documents changed or went missing, every issue citing no document, and always every
   issue labelled `severity: high` or `worked-around`, and every issue whose Upstream row cites
   a report the vendor has closed (`watch/STATUS.md` lists them). A dnd5e or Foundry update can
   change behaviour without touching pack data: the live tier is the same, and the recorded note
   says the behaviour was not re-tested. Then, for each issue checked live:
   - **Still there:** update the header (below), and comment with what you checked.
   - **Fixed upstream:** comment with the evidence, and close it as *not planned*. The header
     says "fixed in X".
   - **Changed** (worse, narrower, different, or the proposed fix no longer fits): correct the
     title, severity, summary and proposed fix, and say what changed in a comment.
4. **New bugs.** Read the changed and added documents, because a rework can break what worked.
   File new issues in the usual format, after checking that none exists.
5. **Close the review in `VERSIONS.md`.** Set the package's **Reviewed** to the new version and
   **Reviewed on** to the date, and commit it with the review's other changes.

**Issue headers show the latest version reviewed.** Each review updates the header table in the
issue body itself (`record-live-check.mjs` writes the Package and Live check rows). Never leave a
stale header for a comment to explain.
- **Package:** the version tested, and the version the issue was filed against.
  For example: `` `dnd-arcana-unleashed` 1.0.2 (premium module). Filed against 1.0.1; still present in 1.0.2. ``
- **Live check:** the result on that version (confirmed, doesn't reproduce, or not tested live and
  why), with the date and the Foundry, dnd5e and book versions.
  For example: `Confirmed on 2026-10-01 (Foundry 14.368, dnd5e 6.0.5, Arcana Unleashed 1.0.2).`
- **Upstream:** whether that release's notes mention it, and whether that version still has it.

## Writing to GitHub

- **Issues state facts only:** the bug, what was built and run, and the numbers seen. Never cite
  CLAUDE.md or restate these working rules, tools or sandbox habits in an issue, a header or a
  comment.
- **Never link to a vendor's tracker.** Every link, bare URL or `owner/repo#N` autolink to a vendor
  issue puts a permanent "mentioned this" entry on their report. Cite a report as plain code,
  `foundryvtt-premium-content#1452` or `foundryvtt/dnd5e#7251` (backticks matter), in every issue
  body, header row and comment; the watch reads the code form. References between our own issues
  are fine.
- **One issue of ours per upstream report.** A vendor report is named in exactly one issue of
  ours, in its Upstream row, and nowhere else: not in another issue's body, header or comment.
  Citations are code today, but they may be switched to links one day, and then every mention
  becomes a link; the data has to be clean before that switch. When one report covers several
  documents (every modron, say), one tracking issue of ours, labelled `tracking`, cites it and
  lists the per-document issues as GitHub sub-issues; each of those carries a "Tracked in #N"
  header row and cites nothing. A tracking issue has no test of its own (`check-issues` exempts
  it), and at a version review a closed report cited on a tracking issue means re-checking its
  sub-issues.
  When the same bug is filed once per book, the citation goes on the issue whose package the
  report is about (a premium-content report on the book copy, a dnd5e report on the SRD copy),
  and the twin's Other book row points at it. A closed `not a bug` issue is the one issue for
  the report it answers. `check-issues` fails on a report named in two issues, and the watch's
  `--record` refuses to cite a report another issue already names.
- **Commit messages never name an issue number.** GitHub links a commit into the timeline of every
  `#N` its message names. Describe the change in words instead.
- **Any change to many issues is tried on one first,** and the user looks at that one before the
  rest run. Then post one at a time, a few seconds apart: GitHub's content limit (about 500
  creates an hour, shared by every session on the account) can drop a create without an error,
  so count a create only when gh prints its URL.
- **Never file new issues in bulk.** Work the few reports a day the watch brings, one at a time.
- **The repo is private.** Making it public is the user's call.

## Upstream watch

A GitHub Action (`.github/workflows/upstream-watch.yml`) runs `node tools/upstream-watch.mjs`
daily and commits what it writes. It needs no sandbox or local install: versions come from the
vendors' public manifests and Foundry's release page, issues from the GitHub API with the
workflow's own token (locally: `GH_TOKEN`/`GITHUB_TOKEN`, or `gh auth token`). It reads two
upstream trackers: `foundryvtt/foundryvtt-premium-content` for the books, and `foundryvtt/dnd5e`
for the system's SRD packs (our `book: SRD 2024` issues; only a report its triage has labelled
`compendium content: 2024` can name a document of ours). The package list, and where each vendor
takes reports, is `PACKAGES` in `tools/lib/upstream.mjs`: adding a package is one line there and
one row in VERSIONS.md. Each run writes, all in `watch/`:
- **`STATUS.md`**, the watch at a glance, rewritten every run: version reviews due, pairs to
  judge, cited reports the vendor has closed, reports new to us with the date first seen, and a
  count per source.
- **`LOG.md`**, one row per run.
- **`state.json`**, what it remembers: the last scan date, every judged pair, when each
  new-to-us report was first seen, and the state of every upstream report our issues cite.
- **`YYYY-MM-DD.md`**, a digest, only on a day with something to act on: a version newer than
  the one reviewed, pairs to judge, a cited report newly closed, or reports first seen today.
- **`VERSIONS.md`**: the **Latest published** column, and the date each version was first seen.
  **Reviewed** belongs to the [version review](#vendor-updates-version-reviews), never to the watch.
- With `--notify` (the Action passes it), one open issue of ours labelled `version review` per
  package whose latest version is newer than the one reviewed, closed by the watch once the
  review has moved **Reviewed**. That is the only issue the watch ever files.

A match is the same document, not necessarily the same bug: a token-art or typo report on a
monster is not the same bug as a missing immunity on it. Judging needs a reader: a session in
this repo (the first thing it does, below), or a scheduled routine if one is set up. For each
pair under **To judge** and **Possible** it reads both issues and records a verdict, so no pair
is shown twice. `--record <ours>=<upstream>` is for the same bug (a dnd5e report is `<ours>=dnd5e#<n>`):
it writes a quiet reference (code, no link, so nothing appears upstream) into our issue's Upstream
row and, for an issue with an Errata 5e fix, the register. `--different <ours>=<upstream>` is for a
different bug. `--record` refuses when another issue of ours already names the report, and says
which: cite it there, or make that issue the tracking issue. A judged pair comes back only if the upstream title changes. A new-to-us report
that matches a closed issue of ours (one that didn't reproduce, say) is judged against it the
same way, and then drops off the new-to-us list. The judge then
appends `## Run notes` to the day's digest: a verdict per pair, anything that failed, and the
new-to-us reports it worked: the issues filed, open or closed as not a bug. Finally it commits `watch/`
and any register change (after `check-register`) to `main`. The watch never writes to an
upstream repo, and never files, closes or relabels a vendor issue.

**At the start of every session in this repo**, pull `main` and read `watch/STATUS.md`:
- **A version review due** (Latest published newer than Reviewed) comes first. Say so. Updating
  the sandbox is the user's call, and the installed version must be snapshotted before it moves.
- **Pairs to judge**: judge and record them as above, and write the day's run notes.
- **Cited reports now closed**: the next version review of that package re-checks those issues,
  or sooner if the closing note says the bug is fixed in a published version.
- **New to us**: work every one, and take none at face value. Our issues hold only real,
  validated bugs: no feature requests, nothing working as designed, nothing a reporter misread.
  1. **Is the claim right?** Check it against the rule text and the document's own text. A Foundry
     Note telling the player to do a step by hand is a design choice, not a bug. Art, token and
     styling wishes are not bugs either.
  2. **Is it new?** Search our issues, open and closed.
  3. **Does it reproduce?** Test it on the sandbox on the installed version, as in
     [Verifying issues on the sandbox](#verifying-issues-on-the-sandbox).
  4. **A validated bug is filed** as an issue of ours in the usual format, citing the report as
     code (one issue per book). Filing needs no sign-off, and an issue doesn't need a tested fix.
     An Errata 5e fix still needs the user's call (see [Where a fix belongs](#where-a-fix-belongs)).
  5. **A report that isn't a bug gets an issue too,** so the answer is on record. Use the same
     header, then the claim, why it isn't a bug (the rule, the document's own text) and what the
     test showed. Label it `not a bug` and close it as *not planned*. A closed issue that cites
     a report takes it off the new-to-us list.
  6. **A duplicate of an issue of ours** (closed ones included) is `--record`ed against it.

  Say what was done with each report in the run notes, and follow
  [Writing to GitHub](#writing-to-github) throughout.

## Release ritual

Bump `version` and the `download` URL in `module.json` together; `build-release.ps1` refuses a
mismatch. Make one `release:` commit, tag `vX.Y.Z`, and push with tags. Then run
`gh release create vX.Y.Z --notes-file dist/RELEASE-NOTES.md dist/fvtt-mod-errata5e.zip module.json`.
The zip entries must use forward slashes; the script writes them that way and verifies it.
