"""Saúde, esqueleto, criação, listagem, busca e validação do autor."""

from datetime import UTC, datetime

import pytest

from tests.conftest import AUTOR, etapa1_completa


def test_saude(client):
    resposta = client.get("/api/saude")
    assert resposta.status_code == 200
    assert resposta.json() == {"ok": True, "versao": "dev"}


def test_saude_mostra_git_sha(client, configurar):
    configurar(git_sha="abc1234")
    assert client.get("/api/saude").json()["versao"] == "abc1234"


def test_modelo_traz_o_esqueleto_completo(client):
    modelo = client.get("/api/fichas/modelo").json()

    assert set(modelo) == {"etapa1", "etapa2", "etapa3", "pendencias"}
    assert set(modelo["etapa1"]) == {
        "cliente", "contatos", "usuarios", "areas_independentes", "ambientes", "rotina", "particularidades", "ccon",
    }  # fmt: skip
    assert set(modelo["etapa2"]) == {
        "equipamentos", "comunicacao", "zonas", "particoes", "usuarios_config", "configuracoes",
    }  # fmt: skip
    assert set(modelo["etapa3"]) == {"testes_tecnicos", "testes_ccon", "validacao_ccon"}

    # linhas iniciais do docx
    assert len(modelo["etapa1"]["contatos"]) == 5
    assert [c["ordem"] for c in modelo["etapa1"]["contatos"]] == [1, 2, 3, 4, 5]
    assert len(modelo["etapa1"]["usuarios"]) == 8
    assert len(modelo["etapa1"]["ambientes"]) == 6
    assert [z["zona"] for z in modelo["etapa2"]["zonas"]] == [f"Z{i:02d}" for i in range(1, 11)]
    assert [p["particao"] for p in modelo["etapa2"]["particoes"]] == ["A", "B", "Comum"]
    assert len(modelo["pendencias"]) == 3

    # tipos: checkbox = false, texto = "", sem senha em 1.3
    assert len(modelo["etapa1"]["particularidades"]) == 15  # 14 checkboxes + observações
    assert modelo["etapa1"]["particularidades"]["animais"] is False
    assert modelo["etapa1"]["cliente"]["razao_social"] == ""
    assert len(modelo["etapa3"]["testes_tecnicos"]) == 12
    assert len(modelo["etapa3"]["testes_ccon"]) == 13
    assert not any("senha" in chave for chave in modelo["etapa1"]["usuarios"][0])


def test_modelo_nao_e_confundido_com_id(client):
    assert client.get("/api/fichas/modelo").status_code == 200


def test_criar_ficha(api):
    ficha = api.criar()

    ano = datetime.now(UTC).year
    assert ficha["numero"] == 1
    assert ficha["codigo"] == f"FI-{ano}-0001"
    assert ficha["status"] == "cadastro_em_preenchimento"
    assert ficha["versao"] == 1
    assert ficha["dados"]["etapa1"]["cliente"]["razao_social"] == ""
    assert len(ficha["dados"]["etapa1"]["usuarios"]) == 8
    assert ficha["criado_em"].endswith(("Z", "+00:00"))  # sempre com fuso (UTC)
    assert len(ficha["eventos"]) == 1
    assert ficha["eventos"][0]["acao"] == "criou"
    assert ficha["eventos"][0]["autor_nome"] == AUTOR["nome"]
    assert ficha["eventos"][0]["status_de"] is None
    assert ficha["eventos"][0]["status_para"] == "cadastro_em_preenchimento"


def test_numeros_sao_sequenciais(api):
    ano = datetime.now(UTC).year
    primeira, segunda, terceira = api.criar(), api.criar(), api.criar()
    assert [primeira["numero"], segunda["numero"], terceira["numero"]] == [1, 2, 3]
    assert terceira["codigo"] == f"FI-{ano}-0003"


def test_numero_nao_e_reaproveitado_apos_falha(api, client):
    api.criar()
    # um POST inválido (sem e-mail) não pode consumir número
    assert client.post("/api/fichas", json={"autor": {"nome": "X", "email": "x"}}).status_code == 422
    assert api.criar()["numero"] == 2


def test_criar_com_dados_iniciais(api):
    dados = {"etapa1": etapa1_completa(), "etapa3": {"validacao_ccon": {"resultado": "aprovado"}}}
    ficha = api.criar(dados=dados)

    assert ficha["dados"]["etapa1"]["cliente"]["razao_social"] == "Padaria Exemplo Ltda"
    # a validação da CCON só muda pela ação validar-ccon
    assert ficha["dados"]["etapa3"]["validacao_ccon"]["resultado"] == ""
    # o esqueleto continua completo
    assert len(ficha["dados"]["etapa1"]["ambientes"]) == 6


def test_buscar_ficha_por_id(api, client):
    criada = api.criar()
    obtida = client.get(f"/api/fichas/{criada['id']}").json()
    assert obtida == criada


def test_buscar_ficha_inexistente(client):
    resposta = client.get("/api/fichas/999")
    assert resposta.status_code == 404
    assert resposta.json() == {"detail": "Ficha não encontrada."}


def test_listar_devolve_resumo(api, client):
    ficha = api.criar()
    api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))

    lista = client.get("/api/fichas").json()
    assert len(lista) == 1
    item = lista[0]
    assert set(item) == {
        "id", "numero", "codigo", "status", "cliente", "vendedor", "data_prevista", "criado_em", "atualizado_em",
    }  # fmt: skip
    assert item["cliente"] == "Padaria Exemplo Ltda"
    assert item["vendedor"] == "Carlos Vendedor"
    assert item["data_prevista"] == "2026-11-20"
    assert item["status"] == "cadastro_em_preenchimento"


