/**
 * Errata 5e — stopgap fixes for bugs in upstream packages we depend on (the premium dnd5e
 * books first, and the system and platform under them) until the vendor fixes them, if ever.
 * One file per fix under scripts/patches/, named e-NNN-<issue>-<name>.js after its register
 * row and the issue it works around, each registering its own hooks. The module is one switch:
 * enabled, every fix is on; disabled, nothing is touched. This is the only esmodules entry; the
 * names the fixes share are in core.js.
 */
import "./core.js";
import "./patches/e-002-710-necrotic-shroud-clock.js";
import "./patches/e-003-711-pass-without-trace-area.js";
import "./patches/e-004-754-sword-of-sharpness-crit.js";
