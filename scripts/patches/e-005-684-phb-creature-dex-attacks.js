/**
 * E-005 · PHB CREATURES' DEXTERITY ATTACKS — six Appendix B creatures attack with Strength, hitting and
 * damaging 2 to 7 points under their stat blocks.
 *
 * THE PROBLEM (issue #684; measured 2026-10-01 on Foundry 14.368, dnd5e 6.0.5, PHB 2.2.0, and again
 * 2026-10-13 on Foundry 14.369, dnd5e 6.0.6, PHB 2.2.0): the Player's Handbook's creatures
 * (`dnd-players-handbook.actors`, their attack items `phbaoi…`) leave each attack activity's ability
 * blank. dnd5e then takes the default melee ability, Strength, for a natural attack. The book's stat
 * blocks attack with the better of Strength and Dexterity: the Cat, Crab, Imp, Lizard, Venomous Snake
 * and Weasel are Dexterity creatures, so the Imp's Sting rolls +0 for 1d6 - 2 where the book says +5
 * for 1d6 + 3. They are most of the familiar forms (Find Familiar, Pact of the Chain). Measured: of
 * the 47 PHB creature attacks with a blank ability and a stated bonus, the better of Strength and
 * Dexterity gives the book's bonus for all 47; Strength alone misses six.
 *
 * THE FIX: dnd5e fills an attack's ability set in BaseAttackActivityData#prepareFinalData, and its
 * `ability` takes the set's largest modifier. Wrapped at `init`: for an attack activity whose ability
 * is blank, on a PHB appendix creature's item (id `phbaoi…`, not a weapon item), Dexterity joins the
 * set before dnd5e fills it, so the attack uses the better of the two, as the book does. In memory
 * only: no item is written, the pack is never edited, and copies already on actors are corrected. An
 * attack whose ability the vendor sets is left alone, so an upstream fix makes this a no-op.
 */
import { TITLE } from "../core.js";

/** The id prefix the PHB gives its appendix creatures' attack items. */
export const PHB_CREATURE_ITEM = /^phbaoi/;

/**
 * Does this attack want the better of Strength and Dexterity? A PHB appendix creature's attack
 * with no ability set. Pure over the plain data, so a suite can test it without a world.
 * @param {{ attack?: { ability?: string } }} activity
 * @param {{ id?: string, type?: string }} item
 * @returns {boolean}
 */
export function wantsFinesse(activity, item) {
  if ( activity?.attack?.ability ) return false;
  if ( item?.type === "weapon" ) return false;
  return PHB_CREATURE_ITEM.test(String(item?.id ?? ""));
}

Hooks.once("init", () => {
  try {
    let proto = CONFIG.DND5E?.activityTypes?.attack?.documentClass?.prototype ?? null;
    while ( proto && !(Object.hasOwn(proto, "availableAbilities") && Object.hasOwn(proto, "prepareFinalData")) ) proto = Object.getPrototypeOf(proto);
    if ( !proto ) throw new Error("dnd5e's attack activity data (availableAbilities, prepareFinalData) not found");
    const original = proto.prepareFinalData;
    proto.prepareFinalData = function(...args) {
      try {
        if ( wantsFinesse(this, this.item) ) this.attack.abilities?.add?.("dex");
      } catch { /* the attack keeps the system's ability */ }
      return original.apply(this, args);
    };
  } catch(err) {
    console.error(`${TITLE} | The PHB creatures' Dexterity attacks could not be patched — they attack with Strength.`, err);
  }
});
