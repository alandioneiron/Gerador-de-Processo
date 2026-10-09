"""Tabelas: fichas, ficha_eventos (histórico) e contadores (número sequencial)."""

from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, false
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db import Base

# JSON portátil: JSONB no PostgreSQL, JSON (texto) no SQLite.
TipoJSON = JSON().with_variant(JSONB(), "postgresql")


def agora() -> datetime:
    return datetime.now(UTC)


class DataHoraUTC(TypeDecorator):
    """Guarda sempre em UTC e devolve sempre com fuso (o SQLite perde o fuso)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class Ficha(Base):
    __tablename__ = "fichas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    numero: Mapped[int] = mapped_column(Integer, unique=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    status: Mapped[str] = mapped_column(String(40), index=True)
    # Controle otimista: o ORM soma 1 a cada UPDATE e recusa a gravação se outra
    # pessoa alterou a linha antes (StaleDataError -> 409).
    versao: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    # A instalação já foi concluída alguma vez? (decide para onde `retomar` volta)
    instalacao_concluida: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    # Resumo do cadastro, copiado de `dados` a cada gravação (listagem e busca).
    cliente: Mapped[str] = mapped_column(String(255), default="", server_default="")
    vendedor: Mapped[str] = mapped_column(String(255), default="", server_default="")
    data_prevista: Mapped[str] = mapped_column(String(40), default="", server_default="")
    cpf_cnpj: Mapped[str] = mapped_column(String(64), default="", server_default="")

    dados: Mapped[dict] = mapped_column(TipoJSON)
    criado_em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora)
    atualizado_em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora)

    eventos: Mapped[list["FichaEvento"]] = relationship(
        back_populates="ficha",
        order_by=lambda: FichaEvento.id.desc(),
        cascade="all, delete-orphan",
    )

    __mapper_args__ = {"version_id_col": versao}


class FichaEvento(Base):
    __tablename__ = "ficha_eventos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ficha_id: Mapped[int] = mapped_column(ForeignKey("fichas.id"), index=True)
    em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora)
    autor_nome: Mapped[str] = mapped_column(String(120))
    autor_email: Mapped[str] = mapped_column(String(254))
    acao: Mapped[str] = mapped_column(String(40))
    status_de: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status_para: Mapped[str | None] = mapped_column(String(40), nullable=True)
    resumo: Mapped[str] = mapped_column(Text, default="", server_default="")

    ficha: Mapped[Ficha] = relationship(back_populates="eventos")


class Contador(Base):
    """Contador de números: cada número emitido nunca é reaproveitado."""

    __tablename__ = "contadores"

    nome: Mapped[str] = mapped_column(String(40), primary_key=True)
    valor: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
