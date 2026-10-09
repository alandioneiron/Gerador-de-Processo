"""Quem pode editar o quê por status, e o controle otimista de versão."""

import pytest
from sqlalchemy import update

from app.erros import MSG_VERSAO
from app.fichas import servico
from app.fichas import status as st
from app.models import Ficha
from tests.conftest import AUTOR, OUTRO_AUTOR, etapa1_completa, etapa2_completa, todos_tecnicos


ESCRITAS = {
    "etapa1": lambda: {"etapa1": {"cliente": {"razao_social": "ACME"}}},
    "etapa2": lambda: {"etapa2": {"equipamentos": {"numero_serie": "SN1"}}},
    "etapa3": lambda: {"testes_tecnicos": {"arme": True}},
    "pendencias": lambda: {"pendencias": [{"descricao": "Falta o contrato", "responsavel": "Maria"}]},
}

# Seção -> status em que o PUT é aceito (seção 3 do contrato).
PERMITIDOS = {
    "etapa1": {st.CADASTRO_EM_PREENCHIMENTO, st.PENDENCIA_CADASTRAL},
    "etapa2": {st.LIBERADO_PARA_INSTALACAO, st.EM_INSTALACAO, st.PENDENCIA_TECNICA},
    "etapa3": {st.INSTALACAO_CONCLUIDA, st.AGUARDANDO_TESTES_CCON},
    "pendencias": set(st.TODOS_STATUS) - {st.ATIVO_MONITORADO},
}


@pytest.mark.parametrize("secao", list(ESCRITAS))
@pytest.mark.parametrize("status", st.TODOS_STATUS)
def test_matriz_de_edicao_por_status(api, forcar_status, status, secao):
    ficha = forcar_status(status)
    resposta = api.salvar(ficha, secao, **ESCRITAS[secao]())

    if status in PERMITIDOS[secao]:
        assert resposta.status_code == 200, resposta.text
        assert resposta.json()["versao"] == ficha["versao"] + 1
    else:
        assert resposta.status_code == 409, resposta.text
        detalhe = resposta.json()["detail"]
        assert isinstance(detalhe, str)
        if status == st.ATIVO_MONITORADO:
            assert "somente leitura" in detalhe
        else:
            assert f"Status atual: “{st.ROTULOS[status]}”" in detalhe
        # recusado: nada mudou
        depois = api.obter(ficha["id"])
        assert depois["versao"] == ficha["versao"]
        assert depois["dados"] == ficha["dados"]
        assert len(depois["eventos"]) == len(ficha["eventos"])


def test_mensagem_de_recusa_lista_os_status_aceitos(api, forcar_status):
    ficha = forcar_status(st.EM_INSTALACAO)
    detalhe = api.salvar(ficha, "etapa1", **ESCRITAS["etapa1"]()).json()["detail"]
    assert "Cadastro em preenchimento" in detalhe
    assert "Pendência cadastral" in detalhe
    assert "Em instalação" in detalhe  # status atual


def test_primeiro_salvamento_da_etapa2_inicia_a_instalacao(api):
    ficha = api.ate_liberado()
    assert ficha["status"] == "liberado_para_instalacao"

    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2={"equipamentos": {"numero_serie": "SN1"}}))
    assert ficha["status"] == "em_instalacao"
    evento = ficha["eventos"][0]
    assert (evento["acao"], evento["status_de"], evento["status_para"]) == (
        "salvou_etapa2", "liberado_para_instalacao", "em_instalacao",
    )  # fmt: skip

    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2={"equipamentos": {"firmware": "1.2.3"}}))
    assert ficha["status"] == "em_instalacao"
    assert ficha["eventos"][0]["status_de"] == ficha["eventos"][0]["status_para"] == "em_instalacao"


def test_salvar_etapa2_em_pendencia_tecnica_nao_muda_o_status(api):
    ficha = api.ate_em_instalacao()
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao="Sensor com defeito"))
    assert ficha["status"] == "pendencia_tecnica"
    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2={"equipamentos": {"firmware": "2.0"}}))
    assert ficha["status"] == "pendencia_tecnica"


