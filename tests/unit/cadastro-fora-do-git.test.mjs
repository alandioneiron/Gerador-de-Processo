// O repositório é público: o cadastro real (BDI, encargos, CCTs) nunca pode ser versionado.
// data/ guarda só o esqueleto vazio; o cadastro real fica em cadastro-local/ (ignorada) e no servidor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), "utf8"));

test("data/ no git não tem cadastro real", () => {
  assert.equal(ler("config.json"), null, "data/config.json deve ser null: o cadastro real fica fora do git");
  assert.deepEqual(ler("ccts.json"), {}, "data/ccts.json deve ser {}: o cadastro real fica fora do git");
  assert.deepEqual(ler("municipios.json"), {}, "data/municipios.json deve ser {}: o cadastro real fica fora do git");
});
