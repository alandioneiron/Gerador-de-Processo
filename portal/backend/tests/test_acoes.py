"""Ações de workflow, travas (casos que bloqueiam e que liberam), pendências e histórico."""

import copy

import pytest

from app.fichas import status as st
from app.fichas.modelo import modelo_vazio
from app.fichas.travas import (
    faltas_concluir_instalacao,
    faltas_liberar_instalacao,
    faltas_validar_ccon,
)
from tests.conftest import (
    AUTOR,
    OUTRO_AUTOR,
    etapa1_completa,
    etapa2_completa,
    todos_ccon,
    todos_tecnicos,
    validacao_aprovada,
)

# --- fluxo completo e histórico -----------------------------------------------------------


def test_fluxo_completo_ate_ativo_com_historico(api):
    ficha = api.criar(autor=AUTOR)
    ficha = api.ok(api.salvar(ficha, "etapa1", autor=AUTOR, etapa1=etapa1_completa()))
    ficha = api.ok(api.acao(ficha, "liberar-instalacao", autor=AUTOR))
    assert ficha["status"] == "liberado_para_instalacao"
    ficha = api.ok(api.salvar(ficha, "etapa2", autor=OUTRO_AUTOR, etapa2=etapa2_completa()))
    assert ficha["status"] == "em_instalacao"
    ficha = api.ok(api.acao(ficha, "concluir-instalacao", autor=OUTRO_AUTOR))
    assert ficha["status"] == "instalacao_concluida"
    ficha = api.ok(api.salvar(ficha, "etapa3", autor=OUTRO_AUTOR, testes_tecnicos=todos_tecnicos()))
    assert ficha["status"] == "aguardando_testes_ccon"
    ficha = api.ok(api.salvar(ficha, "etapa3", autor=OUTRO_AUTOR, testes_ccon=todos_ccon()))
    ficha = api.ok(api.acao(ficha, "validar-ccon", autor=AUTOR, validacao_ccon=validacao_aprovada()))
    assert ficha["status"] == "ativo_monitorado"
    assert ficha["dados"]["etapa3"]["validacao_ccon"]["resultado"] == "aprovado"
    assert ficha["dados"]["etapa3"]["validacao_ccon"]["operador"] == "Operador CCON"

    # histórico: mais recente primeiro; cada passo com autor e status de/para
    sequencia = [(e["acao"], e["status_de"], e["status_para"], e["autor_nome"]) for e in ficha["eventos"]]
    assert sequencia == [
        ("validar-ccon", "aguardando_testes_ccon", "ativo_monitorado", AUTOR["nome"]),
        ("salvou_etapa3", "aguardando_testes_ccon", "aguardando_testes_ccon", OUTRO_AUTOR["nome"]),
        ("salvou_etapa3", "instalacao_concluida", "aguardando_testes_ccon", OUTRO_AUTOR["nome"]),
        ("concluir-instalacao", "em_instalacao", "instalacao_concluida", OUTRO_AUTOR["nome"]),
        ("salvou_etapa2", "liberado_para_instalacao", "em_instalacao", OUTRO_AUTOR["nome"]),
        ("liberar-instalacao", "cadastro_em_preenchimento", "liberado_para_instalacao", AUTOR["nome"]),
        ("salvou_etapa1", "cadastro_em_preenchimento", "cadastro_em_preenchimento", AUTOR["nome"]),
        ("criou", None, "cadastro_em_preenchimento", AUTOR["nome"]),
    ]
    assert all(e["autor_email"] and e["em"] and e["resumo"] for e in ficha["eventos"])
    assert ficha["eventos"][0]["autor_email"] == AUTOR["email"]


def test_acao_desconhecida(api):
    ficha = api.criar()
    resposta = api.acao(ficha, "explodir")
    assert resposta.status_code == 404
    assert "Ação desconhecida" in resposta.json()["detail"]


def test_acao_em_status_errado_devolve_409(api):
    ficha = api.ate_em_instalacao()
    resposta = api.acao(ficha, "liberar-instalacao")
    assert resposta.status_code == 409
    assert "Liberar para instalação" in resposta.json()["detail"]
    assert "Em instalação" in resposta.json()["detail"]
    assert api.acao(ficha, "validar-ccon", validacao_ccon=validacao_aprovada()).status_code == 409
    assert api.acao(ficha, "retomar").status_code == 409


