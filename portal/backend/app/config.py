"""Configuração do backend, lida de variáveis de ambiente (e de um .env local, se existir)."""

from email.utils import parseaddr
from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

NOTIFICAR_PADRAO = "ti@neoguard.com.br,suporte@neoguard.com.br,aux.ti@neoguard.com.br"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
    )

    # Banco: SQLite no desenvolvimento, PostgreSQL 16 em produção
    # (postgresql+psycopg://usuario:senha@db:5432/portal).
    database_url: str = "sqlite:///./portal-dev.db"

    # Endereço público do portal (usado no link dos e-mails).
    portal_url: str = "http://172.16.100.35:8090"

    # Destinatários das notificações, separados por vírgula.
    notificar_para: str = NOTIFICAR_PADRAO

    # SMTP. Sem SMTP_HOST nenhum e-mail é enviado (só vai para o log).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_usuario: str = ""
    smtp_senha: str = ""
    smtp_remetente: str = ""
    smtp_tls: Literal["starttls", "ssl", "nenhum"] = "starttls"
    smtp_verificar_certificado: bool = True

    # Versão exibida em /api/saude (o deploy injeta o SHA do commit).
    git_sha: str = "dev"

    # Origens liberadas no CORS. Em produção o Nginx serve tudo na mesma origem,
    # então só o servidor de desenvolvimento do frontend precisa de CORS.
    cors_origens: str = "http://localhost:5173"

    @field_validator("database_url")
    @classmethod
    def _normalizar_url_banco(cls, valor: str) -> str:
        valor = valor.strip()
        # Aceita as formas curtas e força o driver psycopg 3.
        for prefixo in ("postgresql://", "postgres://"):
            if valor.startswith(prefixo):
                return "postgresql+psycopg://" + valor[len(prefixo) :]
        return valor

    @field_validator("smtp_tls", mode="before")
    @classmethod
    def _normalizar_tls(cls, valor: object) -> object:
        return valor.strip().lower() if isinstance(valor, str) else valor

    @property
    def destinatarios(self) -> list[str]:
        partes = self.notificar_para.replace(";", ",").split(",")
        return [p.strip() for p in partes if p.strip()]

    @property
    def remetente(self) -> str:
        """Valor do cabeçalho From; aceita o formato "Nome <email>"."""
        return self.smtp_remetente.strip() or self.smtp_usuario.strip() or "portal@neoguard.com.br"

    @property
    def remetente_endereco(self) -> str:
        """Só o endereço do remetente (sem o nome), para o envelope do SMTP."""
        return parseaddr(self.remetente)[1] or self.remetente

    @property
    def origens_cors(self) -> list[str]:
        return [o.strip() for o in self.cors_origens.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
