"""Ação enviar-email: envio síncrono da ficha completa, evento, erros 502 e o conteúdo do e-mail."""

import smtplib
import socket
import ssl
from datetime import UTC, datetime
from email.message import EmailMessage

import pytest

from app import email as modulo_email
from app.fichas import relatorio
from app.fichas import status as st
from app.fichas.modelo import aplicar_secao, modelo_vazio
from tests.conftest import AUTOR, OUTRO_AUTOR, etapa1_completa

ANO = datetime.now(UTC).year
DESTINATARIOS = ["ti@neoguard.com.br", "suporte@neoguard.com.br", "aux.ti@neoguard.com.br"]
SENHA_SMTP = "s3nh4-s3cr3t4"


@pytest.fixture
def smtp(monkeypatch, configurar):
    """SMTP configurado (como em produção); o envio real é trocado por um gravador de mensagens."""
    configurar(smtp_host="mail.neoguard.test", smtp_port="465", smtp_tls="ssl", smtp_senha=SENHA_SMTP)
    enviados: list[EmailMessage] = []
    monkeypatch.setattr(modulo_email, "enviar_smtp", lambda msg, settings: enviados.append(msg))
    return enviados


def enviar(api, ficha: dict, autor: dict = AUTOR, **corpo):
    """POST enviar-email: o corpo não leva versão."""
    return api.c.post(f"/api/fichas/{ficha['id']}/acoes/enviar-email", json={"autor": autor, **corpo})


def html(msg: EmailMessage) -> str:
    return msg.get_body(preferencelist=("html",)).get_content()


def texto(msg: EmailMessage) -> str:
    return msg.get_body(preferencelist=("plain",)).get_content()


@pytest.fixture
def ficha_preenchida(api):
    ficha = api.criar()
    etapa1 = etapa1_completa()
    etapa1["contatos"] += [{"nome": "Seu Carlos", "funcao": "Gerente", "tel_principal": "(11) 98888-0002", "decide": "nao"}]
    etapa1["ambientes"] = [{"ambiente": "Salão", "acesso_local": "Porta da frente"}, {"ambiente": "Estoque"}]
    etapa1["particularidades"] = {"animais": True, "cftv": True, "observacoes": "Cão solto à noite"}
    return api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))


# --- envio OK ----------------------------------------------------------------------------


def test_envia_para_os_tres_destinatarios_com_reply_to_e_assunto(api, smtp, ficha_preenchida):
    resposta = enviar(api, ficha_preenchida, autor=OUTRO_AUTOR, mensagem="Podem iniciar a instalação.")

    assert resposta.status_code == 200, resposta.text
    assert len(smtp) == 1
    msg = smtp[0]
    assert [e.strip() for e in msg["To"].split(",")] == DESTINATARIOS
    assert msg["Reply-To"] == OUTRO_AUTOR["email"]
    assert msg["Subject"] == f"[Ficha FI-{ANO}-0001] Ficha de implantação — Padaria Exemplo Ltda"
    assert msg.get_body(preferencelist=("plain",)) is not None  # texto simples + HTML
    assert msg.get_body(preferencelist=("html",)) is not None


def test_nao_exige_versao_e_ignora_versao_antiga(api, smtp, ficha_preenchida):
    assert enviar(api, ficha_preenchida).status_code == 200  # sem versao
    assert enviar(api, ficha_preenchida, versao=999).status_code == 200  # versão qualquer não importa
    assert len(smtp) == 2


