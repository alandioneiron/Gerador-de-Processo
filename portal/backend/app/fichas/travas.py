"""Travas do processo (seção 3): cada função devolve a lista de faltas em PT-BR.

A rota `GET /fichas/{id}/travas` e as ações usam exatamente estas funções.
"""

from typing import Any

from app.fichas.modelo import TESTES_CCON, TESTES_TECNICOS

ROTULOS_TESTES_TECNICOS = {
    "central_energizada": "Central energizada corretamente",
    "arme": "Arme testado",
    "bateria": "Bateria instalada e testada",
    "desarme": "Desarme testado",
    "sirene": "Sirene testada",
    "aplicativo": "Aplicativo testado",
    "sensores": "Sensores testados",
    "comunicacao_principal": "Comunicação principal testada",
    "todas_zonas": "Todas as zonas testadas",
    "comunicacao_contingencia": "Comunicação de contingência testada (se aplicável)",
    "identificacao_zonas": "Identificação das zonas conferida",
    "particoes": "Partições testadas",
}

ROTULOS_TESTES_CCON = {
    "evento_arme": "Evento de arme recebido",
    "falha_energia": "Falha de energia recebida/validada",
    "evento_desarme": "Evento de desarme recebido",
    "restabelecimento": "Restabelecimento recebido/validado",
    "disparo": "Disparo recebido",
    "comunicacao_principal": "Comunicação principal validada",
    "zona_correta": "Zona correta identificada",
    "comunicacao_contingencia": "Comunicação de contingência validada",
    "usuario_identificado": "Usuário identificado corretamente",
    "lista_contatos": "Lista de contatos cadastrada",
    "ordem_contatos": "Ordem de contatos conferida",
    "regras_operacionais": "Regras operacionais cadastradas",
    "aplicativo": "Aplicativo validado (se aplicável)",
}

ITENS_VALIDACAO = {
    "cadastro": "Cadastro",
    "comunicacao": "Comunicação",
    "eventos": "Eventos",
    "contatos": "Contatos",
    "regras_operacionais": "Regras operacionais",
}

NOMES_TRAVAS = ("liberar-instalacao", "concluir-instalacao", "validar-ccon")


def _t(valor: Any) -> str:
    return valor.strip() if isinstance(valor, str) else ""


def algum_usuario_usa_app(dados: dict) -> bool:
    return any(_t(u.get("usa_app")) == "sim" for u in dados["etapa1"]["usuarios"])


def sem_contingencia(dados: dict) -> bool:
    return _t(dados["etapa2"]["comunicacao"].get("contingencia")) == "nao_possui"


# --- liberar instalação ------------------------------------------------------------------


def faltas_liberar_instalacao(dados: dict) -> list[str]:
    etapa1 = dados["etapa1"]
    cliente = etapa1["cliente"]
    faltas: list[str] = []

    obrigatorios = (
        ("razao_social", "a razão social do cliente"),
        ("endereco", "o endereço completo da instalação"),
        ("telefone", "o telefone do cliente"),
        ("vendedor", "o vendedor responsável"),
        ("data_prevista", "a data prevista da instalação"),
    )
    for campo, descricao in obrigatorios:
        if not _t(cliente.get(campo)):
            faltas.append(f"Informe {descricao} (1.1).")

    if not any(_t(c.get("nome")) and _t(c.get("tel_principal")) for c in etapa1["contatos"]):
        faltas.append("Cadastre ao menos 1 contato para ocorrência com nome e telefone principal (1.2).")

    if not any(_t(u.get("nome")) and _t(u.get("permissao")) for u in etapa1["usuarios"]):
        faltas.append("Cadastre ao menos 1 usuário do alarme com nome e permissão (1.3).")

    for posicao, usuario in enumerate(etapa1["usuarios"], start=1):
        if _t(usuario.get("usa_app")) == "sim" and not _t(usuario.get("email_app")):
            quem = _t(usuario.get("nome")) or f"da linha {posicao}"
            faltas.append(f"O usuário {quem} usa o aplicativo: informe o e-mail para o convite (1.3).")
    return faltas


# --- concluir instalação -----------------------------------------------------------------


