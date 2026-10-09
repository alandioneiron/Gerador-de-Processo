"""Status da ficha, rótulos e quem pode editar o quê (seção 3 do contrato)."""

CADASTRO_EM_PREENCHIMENTO = "cadastro_em_preenchimento"
PENDENCIA_CADASTRAL = "pendencia_cadastral"
LIBERADO_PARA_INSTALACAO = "liberado_para_instalacao"
EM_INSTALACAO = "em_instalacao"
PENDENCIA_TECNICA = "pendencia_tecnica"
INSTALACAO_CONCLUIDA = "instalacao_concluida"
AGUARDANDO_TESTES_CCON = "aguardando_testes_ccon"
ATIVO_MONITORADO = "ativo_monitorado"

ROTULOS: dict[str, str] = {
    CADASTRO_EM_PREENCHIMENTO: "Cadastro em preenchimento",
    PENDENCIA_CADASTRAL: "Pendência cadastral",
    LIBERADO_PARA_INSTALACAO: "Liberado para instalação",
    EM_INSTALACAO: "Em instalação",
    PENDENCIA_TECNICA: "Pendência técnica",
    INSTALACAO_CONCLUIDA: "Instalação concluída",
    AGUARDANDO_TESTES_CCON: "Aguardando testes com a CCON",
    ATIVO_MONITORADO: "ATIVO / MONITORADO",
}

TODOS_STATUS = tuple(ROTULOS)

# Seções editáveis por status. `pendencias` é tratada à parte (qualquer status, exceto ATIVO).
EDITAVEL: dict[str, frozenset[str]] = {
    "etapa1": frozenset({CADASTRO_EM_PREENCHIMENTO, PENDENCIA_CADASTRAL}),
    "etapa2": frozenset({LIBERADO_PARA_INSTALACAO, EM_INSTALACAO, PENDENCIA_TECNICA}),
    "etapa3": frozenset({INSTALACAO_CONCLUIDA, AGUARDANDO_TESTES_CCON}),
}

NOMES_SECAO: dict[str, str] = {
    "etapa1": "A Etapa 1 (Cadastro)",
    "etapa2": "A Etapa 2 (Instalação)",
    "etapa3": "Os testes da Etapa 3",
    "pendencias": "As pendências",
}


def rotulo(status: str | None) -> str:
    return ROTULOS.get(status or "", status or "")
