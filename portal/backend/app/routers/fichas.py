from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app import email
from app.db import get_db
from app.fichas import servico
from app.fichas.modelo import modelo_vazio
from app.identidade import autor_da_requisicao
from app.schemas import (
    AcaoCorpo,
    EnviarEmailCorpo,
    Etapa1Corpo,
    Etapa2Corpo,
    Etapa3Corpo,
    FichaNova,
    FichaOut,
    FichaResumoOut,
    PendenciasCorpo,
)

router = APIRouter(prefix="/fichas", tags=["fichas"])


def _ficha_out(ficha) -> FichaOut:
    # Serializa já, com a sessão aberta (os eventos são carregados sob demanda).
    return FichaOut.model_validate(ficha)


@router.get("/modelo")
def modelo() -> dict[str, Any]:
    """A ficha vazia, com as linhas iniciais do docx."""
    return modelo_vazio()


@router.get("", response_model=list[FichaResumoOut])
def listar(status: str | None = None, q: str | None = None, db: Session = Depends(get_db)):
    return [FichaResumoOut.model_validate(f) for f in servico.listar(db, status, q)]


@router.post("", status_code=201, response_model=FichaOut)
def criar(corpo: FichaNova, db: Session = Depends(get_db)):
    autor = autor_da_requisicao(corpo.autor)
    return _ficha_out(servico.criar(db, autor, corpo.dados))


@router.get("/{ficha_id}", response_model=FichaOut)
def detalhe(ficha_id: int, db: Session = Depends(get_db)):
    return _ficha_out(servico.obter(db, ficha_id))


@router.get("/{ficha_id}/travas")
def travas(ficha_id: int, db: Session = Depends(get_db)) -> dict[str, list[str]]:
    """O que ainda falta para cada ação travada (a tela mostra antes de o usuário clicar)."""
    return servico.travas(servico.obter(db, ficha_id))


@router.put("/{ficha_id}/etapa1", response_model=FichaOut)
def salvar_etapa1(ficha_id: int, corpo: Etapa1Corpo, db: Session = Depends(get_db)):
    autor = autor_da_requisicao(corpo.autor)
    return _ficha_out(servico.salvar_etapa1(db, ficha_id, autor, corpo.versao, corpo.etapa1))


@router.put("/{ficha_id}/etapa2", response_model=FichaOut)
def salvar_etapa2(ficha_id: int, corpo: Etapa2Corpo, db: Session = Depends(get_db)):
    autor = autor_da_requisicao(corpo.autor)
    return _ficha_out(servico.salvar_etapa2(db, ficha_id, autor, corpo.versao, corpo.etapa2))


@router.put("/{ficha_id}/etapa3", response_model=FichaOut)
def salvar_etapa3(ficha_id: int, corpo: Etapa3Corpo, db: Session = Depends(get_db)):
    autor = autor_da_requisicao(corpo.autor)
    ficha = servico.salvar_etapa3(db, ficha_id, autor, corpo.versao, corpo.testes_tecnicos, corpo.testes_ccon)
    return _ficha_out(ficha)


@router.put("/{ficha_id}/pendencias", response_model=FichaOut)
def salvar_pendencias(ficha_id: int, corpo: PendenciasCorpo, db: Session = Depends(get_db)):
    autor = autor_da_requisicao(corpo.autor)
    return _ficha_out(servico.salvar_pendencias(db, ficha_id, autor, corpo.versao, corpo.pendencias))


@router.post("/{ficha_id}/acoes/enviar-email", response_model=FichaOut)
def enviar_email(ficha_id: int, corpo: EnviarEmailCorpo, db: Session = Depends(get_db)):
    """Envia a ficha completa por e-mail para NOTIFICAR_PARA, na hora (502 se o SMTP falhar).

    Declarada antes da rota genérica de ações: não leva `versao` e não altera a ficha.
    """
    autor = autor_da_requisicao(corpo.autor)
    return _ficha_out(servico.enviar_email(db, ficha_id, autor, corpo.mensagem))


@router.post("/{ficha_id}/acoes/{acao}", response_model=FichaOut)
def executar_acao(
    ficha_id: int, acao: str, corpo: AcaoCorpo, tarefas: BackgroundTasks, db: Session = Depends(get_db)
):
    autor = autor_da_requisicao(corpo.autor)
    ficha, notificacao = servico.executar_acao(db, ficha_id, acao, autor, corpo)
    if notificacao is not None:
        tarefas.add_task(email.enviar_notificacao, notificacao)
    return _ficha_out(ficha)