# --- liberar-instalacao -------------------------------------------------------------------


def test_travas_de_ficha_vazia(api, client):
    ficha = api.criar()
    travas = client.get(f"/api/fichas/{ficha['id']}/travas").json()
    assert set(travas) == {"liberar-instalacao", "concluir-instalacao", "validar-ccon"}
    assert len(travas["liberar-instalacao"]) == 7  # 5 campos do cliente + contato + usuário
    assert len(travas["concluir-instalacao"]) == 5
    assert len(travas["validar-ccon"]) == 11 + 12  # 3.1 e 3.2 sem o item do app (ninguém usa) = 11 + 12


def test_liberar_bloqueado_devolve_422_com_faltas(api, client):
    ficha = api.criar()
    resposta = api.acao(ficha, "liberar-instalacao")

    assert resposta.status_code == 422
    corpo = resposta.json()
    assert set(corpo) == {"detail", "faltas"}
    assert isinstance(corpo["detail"], str)
    assert len(corpo["faltas"]) == 7
    assert any("razão social" in f for f in corpo["faltas"])
    assert any("endereço" in f for f in corpo["faltas"])
    assert any("contato" in f for f in corpo["faltas"])
    # as mesmas faltas que a tela vê antes de clicar
    assert client.get(f"/api/fichas/{ficha['id']}/travas").json()["liberar-instalacao"] == corpo["faltas"]
    # recusado: nada mudou
    depois = api.obter(ficha["id"])
    assert depois["status"] == "cadastro_em_preenchimento"
    assert depois["versao"] == ficha["versao"]
    assert len(depois["eventos"]) == 1


@pytest.mark.parametrize(
    ("campo", "trecho"),
    [
        ("razao_social", "razão social"),
        ("endereco", "endereço"),
        ("telefone", "telefone"),
        ("vendedor", "vendedor"),
        ("data_prevista", "data prevista"),
    ],
)
def test_liberar_exige_cada_campo_do_cliente(api, campo, trecho):
    ficha = api.criar()
    etapa1 = etapa1_completa()
    etapa1["cliente"][campo] = "   "  # só espaços não conta
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))

    faltas = api.acao(ficha, "liberar-instalacao").json()["faltas"]
    assert len(faltas) == 1
    assert trecho in faltas[0]


def test_liberar_exige_contato_com_nome_e_telefone_principal(api):
    ficha = api.criar()
    etapa1 = etapa1_completa()
    etapa1["contatos"] = [{"nome": "Só nome"}, {"tel_principal": "(11) 99999-0002"}]
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))
    faltas = api.acao(ficha, "liberar-instalacao").json()["faltas"]
    assert len(faltas) == 1
    assert "contato" in faltas[0]

    etapa1["contatos"].append({"nome": "Completo", "tel_principal": "(11) 99999-0003"})
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))
    assert api.acao(ficha, "liberar-instalacao").status_code == 200


def test_liberar_exige_usuario_com_nome_e_permissao(api):
    ficha = api.criar()
    etapa1 = etapa1_completa()
    etapa1["usuarios"] = [{"nome": "Sem permissão"}, {"permissao": "so_arma"}]
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))
    faltas = api.acao(ficha, "liberar-instalacao").json()["faltas"]
    assert len(faltas) == 1
    assert "usuário" in faltas[0]


def test_liberar_usuario_que_usa_app_precisa_de_email(api):
    """Exceção: o e-mail só é exigido de quem usa o aplicativo."""
    ficha = api.criar()
    etapa1 = etapa1_completa()
    etapa1["usuarios"] = [
        {"nome": "Dona Ana", "permissao": "arma_desarma", "usa_app": "sim", "email_app": ""},
        {"nome": "Seu José", "permissao": "so_arma", "usa_app": "nao", "email_app": ""},  # porteiro: sem e-mail
        {"nome": "Sem resposta", "permissao": "so_arma", "usa_app": ""},
    ]
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))
    faltas = api.acao(ficha, "liberar-instalacao").json()["faltas"]
    assert len(faltas) == 1
    assert "Dona Ana" in faltas[0]
    assert "e-mail" in faltas[0]

    etapa1["usuarios"][0]["email_app"] = "ana@example.com"
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))
    assert api.acao(ficha, "liberar-instalacao").status_code == 200


