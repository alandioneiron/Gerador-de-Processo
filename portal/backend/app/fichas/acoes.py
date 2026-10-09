"""Ações de workflow (seção 3): validam o status e a trava e devolvem a transição a gravar."""

import copy
from collections.abc import Callable
from dataclasses import dataclass

from app.erros import ErroNegocio
from app.fichas import status as st
from app.fichas.modelo import MAX_LINHAS, mesclar, pendencia_vazia, validacao_ccon_vazia
from app.fichas.travas import (
    ITENS_VALIDACAO,
    faltas_concluir_instalacao,
    faltas_liberar_instalacao,
    faltas_validar_ccon,
    testes_tecnicos_completos,
)
from app.schemas import AcaoCorpo, Autor


@dataclass
class Transicao:
    status_para: str
    dados: dict
    rotulo: str  # texto da ação, usado no assunto do e-mail
    resumo: str  # texto do histórico
    detalhes: tuple[str, ...] = ()  # linhas extras do e-mail
    instalacao_concluida: bool = False
    notificar: bool = True


@dataclass(frozen=True)
class Definicao:
    rotulo: str
    de: frozenset[str]


@dataclass
class Contexto:
    """O que uma ação precisa saber da ficha (sem acesso ao banco)."""

    status: str
    dados: dict
    instalacao_concluida: bool
    autor: Autor
    corpo: AcaoCorpo


DEFINICOES: dict[str, Definicao] = {
    "liberar-instalacao": Definicao(
        "Liberar para instalação", frozenset({st.CADASTRO_EM_PREENCHIMENTO, st.PENDENCIA_CADASTRAL})
    ),
    "concluir-instalacao": Definicao(
        "Concluir instalação", frozenset({st.EM_INSTALACAO, st.PENDENCIA_TECNICA})
    ),
    "validar-ccon": Definicao("Validar CCON", frozenset({st.AGUARDANDO_TESTES_CCON})),
    "registrar-pendencia": Definicao(
        "Registrar pendência", frozenset(st.TODOS_STATUS) - {st.ATIVO_MONITORADO}
    ),
    "retomar": Definicao("Retomar", frozenset({st.PENDENCIA_CADASTRAL, st.PENDENCIA_TECNICA})),
}


def _t(valor: str | None) -> str:
    return (valor or "").strip()


# --- cada ação ---------------------------------------------------------------------------


def _liberar_instalacao(ctx: Contexto) -> Transicao:
    faltas = faltas_liberar_instalacao(ctx.dados)
    if faltas:
        raise ErroNegocio(422, "Não é possível liberar a instalação: faltam itens obrigatórios.", faltas)
    return Transicao(
        status_para=st.LIBERADO_PARA_INSTALACAO,
        dados=ctx.dados,
        rotulo="Liberada para instalação",
        resumo="Cadastro conferido e ficha liberada para instalação.",
        instalacao_concluida=ctx.instalacao_concluida,
    )


def _concluir_instalacao(ctx: Contexto) -> Transicao:
    faltas = faltas_concluir_instalacao(ctx.dados)
    if faltas:
        raise ErroNegocio(422, "Não é possível concluir a instalação: faltam itens obrigatórios.", faltas)
    return Transicao(
        status_para=st.INSTALACAO_CONCLUIDA,
        dados=ctx.dados,
        rotulo="Instalação concluída",
        resumo="Instalação e configuração concluídas; seguem os testes da Etapa 3.",
        instalacao_concluida=True,
    )


def _validar_ccon(ctx: Contexto) -> Transicao:
    bruto = ctx.corpo.validacao_ccon
    if bruto is None:
        raise ErroNegocio(
            422, "Informe a validação da CCON (validacao_ccon).", ["Preencha a validação da CCON (3.3)."]
        )
    validacao = mesclar(validacao_ccon_vazia(), {}, bruto, "etapa3.validacao_ccon", "validacao_ccon")

    resultado = validacao["resultado"]
    if resultado not in ("aprovado", "reprovado"):
        raise ErroNegocio(
            422,
            "Informe o resultado da validação da CCON: aprovado ou reprovado.",
            ["Validação da CCON (3.3): marque o resultado (aprovado ou reprovado)."],
        )

    operador = validacao["operador"] or ctx.autor.nome
    dados = copy.deepcopy(ctx.dados)
    dados["etapa3"]["validacao_ccon"] = validacao
    detalhes = [f"Operador da CCON: {operador}"]
    if validacao["observacoes"]:
        detalhes.append(f"Observações: {validacao['observacoes']}")

    if resultado == "aprovado":
        faltas = faltas_validar_ccon(ctx.dados, validacao)
        if faltas:
            raise ErroNegocio(
                422, "Não é possível aprovar a ativação: há pendências na validação.", faltas
            )
        return Transicao(
            status_para=st.ATIVO_MONITORADO,
            dados=dados,
            rotulo="Validação da CCON: aprovada (ATIVO / MONITORADO)",
            resumo=f"Validação da CCON aprovada por {operador}: ficha ATIVO / MONITORADO.",
            detalhes=tuple(detalhes),
            instalacao_concluida=True,
        )

    pendentes = [f"{rotulo}: PENDENTE" for campo, rotulo in ITENS_VALIDACAO.items() if validacao[campo] == "pendente"]
    resumo = f"Validação da CCON reprovada por {operador}: ficha em pendência técnica."
    if validacao["observacoes"]:
        resumo += f" Observações: {validacao['observacoes']}"
    return Transicao(
        status_para=st.PENDENCIA_TECNICA,
        dados=dados,
        rotulo="Validação da CCON: reprovada (pendência técnica)",
        resumo=resumo,
        detalhes=tuple(detalhes + pendentes),
        instalacao_concluida=True,
    )


