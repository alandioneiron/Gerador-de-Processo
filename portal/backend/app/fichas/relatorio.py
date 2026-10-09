"""A ficha completa em texto simples e HTML, na ordem do docx (corpo do e-mail "Enviar ficha").

Monta primeiro uma estrutura neutra (etapas, seções, campos, tabelas, marcados) e só então
desenha o texto e o HTML, para os dois ficarem sempre iguais. Todo texto vindo do usuário
passa por `html.escape`; os estilos são inline e fixos.
"""

from dataclasses import dataclass, field
from datetime import date
from html import escape

from app.fichas.modelo import TESTES_CCON, TESTES_TECNICOS
from app.fichas.travas import ITENS_VALIDACAO, ROTULOS_TESTES_CCON, ROTULOS_TESTES_TECNICOS

MARINHO = "#1B2A4A"
DOURADO = "#B8963E"
BORDA = "#BDBDBD"
ZEBRA = "#F4F5F7"
AVISO = "#F3ECDD"

# --- rótulos do docx ---------------------------------------------------------------------

ROTULOS_CLIENTE = (
    ("razao_social", "RAZÃO SOCIAL / NOME"),
    ("nome_fantasia", "NOME FANTASIA"),
    ("cpf_cnpj", "CPF / CNPJ"),
    ("responsavel_local", "RESPONSÁVEL PELO LOCAL"),
    ("telefone", "TELEFONE"),
    ("endereco", "ENDEREÇO COMPLETO DA INSTALAÇÃO"),
    ("email", "E-MAIL"),
    ("vendedor", "VENDEDOR RESPONSÁVEL"),
    ("data_prevista", "DATA PREVISTA DA INSTALAÇÃO"),
    ("numero_proposta", "Nº DA PROPOSTA"),
    ("numero_contrato", "Nº DO CONTRATO"),
    ("servicos_contratados", "SERVIÇOS CONTRATADOS"),
)

ROTULOS_ROTINA = (
    ("seg_sex", "FUNCIONAMENTO — SEG. A SEX."),
    ("sabado", "SÁBADO"),
    ("domingo_feriados", "DOMINGO / FERIADOS"),
    ("funciona_24h", "FUNCIONAMENTO 24H?"),
    ("abertura", "HORÁRIO HABITUAL DE ABERTURA"),
    ("fechamento", "HORÁRIO HABITUAL DE FECHAMENTO"),
    ("autorizados_fora_horario", "PESSOAS AUTORIZADAS FORA DO HORÁRIO (QUEM)"),
)

ROTULOS_PARTICULARIDADES = (
    ("animais", "Animais"),
    ("portaria_24h", "Portaria 24h"),
    ("gerador", "Gerador"),
    ("nobreak", "Nobreak"),
    ("internet", "Internet disponível"),
    ("rede_cabeada", "Rede cabeada"),
    ("wifi", "Wi-Fi"),
    ("cftv", "CFTV"),
    ("controle_acesso", "Controle de acesso"),
    ("cerca_eletrica", "Cerca elétrica"),
    ("automacao", "Automação"),
    ("botao_panico", "Botão de pânico"),
    ("neoguard_imagens", "Neoguard Imagens"),
    ("outros_sistemas", "Outros sistemas de segurança"),
)

ROTULOS_EQUIPAMENTOS = (
    ("numero_serie", "NÚMERO DE SÉRIE"),
    ("mac", "MAC (ETIQUETA QR CODE)"),
    ("firmware", "FIRMWARE"),
    ("teclados", "TECLADO(S) — MODELO E ENDEREÇOS"),
    ("receptor_sem_fio", "RECEPTOR SEM FIO (EX.: XAR 4000 SMART)"),
    ("expansores", "EXPANSORES / MÓDULOS"),
    ("sensores", "SENSORES INSTALADOS (QTD. POR TIPO)"),
    ("sirenes", "SIRENES (QTD. / INTERNA-EXTERNA)"),
    ("controles", "CONTROLES REMOTOS (QTD.)"),
)