def test_registra_o_evento_e_nao_altera_a_ficha(api, smtp, ficha_preenchida):
    ficha = api.ok(enviar(api, ficha_preenchida, autor=OUTRO_AUTOR, mensagem="Segue a ficha."))

    evento = ficha["eventos"][0]
    assert evento["acao"] == "enviou_email"
    assert evento["autor_nome"] == OUTRO_AUTOR["nome"]
    assert evento["autor_email"] == OUTRO_AUTOR["email"]
    assert evento["status_de"] == evento["status_para"] == "cadastro_em_preenchimento"
    for destinatario in DESTINATARIOS:
        assert destinatario in evento["resumo"]
    assert "Segue a ficha." in evento["resumo"]
    assert len(ficha["eventos"]) == len(ficha_preenchida["eventos"]) + 1

    # nada mudou na ficha
    assert ficha["versao"] == ficha_preenchida["versao"]
    assert ficha["status"] == ficha_preenchida["status"]
    assert ficha["dados"] == ficha_preenchida["dados"]
    assert ficha["atualizado_em"] == ficha_preenchida["atualizado_em"]
    # e a ficha continua editável com a mesma versão
    assert api.salvar(ficha, "etapa1", etapa1={"cliente": {"telefone": "1"}}).status_code == 200


def test_evento_sem_mensagem_lista_so_os_destinatarios(api, smtp, ficha_preenchida):
    ficha = api.ok(enviar(api, ficha_preenchida))
    assert "Mensagem" not in ficha["eventos"][0]["resumo"]


def test_resposta_e_a_ficha_completa(api, smtp, ficha_preenchida):
    ficha = api.ok(enviar(api, ficha_preenchida))
    assert set(ficha) == {"id", "numero", "codigo", "status", "versao", "dados", "criado_em", "atualizado_em", "eventos"}


@pytest.mark.parametrize("status", st.TODOS_STATUS)
def test_disponivel_em_qualquer_status(api, smtp, forcar_status, status):
    ficha = forcar_status(status)
    resposta = enviar(api, ficha)
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["status"] == status  # inclusive ATIVO (somente leitura): enviar não altera nada
    assert resposta.json()["eventos"][0]["acao"] == "enviou_email"
    assert len(smtp) == 1


def test_destinatarios_vem_de_notificar_para(api, smtp, configurar, ficha_preenchida):
    configurar(smtp_host="mail.neoguard.test", notificar_para="so-um@neoguard.com.br")
    ficha = api.ok(enviar(api, ficha_preenchida))
    assert smtp[0]["To"] == "so-um@neoguard.com.br"
    assert "so-um@neoguard.com.br" in ficha["eventos"][0]["resumo"]


# --- conteúdo ----------------------------------------------------------------------------


def test_html_traz_cabecalho_e_dados_da_1_1(api, smtp, ficha_preenchida):
    api.ok(enviar(api, ficha_preenchida, autor=OUTRO_AUTOR, mensagem="Cliente com urgência."))
    corpo = html(smtp[0])

    assert f"FI-{ANO}-0001" in corpo
    assert "Cadastro em preenchimento" in corpo  # status
    assert f"{OUTRO_AUTOR['nome']} &lt;{OUTRO_AUTOR['email']}&gt;" in corpo  # quem enviou
    assert "Cliente com urgência." in corpo
    for rotulo in ("1.1", "Identificação do Cliente", "RAZÃO SOCIAL / NOME", "CPF / CNPJ", "VENDEDOR RESPONSÁVEL"):
        assert rotulo in corpo, rotulo
    for valor in ("Padaria Exemplo Ltda", "11.222.333/0001-81", "Rua das Flores, 100 - Centro", "Carlos Vendedor"):
        assert valor in corpo, valor
    assert "20/11/2026" in corpo  # data prevista no formato brasileiro
    # as seções 1.1 a 1.8 estão sempre presentes
    for numero, titulo in [
        ("1.2", "Contatos para Ocorrência"),
        ("1.3", "Usuários do Alarme"),
        ("1.8", "Informações Operacionais para a CCON"),
    ]:
        assert numero in corpo
        assert titulo in corpo