def test_liberar_a_partir_da_pendencia_cadastral(api):
    ficha = api.criar()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="cadastral", descricao="Confirmar CNPJ"))
    assert ficha["status"] == "pendencia_cadastral"
    ficha = api.ok(api.acao(ficha, "liberar-instalacao"))
    assert ficha["status"] == "liberado_para_instalacao"
    assert ficha["eventos"][0]["status_de"] == "pendencia_cadastral"


# --- concluir-instalacao ------------------------------------------------------------------


def test_concluir_bloqueado_devolve_faltas(api, client):
    ficha = api.ate_liberado()
    resposta = api.acao(ficha, "concluir-instalacao")  # ainda em liberado: status errado
    assert resposta.status_code == 409

    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2={"equipamentos": {"firmware": "1"}}))
    resposta = api.acao(ficha, "concluir-instalacao")
    assert resposta.status_code == 422
    faltas = resposta.json()["faltas"]
    assert len(faltas) == 5
    assert client.get(f"/api/fichas/{ficha['id']}/travas").json()["concluir-instalacao"] == faltas
    assert api.obter(ficha["id"])["status"] == "em_instalacao"


@pytest.mark.parametrize(
    ("alteracao", "trecho"),
    [
        ({"equipamentos": {"modelo_central": ""}}, "modelo da central"),
        ({"equipamentos": {"numero_serie": ""}}, "número de série"),
        ({"comunicacao": {"principal": ""}}, "comunicação principal"),
        ({"zonas": [{"zona": "Z01", "ambiente": "Entrada"}]}, "zona"),  # falta o dispositivo
        ({"zonas": [{"zona": "Z01", "dispositivo": "Sensor"}]}, "zona"),  # falta o ambiente
        ({"usuarios_config": {"confirmado": "nao"}}, "usuários"),
        ({"usuarios_config": {"confirmado": ""}}, "usuários"),
    ],
)
def test_concluir_exige_cada_item(api, alteracao, trecho):
    ficha = api.ate_liberado()
    etapa2 = copy.deepcopy(etapa2_completa())
    for secao, valor in alteracao.items():
        etapa2[secao] = valor if isinstance(valor, list) else {**etapa2[secao], **valor}
    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2=etapa2))

    faltas = api.acao(ficha, "concluir-instalacao").json()["faltas"]
    assert len(faltas) == 1
    assert trecho in faltas[0]


def test_concluir_modelo_outro_exige_o_nome_do_modelo(api):
    ficha = api.ate_liberado()
    etapa2 = etapa2_completa()
    etapa2["equipamentos"] = {"modelo_central": "outro", "modelo_outro": "", "numero_serie": "SN1"}
    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2=etapa2))
    faltas = api.acao(ficha, "concluir-instalacao").json()["faltas"]
    assert len(faltas) == 1
    assert "Outro" in faltas[0]

    etapa2["equipamentos"]["modelo_outro"] = "AMT 4010"
    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2=etapa2))
    assert api.acao(ficha, "concluir-instalacao").status_code == 200


def test_concluir_exige_particao_a_so_com_areas_independentes(api):
    """Exceção: sem áreas independentes, a tabela 2.4 não é exigida."""
    ficha = api.criar()
    etapa1 = etapa1_completa() | {"areas_independentes": {"possui": "sim", "area1": "Loja", "area2": "Estoque"}}
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))
    ficha = api.ok(api.acao(ficha, "liberar-instalacao"))
    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2=etapa2_completa()))

    faltas = api.acao(ficha, "concluir-instalacao").json()["faltas"]
    assert len(faltas) == 1
    assert "partição A" in faltas[0]

    particoes = [{"particao": "A", "nome_area": "Loja"}, {"particao": "B", "nome_area": "Estoque"}]
    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2={"particoes": particoes}))
    assert api.acao(ficha, "concluir-instalacao").status_code == 200


def test_concluir_sem_areas_independentes_nao_exige_particoes(api):
    ficha = api.ate_em_instalacao()  # etapa1_completa não tem áreas independentes
    assert ficha["dados"]["etapa2"]["particoes"][0]["nome_area"] == ""
    assert api.acao(ficha, "concluir-instalacao").status_code == 200


