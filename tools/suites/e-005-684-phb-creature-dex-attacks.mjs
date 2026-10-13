// Errata 5e — E-005 (issue #684), the PHB creatures' Dexterity attacks, measured live on the LOCAL sandbox (never prod).
//
//   node tools/suites/e-005-684-phb-creature-dex-attacks.mjs
//
// Nothing is written: each creature is built IN MEMORY from the PHB's actors pack (`new Actor.implementation(data)`),
// prepared, read and dropped. Every PHB creature attack whose activity leaves the ability blank and whose text states a
// bonus must roll the book's bonus; the six Dexterity creatures must use Dexterity; an attack whose ability the data
// sets must be left alone.
import { connectFoundry } from 'fvtt-mcp-dnd5e/client';

console.log('[phb-dex-attacks] connecting to the local sandbox…');
const { f, dispose } = await connectFoundry({ host: 'local', identity: 'suite', tag: 'phb-dex-attacks', watchdogMs: 300_000 });

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-errata5e';
  const results = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  if (!game.modules.get(MOD)?.active) return { fatal: `${MOD} is not active` };
  const pack = game.packs.get('dnd-players-handbook.actors');
  if (!pack) return { fatal: 'the PHB actors pack is not on this box' };
  const strip = h => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const bookBonus = item => Number(strip(item?.system.description?.value).match(/Attack Roll:\s*([+-]\d+)/)?.[1]);
  const toHit = at => Number(String(at?.labels?.toHit ?? '').replace(/\s/g, ''));
  const built = async name => {
    const entry = (await pack.getIndex()).find(e => e.name === name);
    return entry ? new Actor.implementation((await pack.getDocument(entry._id)).toObject()) : null;
  };
  const attackOf = (actor, item) => [...(actor?.items.getName(item)?.system.activities ?? [])].find(a => a.type === 'attack') ?? null;

  // 1. the pack still ships the blank ability (else the fix is upstream-fixed), and the Imp rolls the book
  const imp = await built('Imp');
  const sting = attackOf(imp, 'Sting');
  ok("1. the pack still leaves the Imp's Sting ability blank", (sting?._source.attack?.ability ?? '') === '', `ability="${sting?._source.attack?.ability}"`);
  ok('1b. the Sting rolls with Dexterity: +5, 1d6 + 3 (the book)',
    (sting?.ability === 'dex') && (toHit(sting) === 5) && (sting?.labels?.damage?.[0]?.formula === '1d6 + 3'),
    `${sting?.ability} ${sting?.labels?.toHit} ${sting?.labels?.damage?.map(d => d.formula)}`);

  // 2. the rest of the six named in the issue
  const six = { Cat: 'Scratch', Crab: 'Claw', Lizard: 'Bite', 'Venomous Snake': 'Bite', Weasel: 'Bite' };
  for (const [name, item] of Object.entries(six)) {
    const a = await built(name);
    const at = attackOf(a, item);
    const book = bookBonus(a?.items.getName(item));
    ok(`2. ${name}'s ${item} rolls the book's ${book}`, toHit(at) === book, `${at?.ability} ${at?.labels?.toHit}`);
  }

  // 3. every blank-ability PHB creature attack with a stated bonus; and an attack whose ability the data sets keeps it
  let fine = 0; const off = []; let kept = 0; const changed = [];
  for (const doc of await pack.getDocuments()) {
    const a = new Actor.implementation(doc.toObject());
    for (const i of a.items) for (const at of i.system.activities ?? []) {
      if (at.type !== 'attack') continue;
      const src = at._source.attack?.ability ?? '';
      if (src && (src in CONFIG.DND5E.abilities)) { if (at.ability === src) kept++; else changed.push(`${a.name}/${i.name}`); continue; }
      if (src) continue;
      const book = bookBonus(i);
      if (!Number.isFinite(book)) continue;
      if (toHit(at) === book) fine++; else off.push(`${a.name}/${i.name} ${at.labels?.toHit} vs ${book}`);
    }
  }
  ok('3. every blank-ability PHB creature attack rolls its book bonus', !off.length && (fine > 0), `${fine} right${off.length ? `; off: ${off.join(', ')}` : ''}`);
  ok('3b. an attack whose ability the data sets keeps it', !changed.length, `${kept} kept${changed.length ? `; changed: ${changed.join(', ')}` : ''}`);
  return { results };
}, null);

await dispose();
if (out.fatal) { console.error(`[phb-dex-attacks] FATAL: ${out.fatal}`); process.exit(2); }
let failed = 0;
for (const r of out.results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`[phb-dex-attacks] ${out.results.length - failed}/${out.results.length} passed`);
process.exit(failed ? 1 : 0);
