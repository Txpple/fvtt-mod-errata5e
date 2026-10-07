/**
 * Issue check: every vendor issue of ours carries a test on the version last reviewed. For each
 * issue, open or closed, the header's Package row names a tracked package at the version
 * VERSIONS.md says was reviewed, the Live check row records a result on that version, and the
 * test itself is on record: a comment opening with a dated verdict (what was built, run and seen)
 * or, on a closed issue, an Evidence section in the body. It reads the issues through GitHub's
 * API and nothing else: no sandbox, no snapshot. A token (GH_TOKEN, GITHUB_TOKEN, or
 * `gh auth token`) keeps it inside GitHub's rate limit.
 *
 *   node tools/check-issues.mjs          check, exit 1 on any problem
 *   node tools/check-issues.mjs --json   print every issue's findings as JSON (after checking)
 *
 * A Live check row of "Not tested live" (record-live-check --result not-run) is a recorded
 * result, not a test: it is listed as a warning and does not fail the check. The watch's own
 * version-review trackers are not vendor issues and are skipped.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./lib/workspace.mjs";
import { issues, commentsByIssue } from "./lib/github.mjs";
import { OURS, PACKAGES, parseVersions } from "./lib/upstream.mjs";

const REVIEW_LABEL = "version review";

/** The cell of a header row (`| **Name** | cell |`), or null when the row is missing. */
export function headerRow(body, name) {
  for ( const line of String(body ?? "").split(/\r?\n/) ) {
    const m = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|\s*$/);
    if ( m && (m[1] === name) ) return m[2];
  }
  return null;
}

const hasVersion = (text, v) => new RegExp(`(^|[^\w.])${v.replace(/\./g, "\.")}(?![\w.])`).test(text);

/** A comment that records a test: it opens with a bold, dated verdict line. */
export const isVerdict = c => /^\s*\*\*[^*\n]*\(\d{4}-\d{2}-\d{2}[^*\n]*\*\*/.test(c.body ?? "");

/**
 * The problems and warnings of one issue.
 * @param {object} issue        shaped issue (number, title, body, state, labels)
 * @param {object[]} comments   its comments, oldest first
 * @param {object} versions     parseVersions(VERSIONS.md)
 * @returns {{problems: string[], warnings: string[]}}
 */
export function checkIssue(issue, comments, versions) {
  const problems = [];
  const warnings = [];
  const pkgRow = headerRow(issue.body, "Package");
  const live = headerRow(issue.body, "Live check");

  let reviewed = null;
  if ( pkgRow === null ) problems.push("no Package header row");
  else {
    const m = pkgRow.match(/^`([^`]+)`\s+(\d+(?:\.\d+)+)/);
    if ( !m ) problems.push(`Package row does not open with \`<package>\` <version>: "${pkgRow.slice(0, 60)}"`);
    else if ( !PACKAGES.some(p => p.id === m[1]) ) problems.push(`Package row names an untracked package: ${m[1]}`);
    else if ( !versions[m[1]]?.reviewed ) problems.push(`${m[1]} has no Reviewed version in VERSIONS.md`);
    else if ( m[2] !== versions[m[1]].reviewed ) problems.push(`Package row says ${m[1]} ${m[2]}; the version reviewed is ${versions[m[1]].reviewed}`);
    else reviewed = versions[m[1]].reviewed;
  }

  if ( live === null ) problems.push("no Live check header row");
  else if ( !live || (live === "—") ) problems.push("Live check row is empty");
  else {
    if ( reviewed && !hasVersion(live, reviewed) ) problems.push(`Live check row records no result on ${reviewed}: "${live.slice(0, 80)}"`);
    if ( /^Not tested live/i.test(live) ) warnings.push(`not tested live: ${live.slice(0, 100)}`);
  }

  const verdicts = comments.filter(isVerdict);
  const evidence = /^##\s+Evidence\b[\s\S]*?```/m.test(issue.body ?? "");
  if ( !verdicts.length && !((issue.state === "CLOSED") && evidence) ) {
    problems.push((issue.state === "CLOSED")
      ? "no test on record: no comment opens with a dated verdict, and the body has no Evidence section"
      : "no test on record: no comment opens with a dated verdict (what was built, run and seen)");
  }
  return { problems, warnings };
}

async function main() {
  const versions = parseVersions(readFileSync(join(ROOT, "VERSIONS.md"), "utf8"));
  const [all, comments] = await Promise.all([issues(OURS, "state=all"), commentsByIssue(OURS)]);
  const vendor = all.filter(i => !i.labels.includes(REVIEW_LABEL)).sort((a, b) => a.number - b.number);
  const findings = vendor.map(i => ({ number: i.number, state: i.state, title: i.title, ...checkIssue(i, comments[i.number] ?? [], versions) }));
  const bad = findings.filter(f => f.problems.length);
  const warned = findings.filter(f => f.warnings.length);

  if ( process.argv.includes("--json") ) console.log(JSON.stringify(findings, null, 1));
  for ( const f of warned ) console.log(`#${f.number} [${f.state.toLowerCase()}] warning: ${f.warnings.join("; ")}`);
  for ( const f of bad ) console.error(`#${f.number} [${f.state.toLowerCase()}] ${f.title.slice(0, 70)}\n  - ${f.problems.join("\n  - ")}`);
  const open = vendor.filter(i => i.state === "OPEN").length;
  console.log(`${vendor.length} issues (${open} open, ${vendor.length - open} closed): ${bad.length} without a test on the reviewed version, ${warned.length} not tested live`);
  if ( bad.length ) process.exit(1);
}

if ( resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url) ) main().catch(e => { console.error(e.message); process.exit(1); });