def test_concluir_a_partir_da_pendencia_tecnica(api):
    ficha = api.ate_em_instalacao()
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao="Falta bateria"))
    ficha = api.ok(api.acao(ficha, "concluir-instalacao"))
    assert ficha["status"] == "instalacao_concluida"
    assert ficha["eventos"][0]["status_de"] == "pendencia_tecnica"


# --- validar-ccon -------------------------------------------------------------------------


def test_validar_bloqueado_com_testes_incompletos(api, client):
    ficha = api.ate_aguardando_ccon()
    esperadas = client.get(f"/api/fichas/{ficha['id']}/travas").json()["validar-ccon"]
    assert len(esperadas) == 13  # os 13 itens da 3.2: um usuário usa o aplicativo

    resposta = api.acao(ficha, "validar-ccon", validacao_ccon=validacao_aprovada())
    assert resposta.status_code == 422
    faltas = resposta.json()["faltas"]
    assert faltas == esperadas  # a validação está preenchida, só faltam os testes
    assert all("(3.2)" in f for f in faltas)
    assert api.obter(ficha["id"])["status"] == "aguardando_testes_ccon"


def test_validar_exige_preenchimento_da_3_3(api):
    ficha = api.ate_aguardando_ccon()
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_ccon=todos_ccon()))
    vazia = {"resultado": "aprovado"}
    faltas = api.acao(ficha, "validar-ccon", validacao_ccon=vazia).json()["faltas"]
    assert len(faltas) == 3 + 5  # operador, data, hora + os 5 itens
    assert any("operador" in f for f in faltas)
    assert any("data" in f for f in faltas)
    assert any("hora" in f for f in faltas)


@pytest.mark.parametrize("item", ["cadastro", "comunicacao", "eventos", "contatos", "regras_operacionais"])
@pytest.mark.parametrize("valor", ["pendente", ""])
def test_aprovar_exige_os_5_itens_ok(api, item, valor):
    ficha = api.ate_aguardando_ccon()
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_ccon=todos_ccon()))
    validacao = validacao_aprovada() | {item: valor}
    resposta = api.acao(ficha, "validar-ccon", validacao_ccon=validacao)
    assert resposta.status_code == 422
    assert len(resposta.json()["faltas"]) == 1


@pytest.mark.parametrize("campo", ["operador", "data", "hora"])
def test_aprovar_exige_operador_data_e_hora(api, campo):
    ficha = api.ate_aguardando_ccon()
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_ccon=todos_ccon()))
    resposta = api.acao(ficha, "validar-ccon", validacao_ccon=validacao_aprovada() | {campo: " "})
    assert resposta.status_code == 422
    assert len(resposta.json()["faltas"]) == 1


def test_validar_aprovado_ativa(api):
    ficha = api.ate_aguardando_ccon()
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_ccon=todos_ccon()))
    resposta = api.acao(ficha, "validar-ccon", validacao_ccon=validacao_aprovada())
    ficha = api.ok(resposta)
    assert ficha["status"] == "ativo_monitorado"
    validacao = ficha["dados"]["etapa3"]["validacao_ccon"]
    assert (validacao["operador"], validacao["data"], validacao["hora"]) == ("Operador CCON", "2026-11-25", "14:30")
    assert validacao["observacoes"] == "Tudo conferido."


def test_validar_exige_corpo_e_resultado(api):
    ficha = api.ate_aguardando_ccon()
    sem_corpo = api.acao(ficha, "validar-ccon")
    assert sem_corpo.status_code == 422
    assert "validacao_ccon" in sem_corpo.json()["detail"]
    sem_resultado = api.acao(ficha, "validar-ccon", validacao_ccon={"operador": "X"})
    assert sem_resultado.status_code == 422
    assert "aprovado ou reprovado" in sem_resultado.json()["detail"]
    invalido = api.acao(ficha, "validar-ccon", validacao_ccon={"resultado": "talvez"})
    assert invalido.status_code == 422
    invalido = api.acao(ficha, "validar-ccon", validacao_ccon={"resultado": "aprovado", "cadastro": "sim"})
    assert invalido.status_code == 422


