// Testes unitários do cálculo de preço (js/calc.js).
// Os valores esperados foram calculados À MÃO a partir dos dados fictícios de tests/fixtures
// (a conta está em comentário em cada teste). Não foram copiados da saída do código.
// Valores já arredondados por r2() são comparados com igualdade estrita; os demais, com tolerância de 1e-6.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// js/calc.js é um script clássico que se exporta via `module.exports` quando `module` existe.
// Como o package.json é "type": "module", o require() do Node devolve objeto vazio (NG não é exportado).
// Por isso o arquivo é executado num contexto vm com um objeto `module` de mentira, que é o caminho CommonJS.
function carregarCalc() {
  const arquivo = fileURLToPath(new URL("../../js/calc.js", import.meta.url));
  const ctx = { module: { exports: {} } };
  vm.runInNewContext(readFileSync(arquivo, "utf8"), ctx, { filename: arquivo });
  return ctx.module.exports;
}
const NG = carregarCalc();

const fixture = (nome) => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${nome}`, import.meta.url)), "utf8"));
const cfg = fixture("config.json");
const cct = fixture("ccts.json")["teste-limpeza-2026"];
const mun = fixture("municipios.json")["cidade-teste-sp"];

// Linha como a página monta (js/app.js, compute()). Sal, kit e dias chegam como texto dos campos do formulário.
const linha = (over = {}) => ({
  sal: 2000, kit: 40, tipo: "limp", escala: "5x2", dias: "", postos: 1,
  insal: 0, acum: false, intervalo: false, premio: true, ...over,
});
const preco = (over = {}, m = mun) => NG.priceRow(cfg, cct, m, linha(over));

const perto = (obtido, esperado, msg = "") =>
  assert.ok(Math.abs(obtido - esperado) < 1e-6, `${msg} esperado ${esperado}, obtido ${obtido}`);

describe("priceRow: caso de referência (ASG, 5x2, 1 posto)", () => {
  // Entrada: sal 2000, kit 40, tipo limp (ISS 5%), escala 5x2, postos 1, sem insalubridade/acúmulo/intervalo, prêmio ligado.
  // dias = cfg.dias["5x2"] = 22
  // remuneração = 2000 (sem noturno, sem insalubridade, sem acúmulo)
  // encargos = 2000 x 0,70 = 1400
  // VT = max(0; 22 x 10 - 2000 x 0,06) = 220 - 120 = 100
  // VR = 22 x (30 - 1) = 638
  // benefícios = cesta 150 + prêmio 100 + PPR 600/12 = 50 + social 20 + saúde 50 + seguro 10 = 380
  // insumos = kit 40 + ASO 8 + treinamento 15 + material individual 20 = 83
  // custo = 2000 + 1400 + 100 + 638 + 380 + 83 = 4601
  // BDI = 4601 x (0,05 + 0,08) = 598,13
  // crédito PIS/COFINS = (0,0165 + 0,076) x (40 + 20) = 5,55
  // tributos = ISS 0,05 + PIS 0,0165 + COFINS 0,076 = 0,1425
  // preço = (4601 + 598,13 - 5,55) / (1 - 0,1425) = 5193,58 / 0,8575 = 6056,65
  const r = preco();

  test("dias, custo e componentes batem com a conta à mão", () => {
    assert.equal(r.dias, 22);
    assert.equal(r.cpp, 1);
    assert.equal(r.colab, 1);
    perto(r.rem, 2000, "remuneração");
    perto(r.enc, 1400, "encargos");
    perto(r.vt, 100, "VT");
    perto(r.vr, 638, "VR");
    perto(r.benef, 380, "benefícios");
    perto(r.insumos, 83, "insumos");
    perto(r.custo, 4601, "custo");
    perto(r.bdi, 598.13, "BDI");
    perto(r.cred, 5.55, "crédito PIS/COFINS");
    perto(r.iss, 0.05, "ISS");
  });

  test("preço, valor por posto e total mensal", () => {
    assert.equal(r.preco, 6056.65);
    assert.equal(r.posto, 6056.65);
    assert.equal(r.total, 6056.65);
  });

  test("valores vindos do formulário como texto dão o mesmo resultado", () => {
    const texto = NG.priceRow(cfg, cct, mun, linha({ sal: "2000", kit: "40", postos: "1", dias: "" }));
    assert.equal(texto.preco, 6056.65);
    assert.equal(texto.total, 6056.65);
  });
});

describe("priceRow: 12x36 (cpp = 2)", () => {
  // Porteiro (piso 2500, kit 50, ISS de mão de obra). Escala 12x36 noturno, 1 posto.
  // dias = cfg.dias["12x36"] = 15
  // cpp = 2 colaboradores por posto -> colab = 2 x 1 = 2
  // hn = hnot x plant = 7 x 15 = 105 horas noturnas no mês
  // adicional noturno = rb/220 x (adn x hn x 8/7 + hn/7) = 2500/220 x (0,2 x 105 x 8/7 + 105/7)
  //                   = 2500/220 x (24 + 15) = 2500/220 x 39 = 443,18
  // remuneração = 2500 + 443,18 = 2943,18
  // encargos = 0,70 x 2943,18 = 2060,23
  // VT = max(0; 15 x 10 - 2500 x 0,06) = 150 - 150 = 0
  // VR = 15 x (30 - 1) = 435
  // benefícios = 380 (mesmo do caso de referência)
  // insumos = 50 + 8 + 15 + 20 = 93
  // custo = 2943,18 + 2060,23 + 0 + 435 + 380 + 93 = 5911,41
  // BDI = 0,13 x 5911,41 = 768,48
  // crédito = 0,0925 x (50 + 20) = 6,475
  // preço = (5911,41 + 768,48 - 6,475) / (1 - (0,05 + 0,0925)) = 6673,42 / 0,8575 = 7782,41
  // posto = total = 7782,41 x 2 = 15564,82
  const porteiro = { sal: 2500, kit: 50, tipo: "mo", escala: "12x36n" };

  test("adicional noturno e encargos (conta à mão)", () => {
    const r = preco(porteiro);
    assert.equal(r.dias, 15);
    assert.equal(r.cpp, 2);
    assert.equal(r.colab, 2);
    assert.ok(r.noturno > 0, "noturno deveria ser positivo");
    perto(r.noturno, 4875 / 11, "adicional noturno");
    perto(r.rem, 2943.181818, "remuneração");
    perto(r.enc, 2060.227273, "encargos");
    assert.equal(r.vt, 0);
    perto(r.custo, 5911.409091, "custo");
  });

  test("preço por colaborador, por posto e total do posto", () => {
    const r = preco(porteiro);
    assert.equal(r.preco, 7782.41);
    assert.equal(r.posto, 15564.82, "posto = preço x cpp");
    assert.equal(r.total, 15564.82, "total = preço x colaboradores");
  });

  test("total cresce com a quantidade de postos, o valor por posto não", () => {
    // 3 postos: colab = 2 x 3 = 6; total = 7782,41 x 6 = 46694,46; posto continua 15564,82.
    const r = preco({ ...porteiro, postos: 3 });
    assert.equal(r.colab, 6);
    assert.equal(r.posto, 15564.82);
    assert.equal(r.total, 46694.46);
  });

  test("12x36 diurno com intervalo indenizado gera valor de intervalo e sem noturno", () => {
    // intervalo = sal/220 x 1,5 x intervalo_h x plant = 2500/220 x 1,5 x 1 x 15 = 255,68
    // benefícios = 380 + 255,68 = 635,68; remuneração = 2500 (sem noturno); encargos = 1750
    // custo = 2500 + 1750 + 0 + 435 + 635,68 + 93 = 5413,68
    // preço = (5413,68 + 703,78 - 6,475) / 0,8575 = 7126,51; posto = total = 14253,02
    const r = preco({ ...porteiro, escala: "12x36d", intervalo: true });
    assert.equal(r.noturno, 0);
    assert.ok(r.interv > 0, "intervalo deveria ser positivo");
    perto(r.interv, 5625 / 22, "intervalo indenizado");
    perto(r.benef, 635.681818, "benefícios com intervalo");
    assert.equal(r.preco, 7126.51);
    assert.equal(r.posto, 14253.02);
    assert.equal(r.total, 14253.02);
  });

  test("sem o flag de intervalo, o intervalo indenizado é zero", () => {
    const r = preco({ ...porteiro, escala: "12x36d", intervalo: false });
    assert.equal(r.interv, 0);
    assert.equal(r.benef, 380);
  });
});

describe("priceRow: regras especiais", () => {
  test("insalubridade de 20% usa 20% do salário mínimo da CCT (1500 x 0,2 = 300)", () => {
    // insal = 0,2 x 1500 = 300; remuneração = 2000 + 300 = 2300; encargos = 1610
    // VT continua sobre o salário base (100); custo = 2300 + 1610 + 100 + 638 + 380 + 83 = 5111
    // preço = (5111 + 664,43 - 5,55) / 0,8575 = 6728,72
    const r = preco({ insal: 0.2 });
    perto(r.insal, 300, "adicional de insalubridade");
    perto(r.rem, 2300, "remuneração");
    perto(r.enc, 1610, "encargos");
    perto(r.vt, 100, "VT (sobre salário base, não sobre a remuneração)");
    perto(r.custo, 5111, "custo");
    assert.equal(r.preco, 6728.72);
  });

  test("acúmulo de função soma cct.acumulo (20%) ao salário", () => {
    // remuneração = 2000 x (1 + 0,2) = 2400; encargos = 1680
    // custo = 2400 + 1680 + 100 + 638 + 380 + 83 = 5281; preço = (5281 + 686,53 - 5,55) / 0,8575 = 6952,75
    const r = preco({ acum: true });
    perto(r.rem, 2400, "remuneração com acúmulo");
    perto(r.enc, 1680, "encargos com acúmulo");
    perto(r.custo, 5281, "custo com acúmulo");
    assert.equal(r.preco, 6952.75);
  });

  test("prêmio de assiduidade desligado zera o prêmio e reduz benefícios", () => {
    // benefícios = 150 + 0 + 50 + 20 + 50 + 10 = 280; custo = 2000 + 1400 + 100 + 638 + 280 + 83 = 4501
    // preço = (4501 + 585,13 - 5,55) / 0,8575 = 5924,87
    const r = preco({ premio: false });
    assert.equal(r.premio, 0);
    assert.equal(r.benef, 280);
    perto(r.custo, 4501, "custo sem prêmio");
    assert.equal(r.preco, 5924.87);
  });

  test("tipo 'limp' usa iss_limp e tipo 'mo' usa iss_mo", () => {
    // Município de teste com ISS diferente nas duas categorias (a fixture tem 5% nas duas, não distinguiria).
    const m = { ...mun, iss_limp: 0.02, iss_mo: 0.05 };
    // limp: tributos = 0,02 + 0,0925 = 0,1125; preço = 5193,58 / 0,8875 = 5851,92
    const limp = preco({ tipo: "limp" }, m);
    assert.equal(limp.iss, 0.02);
    assert.equal(limp.preco, 5851.92);
    // mo: tributos = 0,05 + 0,0925 = 0,1425; preço = 5193,58 / 0,8575 = 6056,65
    const mo = preco({ tipo: "mo" }, m);
    assert.equal(mo.iss, 0.05);
    assert.equal(mo.preco, 6056.65);
  });

  test("VT nunca é negativo (salário alto)", () => {
    // Salário 10000: VT = max(0; 220 - 600) = 0 (sem valor negativo).
    const alto = preco({ sal: 10000 });
    assert.equal(alto.vt, 0);
    assert.ok(alto.preco > 0 && Number.isFinite(alto.preco));
    // Salário 3000: VT = 220 - 180 = 40.
    assert.equal(preco({ sal: 3000 }).vt, 40);
  });

  test("escala 'custom' usa os dias informados na linha (15 dias)", () => {
    // dias = 15; VT = 15 x 10 - 120 = 30; VR = 15 x 29 = 435; custo = 2000 + 1400 + 30 + 435 + 380 + 83 = 4328
    // preço = (4328 + 562,64 - 5,55) / 0,8575 = 5696,90
    const r = preco({ escala: "custom", dias: "15" });
    assert.equal(r.dias, 15);
    assert.equal(r.vt, 30);
    assert.equal(r.vr, 435);
    assert.equal(r.preco, 5696.9);
  });

  test("escalas fixas ignoram o campo de dias da linha", () => {
    assert.equal(preco({ escala: "5x2", dias: "99" }).dias, 22);
  });

  test("dias por escala vêm de cfg.dias (5x2 = 22, 6x1 = 26, 12x36 = 15)", () => {
    assert.equal(preco({ escala: "5x2" }).dias, 22);
    assert.equal(preco({ escala: "6x1" }).dias, 26);
    assert.equal(preco({ escala: "12x36d" }).dias, 15);
    assert.equal(preco({ escala: "12x36n" }).dias, 15);
  });
});

describe("priceExtras: materiais e equipamentos", () => {
  // t = 1 - (0,05 + 0,0165 + 0,076) = 0,8575; b = 1 + 0,05 + 0,08 = 1,13; pc = 0,0925
  // Materiais 1000: custo com reserva técnica = 1000 x 1,10 = 1100
  //   preço = (1100 x 1,13 - 0,0925 x 1100) / 0,8575 = (1243 - 101,75) / 0,8575 = 1330,90
  // Equipamentos 2400: amortização = 2400 / 24 = 100 por mês
  //   preço = (100 x 1,10 x 1,13 - 0,0925 x 100) / 0,8575 = (124,30 - 9,25) / 0,8575 = 134,17
  // total = 1330,90 + 134,17 = 1465,07

  test("materiais e equipamentos com valores à mão", () => {
    const e = NG.priceExtras(cfg, mun, 1000, 2400);
    assert.equal(e.mat, 1330.9);
    assert.equal(e.eq, 134.17);
    assert.equal(e.total, 1465.07);
  });

  test("só materiais (equipamentos zero)", () => {
    const e = NG.priceExtras(cfg, mun, 1000, 0);
    assert.equal(e.mat, 1330.9);
    assert.equal(e.eq, 0);
    assert.equal(e.total, 1330.9);
  });

  test("zero em tudo resulta em zero", () => {
    assert.deepEqual({ ...NG.priceExtras(cfg, mun, 0, 0) }, { mat: 0, eq: 0, total: 0 });
  });

  test("campos vazios do formulário ('') contam como zero", () => {
    assert.deepEqual({ ...NG.priceExtras(cfg, mun, "", "") }, { mat: 0, eq: 0, total: 0 });
  });

  test("valores digitados como texto dão o mesmo resultado", () => {
    assert.equal(NG.priceExtras(cfg, mun, "1000", "2400").total, 1465.07);
  });
});

describe("r2 (arredondamento monetário, meio para cima)", () => {
  test("arredonda para centavos e trata o caso clássico de ponto flutuante", () => {
    assert.equal(NG.r2(6056.653), 6056.65);
    assert.equal(NG.r2(2.675), 2.68);
    assert.equal(NG.r2(1.005), 1.01);
    assert.equal(NG.r2(0.125), 0.13);
  });
});
