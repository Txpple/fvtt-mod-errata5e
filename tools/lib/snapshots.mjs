/**
 * Vendor snapshots on disk, and the document diff the version review and the recheck share.
 * A snapshot is `vendor-snapshots/<package>/<version>/<pack>.json` (one array of documents per
 * pack) with a `_manifest.json`; `tools/vendor-review.mjs snapshot` writes them, always outside
 * every repo. No I/O beyond reading snapshots.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { snapshotDir } from "./workspace.mjs";

/** The snapshot root; throws if it would land inside a repo. */
export const SNAP = snapshotDir();

const IGNORED = new Set(["sort", "folder", "ownership", "_key"]);

/** A value a newer system fills in by default: absent, null, "", false, 0, or containers of those. */
const emptyish = v => (v === undefined) || (v === null) || (v === "") || (v === false) || (v === 0)
  || (Array.isArray(v) && v.every(emptyish)) || ((typeof v === "object") && !Array.isArray(v) && Object.values(v).every(emptyish));
/** Embedded collections compare by _id, not by position. */
const byId = v => (Array.isArray(v) && v.length && v.every(e => e && (typeof e === "object") && e._id))
  ? Object.fromEntries(v.map(e => [e._id, e])) : v;
/** An effect change: drop the per-change _id and the default phase/conditions a newer system writes. */
const change = c => { const { _id, phase, conditions, ...rest } = c ?? {};
  return { ...rest, ...((phase && phase !== "initial") ? { phase } : {}), ...((conditions && conditions !== "{}") ? { conditions } : {}) }; };

/**
 * The differences between two versions of one document, as "path: old -> new" lines.
 * Ignores sort/folder/ownership, `_stats` except `compendiumSource`, and schema-default fills.
 */
export function diffDocument(a, b, path = "", out = []) {
  if ( out.length > 400 ) return out;
  if ( a === b ) return out;
  if ( ((a === undefined) && emptyish(b)) || ((b === undefined) && emptyish(a)) ) return out;
  if ( path.endsWith("changes") && Array.isArray(a) && Array.isArray(b) ) { a = a.map(change); b = b.map(change); }
  a = byId(a); b = byId(b);
  const show = v => JSON.stringify(v)?.slice(0, 160);
  if ( (typeof a !== typeof b) || (a === null) || (b === null) || (typeof a !== "object") ) {
    out.push(`${path}: ${show(a)} -> ${show(b)}`);
    return out;
  }
  if ( Array.isArray(a) !== Array.isArray(b) ) { out.push(`${path}: ${show(a)} -> ${show(b)}`); return out; }
  for ( const k of new Set([...Object.keys(a), ...Object.keys(b)]) ) {
    if ( IGNORED.has(k) ) continue;
    const p = path ? `${path}.${k}` : k;
    if ( k === "_stats" ) diffDocument(a[k]?.compendiumSource, b[k]?.compendiumSource, `${p}.compendiumSource`, out);
    else diffDocument(a[k], b[k], p, out);
  }
  return out;
}

/** The snapshot's manifest, or null if there is no snapshot of that version. */
export function manifestOf(id, version) {
  const file = join(SNAP, id, version, "_manifest.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/** One snapshot's packs, by pack name: `{ [pack]: document[] }`. */
export function loadSnapshot(id, version) {
  const dir = join(SNAP, id, version);
  if ( !existsSync(join(dir, "_manifest.json")) ) throw new Error(`no snapshot of ${id} ${version} in ${join(SNAP, id)} — run: node tools/vendor-review.mjs snapshot ${id}`);
  const packs = {};
  for ( const f of readdirSync(dir) ) if ( f.endsWith(".json") && (f !== "_manifest.json") ) packs[f.slice(0, -5)] = JSON.parse(readFileSync(join(dir, f), "utf8"));
  return packs;
}

/** A document (not a folder) of a snapshot, by id, with the pack it sits in. */
export function indexById(packs) {
  const index = new Map();
  for ( const [pack, docs] of Object.entries(packs) ) for ( const d of docs ) {
    if ( !d._key?.startsWith("!folders!") ) index.set(d._id, { pack, doc: d });
  }
  return index;
}
