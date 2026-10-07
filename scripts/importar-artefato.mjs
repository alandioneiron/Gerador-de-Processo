// Importa uma versão nova do artefato original do Claude (mantido pelo C.O) para este repositório.
// Uso: node scripts/importar-artefato.mjs <pasta> [--versao <id>] [--tudo]
//   <pasta>    arquivos publicados do artefato (index.html, calc.js, modelo.js, tpl.js,
//              cadastro.json, NOTAS-DA-VERSAO.md), baixados pelo Claude Code com a ferramenta Artifact
//   --versao   id da versão do artefato (aparece na leitura do artefato), gravado em upstream/artefato.json
//   --tudo     reprocessa todos os arquivos, mesmo os que não mudaram
// O que é mecânico vai direto para o lugar certo:
//   calc.js → js/calc.js;  modelo.js → assets/modelo-proposta.docx (higienizado);
//   tpl.js → assets/modelo-proposta.pdf;  cadastro.json → data/config.json, ccts.json, municipios.json
// O index.html do artefato NÃO é copiado: o site tem sua própria versão (js/app.js + index.html, sem o
// runtime do Claude). Ele é guardado em upstream/index.html, e o `git diff upstream/` mostra o que portar.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { validateData } from "./validate-data.mjs";

const CONHECIDOS = ["index.html", "calc.js", "modelo.js", "tpl.js", "cadastro.json", "NOTAS-DA-VERSAO.md"];
const MK_CLI = "Cliente: {{CLIENTE}}", MK_DATA = "{{DATA_EXTENSO}}";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const pasta = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--versao");
const tudo = args.includes("--tudo");
if (!pasta || !existsSync(pasta)) { console.error("Uso: node scripts/importar-artefato.mjs <pasta> [--versao <id>] [--tudo]"); process.exit(1); }

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const base = JSON.parse(readFileSync("upstream/artefato.json", "utf8"));
const ler = (f) => readFileSync(join(pasta, f));
const fazer = [], avisos = [], novo = {};

for (const f of readdirSync(pasta)) if (!CONHECIDOS.includes(f)) avisos.push(`Arquivo novo no artefato: ${f}. Revise à mão se o site precisa dele.`);
for (const f of CONHECIDOS) {
  if (!existsSync(join(pasta, f))) { if (base.arquivos[f]) novo[f] = base.arquivos[f]; continue; }
  novo[f] = sha(ler(f));
  if (tudo || novo[f] !== base.arquivos[f]) fazer.push(f);
}
console.log(fazer.length ? `Mudaram: ${fazer.join(", ")}` : "Nenhum arquivo mudou desde a última sincronização.");

/* Base64 de window.NOME="..." (formato do modelo.js e do tpl.js do artefato). */
function base64De(arquivo, nome) {
  const m = ler(arquivo).toString("utf8").match(new RegExp(`window\\.${nome}\\s*=\\s*"([A-Za-z0-9+/=]+)"`));
  if (!m) throw new Error(`${arquivo}: não achei window.${nome}="..."`);
  return Buffer.from(m[1], "base64");
}

/* O artefato confere o modelo com x.indexOf("Cliente: <exemplo>") e x.indexOf("<data por extenso>.").
   Essas duas frases (dados do exemplo) viram os marcadores do site, e a 1ª tabela (preços do exemplo) vira um
   espaço reservado, que o site substitui pela tabela calculada. */
async function higienizarDocx(buf, indexHtml) {
  const cli = indexHtml.match(/indexOf\("(Cliente: [^"]+)"\)\s*<\s*0/);
  const data = indexHtml.match(/indexOf\("(\d{1,2} de [^"]+ de \d{4}\.)"\)\s*<\s*0/);
  if (!cli || !data) throw new Error("index.html do artefato não traz mais a conferência do modelo (indexOf do cliente e da data). Ajuste higienizarDocx.");
  const zip = await JSZip.loadAsync(buf);
  let x = await zip.file("word/document.xml").async("string");
  if (!x.includes(cli[1]) || !x.includes(data[1])) throw new Error(`modelo.docx não contém "${cli[1]}" e "${data[1]}"`);
  x = x.split(cli[1]).join(MK_CLI).split(data[1]).join(MK_DATA);
  const t0 = x.indexOf("<w:tbl>"), t1 = x.indexOf("</w:tbl>") + 8;
  if (t0 < 0) throw new Error("modelo.docx sem tabela de preços");
  x = x.slice(0, t0) + '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid><w:gridCol w:w="9067"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="5000" w:type="pct"/></w:tcPr><w:p><w:r><w:t>{{TABELA_DE_PRECOS}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' + x.slice(t1);
  zip.file("word/document.xml", x);
  const core = zip.file("docProps/core.xml");
  if (core) zip.file("docProps/core.xml", (await core.async("string"))
    .replace(/<dc:creator>.*?<\/dc:creator>/, "<dc:creator>Neoguard</dc:creator>")
    .replace(/<cp:lastModifiedBy>.*?<\/cp:lastModifiedBy>/, "<cp:lastModifiedBy>Neoguard</cp:lastModifiedBy>"));
  const nome = cli[1].replace(/^Cliente: /, "");
  return { buf: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), exemplo: nome };
}

