# Upstream watch

What the daily watch (`node tools/upstream-watch.mjs`) found at its last run, 2026-10-07. Versions are tracked in
[VERSIONS.md](../VERSIONS.md); every run adds a row to [LOG.md](LOG.md); a dated digest (`YYYY-MM-DD.md`) is written only on
a day with something to act on, and the verdicts on its pairs are the run notes under it.

| | |
| --- | --- |
| **Version reviews due** | dnd5e system 6.0.5 → **6.0.6** (first seen 2026-10-07) |
| **To judge** | 0 same-document pair(s), 0 possible |
| **Cited upstream reports now closed** | 45 |
| **New to us** | 0 open report(s), 0 first seen today |

## To judge

Each upstream report names a document one of our open issues is about. The same document is not necessarily the same bug:
record a pair that is with `node tools/upstream-watch.mjs --record <ours>=<upstream>`, dismiss one that isn't with `--different`.

None.

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
| `foundryvtt-premium-content#770` [Bug]: Aasimar healing hands feature is consuming activity uses instead of item uses | 2024-09-27 (completed) | #340 |
| `foundryvtt-premium-content#771` [Bug]: Divine Smite should have "Allow Critical" set | 2024-09-27 (completed) | #420, #387, #340, #145, #103 |
| `foundryvtt-premium-content#798` [Bug]: Some effects, like that of Mind Sliver, have incorrect duration for "before the end of your next turn" | 2025-02-27 (completed) | #62 |
| `foundryvtt/dnd5e#103` Add maximum and Dexterity modifier as a tracked data element for Equipment item types | 2019-11-07 (completed) | #104 |
| `foundryvtt/dnd5e#340` Discrepancy with Item.weaponType: template.json vs in-game use | 2020-02-20 (completed) | #342 |
| `foundryvtt/dnd5e#387` Fix syntax error with rolling an "other formula" | 2020-03-28 (completed) | #388 |
| `foundryvtt/dnd5e#556` Redesign the NPC sheet to keep primary combat attributes visible at all times in the header instead of below the fold of the Attributes tab. | 2020-06-14 (completed) | #558 |
| `foundryvtt/dnd5e#569` Bug: Action resource consumption with negative material quantity is inconsistently cleared | 2020-07-21 (completed) | #571, #112 |
| `foundryvtt/dnd5e#574` Unarmored Defense (monk) - SRD compendium incorrect | 2020-07-21 (completed) | #572 |
| `foundryvtt/dnd5e#5772` D&D 5.04 Hex and Hunters Mark Damage Activities don't allow critical damage | 2025-06-20 (completed) | #766, #432, #430, #427, #425 |
| `foundryvtt/dnd5e#585` Add support for Vehicle as a primary Actor type with sheet support for basic vehicle mechanics. | 2020-07-21 (completed) | #587 |
| `foundryvtt/dnd5e#6132` 2024 Alchemist's Fire has "Half Damage" on save. Should be "No Damage" | 2025-09-09 (completed) | #3 |
| `foundryvtt/dnd5e#6857` Bestow Curse (2024)'s "Curse Ability" activity does not include the potential effects | 2026-03-31 (completed) | #610 |
| `foundryvtt/dnd5e#712` CSS changes to the inventory list caused dropdown item details to be too light a font color. | 2020-10-09 (completed) | #713 |
| `foundryvtt/dnd5e#716` Broken PH-B link in Druid class | 2020-10-28 (completed) | #717 |
| `foundryvtt/dnd5e#762` Set Minimum Core Version to 0.7.6 | 2020-11-07 (completed) | #763 |
| `foundryvtt/dnd5e#770` Exclude flags and bonuses added by Active Effects from the configuration of the "Special Traits" app on the actor sheet. Diff changes to the special traits app against the underlying base data for the Actor rather than the derived data. | 2020-11-09 (completed) | #368, #355, #352, #348, #345, #342 |
| `foundryvtt/dnd5e#771` movement.walk should pull from speed.value when an actor is imported from a compendium | 2020-11-08 (completed) | #506, #479, #477, #475, #473, #471, #469, #466, #436, #433, #429, #423, #418, #415, #412, #405, #392, #388, #386, #382, #378, #374, #368, #355, #352, #345, #342, #327, #324, #321, #315, #312, #308, #306, #296, #290, #285, #280, #275, #270, #265, #246, #222, #217, #212, #207, #201, #196, #191, #186, #176, #171, #166, #160, #155, #152, #146, #144, #142, #140, #138, #136, #134, #132, #130, #127, #125, #123, #120, #118, #116, #114, #112, #110, #108, #106, #104 |

## New to us

Open upstream bug reports on our packages' data that match none of our issues, newest first. Each is validated and
tested on the sandbox, and filed as an issue of ours if it reproduces; the watch itself files none.

| First seen | Report | Package |
| --- | --- | --- |
| none | | |

## Sources

| Upstream repo | Open bug reports on our packages | Cited by our issues | Pairs to judge | Judged different | New to us |
| --- | --- | --- | --- | --- | --- |
| foundryvtt/dnd5e | 22 | 27 | 0 | 8 | 0 |
| foundryvtt/foundryvtt-premium-content | 83 | 80 | 0 | 21 | 0 |
