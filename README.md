# Errata 5e

[![check](https://github.com/Txpple/fvtt-mod-errata5e/actions/workflows/check.yml/badge.svg)](https://github.com/Txpple/fvtt-mod-errata5e/actions/workflows/check.yml)
[![upstream watch](https://github.com/Txpple/fvtt-mod-errata5e/actions/workflows/upstream-watch.yml/badge.svg)](https://github.com/Txpple/fvtt-mod-errata5e/actions/workflows/upstream-watch.yml)

A Foundry VTT module that corrects, in memory, bugs in the content and packages our private
Foundry VTT gaming tables depend on: the premium D&D 2024 books (Player's Handbook, Dungeon
Master's Guide, Monster Manual, Heroes of Faerûn, Arcana Unleashed and Ravenloft: The Horrors Within;
the list is [VERSIONS.md](VERSIONS.md)), the dnd5e system and Foundry itself. Each fix
is a stopgap, held only until the vendor ships its own, and this repo is also where we track every
vendor bug we know of and watch the vendors for new versions and new reports.

## How it works

- **A fix corrects data as it loads or prepares.** Nothing in a compendium is edited and nothing is
  saved to a sheet, so every copy of a document is fixed at once, including items already on actors,
  and nothing is left behind when the fix is retired.
- **A fix is a no-op on correct data.** Once the vendor fixes the bug, the fix finds nothing to do;
  it is then marked upstream-fixed and retired.
- **The module is one switch.** Enable it and every fix is on; disable it and nothing is touched.
  No fix has a setting of its own.
- **Only game-breaking bugs get a fix.** The books carry hundreds of known bugs; the rest stay open
  as issues until the vendor fixes them or they start to matter at our tables.

## Installation

Paste the manifest URL into Foundry's *Install Module* dialog:

```
https://github.com/Txpple/fvtt-mod-errata5e/releases/latest/download/module.json
```

Requires Foundry VTT v13 or v14 and the dnd5e system 5.x or 6.x. The module has no other
dependencies and adds nothing to the canvas or the sheets.

## The fixes

The [register](REGISTER.md) is the complete list: one row per fix with its status, the issue it
works around, the vendor, package and documents, what is wrong, what the fix does, the versions it
was measured on, the modules that rely on it and how to tell when the vendor has fixed it. Rows are
never deleted; a retired fix keeps its row.

Each fix is one file under `scripts/patches/`, named `e-NNN-<issue>-<name>.js` after its register
row and its issue, and opens with the full write-up of the problem and the fix.

## Vendor bugs

Every vendor bug we find is an [issue](https://github.com/Txpple/fvtt-mod-errata5e/issues),
one per bug per package, labelled by book (`book: PHB 2024`, `book: SRD 2024`, …) and severity.
An issue states the bug, the documents, what was tested on the sandbox and the numbers seen, and
whether the vendor has a report of it. An issue with a fix carries `worked-around` and stays open
until the vendor's data is right. [VERSIONS.md](VERSIONS.md) shows which version of each package
the open issues were last checked against.

## Upstream watch

`tools/upstream-watch.mjs` reads the vendors' published versions and their public bug trackers
(the premium-content repo for the books, the dnd5e repo for the system's SRD packs), matches new
reports to our issues by document, and writes:

- [watch/STATUS.md](watch/STATUS.md), the watch at a glance: version reviews due, pairs to judge,
  cited reports the vendor has closed, and reports new to us;
- [watch/LOG.md](watch/LOG.md), one row per run, and a dated digest on a day with something to act on;
- the **Latest published** column of VERSIONS.md, and one tracking issue per version review due,
  labelled `version review`, closed again once the review is done.

A match is the same document, not necessarily the same bug, so the pairs it lists are judged by
hand: `--record <ours>=<upstream>` cites the same bug in our issue, `--different` dismisses the
pair, and neither is shown again. Each report new to us is checked against the rule and tested on
the sandbox, then gets an issue of ours either way: a validated bug stays open, and a report that
isn't a bug is closed with the label `not a bug` and the reason.

When a package's latest version is newer than the one reviewed, the package gets a version review:
the installed version is snapshotted, the new one diffed against it, every fix and every open issue
on the package re-checked, and VERSIONS.md updated.

## Automation

Two GitHub Actions workflows, in `.github/workflows/`:

- **check** runs `tools/check-register.mjs` on every push and pull request.
- **upstream watch** runs the watch daily at 06:00 UTC, with the workflow's own token, and commits
  `watch/` and VERSIONS.md when they change. It can also be started by hand from the repo's
  Actions tab. It needs no machine of ours and no secret of ours. It never writes to a vendor's
  repo, and the only issue it files is the version-review tracker.

## Repository layout

```
module.json            the Foundry manifest
scripts/
  errata5e.js       the module's one entry point: imports core.js and every fix
  core.js              the module id and title
  patches/             one file per fix: e-NNN-<issue>-<name>.js
tools/
  check-register.mjs   the offline check run before every commit and by CI
  upstream-watch.mjs   the daily watch
  vendor-review.mjs    snapshot and diff a vendor package's packs for a version review
  recheck.mjs          sort a package's open issues by whether their documents changed
  record-live-check.mjs record a sandbox test on an issue
  sandbox-probe.mjs    run a sandbox test with the house rules built in
  build-release.ps1    build the release zip
  lib/                 shared helpers: paths, the package list and matching, snapshots
  suites/              one live suite per fix that has one: e-NNN-<issue>-<name>.mjs
watch/                 the upstream watch's status page, log, state and digests
REGISTER.md            the register of fixes
VERSIONS.md            the tracked packages: version reviewed, latest published
```

## Development

There is no build step: the module is plain ES modules loaded straight from `scripts/`.

- `node tools/check-register.mjs` (or `npm run check`) checks the register against the code,
  the manifest, the suites and VERSIONS.md. Run it before every commit; CI runs it on every push.
- `node tools/suites/<suite>.mjs` runs one fix's live suite against the local sandbox, a headless
  copy of the production world. The suites and the sandbox tools use the house MCP repo
  (`fvtt-mcp-dnd5e`, a `file:` dev dependency beside this one); run `npm install` once.
- Releases: bump `version` and the `download` URL in `module.json` together, build the zip with
  `tools/build-release.ps1`, tag `vX.Y.Z`, and publish the zip and manifest as a GitHub release.

## License

MIT. See [LICENSE](LICENSE).