/* A cópia em upstream/ vai para um repositório público: tira o cliente de exemplo (nome real) e os nomes de
   pessoas usados como exemplo nos campos. O hash em artefato.json continua sendo o do arquivo original. */
function redigirIndex(html) {
  const cli = html.match(/indexOf\("Cliente: ([^"]+)"\)/);
  let out = cli ? html.split(cli[1]).join("{{CLIENTE_EXEMPLO}}") : html;
  return out.replace(/(placeholder="Ex\.: )Sra?\.\s[^"]+"/g, '$1Sra. Fulana de Tal"');
}

const json = (v) => JSON.stringify(v, null, 2) + "\n";
const indexHtml = existsSync(join(pasta, "index.html")) ? ler("index.html").toString("utf8") : readFileSync("upstream/index.html", "utf8");

if (fazer.includes("calc.js")) {
  const c = ler("calc.js").toString("utf8");
  if (!/module\.exports\s*=\s*NG/.test(c)) avisos.push("calc.js sem `module.exports = NG`: os testes unitários não vão conseguir carregá-lo.");
  copyFileSync(join(pasta, "calc.js"), "js/calc.js");
  copyFileSync(join(pasta, "calc.js"), "upstream/calc.js");
  console.log("✓ js/calc.js atualizado (rode npm test: os casos de referência podem precisar de conta nova)");
}
if (fazer.includes("modelo.js")) {
  const { buf, exemplo } = await higienizarDocx(base64De("modelo.js", "MODELO_B64"), indexHtml);
  writeFileSync("assets/modelo-proposta.docx", buf);
  console.log(`✓ assets/modelo-proposta.docx atualizado (cliente de exemplo "${exemplo}" e tabela de preços removidos)`);
  avisos.push(`Confira se o modelo DOCX novo não tem outros dados do cliente de exemplo "${exemplo}" além da capa e da tabela.`);
}
if (fazer.includes("tpl.js")) {
  const buf = base64De("tpl.js", "TPL_PDF_B64");
  const paginas = (await PDFDocument.load(buf)).getPageCount();
  writeFileSync("assets/modelo-proposta.pdf", buf);
  console.log(`✓ assets/modelo-proposta.pdf atualizado (${paginas} páginas)`);
  if (paginas !== 12) avisos.push(`O PDF novo tem ${paginas} páginas; js/app.js usa as páginas 0 a 11. Revise buildPdf e tests/unit/modelos.test.mjs.`);
  avisos.push("Abra o PDF novo e confira que a capa, a tabela e a data estão em branco (o site desenha esses campos por cima).");
}
if (fazer.includes("cadastro.json")) {
  const c = JSON.parse(ler("cadastro.json").toString("utf8"));
  const dados = { config: c.config ?? null, ccts: c.ccts ?? {}, municipios: c.municipios ?? {} };
  writeFileSync("data/config.json", json(dados.config));
  writeFileSync("data/ccts.json", json(dados.ccts));
  writeFileSync("data/municipios.json", json(dados.municipios));
  const r = validateData(dados, { strict: true });
  console.log(`✓ data/*.json atualizados: ${Object.keys(dados.ccts).length} CCT(s), ${Object.keys(dados.municipios).length} município(s); validação: ${r.errors.length} erro(s), ${r.warnings.length} aviso(s)`);
  for (const e of r.errors) avisos.push(`Cadastro: ${e}`);
  for (const w of r.warnings) console.log(`  aviso: ${w}`);
}
if (fazer.includes("index.html")) {
  writeFileSync("upstream/index.html", redigirIndex(indexHtml));
  avisos.push("index.html do artefato mudou: rode `git diff upstream/index.html` e porte as mudanças para index.html e js/app.js (o site não usa window.claude).");
}
if (fazer.includes("NOTAS-DA-VERSAO.md")) copyFileSync(join(pasta, "NOTAS-DA-VERSAO.md"), "upstream/NOTAS-DA-VERSAO.md");

writeFileSync("upstream/artefato.json", json({ ...base, versao: opt("--versao") || base.versao, sincronizado_em: new Date().toISOString().slice(0, 10), arquivos: novo }));
if (avisos.length) { console.log("\nFalta fazer / conferir:"); for (const a of avisos) console.log(`- ${a}`); }
console.log("\nDepois: npm test && npm run test:e2e, atualize o CHANGELOG e abra o PR sync/artefato-<versão>.");
