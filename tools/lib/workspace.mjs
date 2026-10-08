/**
 * Where things are, wherever this checkout lives, a git worktree included: the main checkout, the
 * fvtt-mcp-dnd5e repo (the Foundry client, the .env, the sandbox scripts) and the vendor snapshots.
 * A fresh worktree has no node_modules and sits somewhere else, so nothing here assumes either.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** This checkout's root. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The main checkout: a worktree's git common dir is the main repo's `.git`. */
export function mainRoot() {
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim();
    return dirname(resolve(ROOT, common));
  } catch { return ROOT; }
}

/** The fvtt-mcp-dnd5e repo: the installed devDependency, else the sibling of the main checkout. */
export function mcpRoot() {
  const main = mainRoot();
  for ( const dir of [join(ROOT, "node_modules", "fvtt-mcp-dnd5e"), join(main, "node_modules", "fvtt-mcp-dnd5e"), join(main, "..", "fvtt-mcp-dnd5e")] ) {
    if ( existsSync(join(dir, "dist", "client.js")) ) return dir;
  }
  throw new Error("fvtt-mcp-dnd5e not found: run npm install, or keep ../fvtt-mcp-dnd5e (built) next to this repo");
}

/** A module of the MCP repo's build: `importMcp("client")`, `importMcp("env")`. */
export const importMcp = name => import(pathToFileURL(join(mcpRoot(), "dist", `${name}.js`)).href);

/** The sandbox script `local-foundry.mjs`. */
export const localFoundry = () => join(mcpRoot(), "scripts", "local-foundry.mjs");

/**
 * Vendor snapshots: ERRATA_SNAPSHOT_DIR, else `vendor-snapshots` three levels above the MAIN checkout (the folder above the suite)
 * (a vendor-snapshots folder beside the repo parent). Never inside a repo: premium data is never committed.
 */
export function snapshotDir() {
  const dir = resolve(process.env.ERRATA_SNAPSHOT_DIR ?? join(mainRoot(), "..", "..", "..", "vendor-snapshots"));
  for ( const repo of new Set([ROOT, mainRoot()]) ) {
    const rel = relative(repo, dir);
    if ( !rel || (!rel.startsWith("..") && !isAbsolute(rel)) ) throw new Error(`snapshot dir ${dir} is inside ${repo}: premium data must never be committed`);
  }
  return dir;
}
