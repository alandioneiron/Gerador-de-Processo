"""Erros de negócio e tratadores globais: toda resposta de erro é `{ "detail": "<PT-BR>" }`."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.erros")


class ErroNegocio(Exception):
    """Erro previsto, devolvido ao cliente com `detail` (e `faltas`, nas travas)."""

    def __init__(self, status_code: int, detail: str, faltas: list[str] | None = None):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.faltas = faltas


MSG_VERSAO = "A ficha foi alterada por outra pessoa. Recarregue."

_MENSAGENS_HTTP = {
    404: "Recurso não encontrado.",
    405: "Método não permitido para este endereço.",
    415: "Tipo de conteúdo não suportado.",
}

_MENSAGENS_CAMPO = {
    ("autor",): "Informe quem está preenchendo (autor com nome e e-mail).",
    ("autor", "nome"): "Informe o nome de quem está preenchendo (autor.nome).",
    ("autor", "email"): "Informe um e-mail válido de quem está preenchendo (autor.email).",
    ("versao",): "Informe a versão da ficha (versao), um número inteiro.",
    ("mensagem",): "A mensagem deve ser um texto de até 2000 caracteres.",
}

_MENSAGENS_TIPO = {
    "missing": "campo obrigatório",
    "int_parsing": "deve ser um número inteiro",
    "int_type": "deve ser um número inteiro",
    "dict_type": "deve ser um objeto",
    "list_type": "deve ser uma lista",
    "string_type": "deve ser um texto",
    "bool_type": "deve ser verdadeiro ou falso",
}


def _mensagem_validacao(erro: dict) -> str:
    local = tuple(str(p) for p in erro.get("loc", ()) if p != "body")
    if erro.get("type") == "json_invalid":
        return "O corpo da requisição não é um JSON válido."
    if local in _MENSAGENS_CAMPO:
        return _MENSAGENS_CAMPO[local]
    campo = ".".join(local) or "requisição"
    motivo = _MENSAGENS_TIPO.get(erro.get("type", ""), "valor inválido")
    return f"Campo “{campo}”: {motivo}."


def registrar_tratadores(app: FastAPI) -> None:
    @app.exception_handler(ErroNegocio)
    async def _negocio(_: Request, exc: ErroNegocio) -> JSONResponse:
        corpo: dict = {"detail": exc.detail}
        if exc.faltas is not None:
            corpo["faltas"] = exc.faltas
        return JSONResponse(corpo, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validacao(_: Request, exc: RequestValidationError) -> JSONResponse:
        mensagens: list[str] = []
        for erro in exc.errors():
            m = _mensagem_validacao(erro)
            if m not in mensagens:
                mensagens.append(m)
        return JSONResponse({"detail": " ".join(mensagens)}, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = _MENSAGENS_HTTP.get(exc.status_code, "Não foi possível atender a requisição.")
        return JSONResponse({"detail": detail}, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(Exception)
    async def _inesperado(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Erro inesperado: %s", exc)
        return JSONResponse({"detail": "Erro interno do servidor. Tente novamente."}, status_code=500)
