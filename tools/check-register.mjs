/**
 * Register check: REGISTER.md parses as the machine-readable table CLAUDE.md defines, and the
 * repo agrees with it: every live row has its fix file, named after the row and its issue and
 * opening with the ID, registering no setting; every fix file and every suite has its live row; the
 * module loads exactly the live fix files and describes each; VERSIONS.md tracks exactly the
 * packages the watch does. Offline, no dependencies, touches no world.
 *
 *   node tools/check-register.mjs          check, exit 1 on any problem
 *   node tools/check-register.mjs --json   print the register as JSON (after checking)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGES, parseVersions } from "./lib/upstream.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COLUMNS = ["ID", "Status", "Issue", "Vendor", "Package", "Source", "Documents", "Bug", "Fix", "File",
  "Measured on", "Dependents", "Upstream report", "Retire when", "Added", "Retired"];
const STATUSES = ["active", "upstream-fixed", "retired"];
const NONE = "—";
/** A fix file: scripts/patches/e-NNN-<issue>-<name>.js; a suite: tools/suites/e-NNN-<issue>-<name>.mjs. */
const FIX_FILE = /^scripts\/patches\/e-(\d{3})-(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*\.js$/;
const SUITE_FILE = /^e-(\d{3})-(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*\.mjs$/;

/**
 * Parse the table between the register markers into row objects keyed by column name.
 * @param {string} text   REGISTER.md
 * @returns {{rows: Record<string, string>[], errors: string[]}}
 */
export function parseRegister(text) {
  const errors = [];
  const block = text.match(/<!-- register:start -->\r?\n([\s\S]*?)<!-- register:end -->/);
  if ( !block ) return { rows: [], errors: ["register markers not found"] };
  const lines = block[1].split(/\r?\n/).filter(l => l.trim());
  const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const header = cells(lines[0] ?? "");
  if ( header.join("|") !== COLUMNS.join("|") ) errors.push(`header must be exactly: ${COLUMNS.join(" | ")}`);
  const rows = [];
  for ( const [i, line] of lines.slice(2).entries() ) {
    const c = cells(line);
    if ( c.length !== COLUMNS.length ) {
      errors.push(`row ${i + 1}: ${c.length} cells, expected ${COLUMNS.length} (a "|" inside a cell?)`);
      continue;
    }
    rows.push(Object.fromEntries(COLUMNS.map((k, j) => [k, c[j]])));
  }
  return { rows, errors };
}

export function check() {
  const { rows, errors } = parseRegister(readFileSync(join(ROOT, "REGISTER.md"), "utf8"));
  const read = rel => existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), "utf8") : null;
  const seen = new Set();
  const issues = new Set();
  const live = rows.filter(r => r.Status !== "retired");

  for ( const [i, r] of rows.entries() ) {
    const at = r.ID || `row ${i + 1}`;
    if ( !/^E-\d{3}$/.test(r.ID) ) errors.push(`${at}: ID must look like E-001`);
    else if ( r.ID !== `E-${String(i + 1).padStart(3, "0")}` ) errors.push(`${at}: IDs must run in order from E-001`);
    if ( seen.has(r.ID) ) errors.push(`${at}: duplicate ID`);
    seen.add(r.ID);
    if ( !STATUSES.includes(r.Status) ) errors.push(`${at}: Status must be one of ${STATUSES.join(", ")}`);
    if ( !/^#\d+$/.test(r.Issue) ) errors.push(`${at}: Issue must be the bug's issue number in this repo, like #709`);
    else if ( issues.has(r.Issue) ) errors.push(`${at}: Issue ${r.Issue} is already another fix's`);
    issues.add(r.Issue);
    for ( const k of COLUMNS ) if ( !r[k] ) errors.push(`${at}: ${k} is empty (use ${NONE})`);
    if ( (r.Status === "retired") === (r.Retired === NONE) ) errors.push(`${at}: Retired is set exactly when Status is retired`);

    // The file is named after the row and its issue.
    const m = r.File.match(FIX_FILE);
    if ( !m ) errors.push(`${at}: File must be scripts/patches/e-NNN-<issue>-<name>.js, not ${r.File}`);
    else {
      if ( `E-${m[1]}` !== r.ID ) errors.push(`${at}: File ${r.File} is named for E-${m[1]}`);
      if ( `#${m[2]}` !== r.Issue ) errors.push(`${at}: File ${r.File} is named for issue #${m[2]}, the row says ${r.Issue}`);
    }
    if ( r.Status === "retired" ) continue;

    // A live row has its file, which opens with the ID and registers no setting.
    const src = read(r.File);
    if ( src === null ) { errors.push(`${at}: File ${r.File} does not exist`); continue; }
    const head = src.match(/^\/\*\*([\s\S]*?)\*\//)?.[1] ?? "";
    if ( !new RegExp(`^\\s*\\*\\s*${r.ID} ·`, "m").test(head) ) errors.push(`${at}: ${r.File} must open with a doc comment headed "${r.ID} · NAME"`);
    if ( !/THE PROBLEM/.test(head) || !/THE FIX/.test(head) ) errors.push(`${at}: ${r.File}'s doc comment must have THE PROBLEM and THE FIX`);
    if ( /game\.settings\.register\(/.test(src) ) errors.push(`${at}: ${r.File} registers a setting; the module is one switch, fixes have none`);
  }

  // Every shipped fix file is a live row, and the module loads exactly the live files.
  const patches = join(ROOT, "scripts", "patches");
  const liveFiles = new Set(live.map(r => r.File));
  if ( existsSync(patches) ) for ( const f of readdirSync(patches).filter(f => f.endsWith(".js")) ) {
    if ( !liveFiles.has(`scripts/patches/${f}`) ) errors.push(`scripts/patches/${f} has no live register row`);
  }
  const entry = read("scripts/errata5e.js") ?? "";
  const imported = [...entry.matchAll(/^import "\.\/patches\/([^"]+)";/gm)].map(m => `scripts/patches/${m[1]}`);
  for ( const f of liveFiles ) if ( !imported.includes(f) ) errors.push(`scripts/errata5e.js does not import ${f}`);
  for ( const f of imported ) if ( !liveFiles.has(f) ) errors.push(`scripts/errata5e.js imports ${f}, which has no live register row`);

  // Every suite belongs to a live row.
  const suites = join(ROOT, "tools", "suites");
  if ( existsSync(suites) ) for ( const f of readdirSync(suites).filter(f => f.endsWith(".mjs")) ) {
    const m = f.match(SUITE_FILE);
    if ( !m ) { errors.push(`tools/suites/${f} must be named e-NNN-<issue>-<name>.mjs`); continue; }
    if ( !live.some(r => (r.ID === `E-${m[1]}`) && (r.Issue === `#${m[2]}`)) ) errors.push(`tools/suites/${f} has no live register row E-${m[1]} on #${m[2]}`);
  }

  // VERSIONS.md tracks exactly the packages the watch does, in its order.
  try {
    const tracked = Object.keys(parseVersions(read("VERSIONS.md") ?? ""));
    const want = PACKAGES.map(p => p.id);
    if ( tracked.join(",") !== want.join(",") ) errors.push(`VERSIONS.md must list ${want.join(", ")}; it lists ${tracked.join(", ") || "nothing"}`);
  } catch(err) { errors.push(err.message); }

  return { rows, errors };
}

// Run only as a script, so another tool can import parseRegister without the check firing.
if ( process.argv[1] && (fileURLToPath(import.meta.url) === process.argv[1]) ) {
  const { rows, errors } = check();
  if ( errors.length ) {
    for ( const e of errors ) console.error(`✗ ${e}`);
    process.exit(1);
  }
  if ( process.argv.includes("--json") ) console.log(JSON.stringify(rows, null, 2));
  else console.log(`✓ register OK — ${rows.length} fix(es)`);
}
