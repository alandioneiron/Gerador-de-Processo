"""Casos de uso da ficha: leitura, criação, salvamento por etapa e ações (com histórico e e-mail)."""

import copy
from typing import Any

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app import email as notificacoes
from app.email import ErroEnvio, Notificacao
from app.erros import MSG_VERSAO, ErroNegocio
from app.fichas import acoes, regras
from app.fichas import status as st
from app.fichas.modelo import (
    aplicar_secao,
    conferir_etapa1,
    modelo_vazio,
    normalizar,
    validacao_ccon_vazia,
)
from app.fichas.modelo import mesclar as _mesclar
from app.fichas.travas import todas_as_travas
from app.models import Contador, Ficha, FichaEvento, agora
from app.schemas import AcaoCorpo, Autor

NOME_CONTADOR = "ficha"


# --- utilidades --------------------------------------------------------------------------


def proximo_numero(db: Session) -> int:
    """Próximo número sequencial; nunca é reaproveitado (a linha do contador fica travada até o commit)."""
    comando = (
        update(Contador)
        .where(Contador.nome == NOME_CONTADOR)
        .values(valor=Contador.valor + 1)
        .returning(Contador.valor)
        .execution_options(synchronize_session=False)
    )
    numero = db.execute(comando).scalar_one_or_none()
    if numero is None:
        db.add(Contador(nome=NOME_CONTADOR, valor=1))
        db.flush()
        numero = 1
    return numero


def _sincronizar_resumo(ficha: Ficha) -> None:
    """Copia o resumo do cadastro (listagem e busca) de `dados` para as colunas."""
    cliente = ficha.dados["etapa1"]["cliente"]
    ficha.cliente = (cliente["razao_social"] or cliente["nome_fantasia"])[:255]
    ficha.vendedor = cliente["vendedor"][:255]
    ficha.data_prevista = cliente["data_prevista"][:40]
    ficha.cpf_cnpj = cliente["cpf_cnpj"][:64]


def _commit(db: Session) -> None:
    try:
        db.commit()
    except StaleDataError:
        db.rollback()
        raise ErroNegocio(409, MSG_VERSAO) from None


def _registrar_evento(
    db: Session, ficha: Ficha, autor: Autor, acao: str, status_de: str | None, resumo: str
) -> None:
    db.add(
        FichaEvento(
            ficha_id=ficha.id,
            em=agora(),
            autor_nome=autor.nome,
            autor_email=autor.email,
            acao=acao,
            status_de=status_de,
            status_para=ficha.status,
            resumo=resumo,
        )
    )


def _notificacao(ficha: Ficha, autor: Autor, acao: str, rotulo: str, detalhes: tuple[str, ...] = ()) -> Notificacao:
    return Notificacao(
        ficha_id=ficha.id,
        codigo=ficha.codigo,
        acao=acao,
        rotulo_acao=rotulo,
        status_novo=st.rotulo(ficha.status),
        cliente=ficha.cliente,
        vendedor=ficha.vendedor,
        data_prevista=ficha.data_prevista,
        autor_nome=autor.nome,
        autor_email=autor.email,
        detalhes=detalhes,
    )


# --- leitura -----------------------------------------------------------------------------


def obter(db: Session, ficha_id: int) -> Ficha:
    ficha = db.get(Ficha, ficha_id)
    if ficha is None:
        raise ErroNegocio(404, "Ficha não encontrada.")
    return ficha


def _so_digitos(coluna):
    for simbolo in (".", "-", "/", " "):
        coluna = func.replace(coluna, simbolo, "")
    return coluna


