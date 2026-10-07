// Testes E2E da página de propostas (Playwright). Usa os dados FICTÍCIOS de tests/fixtures (ver playwright.config.mjs).
// O total esperado vem da conta à mão em tests/unit/calc.test.mjs:
//   posto 1 (ASG, 5x2, 1 posto)                                  = R$ 6.056,65
//   posto 2 (porteiro, 12x36 noturno, 1 posto = 2 colaboradores) = R$ 15.564,82
//   total mensal                                                  = R$ 21.621,47
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

const CLIENTE = "Condomínio Teste Ação";
const AC = "Sr. Fulano";
const TOTAL = "R$ 21.621,47";
// Nome sugerido: slug() de js/app.js tira acentos e põe em maiúsculas.
const NOME_SLUG = "CONDOMINIO TESTE ACAO";

// Erros de rede que não são bugs da página:
// - fontes do Google (a página funciona com a fonte do sistema);
// - version.json: só existe no build publicado. Em desenvolvimento dá 404, e a página ignora (catch).
const IGNORAR_CONSOLE = [/fonts\.(googleapis|gstatic)\.com/, /\/version\.json$/];

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// Mesma regra de dataExtenso() em js/app.js: "7 de outubro de 2026."
const porExtenso = (iso) => {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${ano}.`;
};

let erros = [];

test.beforeEach(async ({ page }) => {
  erros = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const url = msg.location().url || "";
    if (IGNORAR_CONSOLE.some((re) => re.test(url))) return;
    erros.push(msg.text());
  });
  page.on("pageerror", (err) => erros.push(`exceção não tratada: ${err.message}`));
});

test.afterEach(() => {
  expect(erros, "erros no console do navegador").toEqual([]);
});

async function abrirPagina(page) {
  await page.goto("/");
  await expect(page.locator("#conn")).toHaveText("Dados carregados");
}

async function preencherCabecalho(page) {
  await page.fill("#f-cliente", CLIENTE);
  await page.fill("#f-ac", AC);
  await page.fill("#f-por", "QA");
  await page.selectOption("#f-mun", "cidade-teste-sp");
}

// Dois postos do cenário de referência. Devolve os ids (data-id) dos cartões criados.
async function montarDoisPostos(page) {
  await page.click("#add-posto");
  const p1 = await page.locator(".posto").nth(0).getAttribute("data-id");
  await page.fill(`#po${p1}-grupo`, "Limpeza e Conservação");
  await page.selectOption(`#po${p1}-func`, "asg");
  await page.fill(`#po${p1}-horario`, "seg a sex 8h–17h");

  await page.click("#add-posto");
  const p2 = await page.locator(".posto").nth(1).getAttribute("data-id");
  await page.fill(`#po${p2}-grupo`, "Portaria");
  await page.selectOption(`#po${p2}-func`, "porteiro");
  await page.selectOption(`#po${p2}-escala`, "12x36n");
  await page.fill(`#po${p2}-horario`, "19h–7h");
  return { p1, p2 };
}

// Cadastro completo com alerta do município confirmado. Espera a página liberar a emissão.
async function propostaPronta(page) {
  await abrirPagina(page);
  await preencherCabecalho(page);
  await page.check("[data-ack]");
  await montarDoisPostos(page);
  await expect(page.locator("#issues")).toContainText("Tudo conferido");
  await expect(page.locator("#total-mensal")).toHaveText(TOTAL);
}

// Clica no botão de emissão, espera o download e salva o arquivo na pasta de saída do teste.
async function baixar(page, seletor, testInfo) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.click(seletor)]);
  const nome = download.suggestedFilename();
  const caminho = testInfo.outputPath(nome);
  await download.saveAs(caminho);
  return { nome, bytes: readFileSync(caminho) };
}

