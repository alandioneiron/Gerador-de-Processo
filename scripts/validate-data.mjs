// Valida o cadastro (config, CCTs e municípios) antes de entrar na main e antes de cada release.
// Uso: node scripts/validate-data.mjs [pasta] [--strict]
//   pasta     padrão "data" (os testes usam "tests/fixtures")
//   --strict  usado na release: cadastro vazio (sem config ou sem município) vira erro.
// Percentuais são frações (8% = 0.08); os limites abaixo pegam o erro comum de digitar 8 no lugar de 0.08.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function num(errs, where, obj, key, min, max, { optional = false, integer = false } = {}) {
  const v = obj?.[key];
  if (v === undefined && optional) return;
  if (typeof v !== "number" || !Number.isFinite(v)) return errs.push(`${where}.${key}: precisa ser número (veio ${JSON.stringify(v)})`);
  if (integer && !Number.isInteger(v)) errs.push(`${where}.${key}: precisa ser inteiro (veio ${v})`);
  if (v < min || v > max) errs.push(`${where}.${key}: ${v} fora do intervalo esperado [${min}, ${max}]`);
}
function str(errs, where, obj, key, { optional = false } = {}) {
  const v = obj?.[key];
  if (v === undefined && optional) return;
  if (typeof v !== "string" || !v.trim()) errs.push(`${where}.${key}: precisa ser texto não vazio`);
}
function obj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

export function validateConfig(cfg, errs) {
  const w = "config";
  if (!obj(cfg)) return errs.push(`${w}: precisa ser um objeto`);
  if (!obj(cfg.dias)) errs.push(`${w}.dias: precisa ter os dias por escala { "5x2", "6x1", "12x36" }`);
  else for (const k of ["5x2", "6x1", "12x36"]) num(errs, `${w}.dias`, cfg.dias, k, 1, 31);
  num(errs, w, cfg, "plant", 1, 31);
  num(errs, w, cfg, "vtd", 0, 0.06);
  for (const k of ["seg", "aso", "trein", "matind"]) num(errs, w, cfg, k, 0, 2000);
  for (const k of ["bdi_adm", "bdi_luc"]) num(errs, w, cfg, k, 0, 0.5);
  num(errs, w, cfg, "pis", 0, 0.05);
  num(errs, w, cfg, "cofins", 0, 0.1);
  num(errs, w, cfg, "res", 0, 0.5);
  num(errs, w, cfg, "amort", 1, 120, { integer: true });
  num(errs, w, cfg, "manut", 0, 0.5);
}

export function validateCct(id, c, errs, warns, today) {
  const w = `ccts["${id}"]`;
  if (!ID.test(id)) errs.push(`${w}: id deve ter só minúsculas, números e hífen (ex.: "limpeza-sp-2026")`);
  if (!obj(c)) return errs.push(`${w}: precisa ser um objeto`);
  for (const k of ["nome", "registro", "vigencia"]) str(errs, w, c, k);
  if (c.vigencia_fim !== undefined) {
    if (typeof c.vigencia_fim !== "string" || !DATA_ISO.test(c.vigencia_fim)) errs.push(`${w}.vigencia_fim: use o formato AAAA-MM-DD`);
    else if (c.vigencia_fim < today) warns.push(`${w}: convenção venceu em ${c.vigencia_fim} (a página pede confirmação ao vendedor)`);
  } else warns.push(`${w}: sem vigencia_fim (AAAA-MM-DD); a página não consegue avisar quando a CCT vencer`);
  num(errs, w, c, "sm", 500, 20000);
  num(errs, w, c, "acumulo", 0, 1);
  num(errs, w, c, "hnot", 0, 12);
  num(errs, w, c, "adn", 0, 1);
  num(errs, w, c, "enc", 0, 1.5);
  num(errs, w, c, "vr", 0, 500);
  num(errs, w, c, "vr_desc", 0, 500);
  if (typeof c.vr === "number" && typeof c.vr_desc === "number" && c.vr_desc > c.vr) errs.push(`${w}.vr_desc: desconto maior que o VR`);
  for (const k of ["premio", "cesta", "ppr", "social", "saude"]) num(errs, w, c, k, 0, 20000);
  num(errs, w, c, "intervalo_h", 0, 4);
  if (!Array.isArray(c.pisos) || !c.pisos.length) return errs.push(`${w}.pisos: precisa ter pelo menos uma função`);
  const seen = new Set();
  c.pisos.forEach((p, i) => {
    const wp = `${w}.pisos[${i}]`;
    if (!obj(p)) return errs.push(`${wp}: precisa ser um objeto`);
    str(errs, wp, p, "id");
    if (typeof p.id === "string") {
      if (p.id.startsWith("__")) errs.push(`${wp}.id: ids começando com "__" são reservados pela página`);
      if (seen.has(p.id)) errs.push(`${wp}.id: "${p.id}" repetido na mesma CCT`);
      seen.add(p.id);
    }
    str(errs, wp, p, "nome");
    num(errs, wp, p, "piso", 500, 50000);
    if (p.kit !== null) num(errs, wp, p, "kit", 0, 2000);
    if (p.tipo !== "limp" && p.tipo !== "mo") errs.push(`${wp}.tipo: use "limp" (ISS 7.10) ou "mo" (ISS 17.05)`);
    str(errs, wp, p, "obs", { optional: true });
  });
}