def test_etapa3_so_passa_para_aguardando_com_a_3_1_completa(api):
    ficha = api.ate_instalacao_concluida()
    assert ficha["status"] == "instalacao_concluida"

    incompleto = todos_tecnicos() | {"particoes": False}
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_tecnicos=incompleto))
    assert ficha["status"] == "instalacao_concluida"

    ficha = api.ok(api.salvar(ficha, "etapa3", testes_tecnicos={"particoes": True}))
    assert ficha["status"] == "aguardando_testes_ccon"
    assert ficha["eventos"][0]["status_de"] == "instalacao_concluida"


def test_etapa3_sem_contingencia_dispensa_esse_item_na_3_1(api):
    ficha = api.criar()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
    ficha = api.ok(api.acao(ficha, "liberar-instalacao"))
    etapa2 = etapa2_completa() | {"comunicacao": {"principal": "ethernet", "contingencia": "nao_possui"}}
    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2=etapa2))
    ficha = api.ok(api.acao(ficha, "concluir-instalacao"))

    testes = todos_tecnicos() | {"comunicacao_contingencia": False}
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_tecnicos=testes))
    assert ficha["status"] == "aguardando_testes_ccon"


def test_etapa3_aceita_testes_parciais_e_mantem_os_demais(api):
    ficha = api.ate_instalacao_concluida()
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_tecnicos={"arme": True}, testes_ccon={"disparo": True}))
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_tecnicos={"desarme": True}))
    tecnicos = ficha["dados"]["etapa3"]["testes_tecnicos"]
    assert tecnicos["arme"] is True
    assert tecnicos["desarme"] is True
    assert tecnicos["sirene"] is False
    assert ficha["dados"]["etapa3"]["testes_ccon"]["disparo"] is True


def test_validacao_ccon_nao_muda_pelo_put_da_etapa3(api):
    ficha = api.ate_instalacao_concluida()
    ficha = api.ok(
        api.salvar(
            ficha, "etapa3", validacao_ccon={"resultado": "aprovado", "operador": "Eu"}, testes_tecnicos={"arme": True}
        )
    )
    assert ficha["dados"]["etapa3"]["validacao_ccon"]["resultado"] == ""
    assert ficha["dados"]["etapa3"]["validacao_ccon"]["operador"] == ""


def test_pendencias_editaveis_em_qualquer_status_menos_ativo(api):
    ficha = api.ate_aguardando_ccon()
    pendencias = [{"descricao": "Cliente vai trocar o roteador", "responsavel": "Cliente", "prazo": "2026-12-01"}]
    ficha = api.ok(api.salvar(ficha, "pendencias", pendencias=pendencias))
    assert ficha["status"] == "aguardando_testes_ccon"
    assert ficha["dados"]["pendencias"][0]["descricao"] == "Cliente vai trocar o roteador"
    assert ficha["dados"]["pendencias"][0]["resolvido"] is False
    assert ficha["eventos"][0]["acao"] == "salvou_pendencias"

    marcada = [{**ficha["dados"]["pendencias"][0], "resolvido": True}]
    ficha = api.ok(api.salvar(ficha, "pendencias", pendencias=marcada))
    assert ficha["dados"]["pendencias"][0]["resolvido"] is True


def test_ficha_ativa_e_somente_leitura(api):
    ficha = api.ate_ativo()
    assert ficha["status"] == "ativo_monitorado"
    for secao, corpo in ESCRITAS.items():
        resposta = api.salvar(ficha, secao, **corpo())
        assert resposta.status_code == 409
        assert "somente leitura" in resposta.json()["detail"]
    for acao in ("liberar-instalacao", "concluir-instalacao", "validar-ccon", "registrar-pendencia", "retomar"):
        resposta = api.acao(ficha, acao, tipo="tecnica", descricao="x")
        assert resposta.status_code == 409, acao
        assert "somente leitura" in resposta.json()["detail"]
    assert api.obter(ficha["id"])["versao"] == ficha["versao"]


