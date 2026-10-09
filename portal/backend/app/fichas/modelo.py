"""Esqueleto da ficha (seção 2 do contrato), mesclagem profunda e validação de tipos."""

import copy
from collections.abc import Callable
from datetime import date
from typing import Any

from app.erros import ErroNegocio

MAX_TEXTO = 5000
MAX_LINHAS = 300

_AUSENTE = object()

SIM_NAO = frozenset({"", "sim", "nao"})
OK_PENDENTE = frozenset({"", "ok", "pendente"})

MODELOS_CENTRAL = ("AMT 2018 E", "AMT 2018 EG", "AMT 2118 EG", "AMT 2018 E3G", "outro")

# Campos de opção exclusiva, por caminho (listas aparecem como `[]`).
ENUMS: dict[str, frozenset[str]] = {
    "etapa1.contatos[].decide": SIM_NAO,
    "etapa1.usuarios[].usa_app": SIM_NAO,
    "etapa1.usuarios[].permissao": frozenset({"", "arma_desarma", "so_arma"}),
    "etapa1.areas_independentes.possui": SIM_NAO,
    "etapa1.rotina.funciona_24h": SIM_NAO,
    "etapa1.rotina.autoativacao": SIM_NAO,
    "etapa1.ccon.palavra_seguranca": SIM_NAO,
    "etapa2.equipamentos.modelo_central": frozenset({"", *MODELOS_CENTRAL}),
    "etapa2.comunicacao.principal": frozenset({"", "ethernet", "gprs", "3g", "outra"}),
    "etapa2.comunicacao.contingencia": frozenset({"", "nao_possui", "gprs", "ethernet", "outra"}),
    "etapa2.usuarios_config.confirmado": SIM_NAO,
    "etapa3.validacao_ccon.cadastro": OK_PENDENTE,
    "etapa3.validacao_ccon.comunicacao": OK_PENDENTE,
    "etapa3.validacao_ccon.eventos": OK_PENDENTE,
    "etapa3.validacao_ccon.contatos": OK_PENDENTE,
    "etapa3.validacao_ccon.regras_operacionais": OK_PENDENTE,
    "etapa3.validacao_ccon.resultado": frozenset({"", "aprovado", "reprovado"}),
}


# --- linhas das tabelas ------------------------------------------------------------------


def contato_vazio(ordem: int = 1) -> dict:
    return {"ordem": ordem, "nome": "", "funcao": "", "tel_principal": "", "tel_alternativo": "", "decide": "", "restricoes": ""}


def usuario_vazio() -> dict:
    return {
        "nome": "", "funcao": "", "telefone": "", "teclado": "", "usa_app": "", "email_app": "",
        "permissao": "", "particao": "", "observacoes": "",
    }  # fmt: skip


def ambiente_vazio() -> dict:
    return {"ambiente": "", "acesso_local": "", "observacao": ""}


def zona_vazia(zona: str = "") -> dict:
    return {"zona": zona, "ambiente": "", "dispositivo": "", "tipo": "", "particao": "", "testado": False, "observacao": ""}


def particao_vazia(particao: str = "") -> dict:
    return {"particao": particao, "nome_area": "", "zonas": "", "observacao": ""}


def pendencia_vazia() -> dict:
    return {"descricao": "", "responsavel": "", "prazo": "", "resolvido": False}


# Linha padrão de cada tabela (para completar as chaves que faltarem em cada linha).
LINHAS: dict[str, Callable[[], dict]] = {
    "etapa1.contatos": contato_vazio,
    "etapa1.usuarios": usuario_vazio,
    "etapa1.ambientes": ambiente_vazio,
    "etapa2.zonas": zona_vazia,
    "etapa2.particoes": particao_vazia,
    "pendencias": pendencia_vazia,
}

TESTES_TECNICOS = (
    "central_energizada", "arme", "bateria", "desarme", "sirene", "aplicativo", "sensores",
    "comunicacao_principal", "todas_zonas", "comunicacao_contingencia", "identificacao_zonas", "particoes",
)  # fmt: skip

TESTES_CCON = (
    "evento_arme", "falha_energia", "evento_desarme", "restabelecimento", "disparo", "comunicacao_principal",
    "zona_correta", "comunicacao_contingencia", "usuario_identificado", "lista_contatos", "ordem_contatos",
    "regras_operacionais", "aplicativo",
)  # fmt: skip