def test_tabelas_trazem_so_as_linhas_preenchidas(api, smtp, ficha_preenchida):
    api.ok(enviar(api, ficha_preenchida))
    corpo = html(smtp[0])

    # 1.2: dois contatos preenchidos; as três linhas em branco ficam de fora
    assert corpo.count("Dona Ana") == 2  # contato (1.2) + usuária (1.3)
    assert "Seu Carlos" in corpo
    assert "(11) 98888-0002" in corpo
    assert "Tel. Principal" in corpo  # cabeçalhos iguais aos do docx
    assert "Restrições / Observações" in corpo
    # 1.3: dois usuários
    assert "ana@example.com" in corpo
    assert "Seu José" in corpo
    assert "Arma/Desarma" in corpo
    assert "Só arma" in corpo
    # 1.5: dois ambientes
    assert "Salão" in corpo
    assert "Porta da frente" in corpo
    assert "Estoque" in corpo

    etapa1 = relatorio.montar_etapas(ficha_preenchida["dados"])[0]
    tabelas = {s.numero: s.blocos[0] for s in etapa1.secoes if s.numero in ("1.2", "1.3", "1.5")}
    assert [len(t.linhas) for t in tabelas.values()] == [2, 2, 2]  # de 5, 8 e 6 linhas iniciais, só 2 de cada


def test_checkboxes_marcados_da_1_7(api, smtp, ficha_preenchida):
    api.ok(enviar(api, ficha_preenchida))
    corpo = html(smtp[0])
    assert "Animais" in corpo
    assert "CFTV" in corpo
    assert "Cão solto à noite" in corpo
    for desmarcado in ("Gerador", "Nobreak", "Wi-Fi", "Cerca elétrica"):
        assert desmarcado not in corpo, desmarcado


def test_etapas_2_3_e_pendencias_so_aparecem_se_preenchidas(api, smtp, ficha_preenchida):
    api.ok(enviar(api, ficha_preenchida))
    vazia = html(smtp[0]) + texto(smtp[0])
    assert "ETAPA 1" in vazia
    for ausente in ("ETAPA 2", "ETAPA 3", "PENDÊNCIAS"):
        assert ausente not in vazia, ausente

    ficha = api.ate_aguardando_ccon()
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao="Trocar a sirene", responsavel="João"))
    api.ok(enviar(api, ficha))
    completa = html(smtp[-1])
    for esperado in (
        "ETAPA 2", "ETAPA 3", "PENDÊNCIAS",
        "AMT 2018 EG", "SN123456", "Ethernet/IP", "GPRS",  # 2.1 e 2.2
        "Entrada", "Sensor magnético",  # 2.3
        "Arme testado", "Partições testadas",  # 3.1
        "Trocar a sirene", "João",  # pendências
    ):  # fmt: skip
        assert esperado in completa, esperado


def test_texto_simples_tem_as_mesmas_informacoes(api, smtp, ficha_preenchida):
    api.ok(enviar(api, ficha_preenchida, mensagem="Olá time"))
    corpo = texto(smtp[0])

    assert f"Ficha de Implantação FI-{ANO}-0001" in corpo
    assert "Olá time" in corpo
    assert "RAZÃO SOCIAL / NOME: Padaria Exemplo Ltda" in corpo
    assert "Nome: Seu Carlos" in corpo
    assert "[x] Animais" in corpo
    posicoes = [corpo.index(f"{n}  ") for n in ("1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8")]
    assert posicoes == sorted(posicoes)  # mesma ordem do docx


def test_links_do_portal_e_de_impressao(api, smtp, configurar, ficha_preenchida):
    configurar(smtp_host="mail.neoguard.test", portal_url="http://172.16.100.35:8090/")
    api.ok(enviar(api, ficha_preenchida))
    base = f"http://172.16.100.35:8090/fichas/{ficha_preenchida['id']}"
    assert f'href="{base}"' in html(smtp[0])
    assert f'href="{base}/imprimir"' in html(smtp[0])
    assert base in texto(smtp[0])
    assert f"{base}/imprimir" in texto(smtp[0])


def test_estilos_inline_marinho_e_bordas(api, smtp, ficha_preenchida):
    api.ok(enviar(api, ficha_preenchida))
    corpo = html(smtp[0])
    assert "#1B2A4A" in corpo  # marinho: títulos e cabeçalhos de tabela
    assert "#BDBDBD" in corpo  # bordas
    assert "<style" not in corpo
    assert "<script" not in corpo


