/**
 * The upstream packages this module tracks, where their vendors take bug reports, and the pure
 * helpers that match an upstream report to one of our issues. No I/O: the watch
 * (tools/upstream-watch.mjs) and the register check (tools/check-register.mjs) both import this,
 * so the list of packages lives in exactly one place.
 */

/** Our repo. */
export const OURS = "Txpple/fvtt-mod-errata5e";

/**
 * The packages we track, in VERSIONS.md order.
 *   id         Foundry package id (VERSIONS.md's Package column)
 *   name       VERSIONS.md's Name column
 *   label      the label our issues on it carry
 *   repo       the upstream repo its bug reports go to (none for Foundry itself)
 *   repoLabel  (dnd5e) the upstream label marking a report on its 2024 SRD packs
 *   names      (books) the names the premium-content form uses for it
 */
export const PACKAGES = [
  { id: "foundry", name: "Foundry VTT" },
  { id: "dnd5e", name: "dnd5e system", label: "book: SRD 2024", repo: "foundryvtt/dnd5e", repoLabel: "compendium content: 2024" },
  { id: "dnd-players-handbook", name: "Player's Handbook (2024)", label: "book: PHB 2024", repo: "foundryvtt/foundryvtt-premium-content", names: ["Player's Handbook"] },
  { id: "dnd-dungeon-masters-guide", name: "Dungeon Master's Guide (2024)", label: "book: DMG 2024", repo: "foundryvtt/foundryvtt-premium-content", names: ["Dungeon Master's Guide"] },
  { id: "dnd-monster-manual", name: "Monster Manual (2024)", label: "book: MM 2024", repo: "foundryvtt/foundryvtt-premium-content", names: ["Monster Manual"] },
  { id: "dnd-heroes-faerun", name: "Forgotten Realms: Heroes of Faerûn", label: "book: Heroes of Faerûn", repo: "foundryvtt/foundryvtt-premium-content", names: ["Heroes of Faerûn", "Heroes of Faerun"] },
  { id: "dnd-arcana-unleashed", name: "Arcana Unleashed", label: "book: Arcana Unleashed", repo: "foundryvtt/foundryvtt-premium-content", names: ["Arcana Unleashed"] },
  { id: "dnd-ravenloft-horrors-within", name: "Ravenloft: The Horrors Within", label: "book: Ravenloft", repo: "foundryvtt/foundryvtt-premium-content", names: ["Ravenloft"] }
];

/** The premium books. */
export const BOOKS = PACKAGES.filter(p => p.names);

/** The upstream repos, each with the packages whose reports it takes. */
export const SOURCES = [...new Set(PACKAGES.map(p => p.repo).filter(Boolean))]
  .map(repo => ({ repo, short: repo.split("/").pop().replace(/^foundryvtt-/, ""), packages: PACKAGES.filter(p => p.repo === repo) }));

/** The short name a reference uses for a repo: `premium-content`, `dnd5e`. */
export const shortOf = repo => SOURCES.find(s => s.repo === repo)?.short ?? repo;

/** Lower-case, plain apostrophes, no accents: so "Faerûn’s" and "Faerun's" compare equal. */
export const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[‘’]/g, "'").toLowerCase();

/** Compare dotted versions numerically: 14.368 > 14.99, 2.10.0 > 2.9.1. */
export function cmpVersion(a, b) {
  const pa = String(a).split(/[.\-]/).map(Number), pb = String(b).split(/[.\-]/).map(Number);
  for ( let i = 0; i < Math.max(pa.length, pb.length); i++ ) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if ( d ) return Math.sign(d);
  }
  return 0;
}

/* -------------------------------------------- */
/*  Our issues                                  */
/* -------------------------------------------- */

const GENERIC = new Set(["spells journal", "premade characters", "bestiary", "bestiary loose ends", "seven vehicles"]);

/**
 * The document names and ids an issue of ours is about, from its title
 * ("Book — Name, Name (id): summary") and the Compendium UUIDs in its body.
 */