ROTULOS_CONFIGURACOES = (
    ("temporizacoes", "Temporizações de entrada/saída ajustadas"),
    ("identificacao_zonas", "Identificação de zonas configurada"),
    ("autoativacao", "Autoativação configurada (se solicitada)"),
    ("identificacao_usuarios", "Identificação de usuários configurada"),
    ("pgm_automacao", "PGM / automação configurada (se contratado)"),
    ("notificacoes_app", "Notificações do aplicativo configuradas"),
    ("panico", "Pânico configurado (se contratado)"),
)

COMUNICACAO_PRINCIPAL = {"ethernet": "Ethernet/IP", "gprs": "GPRS", "3g": "3G", "outra": "Outra"}
COMUNICACAO_CONTINGENCIA = {"nao_possui": "Não possui", "gprs": "GPRS", "ethernet": "Ethernet/IP", "outra": "Outra"}
PERMISSOES = {"arma_desarma": "Arma/Desarma", "so_arma": "Só arma"}
RESULTADOS = {"aprovado": "APROVADO PARA ATIVAÇÃO", "reprovado": "REPROVADO / PENDENTE"}
SIM_NAO = {"sim": "Sim", "nao": "Não"}
OK_PENDENTE = {"ok": "OK", "pendente": "PENDENTE"}

TITULO_ETAPA1 = "ETAPA 1 — CADASTRO PARA IMPLANTAÇÃO  |  Responsável: COMERCIAL + CLIENTE"
TITULO_ETAPA2 = "ETAPA 2 — INSTALAÇÃO E CONFIGURAÇÃO  |  Responsável: EQUIPE TÉCNICA"
TITULO_ETAPA3 = "ETAPA 3 — TESTES E ATIVAÇÃO  |  Responsável: EQUIPE TÉCNICA + CCON"
TITULO_PENDENCIAS = "9  PENDÊNCIAS"

NADA = "(nada preenchido)"


# --- estrutura neutra --------------------------------------------------------------------


@dataclass
class Campos:
    itens: list[tuple[str, str]]  # (rótulo, valor); só os preenchidos

    @property
    def vazio(self) -> bool:
        return not self.itens


@dataclass
class Tabela:
    colunas: list[str]
    linhas: list[list[str]]  # só as linhas preenchidas

    @property
    def vazio(self) -> bool:
        return not self.linhas


@dataclass
class Marcados:
    itens: list[str]  # só os itens marcados
    total: int | None = None  # quantos itens existem (para "N de M")
    legenda: str = ""

    @property
    def vazio(self) -> bool:
        return not self.itens


Bloco = Campos | Tabela | Marcados


@dataclass
class Secao:
    numero: str
    titulo: str
    blocos: list[Bloco] = field(default_factory=list)

    @property
    def vazia(self) -> bool:
        return all(b.vazio for b in self.blocos)


@dataclass
class Etapa:
    titulo: str
    secoes: list[Secao]
    sempre_completa: bool = False  # Etapa 1 mostra todas as seções, mesmo vazias

    @property
    def vazia(self) -> bool:
        return all(s.vazia for s in self.secoes)

    def secoes_visiveis(self) -> list[Secao]:
        return self.secoes if self.sempre_completa else [s for s in self.secoes if not s.vazia]


# --- montagem a partir dos dados da ficha ------------------------------------------------


def _t(valor: object) -> str:
    return valor.strip() if isinstance(valor, str) else ""


def _data_br(valor: str) -> str:
    try:
        return date.fromisoformat(valor).strftime("%d/%m/%Y")
    except ValueError:
        return valor


def _campos(pares: list[tuple[str, str]]) -> Campos:
    return Campos([(rotulo, valor) for rotulo, valor in pares if valor])