export function validateMunicipio(id, m, ccts, cfg, errs) {
  const w = `municipios["${id}"]`;
  if (!ID.test(id)) errs.push(`${w}: id deve ter só minúsculas, números e hífen (ex.: "campinas-sp")`);
  if (!obj(m)) return errs.push(`${w}: precisa ser um objeto`);
  str(errs, w, m, "nome");
  if (typeof m.uf !== "string" || !/^[A-Z]{2}$/.test(m.uf)) errs.push(`${w}.uf: duas letras maiúsculas (ex.: "SP")`);
  if (typeof m.cct !== "string" || !Object.hasOwn(ccts ?? {}, m.cct)) errs.push(`${w}.cct: "${m.cct}" não existe em ccts.json`);
  // LC 116/2003: ISS entre 2% e 5%.
  num(errs, w, m, "iss_limp", 0.02, 0.05);
  num(errs, w, m, "iss_mo", 0.02, 0.05);
  num(errs, w, m, "vt_dia", 0, 200);
  str(errs, w, m, "vt_obs", { optional: true });
  if (m.alertas !== undefined && (!Array.isArray(m.alertas) || m.alertas.some((a) => typeof a !== "string" || !a.trim())))
    errs.push(`${w}.alertas: lista de textos`);
  if (obj(cfg) && typeof cfg.pis === "number" && typeof cfg.cofins === "number")
    for (const k of ["iss_limp", "iss_mo"])
      if (typeof m[k] === "number" && m[k] + cfg.pis + cfg.cofins >= 1) errs.push(`${w}.${k}: tributos somam 100% ou mais`);
}

export function validateData({ config, ccts, municipios }, { strict = false, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], warnings = [];
  if (config === null) (strict ? errors : warnings).push("config: parâmetros Neoguard ainda não cadastrados (data/config.json = null)");
  else validateConfig(config, errors);
  if (!obj(ccts)) errors.push("ccts: precisa ser um objeto { id: convenção }");
  else for (const [id, c] of Object.entries(ccts)) validateCct(id, c, errors, warnings, today);
  if (!obj(municipios)) errors.push("municipios: precisa ser um objeto { id: município }");
  else {
    if (!Object.keys(municipios).length) (strict ? errors : warnings).push("municipios: nenhum município cadastrado");
    for (const [id, m] of Object.entries(municipios)) validateMunicipio(id, m, obj(ccts) ? ccts : {}, config, errors);
  }
  return { errors, warnings };
}

export function loadData(dir) {
  const read = (f) => {
    try { return JSON.parse(readFileSync(join(dir, f), "utf8")); }
    catch (e) { throw new Error(`${join(dir, f)}: JSON inválido ou ausente – ${e.message}`); }
  };
  return { config: read("config.json"), ccts: read("ccts.json"), municipios: read("municipios.json") };
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const dir = args.find((a) => !a.startsWith("--")) || "data";
  let res;
  try { res = validateData(loadData(dir), { strict }); }
  catch (e) { console.error(`ERRO ${e.message}`); process.exit(1); }
  for (const w of res.warnings) console.log(`AVISO ${w}`);
  for (const e of res.errors) console.error(`ERRO  ${e}`);
  console.log(`${dir}: ${res.errors.length} erro(s), ${res.warnings.length} aviso(s)${strict ? " [modo release]" : ""}`);
  process.exit(res.errors.length ? 1 : 0);
}