def test_todo_texto_do_usuario_e_escapado(api, smtp):
    ficha = api.criar()
    etapa1 = etapa1_completa()
    etapa1["cliente"]["razao_social"] = "<script>alert('x')</script> & Cia"
    etapa1["cliente"]["endereco"] = 'Rua "A" <b>negrito</b>'
    etapa1["contatos"][0]["nome"] = "<img src=x onerror=alert(1)>"
    etapa1["particularidades"] = {"observacoes": "</td><td>quebra"}
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1))
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao="<i>x</i>", responsavel="<u>y</u>"))

    autor = {"nome": "Eu <b>mesmo</b>", "email": "eu@neoguard.com.br"}
    api.ok(enviar(api, ficha, autor=autor, mensagem="<a href='http://mal'>clique</a>"))
    corpo = html(smtp[-1])

    perigosos = ("<script", "<img src", "<b>negrito", "<a href='http://mal'>", "<i>x", "<u>y", "</td><td>quebra", "<b>mesmo")
    for perigoso in perigosos:
        assert perigoso not in corpo, perigoso
    escapados = (
        "&lt;script&gt;", "&amp; Cia", "&lt;img src=x", "&lt;b&gt;negrito&lt;/b&gt;", "&lt;a href=",
        "&lt;i&gt;x", "&lt;/td&gt;&lt;td&gt;quebra",
    )  # fmt: skip
    for escapado in escapados:
        assert escapado in corpo, escapado


def test_assunto_fica_em_uma_linha(api, smtp):
    ficha = api.criar()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1={"cliente": {"razao_social": "Loja\r\nBcc: invasor@exemplo.com"}}))
    api.ok(enviar(api, ficha))
    assert "\n" not in smtp[0]["Subject"]
    assert smtp[0]["Bcc"] is None
    assert smtp[0]["Subject"] == f"[Ficha FI-{ANO}-0001] Ficha de implantação — Loja Bcc: invasor@exemplo.com"


def test_ficha_sem_cliente_usa_texto_padrao_no_assunto(api, smtp):
    api.ok(enviar(api, api.criar()))
    assert smtp[0]["Subject"] == f"[Ficha FI-{ANO}-0001] Ficha de implantação — (cliente não informado)"


def test_ficha_em_instalacao_envia_conteudo_da_etapa2(api, smtp):
    ficha = api.ate_em_instalacao()
    api.ok(enviar(api, ficha))
    corpo = html(smtp[-1])  # as notificações automáticas de liberar-instalacao vêm antes
    assert "Ficha de Implantação" in corpo
    assert "ETAPA 2" in corpo
    assert "Ethernet/IP" in corpo  # principal = ethernet
    assert "GPRS" in corpo  # contingência = gprs
    assert "ETAPA 3" not in corpo  # nada preenchido nos testes ainda


# --- erros: 502 sem registrar evento -------------------------------------------------------


def _sem_evento_novo(api, antes: dict) -> None:
    depois = api.obter(antes["id"])
    assert len(depois["eventos"]) == len(antes["eventos"])
    assert depois["versao"] == antes["versao"]
    assert depois["dados"] == antes["dados"]


def test_sem_smtp_devolve_502_e_nao_registra_evento(api, ficha_preenchida, monkeypatch):
    chamadas = []
    monkeypatch.setattr(modulo_email, "enviar_smtp", lambda *a: chamadas.append(a))

    resposta = enviar(api, ficha_preenchida, mensagem="oi")

    assert resposta.status_code == 502
    assert resposta.json() == {
        "detail": "Não foi possível enviar o e-mail: o servidor de e-mail (SMTP_HOST) não está configurado no portal."
    }
    assert chamadas == []
    _sem_evento_novo(api, ficha_preenchida)


def test_sem_destinatarios_devolve_502(api, smtp, configurar, ficha_preenchida):
    configurar(smtp_host="mail.neoguard.test", notificar_para=" , ; ")
    resposta = enviar(api, ficha_preenchida)
    assert resposta.status_code == 502
    assert "NOTIFICAR_PARA" in resposta.json()["detail"]
    _sem_evento_novo(api, ficha_preenchida)


