/**
 * Record a sandbox test on a vendor issue: set the header's Package and Live check rows to the
 * version tested, post the test as a comment, and close the issue (not planned) when the test
 * shows it isn't a bug. See CLAUDE.md § Verifying issues on the sandbox.
 *
 *   node tools/record-live-check.mjs <issue> --result <result> --notes <file.md> [--version <x.y.z>] [--dry]
 *   node tools/record-live-check.mjs <issue> --result not-run --reason "<why>" [--notes <file.md>] [--dry]
 *   node tools/record-live-check.mjs <issue> --result <result> --header-only [--dry]
 *
 * <result>: confirmed | worse | not-reproduced | fixed-upstream | not-run
 *   worse            confirmed, and worse than filed: also correct the title, severity and summary
 *   not-reproduced   the sandbox shows it isn't a bug: the issue is closed as not planned
 *   fixed-upstream   the version tested fixed it: the issue is closed as not planned
 *   not-run          not testable live (say why with --reason); the header records that
 * <file.md> is the comment body under the bold first line this tool writes: what was built, what
 * was run, and the numbers seen. --header-only updates the header without commenting: use it only
 * when the issue already carries a comment recording this same test (no duplicate comments).
 * Everything this tool writes into an issue is plain fact (result, date, versions): never our
 * working rules or tooling. The package and its version come from the header's Package row
 * and the sandbox install (FOUNDRY_DATA_DIR); Foundry and dnd5e from the running sandbox.
 * A comment counts only when gh prints its URL; an edit only when it reads back.
 * planLiveCheck() and testedVersions() are exported for scripts that record many issues.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { ROOT, importMcp, localFoundry } from "./lib/workspace.mjs";

export const RESULTS = ["confirmed", "worse", "not-reproduced", "fixed-upstream", "not-run"];

/** Replace exactly one match, or fail loudly: a header that doesn't look as expected needs a person. */
function once(text, pattern, replacement, label) {
  const n = (text.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)) ?? []).length;
  if ( n !== 1 ) throw new Error(`header ${label}: expected one match, found ${n}`);
  return text.replace(pattern, replacement);
}

/** The header's package facts: `{ pkg, kind, filedAgainst, book }`. */
export function headerFacts(body) {
  const pkgRow = body.match(/^\| \*\*Package\*\* \| `([^`]+)` (\d+\.\d+\.\d+) \(([^)]*)\)(.*)\|$/m);
  if ( !pkgRow ) throw new Error("no Package row of the form | **Package** | `<id>` <x.y.z> (<kind>) … |");
  const [, pkg, rowVersion, kind, rest] = pkgRow;
  return { pkg, kind, filedAgainst: rest.match(/Filed against (\d+\.\d+\.\d+)/)?.[1] ?? rowVersion,
    book: body.match(/^\| \*\*Book\*\* \| (.+?) \|$/m)?.[1] ?? pkg };
}

/** The versions a test ran against: the package from the sandbox install, Foundry and dnd5e from the running sandbox. */
export async function testedVersions(pkg, override) {
  const { loadEnv } = await importMcp("env");
  const env = loadEnv();
  const data = env.FOUNDRY_DATA_DIR ?? env.LOCAL_FOUNDRY_DATA;
  const installed = id => { for ( const [k, f] of [["modules", "module.json"], ["systems", "system.json"]] ) {
    const p = data && join(data, k, id, f); if ( p && existsSync(p) ) return JSON.parse(readFileSync(p, "utf8")).version; } };
  const version = override ?? installed(pkg);
  if ( !version ) throw new Error(`can't tell which ${pkg} version was tested: pass --version`);
  const status = execFileSync(process.execPath, [localFoundry(), "status"], { encoding: "utf8" });
  return { version, foundry: status.match(/Foundry v(\S+)/)?.[1] ?? "?", dnd5e: status.match(/\(dnd5e (\S+)\)/)?.[1] ?? installed("dnd5e") ?? "?" };
}

/**
 * The issue body after recording a test, the comment to post (or null), and whether to close.
 * Pure: `{ body, result, version, foundry, dnd5e, date, reason?, notes? }` → `{ next, comment, close }`.
 */
