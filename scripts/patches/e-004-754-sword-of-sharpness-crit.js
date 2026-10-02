/**
 * E-004 · SWORD OF SHARPNESS'S CRIT — a 20 deals an extra 14 Slashing damage, and the book's
 * enchantment adds it as Necrotic.
 *
 * THE PROBLEM (the Battle Flow DMG build, 2026-10-01 — measured on the sandbox with Battle Flow's
 * tools/probe-dmg-weapons.mjs, dnd5e 6.0.5, Foundry 14.368, DMG 2.0.0's
 * `dnd-dungeon-masters-guide.equipment` Sword of Sharpness, dmgSwordOfSharpn): the rule says
 * "roll a 20 on the d20 for the attack roll, that target takes an extra 14 Slashing damage". The
 * template item's enchantment effect (nxid1s2CZrB06HH8, "Sword of Sharpness") carries the change
 * `activities[attack].damage.critical.bonus` add `14d1[necrotic]`, so every weapon it enchants (a
 * "Longsword of Sharpness") adds its crit bonus as Necrotic: a creature resistant or immune to
 * Necrotic shrugs it off, and one resistant to Slashing takes it all.
 *
 * THE FIX: dnd5e routes every `activities[...]` change of an effect through
 * ActiveEffect5e#applyActivity, wrapped at `init`. When the change is that crit bonus, its value
 * is exactly the pack's `14d1[necrotic]`, and the effect is the Sword of Sharpness enchantment,
 * the value applied is `14d1[slashing]` instead. Only the applied change is rewritten, in memory:
 * the effect's own data, the pack and every sheet stay as they are, so weapons enchanted before
 * the fix are corrected too. Any other value (the vendor's fix) is left alone, so an upstream fix
 * makes this a no-op.
 */
import { TITLE } from "../core.js";

/** The change the pack ships wrong, and the value the rule gives it. */
export const SHARPNESS_KEY = "activities[attack].damage.critical.bonus";
export const SHARPNESS_WRONG = "14d1[necrotic]";
export const SHARPNESS_RIGHT = "14d1[slashing]";

/**
 * The value this change should apply: the rule's when it is the pack's wrong Sword of Sharpness
 * crit, otherwise its own. Pure over the plain data, so a suite can test it without a world.
 * @param {{key?: string, value?: unknown}} change
 * @param {{name?: string, type?: string}} effect
 * @returns {unknown}
 */
export function sharpnessCritValue(change, effect) {
  if ( change?.key !== SHARPNESS_KEY ) return change?.value;
  if ( String(change?.value ?? "").replace(/\s+/g, "").toLowerCase() !== SHARPNESS_WRONG ) return change?.value;
  if ( effect?.type !== "enchantment" ) return change?.value;
  if ( String(effect?.name ?? "").trim().toLowerCase() !== "sword of sharpness" ) return change?.value;
  return SHARPNESS_RIGHT;
}

Hooks.once("init", () => {
  try {
    const AE = CONFIG.ActiveEffect.documentClass;
    if ( !AE?.prototype?.applyActivity ) throw new Error("dnd5e's ActiveEffect5e#applyActivity not found");
    const original = AE.prototype.applyActivity;
    AE.prototype.applyActivity = function(item, change, options) {
      const value = sharpnessCritValue(change, this);
      if ( value !== change?.value ) change = { ...change, value };
      return original.call(this, item, change, options);
    };
  } catch(err) {
    console.error(`${TITLE} | Sword of Sharpness's crit could not be patched — its 14 extra damage stays Necrotic.`, err);
  }
});