export function subjectsOf(title, body = "") {
  // Drop the book (which may hold a colon: "Ravenloft: The Horrors Within"), then the summary.
  const afterBook = String(title).split(" — ").slice(1).join(" — ");
  const parts = afterBook.split(/:\s/)[0].split(" — ");
  const names = new Set(), ids = new Set();
  for ( let part of parts ) {
    const id = part.match(/\(([A-Za-z0-9]{16})\)\s*$/);
    if ( id ) ids.add(id[1]);
    part = part.replace(/\([^)]*\)/g, " ");                        // ids, "(Arcane Shot)", "(seven stat blocks)"
    for ( const n of part.split(/,\s*|\s+and\s+/) ) {
      const name = n.replace(/\s+/g, " ").trim();
      if ( (name.length >= 4) && !GENERIC.has(norm(name)) && !/^\d/.test(name) && !name.includes(".") ) names.add(name);
    }
  }
  for ( const m of String(body).matchAll(/Compendium\.[\w-]+\.[\w-]+\.(?:Item|Actor|JournalEntry|RollTable)\.([A-Za-z0-9]{16})/g) ) ids.add(m[1]);
  return { names: [...names], ids: [...ids] };
}

/** Our issue's Upstream header row, or "" if it has none. */
export const upstreamRow = body => String(body ?? "").split("\n").find(l => /^\|\s*\*\*Upstream\*\*\s*\|/.test(l)) ?? "";

/**
 * The upstream reports our issue's Upstream row cites, as `{ repo, n }`. Only that row counts:
 * issue bodies quote other reports as examples elsewhere. A bare `#n` counts when the row names
 * exactly one upstream repo.
 */
