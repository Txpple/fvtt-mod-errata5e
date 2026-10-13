// Errata 5e — E-006 (issue #169), the Celestial Vestige Companion, measured live on the LOCAL sandbox (never prod).
//
//   node tools/suites/e-006-169-celestial-vestige.mjs
//
// Nothing is written: the vestiges are built IN MEMORY from Arcana Unleashed's actors pack, prepared, read and dropped.
// The Celestial one must come out Small, celestial, Neutral, resisting Radiant, its saves proficient while its Pact
// Bond carries no effect; its Fiendish sibling must be untouched; values the vendor sets must be left alone.
import { connectFoundry } from 'fvtt-mcp-dnd5e/client';

console.log('[celestial-vestige] connecting to the local sandbox…');
const { f, dispose } = await connectFoundry({ host: 'local', identity: 'suite', tag: 'celestial-vestige', watchdogMs: 300_000 });

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-errata5e';
  const results = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  if (!game.modules.get(MOD)?.active) return { fatal: `${MOD} is not active` };
  const cel = await fromUuid('Compendium.dnd-arcana-unleashed.actors.Actor.aunCelestialVest').catch(() => null);
  const fie = await fromUuid('Compendium.dnd-arcana-unleashed.actors.Actor.aunFiendishVesti').catch(() => null);
  if (!cel || !fie) return { fatal: 'the Arcana Unleashed vestiges are not on this box' };
  // a copy as a summon makes one: its compendium source is the pack actor
  const copy = (src, mutate) => {
    const d = src.toObject();
    d._stats = { ...(d._stats ?? {}), compendiumSource: src.uuid };
    mutate?.(d);
    return new Actor.implementation(d);
  };

  // 1. the pack still ships the defects (else the fix is upstream-fixed)
  const raw = cel._source.system;
  ok('1. the pack Celestial is still Medium, typeless, unresistant, its Pact Bond bare',
    (raw.traits.size === 'med') && !raw.details.type?.value && !(raw.traits.dr?.value ?? []).length && (cel.items.getName('Pact Bond')?.effects.size === 0),
    `size=${raw.traits.size} type=${raw.details.type?.value} dr=${JSON.stringify(raw.traits.dr?.value)}`);

  // 2. a copy, prepared with the fix
  const s = copy(cel).system;
  ok('2. Small', s.traits.size === 'sm', s.traits.size);
  ok('2b. celestial', s.details.type.value === 'celestial', s.details.type.value);
  ok('2c. Neutral', s.details.alignment === 'Neutral', s.details.alignment);
  ok('2d. resists Radiant', s.traits.dr.value.has('radiant'), JSON.stringify([...s.traits.dr.value]));
  ok("2e. its saves add proficiency, as its siblings' do", (s.abilities.wis.proficient >= 1) && (s.abilities.wis.save.value > s.abilities.wis.mod),
    `wis proficient=${s.abilities.wis.proficient} save=${s.abilities.wis.save.value} mod=${s.abilities.wis.mod}`);
  ok('2f. the pack actor itself reads the same', (cel.system.traits.size === 'sm') && (cel.system.details.type.value === 'celestial'));

  // 3. no-ops: the sibling, and values the vendor sets
  const f2 = copy(fie).system;
  ok('3. the Fiendish vestige keeps its type and its fire resistance alone', (f2.details.type.value === 'fiend') && ([...f2.traits.dr.value].join() === 'fire'),
    `${f2.details.type.value} ${[...f2.traits.dr.value]}`);
  const set = copy(cel, d => { d.system.traits.size = 'tiny'; d.system.details.type = { value: 'fey' }; d.system.traits.dr = { value: ['psychic'] }; }).system;
  ok('3b. a vendor-set size, type and resistance are left alone', (set.traits.size === 'tiny') && (set.details.type.value === 'fey') && ([...set.traits.dr.value].join() === 'psychic'),
    `${set.traits.size} ${set.details.type.value} ${[...set.traits.dr.value]}`);
  return { results };
}, null);

await dispose();
if (out.fatal) { console.error(`[celestial-vestige] FATAL: ${out.fatal}`); process.exit(2); }
let failed = 0;
for (const r of out.results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`[celestial-vestige] ${out.results.length - failed}/${out.results.length} passed`);
process.exit(failed ? 1 : 0);