def _preenchida(linha: dict, ignorar: tuple[str, ...] = ()) -> bool:
    return any(valor is True or _t(valor) for chave, valor in linha.items() if chave not in ignorar)


def _marcados(marcas: dict, rotulos: dict | tuple, ordem: tuple[str, ...] | None = None) -> list[str]:
    mapa = dict(rotulos)
    chaves = ordem if ordem is not None else tuple(mapa)
    return [mapa[c] for c in chaves if marcas.get(c) is True]


def _etapa1(dados: dict) -> Etapa:
    e1 = dados["etapa1"]
    cliente = e1["cliente"]
    pares = []
    for chave, rotulo in ROTULOS_CLIENTE:
        valor = _t(cliente.get(chave))
        pares.append((rotulo, _data_br(valor) if chave == "data_prevista" else valor))
    s11 = Secao("1.1", "Identificação do Cliente", [_campos(pares)])

    contatos = [
        [str(c["ordem"]), _t(c["nome"]), _t(c["funcao"]), _t(c["tel_principal"]), _t(c["tel_alternativo"]),
         SIM_NAO.get(_t(c["decide"]), ""), _t(c["restricoes"])]
        for c in e1["contatos"]
        if _preenchida(c, ("ordem",))
    ]  # fmt: skip
    s12 = Secao(
        "1.2",
        "Contatos para Ocorrência",
        [Tabela(["Ord.", "Nome", "Função / Relação", "Tel. Principal", "Tel. Alternativo", "Decide?", "Restrições / Observações"], contatos)],
    )  # fmt: skip

    usuarios = [
        [_t(u["nome"]), _t(u["funcao"]), _t(u["telefone"]), _t(u["teclado"]), SIM_NAO.get(_t(u["usa_app"]), ""),
         _t(u["email_app"]), PERMISSOES.get(_t(u["permissao"]), ""), _t(u["particao"]), _t(u["observacoes"])]
        for u in e1["usuarios"]
        if _preenchida(u)
    ]  # fmt: skip
    s13 = Secao(
        "1.3",
        "Usuários do Alarme",
        [Tabela(["Nome", "Função", "Telefone", "Teclado", "Usa App?", "E-mail (se usa app)", "Permissão", "Área / Partição", "Observações"], usuarios)],
    )  # fmt: skip

    areas = e1["areas_independentes"]
    possui = SIM_NAO.get(_t(areas["possui"]), "")
    pares_areas = [("Existem áreas que precisam ser armadas/desarmadas separadamente?", possui)]
    if _t(areas["possui"]) == "sim":
        pares_areas += [("Área 1", _t(areas["area1"])), ("Área 2", _t(areas["area2"])), ("Outras", _t(areas["outras"]))]
    s14 = Secao("1.4", "Áreas Independentes", [_campos(pares_areas)])

    ambientes = [
        [_t(a["ambiente"]), _t(a["acesso_local"]), _t(a["observacao"])] for a in e1["ambientes"] if _preenchida(a)
    ]
    s15 = Secao("1.5", "Ambientes Protegidos", [Tabela(["Ambiente", "Acesso / Local", "Observação"], ambientes)])

    rotina = e1["rotina"]
    pares_rotina = []
    for chave, rotulo in ROTULOS_ROTINA:
        valor = _t(rotina.get(chave))
        pares_rotina.append((rotulo, SIM_NAO.get(valor, valor) if chave == "funciona_24h" else valor))
    pares_rotina.append(("Interesse em ativação automática (autoativação)", SIM_NAO.get(_t(rotina["autoativacao"]), "")))
    pares_rotina.append(("Observações", _t(rotina["autoativacao_obs"])))
    s16 = Secao("1.6", "Rotina do Estabelecimento", [_campos(pares_rotina)])

    part = e1["particularidades"]
    s17 = Secao(
        "1.7",
        "Particularidades do Local",
        [
            Marcados(_marcados(part, ROTULOS_PARTICULARIDADES)),
            _campos([("Observações importantes", _t(part["observacoes"]))]),
        ],
    )

    ccon = e1["ccon"]
    s18 = Secao(
        "1.8",
        "Informações Operacionais para a CCON",
        [
            _campos(
                [
                    ("Particularidades do estabelecimento relevantes para o atendimento", _t(ccon["particularidades"])),
                    ("Orientação especial em caso de disparo / situações recorrentes conhecidas", _t(ccon["orientacao_disparo"])),
                    ("Cliente deseja cadastrar palavra de segurança? (cadastro feito direto com a CCON)", SIM_NAO.get(_t(ccon["palavra_seguranca"]), "")),
                ]
            )  # fmt: skip
        ],
    )
    return Etapa(TITULO_ETAPA1, [s11, s12, s13, s14, s15, s16, s17, s18], sempre_completa=True)


