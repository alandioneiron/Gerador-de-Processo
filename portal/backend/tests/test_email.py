"""E-mail: destinatários, Reply-To, assunto, quando dispara e que falha de envio não derruba a ação."""

import logging
import ssl
from datetime import UTC, datetime
from email.message import EmailMessage

import pytest

from app import email as modulo_email
from app.config import Settings
from tests.conftest import (
    OUTRO_AUTOR,
    AUTOR,
    etapa1_completa,
    todos_ccon,
    validacao_aprovada,
)

ANO = datetime.now(UTC).year
DESTINATARIOS_PADRAO = ["ti@neoguard.com.br", "suporte@neoguard.com.br", "aux.ti@neoguard.com.br"]


@pytest.fixture
def smtp(monkeypatch, configurar):
    """SMTP configurado; o envio real é trocado por um gravador de mensagens."""
    configurar(smtp_host="smtp.neoguard.test")
    enviados: list[tuple[EmailMessage, Settings]] = []
    monkeypatch.setattr(modulo_email, "enviar_smtp", lambda msg, settings: enviados.append((msg, settings)))
    return enviados


def texto(msg: EmailMessage) -> str:
    return msg.get_body(preferencelist=("plain",)).get_content()


def html(msg: EmailMessage) -> str:
    return msg.get_body(preferencelist=("html",)).get_content()


def enderecos(cabecalho: str) -> list[str]:
    return [e.strip() for e in cabecalho.split(",")]


def provocar_notificacao(api, autor=AUTOR):
    """Cria uma ficha e registra uma pendência técnica (dispara uma notificação automática)."""
    ficha = api.criar(autor=autor)
    return api.ok(api.acao(ficha, "registrar-pendencia", autor=autor, tipo="tecnica", descricao="Falta bateria"))


# --- configuração ------------------------------------------------------------------------


def test_sem_smtp_host_nada_e_enviado_e_registra_no_log(api, monkeypatch, caplog):
    chamadas = []
    monkeypatch.setattr(modulo_email, "enviar_smtp", lambda *a: chamadas.append(a))
    caplog.set_level(logging.INFO, logger="app.email")

    ficha = provocar_notificacao(api)

    assert ficha["status"] == "pendencia_tecnica"  # a ação funciona normalmente
    assert chamadas == []
    assert any("E-mail não configurado" in r.getMessage() for r in caplog.records)


def test_destinatarios_padrao_e_reply_to_do_autor(api, smtp):
    provocar_notificacao(api, autor=OUTRO_AUTOR)

    assert len(smtp) == 1
    msg, _ = smtp[0]
    assert enderecos(msg["To"]) == DESTINATARIOS_PADRAO
    assert msg["Reply-To"] == OUTRO_AUTOR["email"]
    assert msg["From"] == "portal@neoguard.com.br"
    assert msg["Subject"] == f"[Ficha FI-{ANO}-0001] Pendência técnica registrada — (cliente não informado)"


def test_notificar_para_e_remetente_configuraveis(api, smtp, configurar):
    configurar(
        smtp_host="smtp.neoguard.test",
        notificar_para="a@neoguard.com.br; b@neoguard.com.br , ",
        smtp_remetente="portal@neoguard.com.br",
        smtp_usuario="portal",
    )
    provocar_notificacao(api)
    msg, settings = smtp[0]
    assert enderecos(msg["To"]) == ["a@neoguard.com.br", "b@neoguard.com.br"]
    assert msg["From"] == "portal@neoguard.com.br"
    assert settings.destinatarios == ["a@neoguard.com.br", "b@neoguard.com.br"]


def test_remetente_cai_para_o_usuario_smtp(configurar):
    configurar(smtp_usuario="envio@neoguard.com.br")
    from app.config import get_settings

    assert get_settings().remetente == "envio@neoguard.com.br"


# --- quando dispara ----------------------------------------------------------------------


def test_criar_ficha_nao_envia_email(api, smtp):
    """Uma ficha recém-criada (vazia) só geraria ruído."""
    api.criar()
    assert smtp == []


