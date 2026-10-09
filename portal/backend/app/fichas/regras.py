"""Regras de edição por status e transições automáticas ao salvar (seção 3)."""

from app.erros import ErroNegocio
from app.fichas import status as st
from app.fichas.travas import testes_tecnicos_completos


def _lista(rotulos: list[str]) -> str:
    itens = [f"“{r}”" for r in rotulos]
    if len(itens) <= 1:
        return "".join(itens)
    return ", ".join(itens[:-1]) + " e " + itens[-1]


def verificar_edicao(status: str, secao: str) -> None:
    """Levanta 409 se a seção não pode ser editada no status atual."""
    if status == st.ATIVO_MONITORADO:
        raise ErroNegocio(409, "A ficha está ATIVO / MONITORADO e é somente leitura.")
    if secao == "pendencias":
        return
    if status not in st.EDITAVEL[secao]:
        permitidos = [st.ROTULOS[s] for s in st.TODOS_STATUS if s in st.EDITAVEL[secao]]
        raise ErroNegocio(
            409,
            f"{st.NOMES_SECAO[secao]} só pode ser editada nos status {_lista(permitidos)}. "
            f"Status atual: “{st.rotulo(status)}”.",
        )


def status_apos_salvar_etapa2(status: str) -> str:
    """O primeiro salvamento em `liberado_para_instalacao` inicia a instalação."""
    return st.EM_INSTALACAO if status == st.LIBERADO_PARA_INSTALACAO else status


def status_apos_salvar_etapa3(status: str, dados: dict) -> str:
    """Com todos os itens obrigatórios da 3.1 marcados, a ficha passa a aguardar os testes da CCON."""
    if status == st.INSTALACAO_CONCLUIDA and testes_tecnicos_completos(dados):
        return st.AGUARDANDO_TESTES_CCON
    return status
