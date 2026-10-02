// Errata 5e — E-004 (issue #754), Sword of Sharpness's crit, measured live on the LOCAL sandbox (never prod).
//
//   node tools/suites/e-004-754-sword-of-sharpness-crit.mjs
//
// Nothing is written: the weapon here is built IN MEMORY (`new Item.implementation(data)`), prepared,
// read and dropped. The DMG's own Sword of Sharpness enchantment is put on the PHB's Longsword, as the
// enchant activity would; the patch must make its 14 extra crit damage Slashing. A hand-made
// enchantment of another name, and the right value, must come through untouched.
import { connectFoundry } from 'fvtt-mcp-dnd5e/client';

console.log('[sharpness-crit] connecting to the local sandbox…');
const { f, dispose } = await connectFoundry({ host: 'local', identity: 'suite', tag: 'sharpness-crit', watchdogMs: 300_000 });

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-errata5e';
  const results = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  if (!game.modules.get(MOD)?.active) return { fatal: `${MOD} is not active` };
  const KEY = 'activities[attack].damage.critical.bonus';
  const template = await fromUuid('Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgSwordOfSharpn').catch(() => null);
  const base = await fromUuid('Compendium.dnd-players-handbook.equipment.Item.phbwepLongsword0').catch(() => null);
  if (!template || !base) return { fatal: `pack documents missing (DMG ${!!template}, PHB ${!!base})` };
  const enchantment = template.effects.find(e => e.type === 'enchantment');

  // An in-memory longsword carrying an enchantment, applied as the enchant activity applies it.
  const enchanted = effData => {
    const data = base.toObject();
    data.name = 'Errata Live Longsword';
    data.effects = [{ ...effData, disabled: false, transfer: true,
      system: { ...effData.system, origin: { ...(effData.system?.origin ?? {}), item: template.uuid } } }];
    const item = new Item.implementation(data);
    return { item, bonus: [...item.system.activities].filter(a => a.type === 'attack').map(a => a.damage?.critical?.bonus ?? null) };
  };
  const flavors = formula => new CONFIG.Dice.DamageRoll(formula).terms.map(t => t.flavor).filter(Boolean);

  // 1. the pack's own enchantment: still wrong in the data, Slashing once applied
  const packValue = enchantment?._source.system.changes.find(c => c.key === KEY)?.value;
  ok('1. the pack still ships the Necrotic value (else the fix is upstream-fixed)', packValue === '14d1[necrotic]', `value=${packValue}`);
  const pack = enchanted(enchantment.toObject());
  ok('1b. the enchanted weapon is a "Longsword of Sharpness"', pack.item.name === 'Errata Live Longsword of Sharpness', pack.item.name);
  ok('1c. its crit bonus applies as 14d1[slashing]', (pack.bonus.length > 0) && pack.bonus.every(b => b === '14d1[slashing]'), JSON.stringify(pack.bonus));
  ok("1d. and dnd5e's DamageRoll reads it as slashing", pack.bonus.every(b => flavors(b).join() === 'slashing'), JSON.stringify(pack.bonus.map(flavors)));
  ok("1e. the effect's own data is untouched", pack.item.effects.contents[0]._source.system.changes.find(c => c.key === KEY)?.value === '14d1[necrotic]');

  // 2. a no-op elsewhere: the corrected value, and an enchantment of another name
  const corrected = enchantment.toObject();
  corrected.system.changes = corrected.system.changes.map(c => (c.key === KEY) ? { ...c, value: '14[slashing]' } : c);
  const fixed = enchanted(corrected);
  ok('2. an upstream-fixed value (14[slashing]) is left alone', fixed.bonus.every(b => b === '14[slashing]'), JSON.stringify(fixed.bonus));
  const other = enchantment.toObject();
  other.name = 'Errata Live Blade of Night';
  other.system.changes = other.system.changes.filter(c => c.key === KEY);
  const night = enchanted(other);
  ok('2b. another enchantment adding 14d1[necrotic] keeps it', night.bonus.every(b => b === '14d1[necrotic]'), JSON.stringify(night.bonus));
  return { results };
}, null);

await dispose();
if (out.fatal) { console.error(`[sharpness-crit] FATAL: ${out.fatal}`); process.exit(2); }
let failed = 0;
for (const r of out.results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`[sharpness-crit] ${out.results.length - failed}/${out.results.length} passed`);
process.exit(failed ? 1 : 0);