test.describe("cadastro e pendências", () => {
  test("carrega o cadastro fictício e lista o município", async ({ page }) => {
    await abrirPagina(page);
    await expect(page.locator("#fatal")).toBeHidden();
    await expect(page.locator("#f-mun option", { hasText: "Cidade Teste / SP" })).toHaveCount(1);
    await expect(page.locator("#btn-pdf")).toBeDisabled();
  });

  test("sem cliente e sem postos: botões desabilitados e pendências listadas", async ({ page }) => {
    await abrirPagina(page);
    await expect(page.locator("#issues")).toContainText("Informe o nome do cliente.");
    await expect(page.locator("#issues")).toContainText("Escolha o município da prestação do serviço.");
    for (const seletor of ["#btn-pdf", "#btn-docx", "#btn-xlsx"]) {
      await expect(page.locator(seletor)).toBeDisabled();
    }

    await preencherCabecalho(page);
    await expect(page.locator("#issues")).toContainText("Adicione pelo menos um posto.");
    await expect(page.locator("#btn-pdf")).toBeDisabled();
  });

  test("alerta do município exige confirmação antes de emitir", async ({ page }) => {
    await abrirPagina(page);
    await preencherCabecalho(page);
    await montarDoisPostos(page);
    await expect(page.locator("#issues")).toContainText("Confira na fonte e confirme: Alerta fictício de conferência.");
    await expect(page.locator("#btn-pdf")).toBeDisabled();

    await page.check("[data-ack]");
    await expect(page.locator("#issues")).toContainText("Tudo conferido");
    await expect(page.locator("#btn-pdf")).toBeEnabled();
  });

  test("salário abaixo do piso bloqueia a emissão", async ({ page }) => {
    await abrirPagina(page);
    await preencherCabecalho(page);
    await page.check("[data-ack]");
    await page.click("#add-posto");
    const p1 = await page.locator(".posto").nth(0).getAttribute("data-id");
    await page.fill(`#po${p1}-grupo`, "Limpeza e Conservação");
    await page.selectOption(`#po${p1}-func`, "asg");
    await page.fill(`#po${p1}-horario`, "seg a sex 8h–17h");
    await page.fill(`#po${p1}-sal`, "1500");

    // Piso do ASG na fixture é R$ 2.000,00. Abaixo do piso a emissão é bloqueada (o motivo só é exigido acima do piso).
    await expect(page.locator("#issues")).toContainText("salário abaixo do piso da CCT (R$ 2.000,00)");
    await expect(page.locator("#btn-pdf")).toBeDisabled();
  });

  test("salário acima do piso exige o motivo e libera a emissão quando informado", async ({ page }) => {
    await abrirPagina(page);
    await preencherCabecalho(page);
    await page.check("[data-ack]");
    await page.click("#add-posto");
    const p1 = await page.locator(".posto").nth(0).getAttribute("data-id");
    await page.fill(`#po${p1}-grupo`, "Limpeza e Conservação");
    await page.selectOption(`#po${p1}-func`, "asg");
    await page.fill(`#po${p1}-horario`, "seg a sex 8h–17h");
    await page.fill(`#po${p1}-sal`, "2300");

    await expect(page.locator("#issues")).toContainText("salário diferente da tabela da CCT. Informe o motivo.");
    await expect(page.locator("#btn-pdf")).toBeDisabled();

    await page.fill(`#po${p1}-autor`, "Salário pedido pelo cliente no escopo");
    await expect(page.locator("#issues")).toContainText("Tudo conferido");
    await expect(page.locator("#btn-pdf")).toBeEnabled();
  });

  test("município fora da lista mostra o formulário de cadastro e bloqueia a emissão", async ({ page }) => {
    await abrirPagina(page);
    await expect(page.locator("#pend-form")).toBeHidden();
    await page.selectOption("#f-mun", "__outro");
    await expect(page.locator("#pend-form")).toBeVisible();
    await expect(page.locator("#issues")).toContainText("Município sem CCT cadastrada");
    await expect(page.locator("#btn-pdf")).toBeDisabled();
  });

  test("cadastro vazio (config ausente) mostra o aviso e não calcula", async ({ page }) => {
    await page.route("**/data/config.json", (r) => r.fulfill({ json: null }));
    await page.goto("/");
    await expect(page.locator("#fatal")).toContainText("Parâmetros Neoguard ainda não cadastrados");
    await expect(page.locator("#issues")).toContainText("Parâmetros Neoguard");
    await expect(page.locator("#btn-pdf")).toBeDisabled();
  });
});

test.describe("cálculo e emissão", () => {
  test("com dados completos, a conferência libera a emissão e o total bate com a conta à mão", async ({ page }) => {
    await propostaPronta(page);
    await expect(page.locator("#btn-pdf")).toBeEnabled();
    await expect(page.locator("#btn-docx")).toBeEnabled();
    await expect(page.locator("#btn-xlsx")).toBeEnabled();
  });

  test("PDF: nome sugerido, 6 páginas e cabeçalho %PDF", async ({ page }, testInfo) => {
    await propostaPronta(page);
    const data = await page.locator("#f-data").inputValue();

    const { nome, bytes } = await baixar(page, "#btn-pdf", testInfo);
    expect(nome).toBe(`PROPOSTA COMERCIAL FACILITIES - ${NOME_SLUG} - ${data}_v1.pdf`);
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("%PDF");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(6);
    await expect(page.locator("#emit-msg")).toContainText("PDF baixado");
  });

  test("DOCX: cliente, A/C, data por extenso e total; sem marcadores {{", async ({ page }, testInfo) => {
    await propostaPronta(page);
    const data = await page.locator("#f-data").inputValue();

    const { nome, bytes } = await baixar(page, "#btn-docx", testInfo);
    expect(nome).toBe(`PROPOSTA COMERCIAL FACILITIES - ${NOME_SLUG} - ${data}_v1.docx`);
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml").async("string");
    expect(xml).toContain(`Cliente: ${CLIENTE}`);
    expect(xml).toContain(`A/C: ${AC}`);
    expect(xml).toContain(porExtenso(data));
    expect(xml).toContain(TOTAL);
    expect(xml).not.toContain("{{");
    await expect(page.locator("#emit-msg")).toContainText("Proposta baixada");
  });

  test("XLSX: nome sugerido, abas da memória e total na aba RESUMO", async ({ page }, testInfo) => {
    await propostaPronta(page);
    const data = await page.locator("#f-data").inputValue();

    const { nome, bytes } = await baixar(page, "#btn-xlsx", testInfo);
    expect(nome).toBe(`MEMORIA - ${NOME_SLUG} - ${data}_v1.xlsx`);
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
    const zip = await JSZip.loadAsync(bytes);
    const abas = await zip.file("xl/workbook.xml").async("string");
    for (const aba of ["RESUMO", "POSTOS", "PARAMETROS"]) {
      expect(abas).toContain(`name="${aba}"`);
    }
    const resumo = await zip.file("xl/worksheets/sheet1.xml").async("string");
    expect(resumo).toContain("21621.47");
    await expect(page.locator("#emit-msg")).toHaveText("Memória de cálculo baixada.");
  });

  test("histórico registra a emissão neste navegador", async ({ page }, testInfo) => {
    await propostaPronta(page);
    await baixar(page, "#btn-pdf", testInfo);
    await expect(page.locator("#hist")).toContainText(CLIENTE);
    await expect(page.locator("#hist")).toContainText(TOTAL);
  });
});
