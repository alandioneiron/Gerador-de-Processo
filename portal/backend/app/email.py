"""Notificações por e-mail (seção 5 do contrato).

O envio roda em background (BackgroundTasks) e uma falha só vai para o log: nunca derruba a ação.
"""

import logging
import smtplib
import socket
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from html import escape

from app.config import Settings, get_settings
from app.fichas.relatorio import montar_corpo_ficha

logger = logging.getLogger("app.email")

TEMPO_LIMITE_SMTP = 20  # segundos


@dataclass(frozen=True)
class Notificacao:
    """Retrato dos dados do e-mail, tirado depois da gravação (não depende da sessão do banco)."""

    ficha_id: int
    codigo: str
    acao: str
    rotulo_acao: str
    status_novo: str
    cliente: str
    vendedor: str
    data_prevista: str
    autor_nome: str
    autor_email: str
    detalhes: tuple[str, ...] = ()


def _linha(texto: str) -> str:
    """Uma linha só (cabeçalhos de e-mail não aceitam quebras)."""
    return " ".join(texto.split())


def assunto(n: Notificacao) -> str:
    return _linha(f"[Ficha {n.codigo}] {n.rotulo_acao} — {n.cliente or '(cliente não informado)'}")


def link_da_ficha(n: Notificacao, settings: Settings) -> str:
    return f"{settings.portal_url.rstrip('/')}/fichas/{n.ficha_id}"


def _campos(n: Notificacao) -> list[tuple[str, str]]:
    return [
        ("Ação", n.rotulo_acao),
        ("Status", n.status_novo),
        ("Feito por", f"{n.autor_nome} <{n.autor_email}>"),
        ("Cliente", n.cliente or "—"),
        ("Vendedor", n.vendedor or "—"),
        ("Data prevista", n.data_prevista or "—"),
    ]


def montar_mensagem(n: Notificacao, settings: Settings) -> EmailMessage:
    link = link_da_ficha(n, settings)
    campos = _campos(n)

    linhas = [f"Ficha de Implantação {n.codigo}", ""]
    linhas += [f"{rotulo}: {valor}" for rotulo, valor in campos]
    if n.detalhes:
        linhas += ["", "Detalhes:"] + [f"- {d}" for d in n.detalhes]
    linhas += ["", f"Abrir a ficha: {link}"]

    html = ["<html><body style=\"font-family:Arial,Helvetica,sans-serif;color:#161616\">"]
    html.append(f"<h3 style=\"margin:0 0 8px\">Ficha de Implantação {escape(n.codigo)}</h3>")
    html.append("<table cellpadding=\"4\" cellspacing=\"0\" style=\"border-collapse:collapse\">")
    for rotulo, valor in campos:
        html.append(f"<tr><td><b>{escape(rotulo)}</b></td><td>{escape(valor)}</td></tr>")
    html.append("</table>")
    if n.detalhes:
        html.append("<p style=\"margin:12px 0 4px\"><b>Detalhes</b></p><ul style=\"margin:0\">")
        html += [f"<li>{escape(d)}</li>" for d in n.detalhes]
        html.append("</ul>")
    html.append(f"<p><a href=\"{escape(link, quote=True)}\">Abrir a ficha no portal</a></p>")
    html.append("</body></html>")

    msg = EmailMessage()
    msg["Subject"] = assunto(n)
    msg["From"] = settings.remetente
    msg["To"] = ", ".join(settings.destinatarios)
    msg["Reply-To"] = _linha(n.autor_email)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="portal.neoguard")
    msg.set_content("\n".join(linhas))
    msg.add_alternative("".join(html), subtype="html")
    return msg


def enviar_smtp(msg: EmailMessage, settings: Settings) -> None:
    """Entrega a mensagem pelo servidor SMTP configurado (starttls, ssl ou nenhum)."""
    contexto = ssl.create_default_context()
    if not settings.smtp_verificar_certificado:
        contexto.check_hostname = False
        contexto.verify_mode = ssl.CERT_NONE

    if settings.smtp_tls == "ssl":
        servidor = smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, timeout=TEMPO_LIMITE_SMTP, context=contexto
        )
    else:
        servidor = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=TEMPO_LIMITE_SMTP)

    with servidor:
        if settings.smtp_tls == "starttls":
            servidor.ehlo()
            servidor.starttls(context=contexto)
            servidor.ehlo()
        if settings.smtp_usuario:
            servidor.login(settings.smtp_usuario, settings.smtp_senha)
        servidor.send_message(msg, from_addr=settings.remetente_endereco, to_addrs=settings.destinatarios)


def enviar_notificacao(n: Notificacao) -> None:
    """Tarefa de background: envia o e-mail da ação. Nunca levanta exceção."""
    try:
        settings = get_settings()
        if not settings.smtp_host:
            logger.info("E-mail não configurado (SMTP_HOST vazio): %s não foi enviado.", assunto(n))
            return
        if not settings.destinatarios:
            logger.warning("NOTIFICAR_PARA está vazio: %s não foi enviado.", assunto(n))
            return
        enviar_smtp(montar_mensagem(n, settings), settings)
        logger.info("E-mail enviado: %s", assunto(n))
    except Exception:
        logger.exception("Falha ao enviar o e-mail da ficha %s (%s); a ação foi concluída normalmente.", n.codigo, n.acao)