export function planLiveCheck({ body, result, version, foundry, dnd5e, date, reason, notes }) {
  if ( !RESULTS.includes(result) ) throw new Error(`unknown result ${result}`);
  const { pkg, kind, filedAgainst, book } = headerFacts(body);
  const tested = (pkg === "dnd5e") ? `dnd5e ${version}` : `${book} ${version}`;
  const stamp = `Foundry ${foundry}, dnd5e ${dnd5e}${pkg === "dnd5e" ? "" : `, ${book} ${version}`}`;
  const why = reason?.trim().replace(/\.?$/, ".");

  const live = {
    "confirmed": `Confirmed on ${date} (${stamp}).`,
    "worse": `Confirmed on ${date}, and worse than first filed (${stamp}).`,
    "not-reproduced": `Doesn't reproduce on ${date} (${stamp}); closed.`,
    "fixed-upstream": `Fixed in ${version}; checked on ${date} (${stamp}); closed.`,
    "not-run": `Not tested live (${date}, ${tested}): ${why}`
  }[result];
  const since = (version === filedAgainst) ? "" : `; ${{ "confirmed": "still present", "worse": "still present",
    "not-reproduced": "doesn't reproduce", "fixed-upstream": "fixed", "not-run": "still in the data" }[result]} in ${version}`;
  const headline = { "confirmed": "Confirmed", "worse": "Confirmed, and worse than filed", "not-reproduced": "Doesn't reproduce",
    "fixed-upstream": `Fixed in ${version}`, "not-run": "Not tested live" }[result];

  let next = once(body, /^\| \*\*Package\*\* \|.*\|$/m,
    `| **Package** | \`${pkg}\` ${version} (${kind}). Filed against ${filedAgainst}${since}. |`, "Package");
  next = /^\| \*\*Live check\*\* \|/m.test(next)
    ? once(next, /^\| \*\*Live check\*\* \|.*\|$/m, `| **Live check** | ${live} |`, "Live check")
    : once(next, /^(\| \*\*Severity\*\* \|.*\|)$/m, `$1\n| **Live check** | ${live} |`, "Severity");
  const comment = notes ? `**${headline} (${date}; ${stamp}).**\n\n${notes.trim()}` : null;
  return { next, comment, close: ["not-reproduced", "fixed-upstream"].includes(result) };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const issue = args.find(a => /^\d+$/.test(a));
  const result = flag("--result"), notesFile = flag("--notes"), reason = flag("--reason"), dry = args.includes("--dry");
  const headerOnly = args.includes("--header-only");
  const usage = () => { console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, "").trim()); process.exit(1); };
  if ( !issue || !RESULTS.includes(result) ) usage();
  if ( (result === "not-run") ? !reason : (!notesFile && !headerOnly) ) usage();
  const gh = (a, input) => execFileSync("gh", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...(input ? { input } : {}) }).trim();

  try {
    const { title, body, state } = JSON.parse(gh(["issue", "view", issue, "--json", "title,body,state"]));
    const versions = await testedVersions(headerFacts(body).pkg, flag("--version"));
    const notes = (notesFile && !headerOnly) ? readFileSync(resolve(notesFile), "utf8") : undefined;
    const { next, comment, close } = planLiveCheck({ body, result, reason, notes, ...versions, date: new Date().toISOString().slice(0, 10) });

    if ( dry ) {
      const rows = s => s.split("\n").filter(l => /^\| \*\*(Package|Live check)\*\* \|/.test(l)).join("\n");
      console.log(`#${issue} ${title} [${state}]\n--- header now\n${rows(body)}\n--- header after\n${rows(next)}\n--- comment\n${comment ?? "(none)"}\n--- close: ${close}${result === "worse" ? "\n--- also correct the title, severity and summary by hand" : ""}`);
      return;
    }
    const tmp = mkdtempSync(join(tmpdir(), "e-live-check-"));
    try {
      writeFileSync(join(tmp, "body.md"), next);
      gh(["issue", "edit", issue, "--body-file", join(tmp, "body.md")]);
      if ( JSON.parse(gh(["issue", "view", issue, "--json", "body"])).body.trim() !== next.trim() ) throw new Error("the body edit didn't read back — check the issue");
      let url = null;
      if ( comment ) {
        writeFileSync(join(tmp, "comment.md"), comment);
        url = gh(["issue", "comment", issue, "--body-file", join(tmp, "comment.md")]).match(/https:\/\/github\.com\/\S+#issuecomment-\d+/)?.[0];
        if ( !url ) throw new Error("gh printed no comment URL (GitHub's content limit?) — look at the issue before retrying, so nothing is posted twice");
      }
      if ( close && (state === "OPEN") ) gh(["issue", "close", issue, "--reason", "not planned"]);
      console.log(JSON.stringify({ issue: Number(issue), result, version: versions.version, header: "updated", comment: url, closed: close }));
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  } catch(err) {
    console.error(`record-live-check #${issue}: ${err.message}`);
    process.exit(1);
  }
}

if ( resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url) ) await main();
