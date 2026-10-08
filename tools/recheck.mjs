/**
 * Version-review recheck: for every open issue of ours on a package that moved, say whether the
 * documents it cites changed between the two snapshots, and record on the ones that did not that
 * the bug is still there. The live re-checks of a review then go only where something changed.
 *
 *   node tools/recheck.mjs <package> <old> <new>                sort the issues, write nothing
 *   node tools/recheck.mjs <package> <old> <new> --apply        also record the unchanged ones
 *   node tools/recheck.mjs <package> <old> <new> --dry          show the headers --apply would write
 *   … --issue <n>                                               one issue only
 *
 * <package> is a tracked package id with issues of ours (`dnd-players-handbook`, `dnd5e`, …); the
 * snapshots come from `tools/vendor-review.mjs snapshot`. Each open issue carrying the package's
 * label is sorted by its cited documents (the header's Document(s) row and the id in the title):
 *   unchanged     every cited document is the same in both snapshots (the review's own diff, which
 *                 ignores sort, ownership and schema fills). The defect is still in the data by
 *                 construction, so --apply records it in the header without a live test.
 *   changed       a cited document differs: a live re-check, with the differences listed
 *   missing       a cited document is not in the new snapshot: a live re-check
 *   no document   the issue cites nothing the snapshot holds: a live re-check
 * A `tracking` issue is skipped: it has no test of its own, and its sub-issues are sorted here.
 * An issue labelled `severity: high` or `worked-around` is always listed for a live re-check and
 * never written by --apply. --apply sets the header's Package row to the new version and appends
 * to the Live check row that the documents are unchanged and the issue was not re-tested on it:
 * plain facts, nothing else. Edits go one at a time, paced, and count only when they read back.
 * Nothing is commented and nothing is closed. For dnd5e the snapshot holds its SRD packs, and the
 * note says the behaviour was not re-tested, since a system update can change it without touching
 * the data. Foundry has no packs, so it has no recheck.
 */
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { ROOT } from "./lib/workspace.mjs";
import { PACKAGES } from "./lib/upstream.mjs";
import { diffDocument, loadSnapshot, indexById } from "./lib/snapshots.mjs";
import { headerFacts } from "./record-live-check.mjs";

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith("--") && (args[i - 1] !== "--issue"));
const [id, oldV, newV] = positional;
const pkg = PACKAGES.find(p => p.id === id);
if ( !pkg?.label || !oldV || !newV ) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, "").trim());
  process.exit(id ? 1 : 0);
}
const apply = args.includes("--apply"), dry = args.includes("--dry"), only = flag("--issue");
const today = new Date().toISOString().slice(0, 10);
const LIVE_ALWAYS = ["severity: high", "worked-around"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const gh = (a, input) => execFileSync("gh", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...(input ? { input } : {}) }).trim();

/** The ids of this package's documents an issue cites: the header's Document(s) row, and the title. */
export function citedDocuments(issue, packageId) {
  const ids = new Set();
  const rows = issue.body.split("\n").filter(l => /^\|\s*\*\*Documents?\*\*\s*\|/.test(l)).join(" ");
  for ( const m of rows.matchAll(/Compendium\.([\w-]+)\.[\w-]+\.(?:Item|Actor|JournalEntry|RollTable|Scene|Adventure)\.([A-Za-z0-9]{16})/g) ) if ( m[1] === packageId ) ids.add(m[2]);
  const t = issue.title.match(/\(([A-Za-z0-9]{16})\)/);
  if ( t ) ids.add(t[1]);
  return [...ids];
}

/** Sort one issue by its cited documents against the two snapshot indexes. */
export function sortIssue(issue, packageId, A, B) {
  const ids = citedDocuments(issue, packageId).filter(i => A.has(i) || B.has(i));
  if ( !ids.length ) return { kind: "no document", ids, details: [] };
  const details = [];
  let kind = "unchanged";
  for ( const i of ids ) {
    const a = A.get(i), b = B.get(i);
    if ( !b ) { kind = "missing"; details.push(`${i}: not in ${newV}`); continue; }
    if ( !a ) { if ( kind === "unchanged" ) kind = "changed"; details.push(`${i}: new in ${newV}`); continue; }
    const lines = diffDocument(a.doc, b.doc);
    if ( lines.length ) { if ( kind === "unchanged" ) kind = "changed"; details.push(`${b.pack}/${b.doc.name} [${i}]: ${lines.length} difference(s)`, ...lines.slice(0, 8).map(l => `    ${l}`)); }
  }
  return { kind, ids, details };
}

/** Replace exactly one match, or fail loudly: a header that doesn't look as expected needs a person. */
function once(text, pattern, replacement, label) {
  const n = (text.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)) ?? []).length;
  if ( n !== 1 ) throw new Error(`header ${label}: expected one match, found ${n}`);
  return text.replace(pattern, replacement);
}

