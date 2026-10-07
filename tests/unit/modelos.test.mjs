// Testes dos modelos da proposta (assets/modelo-proposta.docx e .pdf).
// Garante que os marcadores que js/app.js procura existem no modelo DOCX, que nenhum dado de cliente real
// ficou no modelo e que o PDF tem as 12 páginas que o app usa (índices 0 a 11).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

const arquivo = (rel) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
const DOCX = arquivo("assets/modelo-proposta.docx");
const PDF = arquivo("assets/modelo-proposta.pdf");
const APP = arquivo("js/app.js");

// Dados de cliente real que já saíram do modelo. Se aparecerem de novo, a proposta vai sair com um cliente antigo.
const DADOS_REAIS_PROIBIDOS = ["Maison", "9.340", "12.426", "21.766"];

// Marcadores que o app substitui: "Cliente: {{CLIENTE}}" (capa) e "{{DATA_EXTENSO}}" (assinatura).
// A 1ª tabela inteira é trocada pela tabela de preços, então marcadores dentro dela não chegam à proposta.
const MARCADORES_TRATADOS = new Set(["{{CLIENTE}}", "{{DATA_EXTENSO}}"]);

// Lê MK_CLI e MK_DATA direto do código do app, para o teste falhar se alguém trocar um e não o outro.
function marcadoresDoApp() {
  const src = readFileSync(APP, "utf8");
  const m = src.match(/var MK_CLI="([^"]+)",MK_DATA="([^"]+)"/);
  assert.ok(m, "não achei `var MK_CLI=\"...\",MK_DATA=\"...\"` em js/app.js: ajuste este teste se o formato mudou");
  return { mkCli: m[1], mkData: m[2] };
}

// Mesmo corte que o app faz no buildDocx(): a primeira <w:tbl> ... </w:tbl>.
function separarPrimeiraTabela(xml) {
  const t0 = xml.indexOf("<w:tbl>");
  const t1 = xml.indexOf("</w:tbl>") + "</w:tbl>".length;
  assert.ok(t0 >= 0 && t1 > t0, "modelo sem tabela de preços (<w:tbl>)");
  return { tabela: xml.slice(t0, t1), resto: xml.slice(0, t0) + xml.slice(t1) };
}

async function documentoXml() {
  const zip = await JSZip.loadAsync(readFileSync(DOCX));
  const entrada = zip.file("word/document.xml");
  assert.ok(entrada, "DOCX sem word/document.xml");
  return entrada.async("string");
}

describe("modelo DOCX", () => {
  test("é um pacote Word com word/document.xml", async () => {
    const xml = await documentoXml();
    assert.ok(xml.includes("<w:document"), "word/document.xml não parece um documento Word");
  });

  test("tem os marcadores e a tabela que o app preenche", async () => {
    const xml = await documentoXml();
    assert.ok(xml.includes("Cliente: {{CLIENTE}}"), "falta o marcador 'Cliente: {{CLIENTE}}' (capa)");
    assert.ok(xml.includes("{{DATA_EXTENSO}}"), "falta o marcador {{DATA_EXTENSO}} (assinatura)");
    assert.ok(xml.includes("<w:tbl>"), "falta a tabela de preços");
    assert.ok(xml.includes("A presente proposta contempla exclusivamente"), "falta o texto de escopo que o app troca conforme materiais");
  });

  test("a primeira tabela é a tabela de preços (o app a substitui inteira)", async () => {
    const { tabela } = separarPrimeiraTabela(await documentoXml());
    assert.match(tabela, /Total de Serviços/);
  });

  test("não contém dados de cliente real", async () => {
    const xml = await documentoXml();
    for (const dado of DADOS_REAIS_PROIBIDOS) {
      assert.ok(!xml.includes(dado), `dado de cliente real encontrado no modelo: "${dado}"`);
    }
  });

  test("marcadores de MK_CLI e MK_DATA do app existem no modelo", async () => {
    const xml = await documentoXml();
    const { mkCli, mkData } = marcadoresDoApp();
    assert.ok(xml.includes(mkCli), `MK_CLI do app ("${mkCli}") não existe no modelo`);
    assert.ok(xml.includes(mkData), `MK_DATA do app ("${mkData}") não existe no modelo`);
  });

  test("todo marcador {{...}} fora da tabela de preços é tratado pelo app", async () => {
    // Um marcador novo no modelo que o app não substitui vazaria "{{...}}" na proposta.
    const { resto } = separarPrimeiraTabela(await documentoXml());
    const sobrando = [...new Set([...resto.matchAll(/\{\{[^{}<>]*\}\}/g)].map((m) => m[0]))]
      .filter((marca) => !MARCADORES_TRATADOS.has(marca));
    assert.deepEqual(sobrando, [], "marcador não tratado pelo app fora da tabela de preços");
  });
});

describe("modelo PDF", () => {
  test("carrega e tem exatamente 12 páginas", async () => {
    const pdf = await PDFDocument.load(readFileSync(PDF));
    assert.equal(pdf.getPageCount(), 12);
  });
});