def _com_outra(valor: str, nomes: dict[str, str], outra: str) -> str:
    texto = nomes.get(valor, valor)
    if valor == "outra" and outra:
        texto = f"Outra: {outra}"
    return texto


def _etapa2(dados: dict) -> Etapa:
    e2 = dados["etapa2"]
    eq = e2["equipamentos"]
    modelo = _t(eq["modelo_central"])
    if modelo == "outro":
        modelo = f"Outro: {_t(eq['modelo_outro'])}" if _t(eq["modelo_outro"]) else "Outro"
    pares = [("Modelo da central", modelo)] + [(rotulo, _t(eq.get(chave))) for chave, rotulo in ROTULOS_EQUIPAMENTOS]
    s21 = Secao("2.1", "Identificação dos Equipamentos", [_campos(pares)])

    com = e2["comunicacao"]
    s22 = Secao(
        "2.2",
        "Comunicação",
        [
            _campos(
                [
                    ("Comunicação principal", _com_outra(_t(com["principal"]), COMUNICACAO_PRINCIPAL, _t(com["principal_outra"]))),
                    ("Comunicação de contingência", _com_outra(_t(com["contingencia"]), COMUNICACAO_CONTINGENCIA, _t(com["contingencia_outra"]))),
                    ("CONTA DE MONITORAMENTO — RECEPTORA IP1", _t(com["conta_ip1"])),
                    ("CONTA DE MONITORAMENTO — RECEPTORA IP2 (CONTINGÊNCIA)", _t(com["conta_ip2"])),
                    ("PROTOCOLO DE REPORTAGEM", _t(com["protocolo"])),
                ]
            )  # fmt: skip
        ],
    )

    zonas = [
        [_t(z["zona"]), _t(z["ambiente"]), _t(z["dispositivo"]), _t(z["tipo"]), _t(z["particao"]),
         "Sim" if z["testado"] is True else "", _t(z["observacao"])]
        for z in e2["zonas"]
        if _preenchida(z, ("zona",))
    ]  # fmt: skip
    s23 = Secao(
        "2.3",
        "Mapa de Zonas",
        [Tabela(["Zona", "Ambiente", "Dispositivo", "Tipo / Comportamento", "Área / Partição", "Testado", "Observação"], zonas)],
    )  # fmt: skip

    particoes = [
        [_t(p["particao"]), _t(p["nome_area"]), _t(p["zonas"]), _t(p["observacao"])]
        for p in e2["particoes"]
        if _preenchida(p, ("particao",))
    ]
    s24 = Secao("2.4", "Partições", [Tabela(["Partição", "Nome / Área", "Zonas relacionadas", "Observação"], particoes)])

    uc = e2["usuarios_config"]
    s25 = Secao(
        "2.5",
        "Usuários — Configuração Concluída",
        [
            _campos(
                [
                    ("Usuários da Tabela 1.3 cadastrados na central e, quando “Usa App?” = Sim, convidados no aplicativo?", SIM_NAO.get(_t(uc["confirmado"]), "")),
                    ("Exceções / pendências de cadastro", _t(uc["excecoes"])),
                ]
            )  # fmt: skip
        ],
    )

    conf = e2["configuracoes"]
    marcadas = _marcados(conf, ROTULOS_CONFIGURACOES)
    if conf.get("outro") is True:
        marcadas.append(f"Outro: {_t(conf['outro_texto'])}" if _t(conf["outro_texto"]) else "Outro")
    s26 = Secao("2.6", "Configurações Adicionais", [Marcados(marcadas)])
    return Etapa(TITULO_ETAPA2, [s21, s22, s23, s24, s25, s26])


