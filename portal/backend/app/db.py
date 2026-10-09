"""Conexão com o banco (SQLAlchemy 2)."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def criar_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        argumentos: dict = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            argumentos["poolclass"] = StaticPool
        return create_engine(url, **argumentos)
    return create_engine(url, pool_pre_ping=True)


@lru_cache
def get_engine() -> Engine:
    return criar_engine(get_settings().database_url)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine())


def get_db() -> Iterator[Session]:
    """Dependência do FastAPI: uma sessão por requisição."""
    with get_sessionmaker()() as sessao:
        yield sessao