# --- envio manual da ficha completa (síncrono) -------------------------------------------


class ErroEnvio(Exception):
    """Falha ao enviar o e-mail pedido pelo usuário; `motivo` é curto e nunca traz a senha."""

    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo


def _limpar(texto: str, settings: Settings, limite: int = 160) -> str:
    if settings.smtp_senha:
        texto = texto.replace(settings.smtp_senha, "***")
    texto = " ".join(texto.split())
    return texto if len(texto) <= limite else texto[: limite - 3] + "..."


def motivo_curto(exc: Exception, settings: Settings) -> str:
    """Traduz a exceção do SMTP em uma frase curta para a tela (a ordem importa: as subclasses vêm antes)."""
    servidor = f"{settings.smtp_host}:{settings.smtp_port}"
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return "usuário ou senha do SMTP foram recusados pelo servidor."
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return "o servidor recusou os destinatários."
    if isinstance(exc, smtplib.SMTPSenderRefused):
        return "o servidor recusou o remetente (SMTP_REMETENTE)."
    if isinstance(exc, smtplib.SMTPServerDisconnected):
        return f"o servidor {servidor} encerrou a conexão."
    if isinstance(exc, smtplib.SMTPException):
        return f"o servidor respondeu com erro ({_limpar(str(exc), settings)})."
    if isinstance(exc, ssl.SSLCertVerificationError):
        return "o certificado do servidor SMTP não foi aceito (veja SMTP_VERIFICAR_CERTIFICADO)."
    if isinstance(exc, ssl.SSLError):
        return "falha na conexão segura com o servidor (confira SMTP_PORT e SMTP_TLS)."
    if isinstance(exc, socket.gaierror):
        return f"não foi possível localizar o servidor {settings.smtp_host}."
    if isinstance(exc, TimeoutError):
        return f"tempo esgotado ao falar com {servidor}."
    if isinstance(exc, ConnectionRefusedError):
        return f"{servidor} recusou a conexão."
    if isinstance(exc, OSError):
        return f"falha de rede ao falar com {servidor} ({_limpar(str(exc), settings, 80)})."
    return f"erro inesperado ({type(exc).__name__})."


def montar_mensagem_ficha(
    *,
    ficha_id: int,
    codigo: str,
    status_rotulo: str,
    cliente: str,
    dados: dict,
    autor_nome: str,
    autor_email: str,
    mensagem: str,
    settings: Settings,
) -> EmailMessage:
    """E-mail com a ficha completa (texto simples + HTML), para os destinatários de NOTIFICAR_PARA."""
    base = f"{settings.portal_url.rstrip('/')}/fichas/{ficha_id}"
    texto, corpo_html = montar_corpo_ficha(
        codigo=codigo,
        cliente=cliente,
        status_rotulo=status_rotulo,
        autor_nome=autor_nome,
        autor_email=autor_email,
        mensagem=mensagem,
        dados=dados,
        link=base,
        link_impressao=f"{base}/imprimir",
    )
    msg = EmailMessage()
    msg["Subject"] = _linha(f"[Ficha {codigo}] Ficha de implantação — {cliente or '(cliente não informado)'}")
    msg["From"] = settings.remetente
    msg["To"] = ", ".join(settings.destinatarios)
    msg["Reply-To"] = _linha(autor_email)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="portal.neoguard")
    msg.set_content(texto)
    msg.add_alternative(corpo_html, subtype="html")
    return msg


def enviar_ficha(
    *,
    ficha_id: int,
    codigo: str,
    status_rotulo: str,
    cliente: str,
    dados: dict,
    autor_nome: str,
    autor_email: str,
    mensagem: str,
) -> list[str]:
    """Envia a ficha completa agora (sem background) e devolve os destinatários.

    Diferente das notificações automáticas, SMTP ausente ou com erro vira `ErroEnvio`,
    para a tela mostrar o motivo real.
    """
    settings = get_settings()
    if not settings.smtp_host:
        raise ErroEnvio("o servidor de e-mail (SMTP_HOST) não está configurado no portal.")
    if not settings.destinatarios:
        raise ErroEnvio("não há destinatários configurados (NOTIFICAR_PARA).")
    msg = montar_mensagem_ficha(
        ficha_id=ficha_id,
        codigo=codigo,
        status_rotulo=status_rotulo,
        cliente=cliente,
        dados=dados,
        autor_nome=autor_nome,
        autor_email=autor_email,
        mensagem=mensagem,
        settings=settings,
    )
    try:
        enviar_smtp(msg, settings)
    except Exception as exc:
        logger.warning("Falha ao enviar a ficha %s por e-mail.", codigo, exc_info=True)
        raise ErroEnvio(motivo_curto(exc, settings)) from exc
    logger.info("Ficha %s enviada por e-mail para %s por %s.", codigo, ", ".join(settings.destinatarios), autor_email)
    return settings.destinatarios