def modelo_vazio() -> dict:
    """A ficha nova: todas as chaves, com as linhas iniciais do docx."""
    return {
        "etapa1": {
            "cliente": {
                "razao_social": "", "nome_fantasia": "", "cpf_cnpj": "", "responsavel_local": "", "telefone": "",
                "endereco": "", "email": "", "vendedor": "", "data_prevista": "", "numero_proposta": "",
                "numero_contrato": "", "servicos_contratados": "",
            },  # fmt: skip
            "contatos": [contato_vazio(i) for i in range(1, 6)],
            "usuarios": [usuario_vazio() for _ in range(8)],
            "areas_independentes": {"possui": "", "area1": "", "area2": "", "outras": ""},
            "ambientes": [ambiente_vazio() for _ in range(6)],
            "rotina": {
                "seg_sex": "", "sabado": "", "domingo_feriados": "", "funciona_24h": "", "abertura": "",
                "fechamento": "", "autorizados_fora_horario": "", "autoativacao": "", "autoativacao_obs": "",
            },  # fmt: skip
            "particularidades": {
                "animais": False, "portaria_24h": False, "gerador": False, "nobreak": False, "internet": False,
                "rede_cabeada": False, "wifi": False, "cftv": False, "controle_acesso": False,
                "cerca_eletrica": False, "automacao": False, "botao_panico": False, "neoguard_imagens": False,
                "outros_sistemas": False, "observacoes": "",
            },  # fmt: skip
            "ccon": {"particularidades": "", "orientacao_disparo": "", "palavra_seguranca": ""},
        },
        "etapa2": {
            "equipamentos": {
                "modelo_central": "", "modelo_outro": "", "numero_serie": "", "mac": "", "firmware": "",
                "teclados": "", "receptor_sem_fio": "", "expansores": "", "sensores": "", "sirenes": "",
                "controles": "",
            },  # fmt: skip
            "comunicacao": {
                "principal": "", "principal_outra": "", "contingencia": "", "contingencia_outra": "",
                "conta_ip1": "", "conta_ip2": "", "protocolo": "",
            },  # fmt: skip
            "zonas": [zona_vazia(f"Z{i:02d}") for i in range(1, 11)],
            "particoes": [particao_vazia("A"), particao_vazia("B"), particao_vazia("Comum")],
            "usuarios_config": {"confirmado": "", "excecoes": ""},
            "configuracoes": {
                "temporizacoes": False, "identificacao_zonas": False, "autoativacao": False,
                "identificacao_usuarios": False, "pgm_automacao": False, "notificacoes_app": False,
                "panico": False, "outro": False, "outro_texto": "",
            },  # fmt: skip
        },
        "etapa3": {
            "testes_tecnicos": dict.fromkeys(TESTES_TECNICOS, False),
            "testes_ccon": dict.fromkeys(TESTES_CCON, False),
            "validacao_ccon": validacao_ccon_vazia(),
        },
        "pendencias": [pendencia_vazia() for _ in range(3)],
    }


def validacao_ccon_vazia() -> dict:
    return {
        "operador": "", "data": "", "hora": "", "cadastro": "", "comunicacao": "", "eventos": "",
        "contatos": "", "regras_operacionais": "", "resultado": "", "observacoes": "",
    }  # fmt: skip


# --- mesclagem profunda ------------------------------------------------------------------


def _erro(rotulo: str, motivo: str) -> ErroNegocio:
    return ErroNegocio(422, f"Dados inválidos em “{rotulo}”: {motivo}.")


def _folha(padrao: Any, valor: Any, caminho: str, rotulo: str) -> Any:
    if valor is _AUSENTE or valor is None:
        return copy.deepcopy(padrao)
    if isinstance(padrao, bool):
        if not isinstance(valor, bool):
            raise _erro(rotulo, "deve ser verdadeiro ou falso")
        return valor
    if isinstance(padrao, int):
        if isinstance(valor, bool):
            raise _erro(rotulo, "deve ser um número inteiro")
        if isinstance(valor, int):
            return valor
        if isinstance(valor, str) and valor.strip().lstrip("-").isdigit():
            return int(valor)
        raise _erro(rotulo, "deve ser um número inteiro")
    # texto
    if isinstance(valor, bool) or not isinstance(valor, str | int | float):
        raise _erro(rotulo, "deve ser um texto")
    texto = str(valor).strip()
    if len(texto) > MAX_TEXTO:
        raise _erro(rotulo, f"texto longo demais (máximo de {MAX_TEXTO} caracteres)")
    permitidos = ENUMS.get(caminho)
    if permitidos is not None and texto not in permitidos:
        opcoes = ", ".join(f"“{p}”" for p in sorted(permitidos) if p)
        raise _erro(rotulo, f"use um destes valores: {opcoes} (ou vazio)")
    return texto


