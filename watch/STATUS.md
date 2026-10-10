# Upstream watch

What the daily watch (`node tools/upstream-watch.mjs`) found at its last run, 2026-10-10. Versions are tracked in
[VERSIONS.md](../VERSIONS.md); every run adds a row to [LOG.md](LOG.md); a dated digest (`YYYY-MM-DD.md`) is written only on
a day with something to act on, and the verdicts on its pairs are the run notes under it.

| | |
| --- | --- |
| **Version reviews due** | none |
| **To judge** | 2 same-document pair(s), 0 possible |
| **Cited upstream reports now closed** | 31 |
| **New to us** | 3 open report(s), 3 first seen today |

## To judge

Each upstream report names a document one of our open issues is about. The same document is not necessarily the same bug:
record a pair that is with `node tools/upstream-watch.mjs --record <ours>=<upstream>`, dismiss one that isn't with `--different`.

- `foundryvtt-premium-content#1816` [open] [Bug]: Barbarian's Brutal Strike should not target self (dnd-players-handbook) https://github.com/foundryvtt/foundryvtt-premium-content/issues/1816
  → our #435 Player's Handbook (2024) — Brutal Strike (phbbrbBrutalStri): Hamstring Blow's 15-foot Speed reduction hits walking speed only
  (matched on "Brutal Strike" in the title)
- `foundryvtt-premium-content#1817` [open] [Bug]: Ancient Green Dragon's breath should recharge on 5-6 (dnd-monster-manual) https://github.com/foundryvtt/foundryvtt-premium-content/issues/1817
  → our #119 Monster Manual (2024) — Ancient Green Dragon (mmAncientGreenDr): Poison Breath is a 15-ft Cone (rule: 90 ft) on Recharge 6 (rule: 5–6); Rend has 5-ft reach (rule: 15 ft)
  (matched on "Ancient Green Dragon" in the title)

### Possible (a name in the body only)

None.

## Cited upstream reports now closed

Our open issues cite these, and the vendor has closed them: re-check each at the next version review of its package.

