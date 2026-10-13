/**
 * E-006 · CELESTIAL VESTIGE COMPANION — Medium, typeless, no Radiant resistance, and a Pact Bond
 * that does nothing.
 *
 * THE PROBLEM (issue #169; measured 2026-10-01 on Foundry 14.368, dnd5e 6.0.5, Arcana Unleashed 1.0.2,
 * and again 2026-10-13 on Foundry 14.369, dnd5e 6.0.6, Arcana Unleashed 1.0.2): the Vestige Patron's
 * Vestige Companion summons one of three actors. The Fiendish and Undead vestiges are Small, typed,
 * Neutral, resist their own damage type (Fire, Necrotic), and their Pact Bond carries an effect that
 * gives their checks and saves the warlock's proficiency. The Celestial one
 * (`Compendium.dnd-arcana-unleashed.actors.Actor.aunCelestialVest`) is Medium (so its Hit Dice are d8s,
 * not d6s), has no creature type (the summon sets none, so it arrives typeless), no alignment, no
 * Radiant resistance, and its Pact Bond (`aunPactBond00000`) has no effect.
 *
 * THE FIX: the NPC data model's prepareBaseData, wrapped at `init`. For the Celestial vestige (the pack
 * actor, or a copy whose compendium source is it), each missing piece is supplied in memory: Small for
 * Medium, the celestial type, Neutral, Radiant resistance, and, while its Pact Bond carries no effect,
 * the proficiency on checks and saves its siblings' Pact Bond effect gives
 * (`rolls.ability.check.proficiency` and `rolls.ability.save.proficiency`, 1). Nothing is written and
 * the pack is never edited; a value the vendor ships is left as it is, so an upstream fix makes each
 * part a no-op.
 */
import { TITLE } from "../core.js";

/** The pack's Celestial vestige. */
export const CELESTIAL_VESTIGE = "Compendium.dnd-arcana-unleashed.actors.Actor.aunCelestialVest";

/**
 * Is this actor the Celestial vestige (the pack's, or a copy made from it)?
 * @param {{ uuid?: string, _stats?: { compendiumSource?: string|null }, flags?: object }} actor
 * @returns {boolean}
 */
export function isCelestialVestige(actor) {
  if ( actor?.uuid === CELESTIAL_VESTIGE ) return true;
  const source = actor?._stats?.compendiumSource ?? actor?.flags?.core?.sourceId ?? null;
  return source === CELESTIAL_VESTIGE;
}

/**
 * Supply what the Celestial vestige's data lacks, in place, leaving whatever it already has. Pure over
 * the plain data, so a suite can test it without a world. Returns the parts it supplied.
 * @param {object} system          the actor's system data, being prepared
 * @param {{ pactBondBare: boolean }} facts   its Pact Bond carries no effect
 * @returns {string[]}
 */
export function supplyCelestialVestige(system, { pactBondBare }) {
  const done = [];
  if ( !system?.details || !system?.traits ) return done;
  if ( system.traits.size === "med" ) { system.traits.size = "sm"; done.push("size"); }
  if ( system.details.type && !system.details.type.value ) { system.details.type.value = "celestial"; done.push("type"); }
  if ( !system.details.alignment ) { system.details.alignment = "Neutral"; done.push("alignment"); }
  const dr = system.traits.dr?.value;
  if ( (dr instanceof Set) && !dr.size ) { dr.add("radiant"); done.push("resistance"); }
  if ( pactBondBare ) {
    for ( const kind of ["check", "save"] ) {
      const path = `rolls.ability.${kind}.proficiency`;
      if ( !(Number(foundry.utils.getProperty(system, path)) >= 1) ) foundry.utils.setProperty(system, path, 1);
    }
    done.push("pact bond");
  }
  return done;
}

Hooks.once("init", () => {
  try {
    const NPCData = CONFIG.Actor.dataModels?.npc;
    if ( !NPCData?.prototype?.prepareBaseData ) throw new Error("dnd5e's NPC data model not found");
    const original = NPCData.prototype.prepareBaseData;
    NPCData.prototype.prepareBaseData = function(...args) {
      const result = original.apply(this, args);
      try {
        const actor = this.parent;
        if ( isCelestialVestige(actor) ) {
          const bond = actor.items?.find?.(i => i.name === "Pact Bond") ?? null;
          supplyCelestialVestige(this, { pactBondBare: !!bond && !bond.effects?.size });
        }
      } catch(err) { console.warn(`${TITLE} | The Celestial vestige could not be corrected.`, err); }
      return result;
    };
  } catch(err) {
    console.error(`${TITLE} | The Celestial vestige could not be patched — it stays Medium, typeless, unresistant and without Pact Bond.`, err);
  }
});
