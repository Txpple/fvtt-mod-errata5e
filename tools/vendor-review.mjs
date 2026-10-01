/**
 * Vendor version review: snapshot a vendor package's compendium packs as JSON, then diff two
 * versions and list the open issues that cite a changed document. Reads the local install (the
 * Data dir from fvtt-mcp-dnd5e's .env); touches no world. See CLAUDE.md § Vendor updates.
 *
 *   node tools/vendor-review.mjs snapshot <package> [<package> …]   the installed version
 *   node tools/vendor-review.mjs versions [<package>]                 snapshots on disk
 *   node tools/vendor-review.mjs diff <package> <old> <new> [--issues] [--full] [--json]
 *
 * <package> is a module or system id (`dnd-players-handbook`, `dnd5e`, …). Snapshots go to
 * ERRATA_SNAPSHOT_DIR, default `vendor-snapshots` two levels above the main checkout (worktrees
 * included): OUTSIDE every repo, because premium pack data must never be committed. Foundry's
 * update overwrites the old version, so snapshot the version you run BEFORE updating, and the new
 * one after. The diff itself is tools/lib/snapshots.mjs, shared with tools/recheck.mjs.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, copyFileSync, rmSync, mkdtempSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { ROOT, mcpRoot, importMcp } from "./lib/workspace.mjs";
import { SNAP, diffDocument, loadSnapshot } from "./lib/snapshots.mjs";

const ID = /\b[A-Za-z0-9]{16}\b/g;

/* -------------------------------------------- */
/*  Snapshots                                   */
/* -------------------------------------------- */

async function dataDir(args) {
  const i = args.indexOf("--data");
  if ( i >= 0 ) return resolve(args[i + 1]);
  const { loadEnv } = await importMcp("env");
  const env = loadEnv();
  const dir = env.FOUNDRY_DATA_DIR ?? env.LOCAL_FOUNDRY_DATA;
  if ( !dir ) throw new Error("no Data dir: set FOUNDRY_DATA_DIR in fvtt-mcp-dnd5e's .env, or pass --data <dir>");
  return resolve(dir);
}

function manifestOf(data, id) {
  for ( const [kind, file] of [["modules", "module.json"], ["systems", "system.json"]] ) {
    const dir = join(data, kind, id);
    if ( existsSync(join(dir, file)) ) return { dir, manifest: JSON.parse(readFileSync(join(dir, file), "utf8")) };
  }
  throw new Error(`${id} is not installed under ${data}`);
}

async function snapshot(ids, args) {
  const data = await dataDir(args);
  const cli = join(mcpRoot(), "node_modules", "@foundryvtt", "foundryvtt-cli", "index.mjs");
  const { extractPack } = await import(pathToFileURL(cli).href);
  for ( const id of ids ) {
    const { dir, manifest } = manifestOf(data, id);
    const out = join(SNAP, id, manifest.version);
    if ( existsSync(join(out, "_manifest.json")) ) { console.log(`${id} ${manifest.version}: already snapshotted (${out})`); continue; }
    mkdirSync(out, { recursive: true });
    const tmp = mkdtempSync(join(tmpdir(), "e-snapshot-"));
    const packs = [], failed = [];
    try {
      for ( const p of manifest.packs ?? [] ) {
        const src = join(dir, p.path ?? join("packs", p.name));
        if ( !existsSync(src) ) { console.warn(`  ${p.name}: no pack at ${src}`); failed.push(p.name); continue; }
        // Copy first: the running server holds the LevelDB lock on the installed pack.
        const raw = join(tmp, "raw", p.name), ext = join(tmp, "ext", p.name);
        mkdirSync(raw, { recursive: true });
        for ( const f of readdirSync(src) ) if ( (f !== "LOCK") && statSync(join(src, f)).isFile() ) copyFileSync(join(src, f), join(raw, f));
        try { await extractPack(raw, ext, { log: false, clean: true }); }
        catch(err) { console.warn(`  ${p.name}: not extracted (${err.message || err.name})`); failed.push(p.name); continue; }
        const docs = [];
        const walk = d => { for ( const e of readdirSync(d, { withFileTypes: true }) ) {
          if ( e.isDirectory() ) walk(join(d, e.name));
          else if ( e.name.endsWith(".json") ) docs.push(JSON.parse(readFileSync(join(d, e.name), "utf8")));
        } };
        if ( existsSync(ext) ) walk(ext);
        writeFileSync(join(out, `${p.name}.json`), JSON.stringify(docs));
        packs.push({ name: p.name, type: p.type, documents: docs.length });
      }
    } finally {
      // Best effort: after a failed extraction the LevelDB reader can keep a handle open on Windows.
      try { rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }); }
      catch { console.warn(`  (left ${tmp} behind: still locked; delete it later)`); }
    }
    writeFileSync(join(out, "_manifest.json"), JSON.stringify({ id, version: manifest.version, title: manifest.title,
      snapshotAt: new Date().toISOString(), source: dir, packs, failed }, null, 1));
    console.log(`${id} ${manifest.version}: ${packs.length} packs, ${packs.reduce((n, p) => n + p.documents, 0)} documents → ${out}`);
  }
}