def _registrar_pendencia(ctx: Contexto) -> Transicao:
    corpo = ctx.corpo
    tipo = _t(corpo.tipo).lower()
    if tipo not in ("cadastral", "tecnica"):
        raise ErroNegocio(
            422,
            "Informe o tipo da pendência: “cadastral” ou “tecnica”.",
            ["Informe o tipo da pendência (cadastral ou tecnica)."],
        )
    descricao = _t(corpo.descricao)
    if not descricao:
        raise ErroNegocio(422, "Descreva a pendência para registrá-la.", ["Descreva a pendência."])

    linha = mesclar(
        pendencia_vazia(),
        {},
        {"descricao": descricao, "responsavel": _t(corpo.responsavel), "prazo": _t(corpo.prazo)},
        "pendencias[]",
        "pendencia",
    )
    dados = copy.deepcopy(ctx.dados)
    linhas = dados["pendencias"]
    # Aproveita a primeira linha em branco da tabela (como no docx); senão acrescenta ao final.
    vazia = next((i for i, p in enumerate(linhas) if not (p["descricao"] or p["responsavel"] or p["prazo"])), None)
    if vazia is not None:
        linhas[vazia] = linha
    elif len(linhas) >= MAX_LINHAS:
        raise ErroNegocio(422, "A tabela de pendências está cheia.", ["Resolva ou remova pendências antigas."])
    else:
        linhas.append(linha)

    nome_tipo = "cadastral" if tipo == "cadastral" else "técnica"
    detalhes = [f"Pendência {nome_tipo}: {descricao}"]
    if linha["responsavel"]:
        detalhes.append(f"Responsável: {linha['responsavel']}")
    if linha["prazo"]:
        detalhes.append(f"Prazo: {linha['prazo']}")
    resumo_descricao = descricao if len(descricao) <= 200 else descricao[:197] + "..."
    return Transicao(
        status_para=st.PENDENCIA_CADASTRAL if tipo == "cadastral" else st.PENDENCIA_TECNICA,
        dados=dados,
        rotulo=f"Pendência {nome_tipo} registrada",
        resumo=f"Pendência {nome_tipo} registrada: {resumo_descricao}",
        detalhes=tuple(detalhes),
        instalacao_concluida=ctx.instalacao_concluida,
    )


def _retomar(ctx: Contexto) -> Transicao:
    if ctx.status == st.PENDENCIA_CADASTRAL:
        destino = st.CADASTRO_EM_PREENCHIMENTO
    elif not ctx.instalacao_concluida:
        destino = st.EM_INSTALACAO
    elif testes_tecnicos_completos(ctx.dados):
        destino = st.AGUARDANDO_TESTES_CCON
    else:
        destino = st.INSTALACAO_CONCLUIDA
    return Transicao(
        status_para=destino,
        dados=ctx.dados,
        rotulo="Pendência resolvida: ficha retomada",
        resumo=f"Ficha retomada: de “{st.rotulo(ctx.status)}” para “{st.rotulo(destino)}”.",
        instalacao_concluida=ctx.instalacao_concluida,
        notificar=False,
    )


_EXECUTORES: dict[str, Callable[[Contexto], Transicao]] = {
    "liberar-instalacao": _liberar_instalacao,
    "concluir-instalacao": _concluir_instalacao,
    "validar-ccon": _validar_ccon,
    "registrar-pendencia": _registrar_pendencia,
    "retomar": _retomar,
}


def definicao(acao: str) -> Definicao:
    """A definição da ação, ou 404 se o nome não existe."""
    encontrada = DEFINICOES.get(acao)
    if encontrada is None:
        disponiveis = ", ".join([*DEFINICOES, "enviar-email"])
        raise ErroNegocio(404, f"Ação desconhecida: “{acao}”. Ações disponíveis: {disponiveis}.")
    return encontrada


def executar(acao: str, ctx: Contexto) -> Transicao:
    """Confere o status de origem e roda a ação (que confere a trava)."""
    regra = definicao(acao)
    if ctx.status == st.ATIVO_MONITORADO:
        raise ErroNegocio(409, "A ficha está ATIVO / MONITORADO e é somente leitura.")
    if ctx.status not in regra.de:
        raise ErroNegocio(
            409, f"A ação “{regra.rotulo}” não está disponível no status “{st.rotulo(ctx.status)}”."
        )
    return _EXECUTORES[acao](ctx)