def test_cliente_usa_nome_fantasia_sem_razao_social(api, client):
    ficha = api.criar()
    api.ok(api.salvar(ficha, "etapa1", etapa1={"cliente": {"nome_fantasia": "Padoca do Zé"}}))
    assert client.get("/api/fichas").json()[0]["cliente"] == "Padoca do Zé"


def _criar_tres(api):
    for razao, vendedor, cnpj in [
        ("Padaria Alfa", "Carlos", "11.111.111/0001-11"),
        ("Mercado Beta", "Débora", "22.222.222/0001-22"),
        ("Farmácia Gama", "Carlos", "33.333.333/0001-33"),
    ]:
        ficha = api.criar()
        api.ok(
            api.salvar(
                ficha, "etapa1", etapa1={"cliente": {"razao_social": razao, "vendedor": vendedor, "cpf_cnpj": cnpj}}
            )
        )


@pytest.mark.parametrize(
    ("q", "esperados"),
    [
        ("alfa", ["Padaria Alfa"]),
        ("MERCADO", ["Mercado Beta"]),
        ("carlos", ["Farmácia Gama", "Padaria Alfa"]),
        ("22.222.222", ["Mercado Beta"]),
        ("333333330001", ["Farmácia Gama"]),  # só dígitos casa com CNPJ formatado
        ("0003", ["Farmácia Gama"]),  # código
        ("inexistente", []),
        ("%", []),  # curinga do LIKE é tratado como texto
    ],
)
def test_busca_q(api, client, q, esperados):
    _criar_tres(api)
    clientes = sorted(f["cliente"] for f in client.get("/api/fichas", params={"q": q}).json())
    assert clientes == sorted(esperados)


def test_filtro_por_status(api, client):
    _criar_tres(api)
    ficha = api.ate_liberado()

    liberadas = client.get("/api/fichas", params={"status": "liberado_para_instalacao"}).json()
    assert [f["id"] for f in liberadas] == [ficha["id"]]
    em_cadastro = client.get("/api/fichas", params={"status": "cadastro_em_preenchimento"}).json()
    assert len(em_cadastro) == 3
    assert len(client.get("/api/fichas", params={"status": ""}).json()) == 4

    invalido = client.get("/api/fichas", params={"status": "inventado"})
    assert invalido.status_code == 422
    assert "Status inválido" in invalido.json()["detail"]


def test_listagem_mais_recente_primeiro(api, client):
    primeira = api.criar()
    segunda = api.criar()
    api.ok(api.salvar(primeira, "etapa1", etapa1={"cliente": {"razao_social": "Atualizada depois"}}))
    ids = [f["id"] for f in client.get("/api/fichas").json()]
    assert ids == [primeira["id"], segunda["id"]]


# --- autor obrigatório ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("autor", "trecho"),
    [
        (None, "autor"),
        ({}, "autor.nome"),
        ({"nome": "", "email": "a@b.com"}, "autor.nome"),
        ({"nome": "   ", "email": "a@b.com"}, "autor.nome"),
        ({"nome": "Ana"}, "autor.email"),
        ({"nome": "Ana", "email": ""}, "autor.email"),
        ({"nome": "Ana", "email": "ana"}, "autor.email"),
        ({"nome": "Ana", "email": "ana@semponto"}, "autor.email"),
        ({"nome": "Ana", "email": "a na@x.com"}, "autor.email"),
    ],
)
def test_autor_invalido_na_criacao(client, autor, trecho):
    corpo = {} if autor is None else {"autor": autor}
    resposta = client.post("/api/fichas", json=corpo)
    assert resposta.status_code == 422
    detalhe = resposta.json()["detail"]
    assert isinstance(detalhe, str)
    assert trecho in detalhe


def test_autor_obrigatorio_em_toda_escrita(api, client):
    ficha = api.criar()
    url = f"/api/fichas/{ficha['id']}"
    sem_autor = {"versao": 1}
    escritas = [
        ("put", f"{url}/etapa1", {**sem_autor, "etapa1": {}}),
        ("put", f"{url}/etapa2", {**sem_autor, "etapa2": {}}),
        ("put", f"{url}/etapa3", {**sem_autor}),
        ("put", f"{url}/pendencias", {**sem_autor, "pendencias": []}),
        ("post", f"{url}/acoes/liberar-instalacao", {**sem_autor}),
    ]
    for metodo, caminho, corpo in escritas:
        resposta = getattr(client, metodo)(caminho, json=corpo)
        assert resposta.status_code == 422, caminho
        assert "autor" in resposta.json()["detail"]


def test_versao_obrigatoria(api, client):
    ficha = api.criar()
    resposta = client.put(f"/api/fichas/{ficha['id']}/etapa1", json={"autor": AUTOR, "etapa1": {}})
    assert resposta.status_code == 422
    assert "versao" in resposta.json()["detail"]


def test_json_malformado(client):
    resposta = client.post("/api/fichas", content="{nao e json", headers={"content-type": "application/json"})
    assert resposta.status_code == 422
    assert isinstance(resposta.json()["detail"], str)


def test_rota_inexistente_tem_detail_em_portugues(client):
    resposta = client.get("/api/nao-existe")
    assert resposta.status_code == 404
    assert resposta.json() == {"detail": "Recurso não encontrado."}


def test_cors_so_para_o_vite_local(client):
    permitido = client.options(
        "/api/fichas",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert permitido.headers.get("access-control-allow-origin") == "http://localhost:5173"
    negado = client.options(
        "/api/fichas",
        headers={"Origin": "http://exemplo.com", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in negado.headers