@pytest.mark.parametrize(
    ("excecao", "trecho"),
    [
        (smtplib.SMTPAuthenticationError(535, b"5.7.8 Authentication failed"), "usuário ou senha"),
        (smtplib.SMTPRecipientsRefused({"x@y.com": (550, b"no")}), "recusou os destinatários"),
        (smtplib.SMTPSenderRefused(553, b"no", "a@b.com"), "recusou o remetente"),
        (smtplib.SMTPServerDisconnected("Connection unexpectedly closed"), "encerrou a conexão"),
        (smtplib.SMTPResponseException(554, b"Message rejected"), "respondeu com erro"),
        (ssl.SSLCertVerificationError("certificate verify failed"), "certificado"),
        (ssl.SSLError("WRONG_VERSION_NUMBER"), "conexão segura"),
        (socket.gaierror(-2, "Name or service not known"), "localizar o servidor"),
        (TimeoutError("timed out"), "tempo esgotado"),
        (ConnectionRefusedError(111, "refused"), "recusou a conexão"),
        (OSError(101, "Network is unreachable"), "falha de rede"),
        (RuntimeError("boom"), "erro inesperado (RuntimeError)"),
    ],
)
def test_falha_do_servidor_devolve_502_com_motivo_e_nao_registra_evento(
    api, smtp, monkeypatch, ficha_preenchida, excecao, trecho
):
    def quebra(msg, settings):
        raise excecao

    monkeypatch.setattr(modulo_email, "enviar_smtp", quebra)

    resposta = enviar(api, ficha_preenchida, mensagem="oi")

    assert resposta.status_code == 502
    detalhe = resposta.json()["detail"]
    assert detalhe.startswith("Não foi possível enviar o e-mail: ")
    assert trecho in detalhe
    assert set(resposta.json()) == {"detail"}
    _sem_evento_novo(api, ficha_preenchida)


def test_motivo_nunca_mostra_a_senha_do_smtp(api, smtp, monkeypatch, ficha_preenchida):
    def quebra(msg, settings):
        raise smtplib.SMTPResponseException(535, f"login falhou com a senha {SENHA_SMTP} do usuario".encode())

    monkeypatch.setattr(modulo_email, "enviar_smtp", quebra)
    detalhe = enviar(api, ficha_preenchida).json()["detail"]
    assert SENHA_SMTP not in detalhe
    assert "***" in detalhe


def test_motivo_e_curto(api, smtp, monkeypatch, ficha_preenchida):
    def quebra(msg, settings):
        raise smtplib.SMTPResponseException(554, ("erro " * 500).encode())

    monkeypatch.setattr(modulo_email, "enviar_smtp", quebra)
    assert len(enviar(api, ficha_preenchida).json()["detail"]) < 300


def test_depois_do_erro_um_novo_envio_funciona(api, smtp, monkeypatch, ficha_preenchida):
    original = modulo_email.enviar_smtp

    def quebra(msg, settings):
        raise ConnectionRefusedError()

    monkeypatch.setattr(modulo_email, "enviar_smtp", quebra)
    assert enviar(api, ficha_preenchida).status_code == 502
    monkeypatch.setattr(modulo_email, "enviar_smtp", original)
    assert enviar(api, ficha_preenchida).status_code == 200
    assert len(api.obter(ficha_preenchida["id"])["eventos"]) == len(ficha_preenchida["eventos"]) + 1


# --- outros erros --------------------------------------------------------------------------


def test_ficha_inexistente_devolve_404(api, smtp):
    resposta = api.c.post("/api/fichas/404/acoes/enviar-email", json={"autor": AUTOR})
    assert resposta.status_code == 404
    assert resposta.json() == {"detail": "Ficha não encontrada."}
    assert smtp == []


