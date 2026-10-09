// Testes do importador do artefato (scripts/importar-artefato.mjs).
// Cada teste roda o script real, com cwd em uma cópia temporária do repositório e um artefato fictício.
// Nada do repositório real é alterado: o script só grava relativo ao cwd, e as pastas temporárias saem no `after`.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = join(REPO, "scripts", "importar-artefato.mjs");
const CONHECIDOS = ["index.html", "calc.js", "modelo.js", "tpl.js", "cadastro.json", "NOTAS-DA-VERSAO.md"];
const DADOS = ["config.json", "ccts.json", "municipios.json"];

const lerEm = (base, rel, enc) => readFileSync(join(base, rel), enc);
const lerRepo = (rel) => lerEm(REPO, rel);
const fixture = (nome) => JSON.parse(readFileSync(join(REPO, "tests", "fixtures", nome), "utf8"));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const temporarios = [];
function pastaTemporaria(prefixo) {
  const d = mkdtempSync(join(tmpdir(), prefixo));
  temporarios.push(d);
  return d;
}
after(() => {
  for (const d of temporarios) rmSync(d, { recursive: true, force: true });
});

// Mesmo formato do index.html do artefato: as duas conferências que o importador lê.
const INDEX_PADRAO = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Artefato de teste</title></head>
<body>
<input placeholder="Ex.: Sra. Maria Teste">
<script>
function conferir(x){ if(x.indexOf("Cliente: Condomínio Exemplo Teste")<0||x.indexOf("1 de janeiro de 2026.")<0) throw new Error("modelo"); }
</script>
</body>
</html>
`;

const municipioPadrao = () => ({ ...fixture("municipios.json")["cidade-teste-sp"], cct: "CCT Limpeza SP/2026" });

function cadastroFicticio(municipios = { "Cidade Teste-SP": municipioPadrao() }) {
  return {
    config: fixture("config.json"),
    ccts: { "CCT Limpeza SP/2026": fixture("ccts.json")["teste-limpeza-2026"] },
    municipios,
  };
}

// modelo.js com o DOCX real trocado pelos dados de exemplo (cliente, data e preço), como no artefato original.
async function docxFicticio() {
  const zip = await JSZip.loadAsync(lerRepo("assets/modelo-proposta.docx"));
  let xml = await zip.file("word/document.xml").async("string");
  xml = xml.replaceAll("Cliente: {{CLIENTE}}", "Cliente: Condomínio Exemplo Teste")
    .replaceAll("{{DATA_EXTENSO}}", "1 de janeiro de 2026.")
    .replaceAll("{{TABELA_DE_PRECOS}}", "R$ 9.999,00");
  assert.ok(xml.includes("Condomínio Exemplo Teste") && xml.includes("R$ 9.999,00"), "fixture do DOCX não foi montada");
  zip.file("word/document.xml", xml);
  return (await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })).toString("base64");
}

async function artefatoFicticio({ index = INDEX_PADRAO, cadastro = cadastroFicticio() } = {}) {
  const art = pastaTemporaria("importador-artefato-");
  // Cópia de js/calc.js com uma linha a mais: o importador compara o hash com upstream/artefato.json, e uma cópia
  // idêntica não seria "mudança". module.exports = NG continua lá (o importador confere).
  writeFileSync(join(art, "calc.js"), lerRepo("js/calc.js").toString("utf8") + "\n// Versão fictícia do artefato (teste)\n");
  writeFileSync(join(art, "index.html"), index);
  writeFileSync(join(art, "modelo.js"), `window.MODELO_B64="${await docxFicticio()}";\n`);
  writeFileSync(join(art, "tpl.js"), `window.TPL_PDF_B64="${lerRepo("assets/modelo-proposta.pdf").toString("base64")}";\n`);
  writeFileSync(join(art, "cadastro.json"), JSON.stringify(cadastro, null, 2));
  writeFileSync(join(art, "NOTAS-DA-VERSAO.md"), "# Notas da versão de teste\n\nTexto fictício.\n");
  return art;
}

// Cópia mínima do repositório: só o que o importador lê ou grava.
function repoMinimo() {
  const repo = pastaTemporaria("importador-repo-");
  mkdirSync(join(repo, "upstream"));
  copyFileSync(join(REPO, "upstream", "artefato.json"), join(repo, "upstream", "artefato.json"));
  for (const p of ["js", "assets", "data"]) mkdirSync(join(repo, p));
  return repo;
}

function importar(repo, art) {
  return spawnSync(process.execPath, [SCRIPT, art, "--versao", "teste-1"], { cwd: repo, encoding: "utf8" });
}

test("importação completa grava os arquivos mecânicos e redige o index", async () => {
  const repo = repoMinimo();
  const art = await artefatoFicticio();
  const r = importar(repo, art);
  assert.equal(r.status, 0, r.stderr);

  // cadastro-local/: config igual à fixture; ids normalizados (CCT e município com nome fora do padrão)
  assert.deepEqual(JSON.parse(lerEm(repo, "cadastro-local/config.json", "utf8")), fixture("config.json"));
  const ccts = JSON.parse(lerEm(repo, "cadastro-local/ccts.json", "utf8"));
  assert.deepEqual(Object.keys(ccts), ["cct-limpeza-sp-2026"]);
  const municipios = JSON.parse(lerEm(repo, "cadastro-local/municipios.json", "utf8"));
  assert.deepEqual(Object.keys(municipios), ["cidade-teste-sp"]);
  assert.equal(municipios["cidade-teste-sp"].cct, "cct-limpeza-sp-2026");

  // DOCX: marcadores no lugar dos dados de exemplo; a tabela de preços vira o espaço reservado
  const docx = await JSZip.loadAsync(lerEm(repo, "assets/modelo-proposta.docx"));
  const xml = await docx.file("word/document.xml").async("string");
  for (const marcador of ["Cliente: {{CLIENTE}}", "{{DATA_EXTENSO}}", "{{TABELA_DE_PRECOS}}"])
    assert.ok(xml.includes(marcador), `DOCX sem ${marcador}`);
  for (const resto of ["Exemplo Teste", "1 de janeiro de 2026", "9.999"])
    assert.ok(!xml.includes(resto), `DOCX ainda tem "${resto}"`);

  // PDF e calc.js: cópias byte a byte
  assert.ok(lerEm(repo, "assets/modelo-proposta.pdf").equals(lerRepo("assets/modelo-proposta.pdf")), "PDF diferente do original");
  assert.ok(lerEm(repo, "js/calc.js").equals(lerEm(art, "calc.js")), "js/calc.js diferente do calc.js do artefato");

  // upstream/: index redigido (cliente de exemplo e nome de pessoa), notas copiadas, hashes do original
  const idx = lerEm(repo, "upstream/index.html", "utf8");
  for (const nome of ["Exemplo Teste", "Maria Teste"]) assert.ok(!idx.includes(nome), `upstream/index.html ainda tem "${nome}"`);
  assert.ok(idx.includes("{{CLIENTE_EXEMPLO}}"), "upstream/index.html sem {{CLIENTE_EXEMPLO}}");
  assert.ok(existsSync(join(repo, "upstream", "NOTAS-DA-VERSAO.md")), "NOTAS-DA-VERSAO.md não foi copiado");

  const meta = JSON.parse(lerEm(repo, "upstream/artefato.json", "utf8"));
  assert.equal(meta.versao, "teste-1");
  assert.deepEqual(Object.keys(meta.arquivos).sort(), [...CONHECIDOS].sort());
  for (const f of CONHECIDOS) assert.equal(meta.arquivos[f], sha256(lerEm(art, f)), `sha256 de ${f}`);
});

test("segunda execução sem mudanças não reescreve o cadastro", async () => {
  const repo = repoMinimo();
  const art = await artefatoFicticio();
  assert.equal(importar(repo, art).status, 0);

  // Envelhece o mtime para que uma reescrita apareça mesmo se o conteúdo for igual.
  const dados = DADOS.map((f) => join(repo, "cadastro-local", f));
  const antigo = new Date("2000-01-01T00:00:00Z");
  for (const f of dados) utimesSync(f, antigo, antigo);
  const conteudoAntes = dados.map((f) => readFileSync(f));

  const r = importar(repo, art);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Nenhum arquivo mudou/);
  dados.forEach((f, i) => {
    assert.ok(readFileSync(f).equals(conteudoAntes[i]), `${f} mudou de conteúdo`);
    assert.equal(statSync(f).mtimeMs, antigo.getTime(), `${f} foi reescrito`);
  });
});

test("ids que ficariam iguais param a importação antes de gravar o cadastro", async () => {
  const repo = repoMinimo();
  const art = await artefatoFicticio({
    cadastro: cadastroFicticio({ "São Paulo-SP": municipioPadrao(), "sao paulo sp": municipioPadrao() }),
  });
  const r = importar(repo, art);
  assert.notEqual(r.status, 0, "importação deveria falhar com ids repetidos");
  assert.match(r.stderr, /ficariam iguais/);
  for (const f of DADOS) assert.equal(existsSync(join(repo, "cadastro-local", f)), false, `${f} foi gravado mesmo com colisão`);
});

test("modelo sem as frases de conferência para a importação", async () => {
  const repo = repoMinimo();
  const art = await artefatoFicticio({
    index: '<!doctype html><html><body><input placeholder="Ex.: Sra. Maria Teste"></body></html>\n',
  });
  const r = importar(repo, art);
  assert.notEqual(r.status, 0, "importação deveria falhar sem a conferência do modelo");
  assert.match(r.stderr, /conferência do modelo/);
});

test("arquivo desconhecido no artefato gera aviso", async () => {
  const repo = repoMinimo();
  const art = await artefatoFicticio();
  writeFileSync(join(art, "extra.js"), "// arquivo novo no artefato\n");
  const r = importar(repo, art);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Arquivo novo no artefato: extra\.js/);
});
