"""Corpos de requisição e respostas da API (Pydantic 2)."""

import re
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

MAX_MENSAGEM = 2000

_EMAIL = re.compile(r"^[^@\s,;<>()\[\]\\\"]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$")


class Autor(BaseModel):
    """Quem está escrevendo (Fase 1: informado pelo navegador)."""

    nome: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=254)]

    @field_validator("nome")
    @classmethod
    def _uma_linha(cls, valor: str) -> str:
        return " ".join(valor.split())

    @field_validator("email")
    @classmethod
    def _email_valido(cls, valor: str) -> str:
        if not _EMAIL.match(valor):
            raise ValueError("e-mail inválido")
        return valor


# --- entrada ------------------------------------------------------------------------------


class FichaNova(BaseModel):
    autor: Autor
    dados: dict[str, Any] | None = None


class CorpoEscrita(BaseModel):
    autor: Autor
    versao: int


class Etapa1Corpo(CorpoEscrita):
    etapa1: dict[str, Any]


class Etapa2Corpo(CorpoEscrita):
    etapa2: dict[str, Any]


class Etapa3Corpo(CorpoEscrita):
    testes_tecnicos: dict[str, Any] | None = None
    testes_ccon: dict[str, Any] | None = None


class PendenciasCorpo(CorpoEscrita):
    pendencias: list[dict[str, Any]]


class EnviarEmailCorpo(BaseModel):
    """`enviar-email` não altera a ficha, então não leva `versao`."""

    autor: Autor
    mensagem: Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_MENSAGEM)] | None = None


class AcaoCorpo(CorpoEscrita):
    # registrar-pendencia
    tipo: str | None = None
    descricao: str | None = None
    responsavel: str | None = None
    prazo: str | None = None
    # validar-ccon
    validacao_ccon: dict[str, Any] | None = None


# --- saída --------------------------------------------------------------------------------


class EventoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    em: datetime
    autor_nome: str
    autor_email: str
    acao: str
    status_de: str | None
    status_para: str | None
    resumo: str


class FichaResumoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero: int
    codigo: str
    status: str
    cliente: str
    vendedor: str
    data_prevista: str
    criado_em: datetime
    atualizado_em: datetime


class FichaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero: int
    codigo: str
    status: str
    versao: int
    dados: dict[str, Any]
    criado_em: datetime
    atualizado_em: datetime
    eventos: list[EventoOut] = Field(default_factory=list)


class SaudeOut(BaseModel):
    ok: bool
    versao: str