def listar(db: Session, status: str | None = None, q: str | None = None) -> list[Ficha]:
    consulta = select(Ficha).order_by(Ficha.atualizado_em.desc(), Ficha.id.desc())
    if status:
        if status not in st.ROTULOS:
            raise ErroNegocio(422, f"Status inválido: “{status}”. Use um de: {', '.join(st.TODOS_STATUS)}.")
        consulta = consulta.where(Ficha.status == status)
    termo = (q or "").strip()
    if termo:
        filtros = [
            Ficha.cliente.icontains(termo, autoescape=True),
            Ficha.vendedor.icontains(termo, autoescape=True),
            Ficha.codigo.icontains(termo, autoescape=True),
            Ficha.cpf_cnpj.icontains(termo, autoescape=True),
        ]
        digitos = "".join(c for c in termo if c.isdigit())
        if len(digitos) >= 3:
            filtros.append(_so_digitos(Ficha.cpf_cnpj).contains(digitos, autoescape=True))
        consulta = consulta.where(or_(*filtros))
    return list(db.scalars(consulta))


def travas(ficha: Ficha) -> dict[str, list[str]]:
    return todas_as_travas(ficha.dados)


# --- criação -----------------------------------------------------------------------------


def criar(db: Session, autor: Autor, dados_iniciais: dict[str, Any] | None) -> Ficha:
    padrao = modelo_vazio()
    dados = _mesclar(padrao, padrao, dados_iniciais or {})
    dados["etapa3"]["validacao_ccon"] = validacao_ccon_vazia()  # só a ação validar-ccon preenche
    conferir_etapa1(dados)

    momento = agora()
    numero = proximo_numero(db)
    ficha = Ficha(
        numero=numero,
        codigo=f"FI-{momento.year}-{numero:04d}",
        status=st.CADASTRO_EM_PREENCHIMENTO,
        instalacao_concluida=False,
        dados=dados,
        criado_em=momento,
        atualizado_em=momento,
    )
    _sincronizar_resumo(ficha)
    db.add(ficha)
    db.flush()
    _registrar_evento(db, ficha, autor, "criou", None, f"Ficha {ficha.codigo} criada.")
    _commit(db)
    db.refresh(ficha)
    return ficha  # uma ficha recém-criada (quase vazia) não gera e-mail


# --- escrita -----------------------------------------------------------------------------


def _carregar_para_escrita(db: Session, ficha_id: int, versao: int) -> Ficha:
    ficha = obter(db, ficha_id)
    if ficha.versao != versao:
        raise ErroNegocio(409, MSG_VERSAO)
    return ficha


def _gravar(
    db: Session,
    ficha: Ficha,
    autor: Autor,
    acao: str,
    status_de: str,
    status_para: str,
    dados: dict,
    resumo: str,
    instalacao_concluida: bool | None = None,
) -> None:
    ficha.dados = dados
    ficha.status = status_para
    if instalacao_concluida is not None:
        ficha.instalacao_concluida = instalacao_concluida
    ficha.atualizado_em = agora()
    _sincronizar_resumo(ficha)
    _registrar_evento(db, ficha, autor, acao, status_de, resumo)
    _commit(db)
    db.refresh(ficha)


def salvar_etapa1(db: Session, ficha_id: int, autor: Autor, versao: int, etapa1: dict) -> Ficha:
    ficha = _carregar_para_escrita(db, ficha_id, versao)
    regras.verificar_edicao(ficha.status, "etapa1")
    dados = aplicar_secao(normalizar(ficha.dados), ("etapa1",), etapa1)
    conferir_etapa1(dados)
    _gravar(db, ficha, autor, "salvou_etapa1", ficha.status, ficha.status, dados, "Etapa 1 (Cadastro) salva.")
    return ficha


def salvar_etapa2(db: Session, ficha_id: int, autor: Autor, versao: int, etapa2: dict) -> Ficha:
    ficha = _carregar_para_escrita(db, ficha_id, versao)
    regras.verificar_edicao(ficha.status, "etapa2")
    dados = aplicar_secao(normalizar(ficha.dados), ("etapa2",), etapa2)
    de = ficha.status
    para = regras.status_apos_salvar_etapa2(de)
    resumo = "Etapa 2 (Instalação) salva."
    if para != de:
        resumo += " Instalação iniciada."
    _gravar(db, ficha, autor, "salvou_etapa2", de, para, dados, resumo)
    return ficha


