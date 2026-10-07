/**
 * Upstream watch: the daily look at what the vendors have done. It needs no sandbox and no local
 * install (versions from the vendors' public manifests and Foundry's release page, issues from
 * GitHub's REST API), so it runs the same from a fresh clone, a GitHub Action included.
 *
 *   node tools/upstream-watch.mjs [--json] [--notify]
 *   node tools/upstream-watch.mjs --record <ours>=<upstream> …      the same bug: cite it in our issue
 *   node tools/upstream-watch.mjs --different <ours>=<upstream> …   a different bug: not shown again
 *
 * <upstream> is a premium-content issue number (`1794`), or `dnd5e#<n>` for the dnd5e repo.
 *
 * A scan reads VERSIONS.md and every open issue of ours, then both upstream repos: every open
 * report on our packages, and every report changed since the last scan. It writes, all in watch/:
 *   STATUS.md      the watch at a glance, rewritten every run: version reviews due, pairs to
 *                  judge, cited reports the vendor has closed, reports new to us
 *   LOG.md         one row per run
 *   state.json     what it remembers: the last scan date, judged pairs, when each new-to-us report
 *                  was first seen, and the state of every upstream report our issues cite
 *   YYYY-MM-DD.md  a digest, only on a day with something to act on (a version newer than the
 *                  one reviewed, pairs to judge, a cited report newly closed, reports first seen
 *                  today); the session that judges the pairs appends its verdicts under `## Run notes`
 * and VERSIONS.md's Latest published column. With --notify it also keeps one open issue of ours
 * per version review due (`Version review due: …`), and closes it once the review has moved the
 * package's Reviewed version; that is the only issue the watch ever files.
 *
 * A name or id match finds the same DOCUMENT, not necessarily the same bug, so nothing is recorded
 * by the scan: whoever reads the digest judges each pair. --record writes the reference into our
 * issue's Upstream header row and, for an issue with an Errata 5e fix, the register's Upstream report
 * cell, as code (`foundryvtt-premium-content#1794`), so GitHub makes no link and nothing appears
 * upstream. --different remembers the pair so it is not shown again unless the upstream title
 * changes. The watch never writes to any repo but ours. A GitHub token (GH_TOKEN, GITHUB_TOKEN,
 * or `gh auth token`) is needed to record and to notify; a scan works without one within GitHub's
 * unauthenticated limit, which the first scan exceeds.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/workspace.mjs";
import { TOKEN, api, shape, issues } from "./lib/github.mjs";
import { OURS, PACKAGES, SOURCES, cmpVersion, subjectsOf, citations, isFeature, upstreamPackage, onOurData,
  matchUpstream, refOf, quietRef, withUpstreamRef, parseVersions, withLatest } from "./lib/upstream.mjs";

const args = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);

const WATCH = join(ROOT, "watch");
const VERSIONS = join(ROOT, "VERSIONS.md");
const STATE = join(WATCH, "state.json");
const STATUS = join(WATCH, "STATUS.md");
const LOG = join(WATCH, "LOG.md");
const REVIEW_LABEL = "version review";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const getIssue = async (repo, n) => shape(await api(`repos/${repo}/issues/${n}`));

function loadState() {
  try { return { lastScan: null, judged: {}, seen: {}, cited: {}, ...JSON.parse(readFileSync(STATE, "utf8")) }; }
  catch { return { lastScan: null, judged: {}, seen: {}, cited: {} }; }
}
const saveState = state => writeFileSync(STATE, `${JSON.stringify(state, null, 1)}\n`);

/** `<ours>=<upstream>` → { ours, repo, n }; the upstream side defaults to premium-content. */
function parsePair(pair) {
  const m = pair.match(/^#?(\d+)=(?:([\w./-]+)#)?(\d+)$/);
  if ( !m ) throw new Error(`${pair}: expected <ours>=<upstream>, e.g. 709=1794 or 670=dnd5e#1234`);
  const short = m[2] ?? "premium-content";
  const source = SOURCES.find(s => (s.short === short) || (s.repo === short) || (refOf(s.repo, 0).slice(0, -2) === short));
  if ( !source ) throw new Error(`${pair}: unknown upstream repo "${short}" (${SOURCES.map(s => s.short).join(", ")})`);
  return { ours: Number(m[1]), repo: source.repo, n: Number(m[3]) };
}

const pairKey = (ours, repo, n) => `${ours}=${refOf(repo, n)}`;
const fmtUp = up => `\`${refOf(up.repo, up.number)}\` [${up.state.toLowerCase()}${up.stateReason ? `, ${up.stateReason.toLowerCase()}` : ""}] ${up.title} (${upstreamPackage(up, up.repo)?.id ?? "?"}) ${up.url}`;

/* -------------------------------------------- */
/*  Versions                                    */
/* -------------------------------------------- */

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": "fvtt-mod-errata5e upstream-watch" } });
  if ( !res.ok ) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** The newest published version of every tracked package, against VERSIONS.md. */
async function versions(tracked) {
  const rows = [];
  const row = (p, latest, notes, extra = "") => {
    const t = tracked[p.id] ?? {};
    rows.push({ id: p.id, name: t.name ?? p.name, reviewed: t.reviewed ?? null, firstSeen: t.firstSeen ?? null, latest, notes, extra,
      newer: !!(t.reviewed && latest && (cmpVersion(latest, t.reviewed) > 0)),
      newSinceLastRun: !!(latest && (!t.latest || (cmpVersion(latest, t.latest) > 0))) });
  };
  for ( const p of PACKAGES ) {
    try {
      if ( p.id === "foundry" ) {
        // The newest Stable release on the release notes page.
        const html = await fetchText("https://foundryvtt.com/releases/");
        const entries = [...html.matchAll(/href="\/releases\/([\d.]+)"[\s\S]*?release-time">([^<]+)<[\s\S]*?<div class="release-tags">([\s\S]*?)<\/div>/g)]
          .map(m => ({ version: m[1], date: m[2].trim(), stable: /release-tag stable/.test(m[3]) }));
        const stable = entries.find(e => e.stable), newest = entries[0];
        row(p, stable?.version ?? null, stable ? `https://foundryvtt.com/releases/${stable.version} (${stable.date})` : "no Stable release found",
          (newest && !newest.stable && (newest.version !== stable?.version)) ? `newest pre-release: ${newest.version} (${newest.date})` : "");
      } else if ( p.id === "dnd5e" ) {
        // The manifest of its latest GitHub release, which Foundry's own update check reads.
        const m = JSON.parse(await fetchText("https://github.com/foundryvtt/dnd5e/releases/latest/download/system.json"));
        row(p, m.version, `https://github.com/foundryvtt/dnd5e/releases/tag/release-${m.version}`);
      } else {
        // A module's public manifest: the vendor's for a premium book, the given one otherwise.
        const m = JSON.parse(await fetchText(p.manifest ?? `https://r2.foundryvtt.com/packages-public/${p.id}/module.json`));
        row(p, m.version, m.changelog ? `changelog: ${m.changelog}` : "changelog: the package's own journal page",
          `compatibility ${m.compatibility?.minimum ?? "?"}–${m.compatibility?.verified ?? "?"}`);
      }
    } catch(err) { row(p, null, `could not read the newest version: ${err.message}`); }
  }
  return rows;
}

/* -------------------------------------------- */
/*  Recording                                   */
/* -------------------------------------------- */

/** Add the reference to the register row whose Issue is #n; returns true if the file changed. */
function registerRef(n, up) {
  const file = join(ROOT, "REGISTER.md");
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const header = lines.find(l => /^\| ID \| Status \| Issue \|/.test(l));
  if ( !header ) return false;
  const cols = header.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const at = cols.indexOf("Upstream report");
  let changed = false;
  for ( const [i, line] of lines.entries() ) {
    if ( !/^\| E-\d{3} \|/.test(line) ) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    if ( cells[2] !== `#${n}` ) continue;
    const ref = refOf(up.repo, up.number);
    if ( cells[at].includes(ref) || new RegExp(`(^|[^\\w/])#${up.number}(?!\\d)`).test(cells[at]) ) continue;
    const note = `${ref} (${up.state.toLowerCase()}, found ${today})`;
    cells[at] = /^not reported$/i.test(cells[at]) ? note : `${cells[at]}; ${note}`;
    lines[i] = `| ${cells.join(" | ")} |`;
    changed = true;
  }
  if ( changed ) writeFileSync(file, lines.join(eol));
  return changed;
}

async function editIssue(number, body) {
  if ( !TOKEN ) throw new Error("editing our issues needs a token: set GH_TOKEN or GITHUB_TOKEN, or log in with gh");
  await api(`repos/${OURS}/issues/${number}`, { method: "PATCH", body: { body } });
  await sleep(4000);   // pace: GitHub's content limit can drop edits silently
  return (await getIssue(OURS, number)).body.trim() === body.trim();
}

/** --record / --different: remember the verdicts; a same-bug pair is also cited in our issue and the register. */
async function judge(pairs, verdict) {
  const state = loadState();
  let registerChanged = false;
  for ( const pair of pairs ) {
    let p;
    try { p = parsePair(pair); } catch(err) { console.error(err.message); process.exitCode = 1; continue; }
    const up = { ...(await getIssue(p.repo, p.n)), repo: p.repo };
    const key = pairKey(p.ours, p.repo, p.n);
    if ( verdict === "same" ) {
      const ours = await getIssue(OURS, p.ours);
      if ( !citations(ours.body).some(c => (c.repo === p.repo) && (c.n === p.n)) ) {
        const body = withUpstreamRef(ours.body, up, p.repo, today);
        if ( !body ) { console.error(`#${p.ours}: no Upstream header row; not recorded`); process.exitCode = 1; continue; }
        let ok = false;
        try { ok = await editIssue(p.ours, body); }
        catch(err) { console.error(`#${p.ours}: ${err.message}`); process.exitCode = 1; continue; }
        if ( !ok ) { console.error(`#${p.ours}: the edit did not stick (GitHub content limit?); try again later`); process.exitCode = 1; continue; }
        const reg = registerRef(p.ours, up);
        registerChanged ||= reg;
        console.log(`#${p.ours} ← ${refOf(p.repo, p.n)}: recorded${reg ? " (and in the register)" : ""}`);
      } else console.log(`#${p.ours} already cites ${refOf(p.repo, p.n)}`);
    } else console.log(`#${p.ours} / ${refOf(p.repo, p.n)}: a different bug; not shown again`);
    state.judged[key] = { verdict, on: today, title: up.title };
  }
  saveState(state);
  if ( registerChanged ) console.log("REGISTER.md changed: run node tools/check-register.mjs, then commit it.");
}

/* -------------------------------------------- */
/*  Notify                                      */
/* -------------------------------------------- */

/** One open issue of ours per version review due; closed once VERSIONS.md says the review is done. */
async function notify(vrows) {
  if ( !TOKEN ) throw new Error("--notify needs a token: set GH_TOKEN or GITHUB_TOKEN, or log in with gh");
  const labels = await api(`repos/${OURS}/labels?per_page=100`);
  if ( !labels.some(l => l.name === REVIEW_LABEL) ) await api(`repos/${OURS}/labels`, { method: "POST",
    body: { name: REVIEW_LABEL, color: "0052cc", description: "A tracked package has a newer version than the one reviewed" } });
  const open = await issues(OURS, `state=open&labels=${encodeURIComponent(REVIEW_LABEL)}`);
  for ( const r of vrows ) {
    const prefix = `Version review due: ${r.name}`;
    const mine = open.filter(i => i.title.startsWith(prefix));
    if ( r.newer ) {
      const title = `${prefix} ${r.reviewed} → ${r.latest}`;
      const body = [`| | |`, `| --- | --- |`, `| **Package** | \`${r.id}\` |`, `| **Reviewed** | ${r.reviewed} |`,
        `| **Latest published** | ${r.latest}, first seen ${r.firstSeen ?? today} |`, `| **Release** | ${[r.notes, r.extra].filter(Boolean).join("; ")} |`, "",
        "The vendor has published a version newer than the one our issues and fixes were last checked against. ",
        "The installed version is snapshotted before it moves; the review sets **Reviewed** in VERSIONS.md, and this issue closes on the next watch run."].join("\n");
      if ( mine.some(i => i.title === title) ) continue;
      if ( mine.length ) await api(`repos/${OURS}/issues/${mine[0].number}`, { method: "PATCH", body: { title, body } });
      else await api(`repos/${OURS}/issues`, { method: "POST", body: { title, body, labels: [REVIEW_LABEL] } });
      await sleep(4000);
      console.log(`[notify] ${title}`);
    } else for ( const i of mine ) {
      await api(`repos/${OURS}/issues/${i.number}/comments`, { method: "POST", body: { body: `Reviewed: VERSIONS.md now says ${r.reviewed} (${today}).` } });
      await api(`repos/${OURS}/issues/${i.number}`, { method: "PATCH", body: { state: "closed", state_reason: "completed" } });
      await sleep(4000);
      console.log(`[notify] closed #${i.number}: ${r.name} reviewed at ${r.reviewed}`);
    }
  }
}

/* -------------------------------------------- */
/*  Scan                                        */
/* -------------------------------------------- */

async function scan() {
  mkdirSync(WATCH, { recursive: true });
  const state = loadState();
  const lastScan = state.lastScan;
  const before = structuredClone(state.cited);
  const versionsText = readFileSync(VERSIONS, "utf8");

  // 1. Versions.
  const vrows = await versions(parseVersions(versionsText));
  const newer = vrows.filter(r => r.newer);

  // 2. Our open issues, with the documents each is about and the upstream reports it cites.
  const ours = (await issues(OURS, "state=open")).map(i => ({ ...i, subjects: subjectsOf(i.title, i.body), cites: citations(i.body) }));
  const citedBy = up => ours.filter(o => o.cites.some(c => (c.repo === up.repo) && (c.n === up.number)));
  // A closed issue of ours that cites a report (a "not a bug" verdict, say) has answered it too.
  const answered = new Set((await issues(OURS, "state=closed")).flatMap(i => citations(i.body).map(c => refOf(c.repo, c.n))));

  // 3. Upstream: every open report on our packages, plus every report changed since the last scan.
  const upstream = new Map();
  const openRefs = new Set();
  for ( const s of SOURCES ) {
    for ( const up of await issues(s.repo, "state=open") ) {
      if ( !upstreamPackage(up, s.repo) ) continue;
      const ref = refOf(s.repo, up.number);
      upstream.set(ref, { ...up, repo: s.repo });
      openRefs.add(ref);
    }
    if ( state.lastScan ) for ( const up of await issues(s.repo, `state=all&since=${state.lastScan}T00:00:00Z`) ) {
      if ( upstreamPackage(up, s.repo) ) upstream.set(refOf(s.repo, up.number), { ...up, repo: s.repo });
    }
  }

  // 4. The reports our issues cite: their state, from this run's reports, the cache, or one fetch.
  const cited = {};
  for ( const o of ours ) for ( const c of o.cites ) {
    const ref = refOf(c.repo, c.n);
    if ( cited[ref] ) { cited[ref].ours.push(o.number); continue; }
    let up = upstream.get(ref);
    if ( !up && !state.cited[ref] ) {
      try { up = { ...(await getIssue(c.repo, c.n)), repo: c.repo }; }
      catch(err) { cited[ref] = { state: "unknown", title: err.message, ours: [o.number] }; continue; }
    }
    cited[ref] = up ? { state: up.state.toLowerCase(), reason: up.stateReason?.toLowerCase() ?? null, closedAt: up.closedAt?.slice(0, 10) ?? null,
      title: up.title, url: up.url, package: upstreamPackage(up, up.repo)?.id ?? null, ours: [o.number] }
      : { ...state.cited[ref], ours: [o.number] };
  }
  state.cited = cited;
  const closedCited = Object.entries(cited).filter(([, c]) => c.state === "closed").sort();
  const newlyClosed = closedCited.filter(([ref]) => before[ref]?.state !== "closed");

  // 5. Pairs: the same document as one of our issues, not yet cited, not yet judged.
  const pending = [];
  let judged = 0;
  const matched = new Set();
  for ( const up of upstream.values() ) {
    if ( isFeature(up) ) continue;
    const ref = refOf(up.repo, up.number);
    const hits = matchUpstream(up, up.repo, ours);
    if ( hits.length ) matched.add(ref);
    const by = citedBy(up);
    for ( const h of hits ) {
      if ( by.includes(h.ours) ) continue;
      const j = state.judged[pairKey(h.ours.number, up.repo, up.number)];
      if ( j && (j.title === up.title) ) { judged++; continue; }
      pending.push({ up, ref, ...h, retitled: !!j });
    }
  }
  pending.sort((a, b) => a.ref.localeCompare(b.ref) || (a.ours.number - b.ours.number));
  const toJudge = pending.filter(p => p.strength === "strong"), possible = pending.filter(p => p.strength === "weak");

  // 6. New to us: open bug reports on our packages' data that match nothing, no issue of ours
  //    (open or closed) cites, and nobody has judged.
  const judgedRefs = new Set(Object.entries(state.judged)
    .map(([key, j]) => [key.slice(key.indexOf("=") + 1), j]).filter(([ref, j]) => upstream.get(ref)?.title === j.title).map(([ref]) => ref));
  const seen = {};
  const newToUs = [...upstream.values()].filter(up => {
    const ref = refOf(up.repo, up.number);
    return openRefs.has(ref) && onOurData(up, up.repo) && !matched.has(ref) && !judgedRefs.has(ref) && !answered.has(ref) && !citedBy(up).length;
  }).map(up => { const ref = refOf(up.repo, up.number);
    seen[ref] = { firstSeen: state.seen[ref]?.firstSeen ?? today, title: up.title, package: upstreamPackage(up, up.repo).id, url: up.url };
    return { ...up, ref, firstSeen: seen[ref].firstSeen }; })
    .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || a.ref.localeCompare(b.ref));
  state.seen = seen;
  const newToday = newToUs.filter(u => u.firstSeen === today);

  // 7. Per source counts.
  const sources = SOURCES.map(s => {
    const refs = [...upstream.values()].filter(up => up.repo === s.repo);
    const isOurs = up => openRefs.has(refOf(up.repo, up.number)) && onOurData(up, up.repo);
    return { repo: s.repo, open: refs.filter(isOurs).length, cited: Object.keys(cited).filter(r => r.startsWith(refOf(s.repo, 0).slice(0, -1))).length,
      pending: pending.filter(p => p.up.repo === s.repo).length,
      different: Object.entries(state.judged).filter(([k, j]) => (j.verdict === "different") && k.includes(`=${refOf(s.repo, 0).slice(0, -1)}`)).length,
      newToUs: newToUs.filter(u => u.repo === s.repo).length };
  });

  // 8. Write: VERSIONS.md, state, STATUS.md, LOG.md, and a digest on a day with something to act on.
  writeFileSync(VERSIONS, withLatest(versionsText, vrows, today));
  state.lastScan = today;
  saveState(state);

  const pairLine = p => `- ${fmtUp(p.up)}\n  → our #${p.ours.number} ${p.ours.title}\n  (matched on ${p.on}${p.retitled ? "; judged before, but the upstream title has changed" : ""})`;
  const due = newer.length ? newer.map(r => `${r.name} ${r.reviewed} → **${r.latest}** (first seen ${r.firstSeen && !r.newSinceLastRun ? r.firstSeen : today})`).join("; ") : "none";

  const status = [];
  status.push("# Upstream watch", "");
  status.push(`What the daily watch (\`node tools/upstream-watch.mjs\`) found at its last run, ${today}. Versions are tracked in`,
    "[VERSIONS.md](../VERSIONS.md); every run adds a row to [LOG.md](LOG.md); a dated digest (`YYYY-MM-DD.md`) is written only on",
    "a day with something to act on, and the verdicts on its pairs are the run notes under it.", "");
  status.push("| | |", "| --- | --- |");
  status.push(`| **Version reviews due** | ${due} |`);
  status.push(`| **To judge** | ${toJudge.length} same-document pair(s), ${possible.length} possible |`);
  status.push(`| **Cited upstream reports now closed** | ${closedCited.length} |`);
  status.push(`| **New to us** | ${newToUs.length} open report(s), ${newToday.length} first seen today |`, "");
  status.push("## To judge", "");
  status.push("Each upstream report names a document one of our open issues is about. The same document is not necessarily the same bug:",
    "record a pair that is with `node tools/upstream-watch.mjs --record <ours>=<upstream>`, dismiss one that isn't with `--different`.", "");
  status.push(toJudge.length ? toJudge.map(pairLine).join("\n") : "None.", "");
  status.push("### Possible (a name in the body only)", "");
  status.push(possible.length ? possible.map(pairLine).join("\n") : "None.", "");
  status.push("## Cited upstream reports now closed", "");
  status.push("Our open issues cite these, and the vendor has closed them: re-check each at the next version review of its package.", "");
  status.push("| Report | Closed | Our issue |", "| --- | --- | --- |");
  for ( const [ref, c] of closedCited ) status.push(`| \`${ref}\` ${c.title.replace(/\|/g, "/")} | ${c.closedAt ?? "?"}${c.reason ? ` (${c.reason})` : ""} | ${c.ours.map(n => `#${n}`).join(", ")} |`);
  if ( !closedCited.length ) status.push("| none | | |");
  status.push("", "## New to us", "");
  status.push("Open upstream bug reports on our packages' data that match none of our issues, newest first. Each is validated and",
    "tested on the sandbox, and filed as an issue of ours if it reproduces; the watch itself files none.", "");
  status.push("| First seen | Report | Package |", "| --- | --- | --- |");
  for ( const u of newToUs ) status.push(`| ${u.firstSeen} | \`${u.ref}\` [${u.title.replace(/\|/g, "/")}](${u.url}) | ${upstreamPackage(u, u.repo).id} |`);
  if ( !newToUs.length ) status.push("| none | | |");
  status.push("", "## Sources", "");
  status.push("| Upstream repo | Open bug reports on our packages | Cited by our issues | Pairs to judge | Judged different | New to us |", "| --- | --- | --- | --- | --- | --- |");
  for ( const s of sources ) status.push(`| ${s.repo} | ${s.open} | ${s.cited} | ${s.pending} | ${s.different} | ${s.newToUs} |`);
  status.push("");
  writeFileSync(STATUS, status.join("\n"));

  const signal = newer.some(r => r.newSinceLastRun) || pending.length || newlyClosed.length || newToday.length;
  const digest = join(WATCH, `${today}.md`);
  const logRow = `| ${today} | ${newer.length ? newer.map(r => `${r.name} ${r.latest}`).join("; ") : "none"} | ${toJudge.length} + ${possible.length} | ${newlyClosed.length} | ${newToday.length} | ${signal ? `[yes](${today}.md)` : "no"} |`;
  let log;
  try { log = readFileSync(LOG, "utf8").split(/\r?\n/).filter(l => !l.startsWith(`| ${today} |`)); }
  catch { log = ["# Upstream watch log", "", "One row per run of `node tools/upstream-watch.mjs`, oldest first; a rerun on the same day replaces the day's row.",
    "", "| Run | Versions newer than reviewed | To judge (same document + possible) | Cited reports newly closed | New to us today | Digest |", "| --- | --- | --- | --- | --- | --- |"]; }
  while ( log.length && !log.at(-1).trim() ) log.pop();
  writeFileSync(LOG, `${[...log, logRow].join("\n")}\n`);

  if ( signal ) {
    const md = [];
    md.push(`# Upstream watch, ${today}`, "");
    md.push(`Scanned: every open report on our packages in ${SOURCES.map(s => s.repo).join(" and ")}, and every report changed since ${lastScan ? `the last scan (${lastScan})` : "ever"}. `
      + `${pending.length} pair(s) to judge, ${judged} judged before. The standing picture is [STATUS.md](STATUS.md).`, "");
    md.push("## New versions", "");
    md.push(newer.length ? `**Newer than the version last reviewed (VERSIONS.md):** ${due}. Each needs a version review.` : "Nothing newer than the versions last reviewed.", "");
    if ( newer.length ) {
      md.push("| Package | Reviewed | Latest | Notes |", "| --- | --- | --- | --- |");
      for ( const r of newer ) md.push(`| ${r.name} (\`${r.id}\`) | ${r.reviewed} | **${r.latest}** | ${[r.notes, r.extra].filter(Boolean).join("; ")} |`);
      md.push("");
    }
    md.push("## Same document upstream: is it the same bug?", "");
    md.push(toJudge.length ? "Record the pairs that are with `node tools/upstream-watch.mjs --record <ours>=<upstream>`; dismiss the others with `--different`.\n\n"
      + toJudge.map(pairLine).join("\n") : "None.", "");
    md.push("## Possible (a name in the body only)", "");
    md.push(possible.length ? possible.map(pairLine).join("\n") : "None.", "");
    md.push("## Cited upstream reports closed since the last scan", "");
    md.push(newlyClosed.length ? newlyClosed.map(([ref, c]) => `- \`${ref}\` [closed${c.reason ? `, ${c.reason}` : ""} ${c.closedAt ?? ""}] ${c.title} → our ${c.ours.map(n => `#${n}`).join(", ")}`).join("\n") : "None.", "");
    md.push("## New to us (first seen today)", "");
    md.push(newToday.length ? newToday.map(u => `- ${fmtUp(u)}`).join("\n") : "None.", "");
    // A rerun the same day keeps the run notes already written under today's digest.
    let notes = "";
    try { notes = readFileSync(digest, "utf8").split(/^(?=## Run notes)/m)[1] ?? ""; } catch {}
    writeFileSync(digest, `${md.join("\n")}\n${notes ? `\n${notes.trimEnd()}\n` : ""}`);
  }

  if ( args.includes("--notify") ) await notify(vrows);

  const summary = { digest: signal ? digest : null, status: STATUS, newVersions: newer.map(r => `${r.id} ${r.reviewed} -> ${r.latest}`),
    toJudge: toJudge.length, possible: possible.length, judgedBefore: judged, newlyClosed: newlyClosed.length, newToday: newToday.length,
    newToUs: newToUs.length, closedCited: closedCited.length };
  if ( args.includes("--json") ) console.log(JSON.stringify(summary, null, 2));
  else console.log(`${status.join("\n")}\n[upstream-watch] ${signal ? `digest: ${digest}` : "no digest today (nothing to act on)"}`);
}

/* -------------------------------------------- */

const at = name => args.indexOf(name);
const pairsAfter = i => args.slice(i + 1).filter(a => !a.startsWith("--"));
try {
  if ( at("--record") >= 0 ) await judge(pairsAfter(at("--record")), "same");
  else if ( at("--different") >= 0 ) await judge(pairsAfter(at("--different")), "different");
  else await scan();
} catch(err) {
  console.error(`upstream-watch: ${err.message}`);
  process.exit(1);
}
