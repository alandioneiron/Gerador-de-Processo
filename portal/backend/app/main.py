"""Aplicação FastAPI do Portal Neoguard. Suba com: uvicorn app.main:app --port 8000"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.erros import registrar_tratadores
from app.routers import fichas, saude


def criar_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = get_settings()

    app = FastAPI(
        title="Portal Neoguard — API",
        version=settings.git_sha,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origens_cors,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    registrar_tratadores(app)
    app.include_router(saude.router, prefix="/api")
    app.include_router(fichas.router, prefix="/api")
    return app


app = criar_app()