/** The issue body after recording that its documents are unchanged in the new version; null if already recorded. */
export function planUnchanged(body, packageId, oldV, newV, date) {
  const { pkg: hpkg, kind, filedAgainst } = headerFacts(body);
  if ( hpkg !== packageId ) throw new Error(`the header's Package row is ${hpkg}, not ${packageId}`);
  const note = (packageId === "dnd5e")
    ? `Not re-tested on dnd5e ${newV} (${date}): the cited documents are unchanged since ${oldV}, and the behaviour was not re-tested.`
    : `Not re-tested on ${newV} (${date}): the cited documents are unchanged since ${oldV}.`;
  if ( body.includes(`Not re-tested on ${packageId === "dnd5e" ? "dnd5e " : ""}${newV} `) ) return null;
  // Already tested live on the new version (its stamp names it): nothing to add.
  if ( new RegExp(`^\\| \\*\\*Live check\\*\\* \\|.* ${newV.replace(/\./g, "\\.")}[),;]`, "m").test(body) ) return null;
  let next = once(body, /^\| \*\*Package\*\* \|.*\|$/m,
    `| **Package** | \`${hpkg}\` ${newV} (${kind}). Filed against ${filedAgainst}${(newV === filedAgainst) ? "" : `; still present in ${newV}`}. |`, "Package");
  const live = next.match(/^\| \*\*Live check\*\* \| (.*) \|$/m);
  next = live
    ? once(next, /^\| \*\*Live check\*\* \|.*\|$/m, `| **Live check** | ${live[1].trim()} ${note} |`, "Live check")
    : once(next, /^(\| \*\*Severity\*\* \|.*\|)$/m, `$1\n| **Live check** | ${note} |`, "Severity");
  return next;
}

async function main() {
  const A = indexById(loadSnapshot(id, oldV)), B = indexById(loadSnapshot(id, newV));
  let issues = JSON.parse(gh(["issue", "list", "--state", "open", "--label", pkg.label, "--limit", "2000", "--json", "number,title,body,labels"]));
  if ( only ) issues = issues.filter(i => String(i.number) === only);
  // A tracking issue holds a citation and a list, no test: its sub-issues are what is re-checked.
  issues = issues.filter(i => !i.labels.some(l => l.name === "tracking"));
  issues.sort((a, b) => a.number - b.number);
  const sorted = issues.map(i => ({ issue: i, live: i.labels.some(l => LIVE_ALWAYS.includes(l.name)), ...sortIssue(i, id, A, B) }));
  const group = k => sorted.filter(s => s.kind === k);
  const toApply = group("unchanged").filter(s => !s.live);

  console.log(`${id} ${oldV} → ${newV}: ${issues.length} open issue(s) labelled "${pkg.label}"`);
  console.log(`  unchanged ${group("unchanged").length} (${toApply.length} to record, ${group("unchanged").length - toApply.length} high or worked-around: live anyway)`
    + `, changed ${group("changed").length}, missing ${group("missing").length}, no document ${group("no document").length}`);
  const liveList = sorted.filter(s => s.live || (s.kind !== "unchanged"));
  console.log(`\nLive re-check (${liveList.length}):`);
  for ( const s of liveList ) {
    console.log(`  #${s.issue.number} [${s.kind}${s.live ? `; ${s.issue.labels.map(l => l.name).filter(l => LIVE_ALWAYS.includes(l)).join(", ")}` : ""}] ${s.issue.title}`);
    for ( const d of s.details ) console.log(`      ${d}`);
  }

  if ( !apply && !dry ) return;
  let written = 0, skipped = 0, failed = 0;
  for ( const s of toApply ) {
    let next;
    try { next = planUnchanged(s.issue.body, id, oldV, newV, today); }
    catch(err) { console.error(`  #${s.issue.number}: ${err.message}; not written`); failed++; continue; }
    if ( !next ) { skipped++; continue; }
    if ( dry ) {
      const rows = t => t.split("\n").filter(l => /^\| \*\*(Package|Live check)\*\* \|/.test(l)).join("\n");
      console.log(`\n#${s.issue.number} ${s.issue.title}\n--- header now\n${rows(s.issue.body)}\n--- header after\n${rows(next)}`);
      continue;
    }
    const tmp = mkdtempSync(join(tmpdir(), "e-recheck-"));
    try {
      writeFileSync(join(tmp, "body.md"), next);
      gh(["issue", "edit", String(s.issue.number), "--body-file", join(tmp, "body.md")]);
      await sleep(2000);
      if ( JSON.parse(gh(["issue", "view", String(s.issue.number), "--json", "body"])).body.trim() !== next.trim() ) throw new Error("the edit didn't read back");
      written++;
      console.log(`  #${s.issue.number}: recorded unchanged in ${newV}`);
    } catch(err) { console.error(`  #${s.issue.number}: ${err.message}`); failed++; }
    finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  if ( !dry ) console.log(`\nRecorded ${written}, already recorded ${skipped}, failed ${failed}.`);
}

try { await main(); }
catch(err) { console.error(`recheck: ${err.message}`); process.exit(1); }