function versions(id) {
  if ( !existsSync(SNAP) ) return console.log(`no snapshots yet (${SNAP})`);
  for ( const pkg of id ? [id] : readdirSync(SNAP) ) {
    const dir = join(SNAP, pkg);
    if ( !existsSync(dir) ) { console.log(`${pkg}: none`); continue; }
    const rows = readdirSync(dir).filter(v => existsSync(join(dir, v, "_manifest.json")))
      .map(v => JSON.parse(readFileSync(join(dir, v, "_manifest.json"), "utf8")));
    console.log(`${pkg}: ${rows.map(m => `${m.version} (${m.snapshotAt.slice(0, 10)}${m.note ? `, ${m.note}` : ""})`).join(", ") || "none"}`);
  }
}

/* -------------------------------------------- */
/*  Diff                                        */
/* -------------------------------------------- */

function diffVersions(id, oldV, newV) {
  const A = loadSnapshot(id, oldV), B = loadSnapshot(id, newV);
  const rows = [], oneSided = [];
  for ( const pack of [...new Set([...Object.keys(A), ...Object.keys(B)])].sort() ) {
    // A pack in only one snapshot was added, removed or not extracted: list it, don't count its documents.
    if ( !A[pack] || !B[pack] ) { oneSided.push(`${pack} (only in ${A[pack] ? oldV : newV}, ${(A[pack] ?? B[pack]).length} documents)`); continue; }
    const isDoc = d => !d._key?.startsWith("!folders!");
    const before = new Map((A[pack] ?? []).filter(isDoc).map(d => [d._id, d]));
    const after = new Map((B[pack] ?? []).filter(isDoc).map(d => [d._id, d]));
    for ( const [docId, d] of before ) {
      if ( !after.has(docId) ) rows.push({ pack, id: docId, name: d.name, kind: "removed", lines: [] });
      else { const lines = diffDocument(d, after.get(docId)); if ( lines.length ) rows.push({ pack, id: docId, name: d.name, kind: "changed", lines }); }
    }
    for ( const [docId, d] of after ) if ( !before.has(docId) ) rows.push({ pack, id: docId, name: d.name, kind: "added", lines: [] });
  }
  return { rows, oneSided };
}

/**
 * Open issues whose body cites a changed document: its own id, or one of its changed embedded ids
 * together with its name (embedded ids are often copied between items, e.g. a template's advancement
 * id, so on their own they would match unrelated issues).
 */
function citingIssues(rows) {
  const issues = JSON.parse(execFileSync("gh", ["issue", "list", "--state", "open", "--limit", "2000", "--json", "number,title,body"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }));
  const hits = new Map();
  for ( const r of rows ) {
    const embedded = [...new Set(r.lines.flatMap(l => l.split(": ")[0].match(ID) ?? []))].filter(i => i !== r.id);
    for ( const issue of issues ) {
      const hasId = issue.body.includes(r.id);
      const emb = embedded.filter(i => issue.body.includes(i));
      if ( !hasId && !(r.name && issue.body.includes(r.name) && emb.length) ) continue;
      if ( !hits.has(issue.number) ) hits.set(issue.number, { title: issue.title, docs: [] });
      hits.get(issue.number).docs.push(`${r.pack}/${r.name} ${r.kind}, cited as ${[hasId ? r.id : `"${r.name}"`, ...emb].join(", ")}`);
    }
  }
  return hits;
}

function report(id, oldV, newV, args) {
  const { rows, oneSided } = diffVersions(id, oldV, newV);
  const hits = args.includes("--issues") ? citingIssues(rows) : null;
  if ( args.includes("--json") ) {
    console.log(JSON.stringify({ id, from: oldV, to: newV, documents: rows, oneSidedPacks: oneSided, issues: hits && Object.fromEntries(hits) }, null, 1));
    return;
  }
  const count = k => rows.filter(r => r.kind === k).length;
  console.log(`${id} ${oldV} → ${newV}: ${count("changed")} changed, ${count("added")} added, ${count("removed")} removed`);
  if ( oneSided.length ) console.log(`Packs in one snapshot only (added, removed, or not extracted — check the manifests): ${oneSided.join("; ")}`);
  const full = args.includes("--full");
  for ( const r of rows ) {
    console.log(`\n${r.kind.toUpperCase()} ${r.pack}/${r.name} [${r.id}]${r.lines.length ? ` — ${r.lines.length} difference(s)` : ""}`);
    for ( const l of full ? r.lines : r.lines.slice(0, 12) ) console.log(`    ${l}`);
    if ( !full && (r.lines.length > 12) ) console.log(`    … ${r.lines.length - 12} more (--full)`);
  }
  if ( hits ) {
    console.log(`\nOpen issues citing a changed document: ${hits.size} (each still needs its own re-check; one that cites nothing changed can still be affected by a system update)`);
    for ( const [n, h] of [...hits].sort((a, b) => a[0] - b[0]) ) console.log(`  #${n} ${h.title}\n      ${h.docs.join("\n      ")}`);
  }
}

/* -------------------------------------------- */

const [cmd, ...args] = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith("--") && (args[i - 1] !== "--data"));
try {
  if ( cmd === "snapshot" && positional.length ) await snapshot(positional, args);
  else if ( cmd === "versions" ) versions(positional[0]);
  else if ( (cmd === "diff") && (positional.length === 3) ) report(...positional, args);
  else {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, "").trim());
    process.exit(cmd ? 1 : 0);
  }
} catch(err) {
  console.error(`vendor-review: ${err.message}`);
  process.exit(1);
}
