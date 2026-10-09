"""Merge profundo com o esqueleto, tipos e opções válidas."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.erros import ErroNegocio
from app.fichas.modelo import aplicar_secao, mesclar, modelo_vazio, normalizar
from app.models import Ficha
from tests.conftest import etapa1_completa

# --- funções puras -----------------------------------------------------------------------


def test_merge_mantem_todas_as_chaves_do_esqueleto():
    dados = aplicar_secao(modelo_vazio(), ("etapa1",), {"cliente": {"razao_social": "ACME"}})

    assert dados["etapa1"]["cliente"]["razao_social"] == "ACME"
    assert dados["etapa1"]["cliente"]["telefone"] == ""
    assert set(dados["etapa1"]) == set(modelo_vazio()["etapa1"])
    assert len(dados["etapa1"]["usuarios"]) == 8  # lista não enviada: mantém as linhas
    assert dados["etapa2"] == modelo_vazio()["etapa2"]  # outras etapas intocadas


def test_merge_campo_ausente_mantem_o_valor_guardado():
    dados = aplicar_secao(modelo_vazio(), ("etapa1",), {"cliente": {"razao_social": "ACME", "telefone": "123"}})
    dados = aplicar_secao(dados, ("etapa1",), {"cliente": {"razao_social": "ACME 2"}})

    assert dados["etapa1"]["cliente"]["razao_social"] == "ACME 2"
    assert dados["etapa1"]["cliente"]["telefone"] == "123"


def test_merge_null_volta_ao_padrao():
    dados = aplicar_secao(modelo_vazio(), ("etapa1",), {"cliente": {"telefone": "123"}})
    dados = aplicar_secao(dados, ("etapa1",), {"cliente": {"telefone": None}})
    assert dados["etapa1"]["cliente"]["telefone"] == ""


def test_merge_descarta_chaves_desconhecidas():
    dados = aplicar_secao(modelo_vazio(), ("etapa1",), {"cliente": {"inventado": "x"}, "outra_secao": {}})
    assert "inventado" not in dados["etapa1"]["cliente"]
    assert "outra_secao" not in dados["etapa1"]


def test_merge_tabela_e_substituida_e_linhas_completadas():
    dados = aplicar_secao(modelo_vazio(), ("etapa1",), {"contatos": [{"nome": "Ana"}, {"nome": "Bia", "decide": "sim"}]})

    contatos = dados["etapa1"]["contatos"]
    assert [c["nome"] for c in contatos] == ["Ana", "Bia"]  # substituiu as 5 linhas iniciais
    assert set(contatos[0]) == set(modelo_vazio()["etapa1"]["contatos"][0])  # linha completada
    assert contatos[0]["tel_principal"] == ""
    assert contatos[1]["decide"] == "sim"


def test_merge_tabela_vazia_e_permitida():
    dados = aplicar_secao(modelo_vazio(), ("etapa1",), {"ambientes": []})
    assert dados["etapa1"]["ambientes"] == []


def test_merge_etapa3_so_toca_na_subsecao():
    dados = aplicar_secao(modelo_vazio(), ("etapa3", "testes_ccon"), {"disparo": True})
    assert dados["etapa3"]["testes_ccon"]["disparo"] is True
    assert dados["etapa3"]["testes_ccon"]["aplicativo"] is False
    assert dados["etapa3"]["testes_tecnicos"] == modelo_vazio()["etapa3"]["testes_tecnicos"]


def test_normalizar_completa_ficha_guardada_no_formato_antigo():
    antiga = {"etapa1": {"cliente": {"razao_social": "Velha"}}}
    dados = normalizar(antiga)

    assert dados["etapa1"]["cliente"]["razao_social"] == "Velha"
    assert dados["etapa2"]["zonas"][0]["zona"] == "Z01"
    assert len(dados["pendencias"]) == 3


def test_normalizar_nao_altera_o_original():
    antiga = {"etapa1": {"cliente": {"razao_social": "Velha"}}}
    normalizar(antiga)
    assert antiga == {"etapa1": {"cliente": {"razao_social": "Velha"}}}


def test_numeros_viram_texto_e_texto_e_aparado():
    dados = aplicar_secao(modelo_vazio(), ("etapa1",), {"cliente": {"telefone": 1140001234, "endereco": "  Rua A  "}})
    assert dados["etapa1"]["cliente"]["telefone"] == "1140001234"
    assert dados["etapa1"]["cliente"]["endereco"] == "Rua A"


@pytest.mark.parametrize(
    ("caminho", "conteudo", "trecho"),
    [
        (("etapa1",), {"cliente": "texto"}, "etapa1.cliente"),
        (("etapa1",), {"cliente": {"telefone": ["x"]}}, "etapa1.cliente.telefone"),
        (("etapa1",), {"particularidades": {"animais": "sim"}}, "verdadeiro ou falso"),
        (("etapa1",), {"contatos": {"nome": "x"}}, "deve ser uma lista"),
        (("etapa1",), {"contatos": ["x"]}, "etapa1.contatos[0]"),
        (("etapa1",), {"usuarios": [{}, {"usa_app": "talvez"}]}, "etapa1.usuarios[1].usa_app"),
        (("etapa1",), {"usuarios": [{"permissao": "tudo"}]}, "arma_desarma"),
        (("etapa1",), {"cliente": {"telefone": "x" * 5001}}, "longo demais"),
        (("etapa2",), {"equipamentos": {"modelo_central": "AMT 9999"}}, "AMT 2018 E3G"),
        (("etapa2",), {"comunicacao": {"principal": "satelite"}}, "ethernet"),
        (("etapa2",), {"comunicacao": {"contingencia": "satelite"}}, "nao_possui"),
        (("etapa2",), {"configuracoes": {"panico": 1}}, "verdadeiro ou falso"),
        (("etapa3", "testes_ccon"), {"disparo": "sim"}, "verdadeiro ou falso"),
        (("pendencias",), [{"resolvido": "sim"}], "pendencias[0].resolvido"),
    ],
)
def test_merge_recusa_tipos_e_opcoes_invalidos(caminho, conteudo, trecho):
    with pytest.raises(ErroNegocio) as erro:
        aplicar_secao(modelo_vazio(), caminho, conteudo)
    assert erro.value.status_code == 422
    assert trecho in erro.value.detail


def test_mesclar_limita_linhas():
    with pytest.raises(ErroNegocio) as erro:
        mesclar(modelo_vazio(), modelo_vazio(), {"etapa1": {"ambientes": [{} for _ in range(301)]}})
    assert "linhas demais" in erro.value.detail


# --- pela API -----------------------------------------------------------------------------


def test_put_etapa1_parcial_nao_perde_o_que_ja_estava_salvo(api):
    ficha = api.criar()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1={"cliente": {"vendedor": "Outro Vendedor"}}))

    cliente = ficha["dados"]["etapa1"]["cliente"]
    assert cliente["vendedor"] == "Outro Vendedor"
    assert cliente["razao_social"] == "Padaria Exemplo Ltda"
    assert ficha["dados"]["etapa1"]["contatos"][0]["nome"] == "Dona Ana"


def test_put_devolve_ficha_completa_com_todas_as_chaves(api):
    ficha = api.criar()
    resposta = api.ok(api.salvar(ficha, "etapa1", etapa1={"cliente": {"razao_social": "ACME"}}))
    esqueleto = modelo_vazio()
    assert set(resposta["dados"]) == set(esqueleto)
    for etapa in ("etapa1", "etapa2", "etapa3"):
        assert set(resposta["dados"][etapa]) == set(esqueleto[etapa])


def test_ordem_dos_contatos_acompanha_a_posicao(api):
    ficha = api.criar()
    contatos = [{"ordem": 9, "nome": "Segundo da lista"}, {"ordem": 1, "nome": "Terceiro"}]
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1={"contatos": contatos}))
    assert [(c["ordem"], c["nome"]) for c in ficha["dados"]["etapa1"]["contatos"]] == [
        (1, "Segundo da lista"),
        (2, "Terceiro"),
    ]


def test_data_prevista_precisa_ser_iso(api):
    ficha = api.criar()
    resposta = api.salvar(ficha, "etapa1", etapa1={"cliente": {"data_prevista": "20/11/2026"}})
    assert resposta.status_code == 422
    assert "AAAA-MM-DD" in resposta.json()["detail"]
    # nada foi gravado
    assert api.obter(ficha["id"])["versao"] == ficha["versao"]


def test_put_com_opcao_invalida_devolve_422_em_portugues(api):
    ficha = api.criar()
    resposta = api.salvar(ficha, "etapa1", etapa1={"usuarios": [{"usa_app": "talvez"}]})
    assert resposta.status_code == 422
    assert "etapa1.usuarios[0].usa_app" in resposta.json()["detail"]


def test_ficha_guardada_em_formato_antigo_e_completada_no_proximo_salvamento(api, engine):
    ficha = api.criar()
    fabrica = sessionmaker(bind=engine)
    with fabrica() as sessao:
        registro = sessao.scalars(select(Ficha)).one()
        registro.dados = {"etapa1": {"cliente": {"razao_social": "Antiga"}}}
        sessao.commit()
        versao = registro.versao

    resposta = api.salvar({"id": ficha["id"], "versao": versao}, "etapa1", etapa1={"cliente": {"telefone": "1"}})
    dados = api.ok(resposta)["dados"]
    assert dados["etapa1"]["cliente"]["razao_social"] == "Antiga"
    assert dados["etapa1"]["cliente"]["telefone"] == "1"
    assert set(dados) == set(modelo_vazio())
    assert len(dados["etapa2"]["zonas"]) == 10


def test_palavra_de_seguranca_guarda_so_o_desejo(api):
    ficha = api.criar()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1={"ccon": {"palavra_seguranca": "sim"}}))
    assert ficha["dados"]["etapa1"]["ccon"]["palavra_seguranca"] == "sim"
    resposta = api.salvar(ficha, "etapa1", etapa1={"ccon": {"palavra_seguranca": "abracadabra"}})
    assert resposta.status_code == 422  # o conteúdo da palavra nunca é aceito