def _etapa3(dados: dict) -> Etapa:
    e3 = dados["etapa3"]
    s31 = Secao(
        "3.1",
        "Testes Técnicos",
        [Marcados(_marcados(e3["testes_tecnicos"], ROTULOS_TESTES_TECNICOS, TESTES_TECNICOS), len(TESTES_TECNICOS), "marcados")],
    )  # fmt: skip
    s32 = Secao(
        "3.2",
        "Testes com a CCON",
        [Marcados(_marcados(e3["testes_ccon"], ROTULOS_TESTES_CCON, TESTES_CCON), len(TESTES_CCON), "marcados")],
    )  # fmt: skip

    v = e3["validacao_ccon"]
    pares = [("OPERADOR CCON", _t(v["operador"])), ("DATA", _data_br(_t(v["data"]))), ("HORA", _t(v["hora"]))]
    pares += [(rotulo, OK_PENDENTE.get(_t(v[chave]), "")) for chave, rotulo in ITENS_VALIDACAO.items()]
    pares += [("Resultado", RESULTADOS.get(_t(v["resultado"]), "")), ("Observações", _t(v["observacoes"]))]
    s33 = Secao("3.3", "Validação da CCON", [_campos(pares)])
    return Etapa(TITULO_ETAPA3, [s31, s32, s33])


def _pendencias(dados: dict) -> Etapa:
    linhas = [
        [_t(p["descricao"]), _t(p["responsavel"]), _data_br(_t(p["prazo"])), "Sim" if p["resolvido"] is True else "Não"]
        for p in dados["pendencias"]
        if _preenchida(p, ("resolvido",))
    ]
    tabela = Tabela(["Pendência", "Responsável", "Data / Prazo", "Resolvido"], linhas)
    return Etapa(TITULO_PENDENCIAS, [Secao("", "", [tabela])])  # a faixa já é o título "9  Pendências"


def montar_etapas(dados: dict) -> list[Etapa]:
    """Etapa 1 sempre; Etapa 2, Etapa 3 e pendências só se tiverem algo preenchido."""
    etapas = [_etapa1(dados)]
    for etapa in (_etapa2(dados), _etapa3(dados), _pendencias(dados)):
        if not etapa.vazia:
            etapas.append(etapa)
    return etapas


# --- texto simples -----------------------------------------------------------------------


def _texto_multilinha(valor: str, recuo: str) -> str:
    return ("\n" + recuo).join(valor.splitlines()) if "\n" in valor else valor


def _bloco_texto(bloco: Bloco) -> list[str]:
    if bloco.vazio:
        return []
    if isinstance(bloco, Campos):
        return [f"  {rotulo}: {_texto_multilinha(valor, '    ')}" for rotulo, valor in bloco.itens]
    if isinstance(bloco, Tabela):
        linhas = []
        for linha in bloco.linhas:
            partes = [f"{coluna}: {valor}" for coluna, valor in zip(bloco.colunas, linha, strict=True) if valor]
            linhas.append("  - " + "; ".join(p.replace("\n", " ") for p in partes))
        return linhas
    cabecalho = []
    if bloco.total is not None:
        cabecalho = [f"  ({len(bloco.itens)} de {bloco.total} {bloco.legenda})"]
    return cabecalho + [f"  [x] {item}" for item in bloco.itens]