def faltas_concluir_instalacao(dados: dict) -> list[str]:
    etapa2 = dados["etapa2"]
    equipamentos = etapa2["equipamentos"]
    faltas: list[str] = []

    modelo = _t(equipamentos.get("modelo_central"))
    if not modelo:
        faltas.append("Selecione o modelo da central (2.1).")
    elif modelo == "outro" and not _t(equipamentos.get("modelo_outro")):
        faltas.append("Informe o modelo da central no campo “Outro” (2.1).")

    if not _t(equipamentos.get("numero_serie")):
        faltas.append("Informe o número de série da central (2.1).")

    if not _t(etapa2["comunicacao"].get("principal")):
        faltas.append("Selecione a comunicação principal (2.2).")

    if not any(_t(z.get("ambiente")) and _t(z.get("dispositivo")) for z in etapa2["zonas"]):
        faltas.append("Preencha ao menos 1 zona com ambiente e dispositivo (2.3).")

    if _t(etapa2["usuarios_config"].get("confirmado")) != "sim":
        faltas.append("Confirme que os usuários da tabela 1.3 foram cadastrados na central (2.5).")

    if _t(dados["etapa1"]["areas_independentes"].get("possui")) == "sim":
        particoes = etapa2["particoes"]
        particao_a = next((p for p in particoes if _t(p.get("particao")).upper() == "A"), None)
        if particao_a is None or not _t(particao_a.get("nome_area")):
            faltas.append("Há áreas independentes: preencha o nome/área da partição A (2.4).")
    return faltas


# --- testes (3.1 / 3.2) e validação (3.3) ------------------------------------------------


def itens_tecnicos_obrigatorios(dados: dict) -> list[str]:
    """Itens da 3.1 que precisam estar marcados (contingência e aplicativo só se aplicáveis)."""
    obrigatorios = []
    for item in TESTES_TECNICOS:
        if item == "comunicacao_contingencia" and sem_contingencia(dados):
            continue
        if item == "aplicativo" and not algum_usuario_usa_app(dados):
            continue
        obrigatorios.append(item)
    return obrigatorios


def itens_ccon_obrigatorios(dados: dict) -> list[str]:
    """Itens da 3.2 que precisam estar marcados (contingência e aplicativo só se aplicáveis)."""
    obrigatorios = []
    for item in TESTES_CCON:
        if item == "comunicacao_contingencia" and sem_contingencia(dados):
            continue
        if item == "aplicativo" and not algum_usuario_usa_app(dados):
            continue
        obrigatorios.append(item)
    return obrigatorios


def testes_tecnicos_completos(dados: dict) -> bool:
    marcados = dados["etapa3"]["testes_tecnicos"]
    return all(marcados.get(i) is True for i in itens_tecnicos_obrigatorios(dados))


def faltas_testes(dados: dict) -> list[str]:
    faltas: list[str] = []
    tecnicos = dados["etapa3"]["testes_tecnicos"]
    for item in itens_tecnicos_obrigatorios(dados):
        if tecnicos.get(item) is not True:
            faltas.append(f"Teste técnico não marcado (3.1): {ROTULOS_TESTES_TECNICOS[item]}.")
    ccon = dados["etapa3"]["testes_ccon"]
    for item in itens_ccon_obrigatorios(dados):
        if ccon.get(item) is not True:
            faltas.append(f"Teste com a CCON não marcado (3.2): {ROTULOS_TESTES_CCON[item]}.")
    return faltas


def faltas_validacao_aprovar(validacao: dict) -> list[str]:
    """O que o preenchimento da 3.3 precisa ter para aprovar a ativação."""
    faltas: list[str] = []
    for campo, descricao in (("operador", "o operador da CCON"), ("data", "a data"), ("hora", "a hora")):
        if not _t(validacao.get(campo)):
            faltas.append(f"Validação da CCON (3.3): informe {descricao}.")
    for campo, rotulo in ITENS_VALIDACAO.items():
        if _t(validacao.get(campo)) != "ok":
            faltas.append(f"Validação da CCON (3.3): marque “{rotulo}” como OK.")
    return faltas


def faltas_validar_ccon(dados: dict, validacao: dict | None = None) -> list[str]:
    """Faltas para aprovar a ativação.

    Sem `validacao` (consulta da tela, antes de o operador preencher a 3.3), só verifica os testes
    das 3.1 e 3.2. Com `validacao` (a ação `validar-ccon`), verifica também o preenchimento da 3.3.
    """
    faltas = faltas_testes(dados)
    if validacao is not None:
        faltas += faltas_validacao_aprovar(validacao)
    return faltas


def todas_as_travas(dados: dict) -> dict[str, list[str]]:
    return {
        "liberar-instalacao": faltas_liberar_instalacao(dados),
        "concluir-instalacao": faltas_concluir_instalacao(dados),
        "validar-ccon": faltas_validar_ccon(dados),
    }
