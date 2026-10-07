// Servidor estático local (desenvolvimento e testes E2E), sem dependências.
// Uso: node scripts/serve.mjs [--root .] [--port 8080] [--data-dir tests/fixtures]
//   --data-dir  serve /data/config.json, ccts.json e municipios.json a partir de outra pasta
//               (os testes usam os dados fictícios de tests/fixtures).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const root = resolve(arg("--root", "."));
const dataDir = arg("--data-dir") ? resolve(arg("--data-dir")) : null;
const port = Number(arg("--port", process.env.PORT || 8080));
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};
const OVERRIDE = new Set(["config.json", "ccts.json", "municipios.json"]);

function inside(base, p) { return p === base || p.startsWith(base + sep); }

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.endsWith("/")) path += "index.html";
  const rel = normalize(path).replace(/^([\\/])+/, "");
  const name = rel.split(/[\\/]/).pop();
  const base = dataDir && /^data[\\/]/.test(rel) && OVERRIDE.has(name) ? dataDir : root;
  const file = base === dataDir ? join(dataDir, name) : join(root, rel);
  if (!inside(base, resolve(file))) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    if (rel === "version.json") { res.writeHead(200, { "content-type": TYPES[".json"], "cache-control": "no-store" }).end('{"version":"dev-local"}\n'); return; }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("não encontrado");
  }
}).listen(port, () => console.log(`http://localhost:${port}  (raiz: ${root}${dataDir ? `, dados: ${dataDir}` : ""})`));