| Report | Closed | Our issue |
| --- | --- | --- |
| `foundryvtt-premium-content#1049` [Bug]: Ancient Gold Dragon incorrectly configured. | 2025-09-15 (completed) | #569 |
| `foundryvtt-premium-content#1093` [Bug]: Priest and Priest Acolyte wrong spells | 2025-10-13 (completed) | #583 |
| `foundryvtt-premium-content#1101` [Bug]: Troll has incorrect regeneration text | 2025-09-15 (completed) | #585 |
| `foundryvtt-premium-content#1109` [Bug]: Pact of the chain set up to consume a spell slot | 2025-08-21 (completed) | #673 |
| `foundryvtt-premium-content#1113` [Bug]: Phantasmal Killer does not have its Challenge Ability set | 2025-08-21 (completed) | #527 |
| `foundryvtt-premium-content#1116` [Bug]: Update Champion's Survivor passive to make use of Advantage to death saving throws via an active effect | 2025-08-21 (completed) | #446 |
| `foundryvtt-premium-content#1140` [Bug]: Several potions labeled as costing an Action | 2025-09-15 (completed) | #592 |
| `foundryvtt-premium-content#1161` [Bug]: Vicious Weapon enchantement not adding additional dice | 2025-09-15 (completed) | #555 |
| `foundryvtt-premium-content#1236` [Bug]: Giant Venomous Snake's attack should have 10 ft. reach | 2025-09-15 (completed) | #580 |
| `foundryvtt-premium-content#1243` [Bug]: Boots of Speed is an Action instead of Bonus Action | 2025-09-15 (completed) | #510 |
| `foundryvtt-premium-content#1247` [Bug]: Some spells have incorrect durations | 2025-08-20 (completed) | #524 |
| `foundryvtt-premium-content#1269` [Bug]: Chuul's Paralyzing Tentacles has area of effect but shouldn't | 2025-09-15 (completed) | #588 |
| `foundryvtt-premium-content#1300` [Bug]: Gnoll warrior is missing rampage ability | 2025-10-13 (completed) | #581 |
| `foundryvtt-premium-content#1344` [Bug]: Items incorrectly set for apply half damage on a save when it should be no damage | 2025-10-13 (completed) | #40 |
| `foundryvtt-premium-content#1352` [Bug]: Two ErrataV1 are missing from the MM | 2025-10-13 (completed) | #486 |
| `foundryvtt-premium-content#1373` [Bug]: Badger and Giant Badger are missing poison resistance. | 2025-10-13 (completed) | #574 |
| `foundryvtt-premium-content#1379` [Bug]: Octopus should not have Escape Check in Tentacles feature | 2025-10-13 (completed) | #590 |
| `foundryvtt-premium-content#1383` [Bug]: Several origin background features refer to items from SRD instead of PHB | 2025-10-13 (completed) | #339 |
| `foundryvtt-premium-content#1407` [Bug]: Investment of the Chain Master's summon activities don't include additional familiar options | 2026-07-01 (completed) | #658 |
| `foundryvtt-premium-content#1420` [Bug]: Multiple effects use incorrect durations | 2026-07-02 (completed) | #764, #61, #60, #59 |
| `foundryvtt-premium-content#1429` [Bug]: Monk's Stunning Strike effects have wrong duration | 2026-07-01 (completed) | #85 |
| `foundryvtt-premium-content#1497` [Bug]: Damage activities don't allow for critical rolls. (Attack damage riders) | 2026-06-29 (completed) | #769, #671, #649, #648, #633, #632, #432, #430, #427, #425, #422, #419, #417 |
| `foundryvtt-premium-content#1505` [Bug]: Darkvison spell effect gives wrong darkvision range | 2026-06-26 (completed) | #631 |
| `foundryvtt-premium-content#1535` [Bug]: Sorcerer's Font of Magic's activity `Regain Sorcery Points` is misconfigured | 2026-06-26 (completed) | #670 |
| `foundryvtt-premium-content#1574` [Bug]: Starting equipment of Backgrounds and Classes does not include gold for option A | 2026-06-25 (completed) | #344 |
| `foundryvtt-premium-content#1596` [Bug]: Boon of Fate & Boon of Irresistible Offense don't have level prerequisite set | 2026-06-24 (completed) | #323 |
| `foundryvtt-premium-content#1675` [Bug]: Contagion spell has half damage on save configured, should be "no damage" | 2026-06-30 (completed) | #541 |
| `foundryvtt-premium-content#798` [Bug]: Some effects, like that of Mind Sliver, have incorrect duration for "before the end of your next turn" | 2025-02-27 (completed) | #62 |
| `foundryvtt/dnd5e#5772` D&D 5.04 Hex and Hunters Mark Damage Activities don't allow critical damage | 2025-06-20 (completed) | #766, #432, #430, #427, #425 |
| `foundryvtt/dnd5e#6132` 2024 Alchemist's Fire has "Half Damage" on save. Should be "No Damage" | 2025-09-09 (completed) | #3 |
| `foundryvtt/dnd5e#6857` Bestow Curse (2024)'s "Curse Ability" activity does not include the potential effects | 2026-03-31 (completed) | #610 |

## New to us

Open upstream bug reports on our packages' data that match none of our issues, newest first. Each is validated and
tested on the sandbox, and filed as an issue of ours if it reproduces; the watch itself files none.

| First seen | Report | Package |
| --- | --- | --- |
| 2026-10-10 | `foundryvtt-premium-content#1818` [[Bug]:  Council of Zulkirs token issues](https://github.com/foundryvtt/foundryvtt-premium-content/issues/1818) | dnd-arcana-unleashed |
| 2026-10-10 | `foundryvtt/dnd5e#7597` [D&D Modern Content Polymorph Spell No Transform Activity](https://github.com/foundryvtt/dnd5e/issues/7597) | dnd5e |
| 2026-10-10 | `foundryvtt/dnd5e#7601` [SRD 5.1: Typo on Pass without Trace effect.](https://github.com/foundryvtt/dnd5e/issues/7601) | dnd5e |

## Sources

| Upstream repo | Open bug reports on our packages | Cited by our issues | Pairs to judge | Judged different | New to us |
| --- | --- | --- | --- | --- | --- |
| foundryvtt/dnd5e | 26 | 17 | 0 | 8 | 2 |
| foundryvtt/foundryvtt-premium-content | 88 | 78 | 2 | 21 | 1 |
