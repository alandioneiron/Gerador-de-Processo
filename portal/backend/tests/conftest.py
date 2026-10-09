"""Fixtures: banco SQLite temporário por teste, cliente HTTP e roteiros prontos de preenchimento."""

import copy

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.db import Base, criar_engine, get_db
from app.main import app
from app.models import Ficha

AUTOR = {"nome": "Maria Comercial", "email": "maria@neoguard.com.br"}
OUTRO_AUTOR = {"nome": "João Técnico", "email": "joao@neoguard.com.br"}

VARIAVEIS_DO_PORTAL = (
    "DATABASE_URL", "PORTAL_URL", "NOTIFICAR_PARA", "SMTP_HOST", "SMTP_PORT", "SMTP_USUARIO",
    "SMTP_SENHA", "SMTP_REMETENTE", "SMTP_TLS", "SMTP_VERIFICAR_CERTIFICADO", "GIT_SHA", "CORS_ORIGENS",
)  # fmt: skip


@pytest.fixture(autouse=True)
def ambiente_limpo(monkeypatch, tmp_path):
    """Nenhum teste lê o .env nem as variáveis da máquina: tudo parte do padrão, sem SMTP."""
    for nome in VARIAVEIS_DO_PORTAL:
        monkeypatch.delenv(nome, raising=False)
    monkeypatch.chdir(tmp_path)  # sem .env à vista
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def configurar(monkeypatch):
    """Define variáveis de ambiente do portal e recarrega as configurações."""

    def _configurar(**variaveis: str) -> None:
        for nome, valor in variaveis.items():
            monkeypatch.setenv(nome.upper(), valor)
        get_settings.cache_clear()

    return _configurar


@pytest.fixture
def engine(tmp_path):
    motor = criar_engine(f"sqlite:///{tmp_path / 'teste.db'}")
    Base.metadata.create_all(motor)
    yield motor
    motor.dispose()


@pytest.fixture
def client(engine):
    fabrica = sessionmaker(bind=engine)

    def _get_db():
        with fabrica() as sessao:
            yield sessao

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as cliente:
        yield cliente
    app.dependency_overrides.clear()


# --- roteiro de preenchimento ------------------------------------------------------------


def etapa1_completa() -> dict:
    """Etapa 1 mínima que libera a instalação (um usuário usa o app)."""
    return {
        "cliente": {
            "razao_social": "Padaria Exemplo Ltda",
            "cpf_cnpj": "11.222.333/0001-81",
            "telefone": "(11) 4000-0000",
            "endereco": "Rua das Flores, 100 - Centro",
            "vendedor": "Carlos Vendedor",
            "data_prevista": "2026-11-20",
        },
        "contatos": [{"nome": "Dona Ana", "tel_principal": "(11) 99999-0001", "decide": "sim"}],
        "usuarios": [
            {"nome": "Dona Ana", "permissao": "arma_desarma", "usa_app": "sim", "email_app": "ana@example.com"},
            {"nome": "Seu José", "permissao": "so_arma", "usa_app": "nao"},
        ],
    }


def etapa2_completa() -> dict:
    """Etapa 2 mínima que conclui a instalação."""
    return {
        "equipamentos": {"modelo_central": "AMT 2018 EG", "numero_serie": "SN123456"},
        "comunicacao": {"principal": "ethernet", "contingencia": "gprs"},
        "zonas": [{"zona": "Z01", "ambiente": "Entrada", "dispositivo": "Sensor magnético"}],
        "usuarios_config": {"confirmado": "sim"},
    }


def todos_tecnicos(valor: bool = True) -> dict:
    from app.fichas.modelo import TESTES_TECNICOS

    return dict.fromkeys(TESTES_TECNICOS, valor)


def todos_ccon(valor: bool = True) -> dict:
    from app.fichas.modelo import TESTES_CCON

    return dict.fromkeys(TESTES_CCON, valor)


def validacao_aprovada() -> dict:
    return {
        "operador": "Operador CCON", "data": "2026-11-25", "hora": "14:30",
        "cadastro": "ok", "comunicacao": "ok", "eventos": "ok", "contatos": "ok", "regras_operacionais": "ok",
        "resultado": "aprovado", "observacoes": "Tudo conferido.",
    }  # fmt: skip


class Api:
    """Atalhos para os endpoints, sempre com autor e versão corretos."""

    def __init__(self, client: TestClient):
        self.c = client

    def criar(self, dados: dict | None = None, autor: dict = AUTOR):
        corpo = {"autor": autor}
        if dados is not None:
            corpo["dados"] = dados
        resposta = self.c.post("/api/fichas", json=corpo)
        assert resposta.status_code == 201, resposta.text
        return resposta.json()

    def obter(self, ficha_id: int) -> dict:
        resposta = self.c.get(f"/api/fichas/{ficha_id}")
        assert resposta.status_code == 200, resposta.text
        return resposta.json()

    def salvar(self, ficha: dict, secao: str, autor: dict = AUTOR, **conteudo):
        """PUT /etapaN ou /pendencias com a versão atual da ficha; devolve a resposta HTTP."""
        corpo = {"autor": autor, "versao": ficha["versao"], **conteudo}
        return self.c.put(f"/api/fichas/{ficha['id']}/{secao}", json=corpo)

    def acao(self, ficha: dict, acao: str, autor: dict = AUTOR, **extras):
        corpo = {"autor": autor, "versao": ficha["versao"], **extras}
        return self.c.post(f"/api/fichas/{ficha['id']}/acoes/{acao}", json=corpo)

    def ok(self, resposta) -> dict:
        assert resposta.status_code == 200, resposta.text
        return resposta.json()

    # --- caminhos prontos até cada status ---
    def ate_liberado(self) -> dict:
        ficha = self.criar()
        ficha = self.ok(self.salvar(ficha, "etapa1", etapa1=etapa1_completa()))
        return self.ok(self.acao(ficha, "liberar-instalacao"))

    def ate_em_instalacao(self) -> dict:
        ficha = self.ate_liberado()
        return self.ok(self.salvar(ficha, "etapa2", etapa2=etapa2_completa()))

    def ate_instalacao_concluida(self) -> dict:
        ficha = self.ate_em_instalacao()
        return self.ok(self.acao(ficha, "concluir-instalacao"))

    def ate_aguardando_ccon(self) -> dict:
        ficha = self.ate_instalacao_concluida()
        return self.ok(self.salvar(ficha, "etapa3", testes_tecnicos=todos_tecnicos()))

    def ate_ativo(self) -> dict:
        ficha = self.ate_aguardando_ccon()
        ficha = self.ok(self.salvar(ficha, "etapa3", testes_ccon=todos_ccon()))
        return self.ok(self.acao(ficha, "validar-ccon", validacao_ccon=validacao_aprovada()))


@pytest.fixture
def api(client) -> Api:
    return Api(client)


@pytest.fixture
def forcar_status(engine, api):
    """Cria uma ficha e a coloca direto em um status (atalho para testes de matriz)."""

    def _forcar(status: str) -> dict:
        ficha = api.criar()
        with engine.begin() as conexao:
            conexao.execute(update(Ficha).where(Ficha.id == ficha["id"]).values(status=status))
        return api.obter(ficha["id"])

    return _forcar


@pytest.fixture
def dados_vazios(client) -> dict:
    return copy.deepcopy(client.get("/api/fichas/modelo").json())
