// Testes do validador cadastral (scripts/validate-data.mjs).
// Cobre: dados fictícios válidos, o cadastro atual de data/ (modo normal e --strict) e mutações que devem gerar erro.
// A data "hoje" é fixada em TODAY para que o aviso de CCT vencida não dependa do dia em que o teste roda.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { validateData, loadData } from "../../scripts/validate-data.mjs";

const TODAY = "2026-10-07";
const FIXTURES = fileURLToPath(new URL("../fixtures", import.meta.url));
const DATA = fileURLToPath(new URL("../../data", import.meta.url));

const validar = (d, strict = false) => validateData(d, { strict, today: TODAY });
const fixtures = () => loadData(FIXTURES);

describe("dados fictícios (tests/fixtures)", () => {
  test("passam sem erro e sem aviso", () => {
    const { errors, warnings } = validar(fixtures());
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  });

  test("passam também no modo --strict (release)", () => {
    const { errors } = validar(fixtures(), true);
    assert.deepEqual(errors, []);
  });

  test("CCT com vigencia_fim no passado gera AVISO e não ERRO", () => {
    const d = fixtures();
    d.ccts["teste-limpeza-2026"].vigencia_fim = "2025-12-31";
    const { errors, warnings } = validar(d, true);
    assert.deepEqual(errors, []);
    assert.ok(warnings.some((w) => /venceu em 2025-12-31/.test(w)), `avisos: ${warnings}`);
  });

  test("CCT sem vigencia_fim gera AVISO e não ERRO", () => {
    const d = fixtures();
    delete d.ccts["teste-limpeza-2026"].vigencia_fim;
    const { errors, warnings } = validar(d);
    assert.deepEqual(errors, []);
    assert.ok(warnings.some((w) => /sem vigencia_fim/.test(w)), `avisos: ${warnings}`);
  });

  test("vigencia_fim fora do formato AAAA-MM-DD é ERRO", () => {
    const d = fixtures();
    d.ccts["teste-limpeza-2026"].vigencia_fim = "31/12/2099";
    const { errors } = validar(d);
    assert.ok(errors.some((e) => /AAAA-MM-DD/.test(e)), `erros: ${errors}`);
  });
});

describe("cadastro vazio (em memória, não depende de data/)", () => {
  test("config null e nenhum município: modo normal só avisa", () => {
    const { errors, warnings } = validar({ config: null, ccts: {}, municipios: {} });
    assert.deepEqual(errors, []);
    assert.equal(warnings.length, 2, `avisos: ${warnings}`);
  });

  test("config null e nenhum município: --strict falha nos dois pontos", () => {
    const { errors } = validar({ config: null, ccts: {}, municipios: {} }, true);
    assert.equal(errors.length, 2, `erros: ${errors}`);
    assert.ok(errors.some((e) => /config/.test(e)));
    assert.ok(errors.some((e) => /municipios/.test(e)));
  });
});

describe("data/ atual do repositório", () => {
  const atual = loadData(DATA);
  // Enquanto o cadastro real não estiver preenchido (config null ou sem município), os testes de release esperam falha.
  const cadastroVazio = atual.config === null || Object.keys(atual.municipios).length === 0;

  test("modo normal não tem erro (só avisos)", () => {
    const { errors } = validar(atual);
    assert.deepEqual(errors, [], "data/ tem erro de cadastro: corrigir antes do merge");
  });

  test("--strict (release) falha enquanto o cadastro estiver vazio", (t) => {
    if (!cadastroVazio) {
      t.skip("cadastro real já preenchido: o teste de bloqueio só se aplica a cadastro vazio");
      return;
    }
    const { errors } = validar(atual, true);
    assert.ok(errors.length > 0, "release deveria bloquear com cadastro vazio");
  });
});

