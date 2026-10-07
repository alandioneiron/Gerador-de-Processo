/* Cálculo de preço por posto – método Neoguard Facilities (memória de cálculo). Funções puras. */
var NG = (function () {
  var ESC = {
    "5x2": { label: "5x2 (44h)", cpp: 1, dias: "5x2", not: false },
    "6x1": { label: "Seg a sáb (44h)", cpp: 1, dias: "6x1", not: false },
    "12x36d": { label: "12x36 diurno", cpp: 2, dias: "12x36", not: false },
    "12x36n": { label: "12x36 noturno", cpp: 2, dias: "12x36", not: true },
    "custom": { label: "Outra (informar dias/mês)", cpp: 1, dias: null, not: false }
  };
  function r2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function priceRow(cfg, cct, mun, row) {
    var e = ESC[row.escala];
    var dias = e.dias ? cfg.dias[e.dias] : Number(row.dias);
    var cpp = e.cpp, colab = cpp * row.postos;
    var sal = Number(row.sal);
    var insal = (row.insal || 0) * cct.sm;
    var rb = sal * (1 + (row.acum ? cct.acumulo : 0)) + insal;
    var hn = cct.hnot * cfg.plant;
    var noturno = e.not ? (rb / 220 * cct.adn * hn * 8 / 7 + rb / 220 * hn / 7) : 0;
    var rem = rb + noturno;
    var enc = rem * cct.enc;
    var vt = Math.max(0, dias * mun.vt_dia - sal * cfg.vtd);
    var vr = dias * (cct.vr - cct.vr_desc);
    var interv = row.intervalo ? sal / 220 * 1.5 * cct.intervalo_h * cfg.plant : 0;
    var premio = row.premio ? cct.premio : 0;
    var benef = cct.cesta + premio + cct.ppr / 12 + cct.social + cct.saude + cfg.seg + interv;
    var insumos = Number(row.kit) + cfg.aso + cfg.trein + cfg.matind;
    var custo = rem + enc + vt + vr + benef + insumos;
    var bdi = custo * (cfg.bdi_adm + cfg.bdi_luc);
    var cred = (cfg.pis + cfg.cofins) * (Number(row.kit) + cfg.matind);
    var iss = row.tipo === "limp" ? mun.iss_limp : mun.iss_mo;
    var trib = iss + cfg.pis + cfg.cofins;
    var preco = r2((custo + bdi - cred) / (1 - trib));
    return {
      dias: dias, cpp: cpp, colab: colab, sal: sal, insal: insal, noturno: noturno, rem: rem, enc: enc, vt: vt, vr: vr,
      interv: interv, premio: premio, benef: benef, insumos: insumos, custo: custo, bdi: bdi, cred: cred, iss: iss,
      preco: preco, posto: r2(preco * cpp), total: r2(preco * colab)
    };
  }
  function priceExtras(cfg, mun, mat, eq) {
    var t = 1 - (mun.iss_limp + cfg.pis + cfg.cofins), b = 1 + cfg.bdi_adm + cfg.bdi_luc, pc = cfg.pis + cfg.cofins;
    var cm = (Number(mat) || 0) * (1 + cfg.res);
    var pm = (cm * b - pc * cm) / t;
    var inv = Number(eq) || 0, am = inv / cfg.amort;
    var pe = (am * (1 + cfg.manut) * b - pc * am) / t;
    return { mat: r2(pm), eq: r2(pe), total: r2(pm + pe) };
  }
  return { ESC: ESC, priceRow: priceRow, priceExtras: priceExtras, r2: r2 };
})();
if (typeof module !== "undefined") module.exports = NG;