def renderizar_texto(
    *, titulo: str, cabecalho: list[tuple[str, str]], mensagem: str, etapas: list[Etapa], links: list[tuple[str, str]]
) -> str:
    linhas = [titulo, "=" * len(titulo)]
    linhas += [f"{rotulo}: {valor}" for rotulo, valor in cabecalho]
    if mensagem:
        linhas += ["", "Mensagem:", _texto_multilinha(mensagem, "")]
    for etapa in etapas:
        linhas += ["", etapa.titulo, "-" * min(len(etapa.titulo), 78)]
        for secao in etapa.secoes_visiveis():
            if secao.numero or secao.titulo:
                linhas += ["", f"{secao.numero}  {secao.titulo}"]
            corpo = [linha for bloco in secao.blocos for linha in _bloco_texto(bloco)]
            linhas += corpo or [f"  {NADA}"]
    linhas += [""] + [f"{rotulo}: {url}" for rotulo, url in links]
    return "\n".join(linhas) + "\n"


# --- HTML --------------------------------------------------------------------------------

_FONTE = "font-family:Arial,Helvetica,sans-serif"


def _h(valor: str) -> str:
    """Escapa e preserva as quebras de linha digitadas."""
    return escape(valor).replace("\r\n", "\n").replace("\n", "<br>")


def _html_campos(campos: Campos) -> str:
    linhas = []
    for i, (rotulo, valor) in enumerate(campos.itens):
        fundo = ZEBRA if i % 2 == 0 else "#FFFFFF"
        linhas.append(
            f'<tr><td style="width:38%;padding:6px 8px;border:1px solid {BORDA};background:{fundo};'
            f'color:{MARINHO};font-size:11px;font-weight:bold;vertical-align:top">{_h(rotulo)}</td>'
            f'<td style="padding:6px 8px;border:1px solid {BORDA};background:{fundo};font-size:13px;vertical-align:top">{_h(valor)}</td></tr>'
        )
    return _tabela_html("".join(linhas))


def _html_tabela(tabela: Tabela) -> str:
    cabecalho = "".join(
        f'<th style="padding:6px 8px;border:1px solid {BORDA};background:{MARINHO};color:#FFFFFF;'
        f'font-size:11px;text-align:left;vertical-align:top">{_h(coluna)}</th>'
        for coluna in tabela.colunas
    )
    linhas = [f"<tr>{cabecalho}</tr>"]
    for i, linha in enumerate(tabela.linhas):
        fundo = ZEBRA if i % 2 == 1 else "#FFFFFF"
        celulas = "".join(
            f'<td style="padding:6px 8px;border:1px solid {BORDA};background:{fundo};font-size:12px;vertical-align:top">{_h(valor)}</td>'
            for valor in linha
        )
        linhas.append(f"<tr>{celulas}</tr>")
    return _tabela_html("".join(linhas))


def _tabela_html(conteudo: str) -> str:
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;{_FONTE};margin:0 0 6px">'
        f"{conteudo}</table>"
    )


def _html_marcados(marcados: Marcados) -> str:
    resumo = ""
    if marcados.total is not None:
        resumo = (
            f'<p style="margin:0 0 4px;color:#555555;font-size:12px">{len(marcados.itens)} de {marcados.total} {_h(marcados.legenda)}</p>'
        )
    itens = "".join(f'<li style="margin:2px 0;font-size:13px">&#9745; {_h(item)}</li>' for item in marcados.itens)
    return f'{resumo}<ul style="margin:0 0 6px;padding-left:0;list-style:none">{itens}</ul>'


def _html_bloco(bloco: Bloco) -> str:
    if bloco.vazio:
        return ""
    if isinstance(bloco, Campos):
        return _html_campos(bloco)
    if isinstance(bloco, Tabela):
        return _html_tabela(bloco)
    return _html_marcados(bloco)


