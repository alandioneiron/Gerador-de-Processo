"""A migração Alembic sobe num SQLite vazio e deixa o banco igual ao dos modelos."""

from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app

RAIZ = Path(__file__).resolve().parents[1]


def config_alembic(url: str) -> Config:
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


@pytest.fixture
def url(tmp_path) -> str:
    return f"sqlite:///{tmp_path / 'migrado.db'}"


def test_upgrade_head_cria_as_tabelas(url):
    command.upgrade(config_alembic(url), "head")

    motor = create_engine(url)
    inspetor = inspect(motor)
    assert {"fichas", "ficha_eventos", "contadores", "alembic_version"} <= set(inspetor.get_table_names())

    colunas = {c["name"] for c in inspetor.get_columns("fichas")}
    assert {"id", "numero", "codigo", "status", "versao", "dados", "criado_em", "atualizado_em"} <= colunas
    colunas_eventos = {c["name"] for c in inspetor.get_columns("ficha_eventos")}
    assert {"em", "autor_nome", "autor_email", "acao", "status_de", "status_para", "resumo"} <= colunas_eventos

    with motor.connect() as conexao:
        assert conexao.execute(text("SELECT valor FROM contadores WHERE nome = 'ficha'")).scalar_one() == 0
        assert conexao.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0001"
    motor.dispose()


def test_migracao_deixa_o_banco_igual_aos_modelos(url):
    command.upgrade(config_alembic(url), "head")
    motor = create_engine(url)
    with motor.connect() as conexao:
        diferencas = compare_metadata(MigrationContext.configure(conexao), Base.metadata)
    motor.dispose()
    assert diferencas == []


def test_downgrade_base_remove_tudo(url):
    cfg = config_alembic(url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    motor = create_engine(url)
    assert set(inspect(motor).get_table_names()) <= {"alembic_version"}
    motor.dispose()


def test_upgrade_usa_database_url_do_ambiente(tmp_path, monkeypatch):
    from app.config import get_settings

    destino = tmp_path / "pelo_ambiente.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{destino}")
    get_settings.cache_clear()
    cfg = Config(str(RAIZ / "alembic.ini"))  # sem sqlalchemy.url: vem do ambiente
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    command.upgrade(cfg, "head")

    assert destino.exists()
    motor = create_engine(f"sqlite:///{destino}")
    assert "fichas" in inspect(motor).get_table_names()
    motor.dispose()


def test_api_funciona_no_banco_criado_pela_migracao(url):
    command.upgrade(config_alembic(url), "head")
    motor = create_engine(url, connect_args={"check_same_thread": False})
    fabrica = sessionmaker(bind=motor)

    def _get_db():
        with fabrica() as sessao:
            yield sessao

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as cliente:
            autor = {"nome": "Maria", "email": "maria@neoguard.com.br"}
            primeira = cliente.post("/api/fichas", json={"autor": autor}).json()
            segunda = cliente.post("/api/fichas", json={"autor": autor}).json()
            assert (primeira["numero"], segunda["numero"]) == (1, 2)
            assert cliente.get("/api/fichas").json()[0]["id"] == segunda["id"]
    finally:
        app.dependency_overrides.clear()
        motor.dispose()