def test_dispara_em_liberar_concluir_e_validar(api, smtp):
    api.ate_ativo()

    assunto = [m["Subject"] for m, _ in smtp]
    assert assunto == [
        f"[Ficha FI-{ANO}-0001] Liberada para instalação — Padaria Exemplo Ltda",
        f"[Ficha FI-{ANO}-0001] Instalação concluída — Padaria Exemplo Ltda",
        f"[Ficha FI-{ANO}-0001] Validação da CCON: aprovada (ATIVO / MONITORADO) — Padaria Exemplo Ltda",
    ]
    assert all(m["Reply-To"] == AUTOR["email"] for m, _ in smtp)


def test_dispara_em_registrar_pendencia(api, smtp):
    ficha = api.criar()
    api.ok(api.acao(ficha, "registrar-pendencia", autor=OUTRO_AUTOR, tipo="tecnica", descricao="Falta bateria"))

    assert len(smtp) == 1
    msg, _ = smtp[0]
    assert msg["Subject"] == f"[Ficha FI-{ANO}-0001] Pendência técnica registrada — (cliente não informado)"
    assert msg["Reply-To"] == OUTRO_AUTOR["email"]
    assert "Falta bateria" in texto(msg)
    assert "Falta bateria" in html(msg)


def test_nao_dispara_ao_salvar_nem_retomar(api, smtp):
    ficha = api.criar()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
    ficha = api.ok(api.salvar(ficha, "pendencias", pendencias=[]))
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="cadastral", descricao="Algo"))
    antes = len(smtp)
    api.ok(api.acao(ficha, "retomar"))
    assert len(smtp) == antes
    assert len(smtp) == 1  # só o registrar-pendencia


def test_acao_recusada_nao_envia(api, smtp):
    ficha = api.criar()
    assert api.acao(ficha, "liberar-instalacao").status_code == 422
    assert smtp == []


def test_validacao_reprovada_envia_com_detalhes(api, smtp):
    ficha = api.ate_aguardando_ccon()
    smtp.clear()
    validacao = {"operador": "Op CCON", "eventos": "pendente", "resultado": "reprovado", "observacoes": "Sem sinal"}
    api.ok(api.acao(ficha, "validar-ccon", validacao_ccon=validacao))

    msg, _ = smtp[0]
    assert msg["Subject"].startswith(f"[Ficha FI-{ANO}-0001] Validação da CCON: reprovada")
    corpo = texto(msg)
    assert "Op CCON" in corpo
    assert "Sem sinal" in corpo
    assert "Eventos: PENDENTE" in corpo
    assert "Pendência técnica" in corpo  # status novo


# --- conteúdo ----------------------------------------------------------------------------


def test_corpo_tem_dados_da_ficha_e_link(api, smtp, configurar):
    configurar(smtp_host="smtp.neoguard.test", portal_url="http://172.16.100.35:8090/")
    ficha = api.criar()
    smtp.clear()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
    api.ok(api.acao(ficha, "liberar-instalacao"))

    msg, _ = smtp[0]
    corpo = texto(msg)
    for esperado in (
        f"FI-{ANO}-0001",
        "Liberada para instalação",
        "Liberado para instalação",
        AUTOR["nome"],
        AUTOR["email"],
        "Padaria Exemplo Ltda",
        "Carlos Vendedor",
        "2026-11-20",
        f"http://172.16.100.35:8090/fichas/{ficha['id']}",
    ):
        assert esperado in corpo, esperado
    assert f'href="http://172.16.100.35:8090/fichas/{ficha["id"]}"' in html(msg)


def test_html_escapa_o_conteudo_e_assunto_fica_em_uma_linha(api, smtp):
    ficha = api.criar()
    smtp.clear()
    ficha = api.ok(
        api.salvar(ficha, "etapa1", etapa1=etapa1_completa() | {"cliente": etapa1_completa()["cliente"] | {
            "razao_social": "Loja <b>X</b>\r\nBcc: invasor@exemplo.com"}})
    )  # fmt: skip
    api.ok(api.acao(ficha, "liberar-instalacao"))

    msg, _ = smtp[0]
    assert "\n" not in msg["Subject"]
    assert msg["Bcc"] is None
    assert "Loja <b>X</b> Bcc: invasor@exemplo.com" in msg["Subject"]
    assert "&lt;b&gt;X&lt;/b&gt;" in html(msg)
    assert "<b>X</b>" not in html(msg)