def _html_secao(secao: Secao) -> str:
    corpo = "".join(_html_bloco(b) for b in secao.blocos)
    if not corpo:
        corpo = f'<p style="margin:0;color:#777777;font-size:12px;font-style:italic">{NADA}</p>'
    titulo = ""
    if secao.numero or secao.titulo:
        titulo = (
            f'<div style="margin:14px 0 4px;padding-bottom:3px;border-bottom:2px solid {DOURADO};{_FONTE}">'
            f'<span style="color:{DOURADO};font-weight:bold;font-size:13px">{_h(secao.numero)}</span>'
            f'&nbsp;&nbsp;<span style="color:{MARINHO};font-weight:bold;font-size:14px">{_h(secao.titulo)}</span></div>'
        )
    return titulo + corpo


def _html_etapa(etapa: Etapa) -> str:
    faixa = (
        f'<div style="margin:22px 0 8px;padding:8px 12px;background:{MARINHO};color:#FFFFFF;{_FONTE};'
        f'font-size:13px;font-weight:bold">{_h(etapa.titulo)}</div>'
    )
    return faixa + "".join(_html_secao(s) for s in etapa.secoes_visiveis())


def renderizar_html(
    *,
    titulo: str,
    cabecalho: list[tuple[str, str]],
    mensagem: str,
    etapas: list[Etapa],
    links: list[tuple[str, str]],
) -> str:
    topo = (
        f'<div style="padding:12px 16px;background:{MARINHO};color:#FFFFFF;{_FONTE}">'
        f'<div style="font-size:11px;letter-spacing:1px;color:#C9A24B">GRUPO NEOGUARD</div>'
        f'<div style="font-size:18px;font-weight:bold;margin-top:2px">{_h(titulo)}</div></div>'
    )
    quadro = _html_campos(Campos([(rotulo, valor) for rotulo, valor in cabecalho if valor]))
    caixa = ""
    if mensagem:
        caixa = (
            f'<div style="margin:10px 0;padding:10px 12px;background:{AVISO};border-left:4px solid {DOURADO};{_FONTE};font-size:13px">'
            f'<b style="color:{MARINHO}">Mensagem</b><br>{_h(mensagem)}</div>'
        )
    rodape = "".join(
        f'<p style="margin:4px 0;{_FONTE};font-size:13px">{_h(rotulo)}: '
        f'<a href="{escape(url, quote=True)}" style="color:{MARINHO}">{_h(url)}</a></p>'
        for rotulo, url in links
    )
    return (
        f'<html><body style="margin:0;padding:12px;background:#FFFFFF;color:#161616;{_FONTE}">'
        f'<div style="max-width:780px;margin:0 auto">{topo}<div style="margin-top:10px">{quadro}</div>{caixa}'
        f'{"".join(_html_etapa(e) for e in etapas)}'
        f'<div style="margin-top:22px;padding-top:10px;border-top:1px solid {BORDA}">{rodape}</div></div></body></html>'
    )


def montar_corpo_ficha(
    *,
    codigo: str,
    cliente: str,
    status_rotulo: str,
    autor_nome: str,
    autor_email: str,
    mensagem: str,
    dados: dict,
    link: str,
    link_impressao: str,
) -> tuple[str, str]:
    """Devolve (texto simples, HTML) da ficha completa."""
    titulo = f"Ficha de Implantação {codigo}"
    cabecalho = [
        ("Código", codigo),
        ("Cliente", cliente or "(cliente não informado)"),
        ("Status", status_rotulo),
        ("Enviada por", f"{autor_nome} <{autor_email}>"),
    ]
    etapas = montar_etapas(dados)
    links = [("Abrir a ficha no portal", link), ("Versão para impressão / PDF", link_impressao)]
    comum = {"titulo": titulo, "cabecalho": cabecalho, "mensagem": mensagem, "etapas": etapas, "links": links}
    return renderizar_texto(**comum), renderizar_html(**comum)