def test_validar_reprovado_vai_para_pendencia_tecnica_sem_trava(api):
    ficha = api.ate_aguardando_ccon()  # nenhum teste da CCON feito: reprovar não depende disso
    validacao = {"operador": "Operador CCON", "cadastro": "ok", "eventos": "pendente", "resultado": "reprovado",
                 "observacoes": "Evento de disparo não chegou."}  # fmt: skip
    ficha = api.ok(api.acao(ficha, "validar-ccon", validacao_ccon=validacao))

    assert ficha["status"] == "pendencia_tecnica"
    assert ficha["dados"]["etapa3"]["validacao_ccon"]["resultado"] == "reprovado"
    evento = ficha["eventos"][0]
    assert (evento["acao"], evento["status_de"], evento["status_para"]) == (
        "validar-ccon", "aguardando_testes_ccon", "pendencia_tecnica",
    )  # fmt: skip
    assert "Evento de disparo não chegou." in evento["resumo"]


def test_depois_de_reprovar_retomar_volta_aos_testes_da_ccon(api):
    ficha = api.ate_aguardando_ccon()
    ficha = api.ok(api.acao(ficha, "validar-ccon", validacao_ccon={"resultado": "reprovado", "operador": "Op"}))
    ficha = api.ok(api.acao(ficha, "retomar"))
    assert ficha["status"] == "aguardando_testes_ccon"  # a instalação já tinha sido concluída

    # nova rodada: os testes voltam a ser editáveis e dá para aprovar
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_ccon=todos_ccon()))
    ficha = api.ok(api.acao(ficha, "validar-ccon", validacao_ccon=validacao_aprovada()))
    assert ficha["status"] == "ativo_monitorado"


def test_travas_da_validacao_nao_dependem_da_3_3(api, client):
    """A tela consulta /travas antes de o operador preencher a 3.3: só os testes entram."""
    ficha = api.ate_aguardando_ccon()
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_ccon=todos_ccon()))
    assert client.get(f"/api/fichas/{ficha['id']}/travas").json()["validar-ccon"] == []


def _ficha_aguardando(api, contingencia: str, usa_app: bool):
    """Ficha em aguardando_testes_ccon com a comunicação de contingência e o uso do app escolhidos."""
    ficha = api.criar()
    etapa1 = etapa1_completa()
    etapa1["usuarios"] = [
        {"nome": "Dona Ana", "permissao": "arma_desarma", "usa_app": "sim" if usa_app else "nao",
         "email_app": "ana@example.com" if usa_app else ""},
    ]  # fmt: skip
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))
    ficha = api.ok(api.acao(ficha, "liberar-instalacao"))
    etapa2 = etapa2_completa() | {"comunicacao": {"principal": "ethernet", "contingencia": contingencia}}
    ficha = api.ok(api.salvar(ficha, "etapa2", etapa2=etapa2))
    ficha = api.ok(api.acao(ficha, "concluir-instalacao"))
    # marca tudo, menos a contingência (3.1 e 3.2) e o aplicativo da 3.2
    tecnicos = todos_tecnicos() | {"comunicacao_contingencia": False}
    ccon = todos_ccon() | {"comunicacao_contingencia": False, "aplicativo": False}
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_tecnicos=tecnicos, testes_ccon=ccon))
    return ficha


def test_excecao_sem_contingencia_dispensa_o_item_na_3_1_e_na_3_2(api, client):
    ficha = _ficha_aguardando(api, contingencia="nao_possui", usa_app=False)
    assert ficha["status"] == "aguardando_testes_ccon"
    assert client.get(f"/api/fichas/{ficha['id']}/travas").json()["validar-ccon"] == []
    ficha = api.ok(api.acao(ficha, "validar-ccon", validacao_ccon=validacao_aprovada()))
    assert ficha["status"] == "ativo_monitorado"


def test_com_contingencia_o_item_e_exigido_na_3_1_e_na_3_2(api, client):
    ficha = _ficha_aguardando(api, contingencia="gprs", usa_app=False)
    # com contingência, a 3.1 também fica incompleta: a ficha nem passou para aguardando
    assert ficha["status"] == "instalacao_concluida"

    ficha = api.ok(api.salvar(ficha, "etapa3", testes_tecnicos={"comunicacao_contingencia": True}))
    assert ficha["status"] == "aguardando_testes_ccon"
    faltas = client.get(f"/api/fichas/{ficha['id']}/travas").json()["validar-ccon"]
    assert faltas == ["Teste com a CCON não marcado (3.2): Comunicação de contingência validada."]

    ficha = api.ok(api.salvar(ficha, "etapa3", testes_ccon={"comunicacao_contingencia": True}))
    assert client.get(f"/api/fichas/{ficha['id']}/travas").json()["validar-ccon"] == []