describe("mutações que devem gerar ERRO", () => {
  // Cada caso altera uma cópia das fixtures e confere se o erro esperado aparece.
  const casos = [
    {
      nome: "ISS digitado como 5 em vez de 0,05",
      muta: (d) => { d.municipios["cidade-teste-sp"].iss_limp = 5; },
      erro: /iss_limp: 5 fora do intervalo/,
    },
    {
      nome: "município apontando para CCT inexistente",
      muta: (d) => { d.municipios["cidade-teste-sp"].cct = "cct-que-nao-existe"; },
      erro: /cct: "cct-que-nao-existe" não existe em ccts\.json/,
    },
    {
      nome: "id de piso repetido na mesma CCT",
      muta: (d) => { d.ccts["teste-limpeza-2026"].pisos[1].id = "asg"; },
      erro: /id: "asg" repetido/,
    },
    {
      nome: "tipo de piso inválido",
      muta: (d) => { d.ccts["teste-limpeza-2026"].pisos[0].tipo = "outro"; },
      erro: /tipo: use "limp" \(ISS 7\.10\) ou "mo" \(ISS 17\.05\)/,
    },
    {
      nome: "UF em minúscula",
      muta: (d) => { d.municipios["cidade-teste-sp"].uf = "sp"; },
      erro: /uf: duas letras maiúsculas/,
    },
    {
      nome: "id de município com maiúscula e espaço",
      muta: (d) => {
        d.municipios["Cidade Teste"] = d.municipios["cidade-teste-sp"];
        delete d.municipios["cidade-teste-sp"];
      },
      erro: /municipios\["Cidade Teste"\]: id deve ter só minúsculas/,
    },
    {
      nome: "id de CCT com maiúscula e espaço",
      muta: (d) => {
        d.ccts["Teste Limpeza"] = d.ccts["teste-limpeza-2026"];
        delete d.ccts["teste-limpeza-2026"];
        d.municipios["cidade-teste-sp"].cct = "Teste Limpeza";
      },
      erro: /ccts\["Teste Limpeza"\]: id deve ter só minúsculas/,
    },
    {
      nome: "desconto do VR maior que o VR",
      muta: (d) => { d.ccts["teste-limpeza-2026"].vr_desc = 50; },
      erro: /vr_desc: desconto maior que o VR/,
    },
    {
      nome: "config.json sem o campo plant",
      muta: (d) => { delete d.config.plant; },
      erro: /config\.plant: precisa ser número/,
    },
    {
      nome: "config.json sem a escala 12x36 em dias",
      muta: (d) => { delete d.config.dias["12x36"]; },
      erro: /config\.dias\.12x36: precisa ser número/,
    },
    {
      nome: "tributos somando 100% ou mais (PIS digitado fora da faixa)",
      // Com faixas válidas a soma nunca chega a 100%; o PIS fora da faixa dispara também a checagem de soma.
      muta: (d) => { d.config.pis = 0.95; },
      erro: /tributos somam 100% ou mais/,
    },
    {
      nome: "id de piso começando com '__' (reservado pela página)",
      muta: (d) => { d.ccts["teste-limpeza-2026"].pisos[0].id = "__outra"; },
      erro: /ids começando com "__" são reservados/,
    },
    {
      nome: "piso de salário fora do intervalo",
      muta: (d) => { d.ccts["teste-limpeza-2026"].pisos[0].piso = 100; },
      erro: /piso: 100 fora do intervalo/,
    },
    {
      nome: "lista de alertas com item vazio",
      muta: (d) => { d.municipios["cidade-teste-sp"].alertas = [""]; },
      erro: /alertas: lista de textos/,
    },
    {
      nome: "VT por dia fora do intervalo",
      muta: (d) => { d.municipios["cidade-teste-sp"].vt_dia = 500; },
      erro: /vt_dia: 500 fora do intervalo/,
    },
    {
      nome: "piso sem o campo tipo",
      muta: (d) => { delete d.ccts["teste-limpeza-2026"].pisos[2].tipo; },
      erro: /pisos\[2\]\.tipo: use "limp"/,
    },
  ];

  for (const caso of casos) {
    test(caso.nome, () => {
      const d = fixtures();
      caso.muta(d);
      const { errors } = validar(d);
      assert.ok(errors.length > 0, "deveria haver erro");
      assert.ok(errors.some((e) => caso.erro.test(e)), `erro esperado ${caso.erro} não apareceu. Erros: ${errors}`);
    });
  }
});