def test_mensagem_serializa_com_acentos(api, smtp):
    provocar_notificacao(api)
    msg, _ = smtp[0]
    bruto = msg.as_bytes()  # não pode falhar com “—” e “ç”
    assert b"Subject:" in bruto
    assert msg.is_multipart()


# --- falhas ------------------------------------------------------------------------------


def test_falha_no_envio_nao_derruba_a_acao(api, configurar, monkeypatch, caplog):
    configurar(smtp_host="smtp.neoguard.test")

    def quebra(msg, settings):
        raise ConnectionRefusedError("SMTP fora do ar")

    monkeypatch.setattr(modulo_email, "enviar_smtp", quebra)
    caplog.set_level(logging.ERROR, logger="app.email")

    ficha = api.criar()
    ficha = api.ok(api.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
    ficha = api.ok(api.acao(ficha, "liberar-instalacao"))  # 200 mesmo com o SMTP quebrado
    ficha = api.ok(api.acao(ficha, "registrar-pendencia", tipo="tecnica", descricao="Algo"))

    assert ficha["status"] == "pendencia_tecnica"
    erros = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(erros) == 2
    assert "Falha ao enviar o e-mail" in erros[0].getMessage()


def test_sem_destinatarios_nao_envia(api, configurar, monkeypatch, caplog):
    configurar(smtp_host="smtp.neoguard.test", notificar_para=" , ; ")
    # `env_ignore_empty` só ignora vazio; "  , ;" vira lista vazia
    chamadas = []
    monkeypatch.setattr(modulo_email, "enviar_smtp", lambda *a: chamadas.append(a))
    caplog.set_level(logging.WARNING, logger="app.email")
    provocar_notificacao(api)
    assert chamadas == []
    assert any("NOTIFICAR_PARA" in r.getMessage() for r in caplog.records)


# --- entrega SMTP (smtplib trocado por um falso) ------------------------------------------


class SmtpFalso:
    instancias: list["SmtpFalso"] = []

    def __init__(self, host, port, timeout=None, context=None):
        self.chamadas: list[tuple] = [("conectar", host, port)]
        self.timeout = timeout
        self.context = context
        SmtpFalso.instancias.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.chamadas.append(("sair",))

    def ehlo(self):
        self.chamadas.append(("ehlo",))

    def starttls(self, context=None):
        self.chamadas.append(("starttls",))

    def login(self, usuario, senha):
        self.chamadas.append(("login", usuario, senha))

    def send_message(self, msg, from_addr=None, to_addrs=None):
        self.chamadas.append(("enviar", from_addr, tuple(to_addrs)))


class SmtpSslFalso(SmtpFalso):
    def __init__(self, host, port, timeout=None, context=None):
        super().__init__(host, port, timeout, context)
        self.chamadas[0] = ("conectar_ssl", host, port)


@pytest.fixture
def smtplib_falso(monkeypatch):
    SmtpFalso.instancias.clear()
    monkeypatch.setattr(modulo_email.smtplib, "SMTP", SmtpFalso)
    monkeypatch.setattr(modulo_email.smtplib, "SMTP_SSL", SmtpSslFalso)
    return SmtpFalso.instancias


def _notificacao() -> modulo_email.Notificacao:
    return modulo_email.Notificacao(
        ficha_id=7, codigo=f"FI-{ANO}-0007", acao="criou", rotulo_acao="Ficha criada", status_novo="Cadastro em preenchimento",
        cliente="ACME", vendedor="Carlos", data_prevista="2026-11-20", autor_nome="Maria", autor_email="maria@neoguard.com.br",
    )  # fmt: skip


@pytest.mark.parametrize(
    ("tls", "porta", "esperado"),
    [
        ("starttls", 587, [("conectar", "smtp.x", 587), ("ehlo",), ("starttls",), ("ehlo",), ("login", "u", "s")]),
        ("ssl", 465, [("conectar_ssl", "smtp.x", 465), ("login", "u", "s")]),
        ("nenhum", 25, [("conectar", "smtp.x", 25), ("login", "u", "s")]),
    ],
)
def test_enviar_smtp_respeita_o_modo_de_tls(smtplib_falso, tls, porta, esperado):
    settings = Settings(
        _env_file=None, smtp_host="smtp.x", smtp_port=porta, smtp_tls=tls, smtp_usuario="u", smtp_senha="s"
    )
    msg = modulo_email.montar_mensagem(_notificacao(), settings)
    modulo_email.enviar_smtp(msg, settings)

    (servidor,) = smtplib_falso
    chamadas = servidor.chamadas
    assert chamadas[: len(esperado)] == esperado
    enviar = [c for c in chamadas if c[0] == "enviar"]
    assert enviar == [("enviar", "u", tuple(DESTINATARIOS_PADRAO))]
    assert chamadas[-1] == ("sair",)


def test_enviar_smtp_sem_usuario_nao_faz_login(smtplib_falso):
    settings = Settings(_env_file=None, smtp_host="smtp.x", smtp_tls="nenhum", smtp_remetente="portal@neoguard.com.br")
    modulo_email.enviar_smtp(modulo_email.montar_mensagem(_notificacao(), settings), settings)
    assert not any(c[0] == "login" for c in smtplib_falso[0].chamadas)


def test_modo_ssl_usa_smtp_ssl_com_timeout_de_20s_e_valida_o_certificado(smtplib_falso):
    """Produção: mail.neoguard.com.br, porta 465, SSL implícito."""
    settings = Settings(_env_file=None, smtp_host="mail.neoguard.com.br", smtp_port=465, smtp_tls="ssl")
    modulo_email.enviar_smtp(modulo_email.montar_mensagem(_notificacao(), settings), settings)

    (servidor,) = smtplib_falso
    assert isinstance(servidor, SmtpSslFalso)
    assert servidor.chamadas[0] == ("conectar_ssl", "mail.neoguard.com.br", 465)
    assert servidor.timeout == 20
    assert servidor.context.verify_mode == ssl.CERT_REQUIRED
    assert servidor.context.check_hostname is True
    assert not any(c[0] in ("ehlo", "starttls") for c in servidor.chamadas)  # SSL implícito: sem STARTTLS


def test_modo_ssl_respeita_smtp_verificar_certificado(smtplib_falso):
    settings = Settings(
        _env_file=None, smtp_host="mail.neoguard.com.br", smtp_port=465, smtp_tls="ssl", smtp_verificar_certificado=False
    )
    modulo_email.enviar_smtp(modulo_email.montar_mensagem(_notificacao(), settings), settings)

    contexto = smtplib_falso[0].context
    assert contexto.verify_mode == ssl.CERT_NONE
    assert contexto.check_hostname is False


@pytest.mark.parametrize("tls", ["starttls", "nenhum"])
def test_timeout_de_20s_tambem_nos_outros_modos(smtplib_falso, tls):
    settings = Settings(_env_file=None, smtp_host="smtp.x", smtp_tls=tls)
    modulo_email.enviar_smtp(modulo_email.montar_mensagem(_notificacao(), settings), settings)
    assert not isinstance(smtplib_falso[0], SmtpSslFalso)
    assert smtplib_falso[0].timeout == 20


def test_remetente_aceita_nome_e_endereco(smtplib_falso):
    settings = Settings(
        _env_file=None, smtp_host="smtp.x", smtp_tls="nenhum", smtp_remetente="Portal Neoguard <portal@neoguard.com.br>"
    )
    msg = modulo_email.montar_mensagem(_notificacao(), settings)
    modulo_email.enviar_smtp(msg, settings)

    remetente = msg["From"].addresses[0]
    assert (remetente.display_name, remetente.addr_spec) == ("Portal Neoguard", "portal@neoguard.com.br")
    enviar = [c for c in smtplib_falso[0].chamadas if c[0] == "enviar"]
    assert enviar[0][1] == "portal@neoguard.com.br"  # o envelope leva só o endereço


def test_smtp_tls_invalido_e_recusado():
    with pytest.raises(ValueError):
        Settings(_env_file=None, smtp_tls="tls-estranho")
    assert Settings(_env_file=None, smtp_tls="STARTTLS").smtp_tls == "starttls"


def test_postgres_url_curta_usa_o_driver_psycopg():
    assert Settings(_env_file=None, database_url="postgresql://u:p@db/portal").database_url == (
        "postgresql+psycopg://u:p@db/portal"
    )
    assert Settings(_env_file=None, database_url="postgres://u:p@db/portal").database_url.startswith(
        "postgresql+psycopg://"
    )
    assert Settings(_env_file=None, database_url="sqlite:///x.db").database_url == "sqlite:///x.db"