# --- controle otimista ---------------------------------------------------------------------


def test_versao_incrementa_a_cada_escrita(api):
    ficha = api.criar()
    assert ficha["versao"] == 1
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1={"cliente": {"razao_social": "A"}}))
    assert ficha["versao"] == 2
    ficha = api.ok(api.salvar(ficha, "pendencias", pendencias=[]))
    assert ficha["versao"] == 3
    # sem mudança de conteúdo também registra (e soma) a gravação
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1={}))
    assert ficha["versao"] == 4


@pytest.mark.parametrize("secao", list(ESCRITAS))
def test_versao_desatualizada_devolve_409(api, secao):
    ficha = api.ate_instalacao_concluida() if secao == "etapa3" else api.criar()
    if secao == "etapa2":
        ficha = api.ate_liberado()
    atual = api.obter(ficha["id"])
    desatualizada = {**atual, "versao": atual["versao"] - 1}

    resposta = api.salvar(desatualizada, secao, **ESCRITAS[secao]())

    assert resposta.status_code == 409
    assert resposta.json() == {"detail": MSG_VERSAO}
    assert MSG_VERSAO == "A ficha foi alterada por outra pessoa. Recarregue."
    assert api.obter(ficha["id"])["versao"] == atual["versao"]


def test_versao_futura_tambem_e_recusada(api):
    ficha = api.criar()
    resposta = api.salvar({**ficha, "versao": 99}, "etapa1", etapa1={})
    assert resposta.status_code == 409


def test_acao_com_versao_desatualizada_devolve_409(api):
    ficha = api.criar()
    api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
    resposta = api.acao(ficha, "liberar-instalacao")  # `ficha` ainda tem a versão antiga
    assert resposta.status_code == 409
    assert resposta.json()["detail"] == MSG_VERSAO


def test_duas_pessoas_editando_a_mesma_ficha(api):
    original = api.criar()
    # as duas abrem a ficha na versão 1
    a = api.salvar(original, "etapa1", autor=AUTOR, etapa1={"cliente": {"razao_social": "Versão da Maria"}})
    b = api.salvar(original, "etapa1", autor=OUTRO_AUTOR, etapa1={"cliente": {"razao_social": "Versão do João"}})
    assert a.status_code == 200
    assert b.status_code == 409

    recarregada = api.obter(original["id"])
    assert recarregada["dados"]["etapa1"]["cliente"]["razao_social"] == "Versão da Maria"
    # depois de recarregar, o João consegue salvar
    depois = api.salvar(recarregada, "etapa1", autor=OUTRO_AUTOR, etapa1={"cliente": {"vendedor": "João"}})
    assert depois.status_code == 200
    assert depois.json()["dados"]["etapa1"]["cliente"]["razao_social"] == "Versão da Maria"


def test_conflito_detectado_na_hora_de_gravar(api, engine, monkeypatch):
    """Outra gravação entra entre a leitura e o commit: o UPDATE condicional falha e vira 409."""
    ficha = api.criar()
    original = servico._registrar_evento

    def com_concorrencia(db, registro, *args, **kwargs):
        with engine.begin() as conexao:
            conexao.execute(update(Ficha).where(Ficha.id == registro.id).values(versao=Ficha.versao + 1))
        return original(db, registro, *args, **kwargs)

    monkeypatch.setattr(servico, "_registrar_evento", com_concorrencia)
    resposta = api.salvar(ficha, "etapa1", etapa1={"cliente": {"razao_social": "Perdida"}})

    assert resposta.status_code == 409
    assert resposta.json()["detail"] == MSG_VERSAO
    monkeypatch.undo()
    guardada = api.obter(ficha["id"])
    assert guardada["dados"]["etapa1"]["cliente"]["razao_social"] == ""
    assert len(guardada["eventos"]) == 1  # nenhum evento órfão