def salvar_etapa3(
    db: Session,
    ficha_id: int,
    autor: Autor,
    versao: int,
    testes_tecnicos: dict | None,
    testes_ccon: dict | None,
) -> Ficha:
    ficha = _carregar_para_escrita(db, ficha_id, versao)
    regras.verificar_edicao(ficha.status, "etapa3")
    dados = normalizar(ficha.dados)
    dados = aplicar_secao(dados, ("etapa3", "testes_tecnicos"), testes_tecnicos)
    dados = aplicar_secao(dados, ("etapa3", "testes_ccon"), testes_ccon)
    de = ficha.status
    para = regras.status_apos_salvar_etapa3(de, dados)
    resumo = "Testes da Etapa 3 salvos."
    if para != de:
        resumo += " Testes técnicos completos: aguardando os testes com a CCON."
    _gravar(db, ficha, autor, "salvou_etapa3", de, para, dados, resumo)
    return ficha


def salvar_pendencias(db: Session, ficha_id: int, autor: Autor, versao: int, pendencias: list) -> Ficha:
    ficha = _carregar_para_escrita(db, ficha_id, versao)
    regras.verificar_edicao(ficha.status, "pendencias")
    dados = aplicar_secao(normalizar(ficha.dados), ("pendencias",), pendencias)
    _gravar(db, ficha, autor, "salvou_pendencias", ficha.status, ficha.status, dados, "Pendências salvas.")
    return ficha


def executar_acao(
    db: Session, ficha_id: int, acao: str, autor: Autor, corpo: AcaoCorpo
) -> tuple[Ficha, Notificacao | None]:
    acoes.definicao(acao)  # 404 se a ação não existe, antes de qualquer outra checagem
    ficha = _carregar_para_escrita(db, ficha_id, corpo.versao)
    contexto = acoes.Contexto(
        status=ficha.status,
        dados=normalizar(copy.deepcopy(ficha.dados)),
        instalacao_concluida=ficha.instalacao_concluida,
        autor=autor,
        corpo=corpo,
    )
    transicao = acoes.executar(acao, contexto)
    de = ficha.status
    _gravar(
        db, ficha, autor, acao, de, transicao.status_para, transicao.dados, transicao.resumo,
        instalacao_concluida=transicao.instalacao_concluida,
    )  # fmt: skip
    notificacao = None
    if transicao.notificar:
        notificacao = _notificacao(ficha, autor, acao, transicao.rotulo, transicao.detalhes)
    return ficha, notificacao


def enviar_email(db: Session, ficha_id: int, autor: Autor, mensagem: str | None) -> Ficha:
    """Envia a ficha completa por e-mail, agora. Não mexe em dados, status nem versão.

    Se o SMTP não está configurado ou falha, devolve 502 e não registra o evento.
    """
    ficha = obter(db, ficha_id)
    texto = (mensagem or "").strip()
    try:
        destinatarios = notificacoes.enviar_ficha(
            ficha_id=ficha.id,
            codigo=ficha.codigo,
            status_rotulo=st.rotulo(ficha.status),
            cliente=ficha.cliente,
            dados=normalizar(ficha.dados),
            autor_nome=autor.nome,
            autor_email=autor.email,
            mensagem=texto,
        )
    except ErroEnvio as erro:
        raise ErroNegocio(502, f"Não foi possível enviar o e-mail: {erro.motivo}") from None

    resumo = f"Ficha enviada por e-mail para {', '.join(destinatarios)}."
    if texto:
        resumo += f" Mensagem: {texto}"
    _registrar_evento(db, ficha, autor, "enviou_email", ficha.status, resumo)
    _commit(db)
    db.refresh(ficha)
    return ficha
