/**
 * GitHub's REST API for the tools that read or edit our issues: a token if one is to hand, one
 * call, and every issue or comment of a repo. Shared by the upstream watch and the issue check.
 */
import { execFileSync } from "node:child_process";

/** A GitHub token if one is to hand: GH_TOKEN, GITHUB_TOKEN, or `gh auth token`; null without. */
export const TOKEN = (() => {
  if ( process.env.GH_TOKEN || process.env.GITHUB_TOKEN ) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  try { return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; }
  catch { return null; }
})();

/** One GitHub REST call; `path` is relative to the API root. */
export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.github.com/${path}`, { method,
    headers: { "accept": "application/vnd.github+json", "user-agent": "fvtt-mod-errata5e tools",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  if ( !res.ok ) throw new Error(`GitHub ${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** The fields the tools use of an issue. */
export const shape = i => ({ number: i.number, title: i.title, body: i.body ?? "", state: i.state.toUpperCase(),
  stateReason: i.state_reason?.toUpperCase() ?? null, labels: i.labels.map(l => l.name ?? l), url: i.html_url,
  updatedAt: i.updated_at, closedAt: i.closed_at ?? null, comments: i.comments ?? 0 });

/** Every page of a list endpoint. */
async function pages(path) {
  const out = [];
  for ( let page = 1; ; page++ ) {
    const batch = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    out.push(...batch);
    if ( batch.length < 100 ) return out;
  }
}

/** Every issue (not pull request) of a repo matching the query. */
export async function issues(repo, query) {
  return (await pages(`repos/${repo}/issues?${query}`)).filter(i => !i.pull_request).map(shape);
}

/** Every issue comment of a repo, by issue number: { [n]: [{ body, createdAt }] }, oldest first. */
export async function commentsByIssue(repo) {
  const out = {};
  for ( const c of await pages(`repos/${repo}/issues/comments?sort=created&direction=asc`) ) {
    const n = Number(c.issue_url.split("/").pop());
    (out[n] ??= []).push({ body: c.body ?? "", createdAt: c.created_at });
  }
  return out;
}