@pytest.mark.parametrize("autor", [None, {}, {"nome": "Ana"}, {"nome": "Ana", "email": "ana"}])
def test_autor_obrigatorio(api, smtp, ficha_preenchida, autor):
    corpo = {} if autor is None else {"autor": autor}
    resposta = api.c.post(f"/api/fichas/{ficha_preenchida['id']}/acoes/enviar-email", json=corpo)
    assert resposta.status_code == 422
    assert "autor" in resposta.json()["detail"]
    assert smtp == []


def test_mensagem_longa_demais(api, smtp, ficha_preenchida):
    resposta = enviar(api, ficha_preenchida, mensagem="x" * 2001)
    assert resposta.status_code == 422
    assert "2000" in resposta.json()["detail"]
    assert enviar(api, ficha_preenchida, mensagem="x" * 2000).status_code == 200


def test_acao_desconhecida_continua_404_e_lista_enviar_email(api, ficha_preenchida):
    resposta = api.acao(ficha_preenchida, "explodir")
    assert resposta.status_code == 404
    assert "enviar-email" in resposta.json()["detail"]


# --- relatório (unidade) -------------------------------------------------------------------


def test_relatorio_de_ficha_vazia_so_tem_etapa_1_com_todas_as_secoes():
    etapas = relatorio.montar_etapas(modelo_vazio())
    assert [e.titulo for e in etapas] == [relatorio.TITULO_ETAPA1]
    assert [s.numero for s in etapas[0].secoes_visiveis()] == ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8"]
    assert all(s.vazia for s in etapas[0].secoes)


def test_relatorio_linhas_em_branco_de_zonas_e_pendencias_ficam_de_fora():
    zonas = [{"zona": "Z01"}, {"zona": "Z02", "ambiente": "Sala"}, {"zona": "Z03", "testado": True}]
    dados = aplicar_secao(modelo_vazio(), ("etapa2",), {"zonas": zonas})
    dados = aplicar_secao(dados, ("pendencias",), [{"descricao": "A"}, {}, {"resolvido": True}])
    etapas = {e.titulo: e for e in relatorio.montar_etapas(dados)}

    mapa = next(s for s in etapas[relatorio.TITULO_ETAPA2].secoes if s.numero == "2.3").blocos[0]
    assert [linha[0] for linha in mapa.linhas] == ["Z02", "Z03"]  # Z01 vazia; "testado" conta como preenchido
    pendencias = etapas[relatorio.TITULO_PENDENCIAS].secoes[0].blocos[0]
    assert len(pendencias.linhas) == 1  # `resolvido` sozinho não faz uma linha


def test_relatorio_etapa_3_aparece_com_um_teste_marcado():
    dados = aplicar_secao(modelo_vazio(), ("etapa3", "testes_ccon"), {"disparo": True})
    etapas = relatorio.montar_etapas(dados)
    assert [e.titulo for e in etapas] == [relatorio.TITULO_ETAPA1, relatorio.TITULO_ETAPA3]
    secoes = etapas[1].secoes_visiveis()
    assert [s.numero for s in secoes] == ["3.2"]  # 3.1 e 3.3 vazias ficam de fora
    assert secoes[0].blocos[0].itens == ["Disparo recebido"]


def test_relatorio_particoes_e_validacao_da_ccon():
    dados = aplicar_secao(modelo_vazio(), ("etapa2",), {"particoes": [{"particao": "A", "nome_area": "Loja"}]})
    validacao = {"operador": "Op", "cadastro": "ok", "resultado": "aprovado", "data": "2026-11-25"}
    dados = aplicar_secao(dados, ("etapa3", "validacao_ccon"), validacao)
    etapas = relatorio.montar_etapas(dados)
    corpo = relatorio.renderizar_texto(titulo="T", cabecalho=[], mensagem="", etapas=etapas, links=[])
    assert "Partição: A" in corpo
    assert "Nome / Área: Loja" in corpo
    assert "OPERADOR CCON: Op" in corpo
    assert "Cadastro: OK" in corpo
    assert "Resultado: APROVADO PARA ATIVAÇÃO" in corpo
    assert "DATA: 25/11/2026" in corpo