def mesclar(padrao: Any, atual: Any, novo: Any, caminho: str = "", rotulo: str = "") -> Any:
    """Mescla `novo` sobre `atual` seguindo a forma de `padrao`.

    - Chaves ausentes em `novo` mantêm o valor de `atual` (e, faltando também, o padrão).
    - Chaves desconhecidas são descartadas; o resultado tem sempre todas as chaves do esqueleto.
    - Tabelas (listas) são substituídas inteiras; cada linha é completada com a linha padrão.
    - `null` volta ao padrão do campo.
    """
    if isinstance(padrao, dict):
        if novo is _AUSENTE or novo is None:
            novo = {}
        if not isinstance(novo, dict):
            raise _erro(rotulo or "requisição", "deve ser um objeto")
        atual = atual if isinstance(atual, dict) else {}
        resultado: dict = {}
        for chave, sub in padrao.items():
            sub_caminho = f"{caminho}.{chave}" if caminho else chave
            sub_rotulo = f"{rotulo}.{chave}" if rotulo else chave
            resultado[chave] = mesclar(sub, atual.get(chave, _AUSENTE), novo.get(chave, _AUSENTE), sub_caminho, sub_rotulo)
        return resultado

    if isinstance(padrao, list):
        fonte = novo
        if fonte is _AUSENTE or fonte is None:
            fonte = atual if isinstance(atual, list) else padrao
        if not isinstance(fonte, list):
            raise _erro(rotulo, "deve ser uma lista")
        if len(fonte) > MAX_LINHAS:
            raise _erro(rotulo, f"linhas demais (máximo de {MAX_LINHAS})")
        linha_padrao = LINHAS[caminho]()
        linhas = []
        for i, item in enumerate(fonte):
            if not isinstance(item, dict):
                raise _erro(f"{rotulo}[{i}]", "cada linha deve ser um objeto")
            linhas.append(mesclar(linha_padrao, {}, item, f"{caminho}[]", f"{rotulo}[{i}]"))
        return linhas

    valor = novo if novo is not _AUSENTE else (atual if atual is not _AUSENTE else padrao)
    return _folha(padrao, valor, caminho, rotulo)


def normalizar(dados: dict | None) -> dict:
    """Completa uma ficha guardada com as chaves do esqueleto (sem alterar o que já existe)."""
    return mesclar(modelo_vazio(), dados or {}, {})


def aplicar_secao(dados: dict, caminho: tuple[str, ...], novo: Any) -> dict:
    """Devolve uma cópia de `dados` com `novo` mesclado na seção `caminho` (ex.: ("etapa3", "testes_ccon"))."""
    resultado = copy.deepcopy(dados)
    padrao_no: Any = modelo_vazio()
    destino = resultado
    for chave in caminho[:-1]:
        padrao_no = padrao_no[chave]
        destino = destino[chave]
    ultimo = caminho[-1]
    destino[ultimo] = mesclar(padrao_no[ultimo], destino.get(ultimo), novo, ".".join(caminho), ".".join(caminho))
    return resultado


# --- regras de conteúdo da etapa 1 -------------------------------------------------------


def conferir_etapa1(dados: dict) -> None:
    """Regras de formato que valem ao salvar a etapa 1."""
    data = dados["etapa1"]["cliente"]["data_prevista"]
    if data:
        try:
            date.fromisoformat(data)
        except ValueError:
            raise ErroNegocio(
                422, "A data prevista da instalação deve estar no formato AAAA-MM-DD (ex.: 2026-03-15)."
            ) from None
    # A ordem dos contatos é a sequência de acionamento da CCON: acompanha a posição na tabela.
    for posicao, contato in enumerate(dados["etapa1"]["contatos"], start=1):
        contato["ordem"] = posicao
