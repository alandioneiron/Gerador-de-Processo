// Monta o site estático em dist/ (o que vai para o GitHub Pages).
// Uso: node scripts/build.mjs [--version v1.2.3]
// Sem --version usa GITHUB_REF_NAME (tag da release no Actions) ou "dev".
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const version = arg("--version") || process.env.RELEASE_TAG || "dev";
let commit = process.env.GITHUB_SHA || "";
if (!commit) try { commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { commit = ""; }

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const p of ["index.html", "js", "assets", "data"]) cpSync(p, `dist/${p}`, { recursive: true });
writeFileSync("dist/version.json", JSON.stringify({ version, commit: commit.slice(0, 12), built_at: new Date().toISOString() }, null, 2) + "\n");
writeFileSync("dist/.nojekyll", "");
console.log(`dist/ pronto (versão ${version}${commit ? ", commit " + commit.slice(0, 7) : ""})`);