def test_excecao_aplicativo_so_e_exigido_se_alguem_usa(api, client):
    sem_app = _ficha_aguardando(api, contingencia="nao_possui", usa_app=False)
    assert client.get(f"/api/fichas/{sem_app['id']}/travas").json()["validar-ccon"] == []

    com_app = _ficha_aguardando(api, contingencia="nao_possui", usa_app=True)
    faltas = client.get(f"/api/fichas/{com_app['id']}/travas").json()["validar-ccon"]
    assert faltas == ["Teste com a CCON não marcado (3.2): Aplicativo validado (se aplicável)."]

    resposta = api.acao(com_app, "validar-ccon", validacao_ccon=validacao_aprovada())
    assert resposta.status_code == 422
    ficha = api.ok(api.salvar(com_app, "etapa3", testes_ccon={"aplicativo": True}))
    assert api.acao(ficha, "validar-ccon", validacao_ccon=validacao_aprovada()).status_code == 200


def test_aplicativo_da_3_1_continua_obrigatorio_mesmo_sem_usuarios_de_app(api):
    """Só o aplicativo da 3.2 é dispensado (seção 3 do contrato)."""
    ficha = api.ate_instalacao_concluida()  # contingência = gprs, um usuário usa o app
    sem_app = {k: v for k, v in todos_tecnicos().items() if k != "aplicativo"}
    ficha = api.ok(api.salvar(ficha, "etapa3", testes_tecnicos=sem_app))
    assert ficha["status"] == "instalacao_concluida"


# --- registrar-pendencia ------------------------------------------------------------------

STATUS_COM_PENDENCIA = [s for s in st.TODOS_STATUS if s != st.ATIVO_MONITORADO]


@pytest.mark.parametrize("status", STATUS_COM_PENDENCIA)
@pytest.mark.parametrize(("tipo", "destino"), [("cadastral", "pendencia_cadastral"), ("tecnica", "pendencia_tecnica")])
def test_registrar_pendencia_em_qualquer_status_menos_ativo(api, forcar_status, status, tipo, destino):
    ficha = forcar_status(status)
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo=tipo, descricao="Aguardando documento"))
    assert ficha["status"] == destino
    assert ficha["eventos"][0]["acao"] == "registrar-pendencia"
    assert ficha["eventos"][0]["status_de"] == status
    assert ficha["eventos"][0]["status_para"] == destino
    assert "Aguardando documento" in ficha["eventos"][0]["resumo"]


def test_registrar_pendencia_ocupa_a_primeira_linha_em_branco(api):
    ficha = api.criar()
    assert len(ficha["dados"]["pendencias"]) == 3
    ficha = api.ok(
        api.acao(
            ficha, "registrar-pendencia", tipo="cadastral", descricao="Falta CNPJ", responsavel="Maria", prazo="2026-12-01"
        )
    )
    linhas = ficha["dados"]["pendencias"]
    assert len(linhas) == 3
    assert linhas[0] == {"descricao": "Falta CNPJ", "responsavel": "Maria", "prazo": "2026-12-01", "resolvido": False}
    assert linhas[1]["descricao"] == ""


def test_registrar_pendencia_acrescenta_linha_quando_a_tabela_esta_cheia(api):
    ficha = api.criar()
    for numero in range(1, 5):
        ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao=f"Pendência {numero}"))
    assert [p["descricao"] for p in ficha["dados"]["pendencias"]] == [f"Pendência {n}" for n in range(1, 5)]


def test_registrar_pendencia_exige_descricao(api):
    ficha = api.criar()
    for extras in ({"tipo": "tecnica"}, {"tipo": "tecnica", "descricao": "   "}):
        resposta = api.acao(ficha, "registrar-pendencia", **extras)
        assert resposta.status_code == 422
        assert resposta.json()["faltas"] == ["Descreva a pendência."]
    assert api.obter(ficha["id"])["status"] == "cadastro_em_preenchimento"


