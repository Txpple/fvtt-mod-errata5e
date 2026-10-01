/**
 * Run a sandbox test (a "probe") with the house rules built in: it refuses while another session
 * is connected to the sandbox, runs the probe's page function as the suite user, then deletes the
 * run's leftovers: `Errata Live …` actors, items, scenes and journals, combats created during the run,
 * and the chat messages the run posted (modules post some in reaction, e.g. Battle Flow's
 * combat-start card). LOCAL sandbox only; see CLAUDE.md § Verifying issues on the sandbox.
 *
 *   node tools/sandbox-probe.mjs <probe.mjs> [--arg <file.json>] [--timeout <seconds>] [--allow-busy]
 *
 * <probe.mjs> exports `default async function (arg) { … }`. It runs IN THE PAGE: no closures over
 * Node values (pass data through --arg or an exported `arg`), and it returns something
 * JSON-serialisable. Build documents in memory (`new Actor.implementation(data)`) where you can;
 * name anything you must save "Errata Live …". Race slow calls against a timeout (an activity
 * `use()` can wait forever for a dialog).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { importMcp, localFoundry } from "./lib/workspace.mjs";

const flag = (args, name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith("--") && !["--arg", "--timeout"].includes(args[i - 1]));
if ( !file ) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, "").trim());
  process.exit(1);
}
const timeoutMs = Number(flag(args, "--timeout") ?? 120) * 1000;

// 1. Is anyone else in the sandbox? Another session's suite and ours would fight over it.
const status = execFileSync(process.execPath, [localFoundry(), "status"], { encoding: "utf8" });
if ( !/server:\s+up/.test(status) ) { console.error(`sandbox-probe: the sandbox is not up\n${status}`); process.exit(2); }
const connected = Number(status.match(/users:\s+(\d+) connected/)?.[1] ?? 0);
if ( connected && !args.includes("--allow-busy") ) {
  console.error(`sandbox-probe: ${connected} user(s) already connected to the sandbox — another session may be testing. Wait, or pass --allow-busy if it's yours.`);
  process.exit(2);
}

// 2. The probe.
const mod = await import(pathToFileURL(resolve(file)).href);
if ( typeof mod.default !== "function" ) { console.error("sandbox-probe: the probe must export a default (async) function"); process.exit(1); }
const argFile = flag(args, "--arg");
const arg = argFile ? JSON.parse(readFileSync(resolve(argFile), "utf8")) : (mod.arg ?? null);

const { connectFoundry } = await importMcp("client");
const { f, dispose } = await connectFoundry({ host: "local", identity: "suite", tag: "sandbox-probe", watchdogMs: timeoutMs + 120_000 });
let result, error, cleanup;
try {
  const start = await f.evaluate(() => Date.now(), null);
  try {
    result = await Promise.race([f.evaluate(mod.default, arg),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`probe timed out after ${timeoutMs / 1000} s`)), timeoutMs))]);
  } catch(err) { error = err.message; }
  // 3. Leftovers, whatever happened above.
  cleanup = await f.evaluate(async start => {
    const removed = {};
    const sweep = async (cls, docs, key) => { const ids = docs.map(d => d.id); if ( ids.length ) await cls.deleteDocuments(ids); removed[key] = ids.length; };
    const ours = d => d.name?.startsWith("Errata Live");
    const madeNow = d => (d._stats?.createdTime ?? 0) >= start;
    await sweep(Combat.implementation, game.combats.filter(c => madeNow(c) || c.combatants.some(cb => cb.actor && ours(cb.actor))), "combats");
    await sweep(ChatMessage.implementation, game.messages.filter(m => madeNow(m) && (m.author?.id === game.user.id)), "messages");
    await sweep(Actor.implementation, game.actors.filter(ours), "actors");
    await sweep(Item.implementation, game.items.filter(ours), "items");
    await sweep(Scene.implementation, game.scenes.filter(ours), "scenes");
    await sweep(JournalEntry.implementation, game.journal.filter(ours), "journals");
    return removed;
  }, start);
} finally { await dispose(); }

console.log(JSON.stringify({ result: result ?? null, error: error ?? null, cleanup }, null, 1));
process.exit(error ? 1 : 0);