export function citations(body) {
  const row = upstreamRow(body);
  const out = new Map();
  const add = (repo, n) => out.set(`${repo}#${n}`, { repo, n: Number(n) });
  for ( const s of SOURCES ) {
    const owner = s.repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), short = s.short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for ( const m of row.matchAll(new RegExp(`${owner}(?:/issues/|#)(\\d+)`, "g")) ) add(s.repo, m[1]);
    for ( const m of row.matchAll(new RegExp(`(?:^|[^-\\w/])${short}#(\\d+)`, "g")) ) add(s.repo, m[1]);
    // the code form our issues use (refOf): `foundryvtt-premium-content#1730`, `foundryvtt/dnd5e#7251`
    const ref = refOf(s.repo, 0).slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for ( const m of row.matchAll(new RegExp(`(?:^|[^-\\w/])${ref}#(\\d+)`, "g")) ) add(s.repo, m[1]);
  }
  const named = SOURCES.filter(s => row.includes(s.short) || row.includes(s.repo));
  if ( named.length === 1 ) for ( const m of row.matchAll(/(?:^|[^-\w#])#(\d+)(?!\d)/g) ) add(named[0].repo, m[1]);
  return [...out.values()];
}

/** Does our issue's Upstream row cite this upstream report? */
export const cites = (body, repo, n) => citations(body).some(c => (c.repo === repo) && (c.n === Number(n)));

/* -------------------------------------------- */
/*  Upstream reports                            */
/* -------------------------------------------- */

const labelsOf = issue => (issue.labels ?? []).map(l => l.name ?? l);

/** A feature request upstream: counted, never matched. */
export const isFeature = up => /^\[feature/i.test(up.title) || labelsOf(up).some(l => /^feature/i.test(l));

/**
 * The tracked package an upstream report is about, or null. Premium-content: its package label,
 * else the form's package answer. dnd5e: every report is the system's.
 */
export function upstreamPackage(issue, repo) {
  const source = SOURCES.find(s => s.repo === repo);
  if ( !source ) return null;
  if ( source.packages.length === 1 ) return source.packages[0];
  const labels = labelsOf(issue);
  const byLabel = source.packages.find(p => labels.includes(p.id));
  if ( byLabel ) return byLabel;
  // Labelled with a package we don't track (dnd-deadfall's form answer names "Arcana Unleashed").
  if ( labels.some(l => l.startsWith("dnd-")) ) return null;
  const answer = String(issue.body ?? "").match(/What package are you reporting this for\?\s*\n+([^\n]+)/)?.[1] ?? "";
  return source.packages.find(p => (p.names ?? []).some(n => norm(answer).includes(norm(n)))) ?? null;
}

/** Is an upstream report one that could be "new to us": a bug on the package's data? dnd5e needs its SRD label. */
export function onOurData(issue, repo) {
  const pkg = upstreamPackage(issue, repo);
  if ( !pkg || isFeature(issue) ) return false;
  return !pkg.repoLabel || labelsOf(issue).includes(pkg.repoLabel);
}

const phrase = name => new RegExp(`(^|[^a-z0-9])${norm(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);

/**
 * Match one upstream report against our open issues on the same package.
 * Strong: one of our document ids appears in it, or one of our names appears in its title.
 * Weak: a name of two or more words appears only in its body.
 */
export function matchUpstream(up, repo, ours) {
  const pkg = upstreamPackage(up, repo);
  if ( !pkg ) return [];
  // dnd5e's repo is the system's: only a report its triage has put on the SRD packs names a document of ours.
  if ( pkg.repoLabel && !labelsOf(up).includes(pkg.repoLabel) ) return [];
  const t = norm(up.title), b = norm(up.body);
  const found = [];
  for ( const o of ours ) {
    if ( !o.labels.includes(pkg.label) ) continue;
    const idHit = o.subjects.ids.find(id => String(up.body ?? "").includes(id) || String(up.title).includes(id));
    const titleHit = o.subjects.names.find(n => phrase(n).test(t));
    const bodyHit = !titleHit && o.subjects.names.find(n => (n.split(" ").length >= 2) && phrase(n).test(b));
    if ( idHit || titleHit ) found.push({ ours: o, strength: "strong", on: idHit ? `id ${idHit}` : `"${titleHit}" in the title` });
    else if ( bodyHit ) found.push({ ours: o, strength: "weak", on: `"${bodyHit}" in the body` });
  }
  return found;
}

/**
 * The reference to an upstream report as our issues and the register write it:
 * `foundryvtt-premium-content#1794`, `foundryvtt/dnd5e#1234`. In code in an issue, or in a file,
 * GitHub makes no link of it and nothing appears upstream.
 */
export const refOf = (repo, n) => `${repo.replace(/^foundryvtt\/(foundryvtt-)/, "$1")}#${n}`;

/** The quiet reference: code, so GitHub makes no link and posts nothing upstream. */
export const quietRef = (up, repo) => `\`${refOf(repo, up.number)}\` (${up.state.toLowerCase()}; "${up.title.replace(/^\[(Bug|Feature)\]:\s*/i, "").replace(/[|`]/g, "")}")`;

/** Our issue body with the reference added to the Upstream header row, or null if it has none. */
export function withUpstreamRef(body, up, repo, today) {
  const lines = String(body).split("\n");
  const i = lines.findIndex(l => /^\|\s*\*\*Upstream\*\*\s*\|/.test(l));
  if ( i < 0 ) return null;
  const cell = lines[i].replace(/^\|\s*\*\*Upstream\*\*\s*\|\s*/, "").replace(/\s*\|\s*$/, "");
  const note = `Reported upstream as ${quietRef(up, repo)}, found ${today}.`;
  const next = /^not reported\b/i.test(cell) ? note : `${cell} Also reported upstream as ${quietRef(up, repo)}, found ${today}.`;
  lines[i] = `| **Upstream** | ${next} |`;
  return lines.join("\n");
}

/* -------------------------------------------- */
/*  VERSIONS.md                                 */
/* -------------------------------------------- */

/** VERSIONS.md's table, by package id: { name, reviewed, reviewedOn, latest, firstSeen }. */
export function parseVersions(text) {
  const block = String(text).split("<!-- versions:start -->")[1]?.split("<!-- versions:end -->")[0];
  if ( !block ) throw new Error("VERSIONS.md: no <!-- versions:start --> … <!-- versions:end --> table");
  const out = {};
  for ( const line of block.split(/\r?\n/).filter(l => /^\|/.test(l)).slice(2) ) {
    const [id, name, reviewed, reviewedOn, latest, firstSeen] = line.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    out[id] = { name, reviewed, reviewedOn, latest, firstSeen };
  }
  return out;
}

/** VERSIONS.md with each row's Latest published and First seen set from the watch's rows. */
export function withLatest(text, rows, today) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return text.split(/\r?\n/).map(line => {
    const cells = line.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    const r = /^\|/.test(line) && rows.find(r => r.id === cells[0]);
    if ( !r?.latest || (r.latest === cells[4]) ) return line;
    cells[4] = r.latest;
    cells[5] = today;
    return `| ${cells.join(" | ")} |`;
  }).join(eol);
}