@pytest.mark.parametrize("tipo", [None, "", "outra", "técnica"])
def test_registrar_pendencia_exige_tipo_valido(api, tipo):
    ficha = api.criar()
    extras = {"descricao": "Algo"} | ({"tipo": tipo} if tipo is not None else {})
    resposta = api.acao(ficha, "registrar-pendencia", **extras)
    assert resposta.status_code == 422
    assert "tipo" in resposta.json()["detail"]


# --- retomar ------------------------------------------------------------------------------


def test_retomar_pendencia_cadastral_volta_ao_cadastro(api):
    ficha = api.criar()
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="cadastral", descricao="Falta CNPJ"))
    ficha = api.ok(api.acao(ficha, "retomar"))
    assert ficha["status"] == "cadastro_em_preenchimento"
    assert ficha["eventos"][0]["acao"] == "retomar"
    assert ficha["eventos"][0]["status_de"] == "pendencia_cadastral"


def test_retomar_pendencia_tecnica_volta_a_instalacao(api):
    ficha = api.ate_em_instalacao()
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao="Falta sensor"))
    ficha = api.ok(api.acao(ficha, "retomar"))
    assert ficha["status"] == "em_instalacao"


def test_retomar_pendencia_tecnica_depois_da_instalacao_concluida(api):
    ficha = api.ate_aguardando_ccon()
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao="Trocar sirene"))
    assert ficha["status"] == "pendencia_tecnica"
    ficha = api.ok(api.acao(ficha, "retomar"))
    assert ficha["status"] == "aguardando_testes_ccon"


def test_retomar_com_instalacao_concluida_e_3_1_incompleta_volta_para_instalacao_concluida(api):
    ficha = api.ate_instalacao_concluida()
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao="Trocar sirene"))
    ficha = api.ok(api.acao(ficha, "retomar"))
    assert ficha["status"] == "instalacao_concluida"


@pytest.mark.parametrize(
    "status",
    [s for s in st.TODOS_STATUS if s not in (st.PENDENCIA_CADASTRAL, st.PENDENCIA_TECNICA)],
)
def test_retomar_so_vale_em_pendencia(api, forcar_status, status):
    ficha = forcar_status(status)
    resposta = api.acao(ficha, "retomar")
    assert resposta.status_code == 409
    esperado = "somente leitura" if status == st.ATIVO_MONITORADO else "Retomar"
    assert esperado in resposta.json()["detail"]


# --- travas como funções puras ------------------------------------------------------------


def test_funcoes_de_trava_com_dados_vazios():
    dados = modelo_vazio()
    assert len(faltas_liberar_instalacao(dados)) == 7
    assert len(faltas_concluir_instalacao(dados)) == 5
    assert len(faltas_validar_ccon(dados)) == 11 + 12
    assert len(faltas_validar_ccon(dados, {})) == 11 + 12 + 8


def test_travas_endpoint_usa_as_mesmas_funcoes(api, client):
    ficha = api.criar()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
    travas = client.get(f"/api/fichas/{ficha['id']}/travas").json()
    assert travas["liberar-instalacao"] == faltas_liberar_instalacao(ficha["dados"]) == []
    assert travas["concluir-instalacao"] == faltas_concluir_instalacao(ficha["dados"])
    assert travas["validar-ccon"] == faltas_validar_ccon(ficha["dados"])


def test_travas_de_ficha_inexistente(client):
    assert client.get("/api/fichas/404/travas").status_code == 404


def test_aplicativo_da_3_1_so_e_obrigatorio_se_alguem_usa_app():
    from app.fichas.modelo import modelo_vazio
    from app.fichas.travas import itens_ccon_obrigatorios, itens_tecnicos_obrigatorios

    dados = modelo_vazio()
    assert "aplicativo" not in itens_tecnicos_obrigatorios(dados)
    assert "aplicativo" not in itens_ccon_obrigatorios(dados)
    dados["etapa1"]["usuarios"][0].update({"nome": "Ana", "usa_app": "sim", "email_app": "ana@exemplo.com"})
    assert "aplicativo" in itens_tecnicos_obrigatorios(dados)
    assert "aplicativo" in itens_ccon_obrigatorios(dados)
