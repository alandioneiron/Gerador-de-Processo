# Portal Neoguard — Fase 1 (contrato técnico)

Objetivo: colocar no ar, para o Comercial, a **Ficha de Implantação de Alarme Monitorado** (fiel ao docx `Ficha_Implantacao_Alarme_Monitorado_Neoguard_3.docx`) e o **Gerador de Propostas**, num portal interno.

**Fase 1 = sem login.** O acesso é por porta, só na rede interna (`http://172.16.100.35:8090`). Quem preenche se identifica com nome + e-mail (guardado no navegador), e isso vai para o histórico e para o Reply-To dos e-mails. Na Fase 2 entram o login pelo AD (LDAPS), o MFA fora da rede e o HTTPS público, e a porta 8090 é fechada.

## 1. Estrutura e responsáveis

```
portal/
  backend/     Dev Backend — FastAPI (Python 3.12), SQLAlchemy 2, Alembic, PostgreSQL 16
  frontend/    Dev Frontend — React 18 + Vite + TypeScript + Ant Design 5 + react-router
  deploy/      Dev Infra — Dockerfiles, nginx.conf, docker-compose.yml, .env.example, deploy.sh
(raiz)         Gerador de Propostas estático (index.html, js/, assets/, data/): servido em /propostas/
```

Roteamento no Nginx (porta 80 do container `web`, publicada como `8090` no servidor):

| Caminho | Destino |
|---|---|
| `/` | SPA do portal (`portal/frontend/dist`), com fallback para `index.html` |
| `/api/` | backend `api:8000` (FastAPI), repassando o caminho completo `/api/...` |
| `/propostas/` | Gerador estático (`index.html`, `js/`, `assets/` da raiz do repo) |
| `/propostas/data/` | volume do servidor `/opt/portal-neoguard/cadastro/` (cadastro real; **nunca no git**) |

## 2. Dados da ficha (JSON)

Uma ficha = um registro com metadados + `dados` (JSON). Chaves em snake_case, sem acento. Campos não preenchidos são `""`, `null` ou `[]`. Booleanos de checkbox são `true`/`false`. "Sim/Não" é `"sim"` | `"nao"` | `""`.

```jsonc
{
  "etapa1": {
    "cliente": {                       // 1.1
      "razao_social": "", "nome_fantasia": "", "cpf_cnpj": "", "responsavel_local": "", "telefone": "",
      "endereco": "", "email": "", "vendedor": "", "data_prevista": "",       // data ISO AAAA-MM-DD
      "numero_proposta": "", "numero_contrato": "", "servicos_contratados": ""
    },
    "contatos": [                      // 1.2 — ordem = sequência de acionamento da CCON (5 linhas iniciais)
      { "ordem": 1, "nome": "", "funcao": "", "tel_principal": "", "tel_alternativo": "", "decide": "", "restricoes": "" }
    ],
    "usuarios": [                      // 1.3 — 8 linhas iniciais; SEM senha
      { "nome": "", "funcao": "", "telefone": "", "teclado": "", "usa_app": "", "email_app": "",
        "permissao": "",               // "arma_desarma" | "so_arma" | ""
        "particao": "", "observacoes": "" }
    ],
    "areas_independentes": { "possui": "", "area1": "", "area2": "", "outras": "" },   // 1.4
    "ambientes": [ { "ambiente": "", "acesso_local": "", "observacao": "" } ],         // 1.5 — 6 linhas iniciais
    "rotina": {                        // 1.6
      "seg_sex": "", "sabado": "", "domingo_feriados": "", "funciona_24h": "",
      "abertura": "", "fechamento": "", "autorizados_fora_horario": "",
      "autoativacao": "", "autoativacao_obs": ""
    },
    "particularidades": {              // 1.7 — 14 checkboxes + observações
      "animais": false, "portaria_24h": false, "gerador": false, "nobreak": false, "internet": false,
      "rede_cabeada": false, "wifi": false, "cftv": false, "controle_acesso": false, "cerca_eletrica": false,
      "automacao": false, "botao_panico": false, "neoguard_imagens": false, "outros_sistemas": false,
      "observacoes": ""
    },
    "ccon": {                          // 1.8 — palavra de segurança: só se deseja, NUNCA o conteúdo
      "particularidades": "", "orientacao_disparo": "", "palavra_seguranca": ""
    }
  },
  "etapa2": {
    "equipamentos": {                  // 2.1
      "modelo_central": "",            // "AMT 2018 E" | "AMT 2018 EG" | "AMT 2118 EG" | "AMT 2018 E3G" | "outro"
      "modelo_outro": "", "numero_serie": "", "mac": "", "firmware": "",
      "teclados": "", "receptor_sem_fio": "", "expansores": "", "sensores": "", "sirenes": "", "controles": ""
    },
    "comunicacao": {                   // 2.2
      "principal": "", "principal_outra": "",      // "ethernet" | "gprs" | "3g" | "outra"
      "contingencia": "", "contingencia_outra": "", // "nao_possui" | "gprs" | "ethernet" | "outra"
      "conta_ip1": "", "conta_ip2": "", "protocolo": ""
    },
    "zonas": [                         // 2.3 — Z01..Z10 iniciais; dá para acrescentar Z11+
      { "zona": "Z01", "ambiente": "", "dispositivo": "", "tipo": "", "particao": "", "testado": false, "observacao": "" }
    ],
    "particoes": [                     // 2.4 — só aparece se etapa1.areas_independentes.possui = "sim"
      { "particao": "A", "nome_area": "", "zonas": "", "observacao": "" },
      { "particao": "B", "nome_area": "", "zonas": "", "observacao": "" },
      { "particao": "Comum", "nome_area": "", "zonas": "", "observacao": "" }
    ],
    "usuarios_config": { "confirmado": "", "excecoes": "" },   // 2.5 — confirma a lista da 1.3 (sem redigitar)
    "configuracoes": {                 // 2.6
      "temporizacoes": false, "identificacao_zonas": false, "autoativacao": false, "identificacao_usuarios": false,
      "pgm_automacao": false, "notificacoes_app": false, "panico": false, "outro": false, "outro_texto": ""
    }
  },
  "etapa3": {
    "testes_tecnicos": {               // 3.1 — 12 itens
      "central_energizada": false, "arme": false, "bateria": false, "desarme": false, "sirene": false,
      "aplicativo": false, "sensores": false, "comunicacao_principal": false, "todas_zonas": false,
      "comunicacao_contingencia": false,   // "(se aplicável)"
      "identificacao_zonas": false, "particoes": false
    },
    "testes_ccon": {                   // 3.2 — 13 itens
      "evento_arme": false, "falha_energia": false, "evento_desarme": false, "restabelecimento": false,
      "disparo": false, "comunicacao_principal": false, "zona_correta": false, "comunicacao_contingencia": false,
      "usuario_identificado": false, "lista_contatos": false, "ordem_contatos": false, "regras_operacionais": false,
      "aplicativo": false                  // "(se aplicável)"
    },
    "validacao_ccon": {                // 3.3 — preenchida pela ação "validar"
      "operador": "", "data": "", "hora": "",
      "cadastro": "", "comunicacao": "", "eventos": "", "contatos": "", "regras_operacionais": "",  // "ok" | "pendente" | ""
      "resultado": "",                 // "aprovado" | "reprovado" | ""
      "observacoes": ""
    }
  },
  "pendencias": [                      // seção 9 — 3 linhas iniciais
    { "descricao": "", "responsavel": "", "prazo": "", "resolvido": false }
  ]
}
```

O backend cria a ficha nova já com esse esqueleto (linhas iniciais incluídas): `GET /api/fichas/modelo` devolve o JSON vazio.

## 3. Status e travas

| status (API) | Rótulo na tela |
|---|---|
| `cadastro_em_preenchimento` | Cadastro em preenchimento |
| `pendencia_cadastral` | Pendência cadastral |
| `liberado_para_instalacao` | Liberado para instalação |
| `em_instalacao` | Em instalação |
| `pendencia_tecnica` | Pendência técnica |
| `instalacao_concluida` | Instalação concluída |
| `aguardando_testes_ccon` | Aguardando testes com a CCON |
| `ativo_monitorado` | ATIVO / MONITORADO |

Quem pode editar o quê (o backend recusa com 409 e mensagem em PT-BR):
- `etapa1` e `pendencias`: em `cadastro_em_preenchimento` e `pendencia_cadastral`. As `pendencias` podem ser editadas em qualquer status, exceto `ativo_monitorado`.
- `etapa2`: em `liberado_para_instalacao`, `em_instalacao` e `pendencia_tecnica`. O primeiro salvamento em `liberado_para_instalacao` muda para `em_instalacao`.
- `etapa3.testes_tecnicos` e `etapa3.testes_ccon`: em `instalacao_concluida` e `aguardando_testes_ccon`. Quando todos os itens obrigatórios da 3.1 estão marcados, muda para `aguardando_testes_ccon`.
- `ativo_monitorado` é somente leitura. `etapa3.validacao_ccon` só muda pela ação `validar-ccon`.

Ações (cada uma gera evento no histórico e e-mail):

| Ação | De | Para | Trava (lista de faltas devolvida em 422) |
|---|---|---|---|
| `liberar-instalacao` | cadastro_em_preenchimento, pendencia_cadastral | liberado_para_instalacao | razão social, endereço, telefone, vendedor e data prevista preenchidos; ≥1 contato com nome e telefone principal; ≥1 usuário com nome e permissão; usuário com usa_app = "sim" precisa de email_app |
| `concluir-instalacao` | em_instalacao, pendencia_tecnica | instalacao_concluida | modelo da central (e `modelo_outro` se "outro"), número de série, comunicação principal; ≥1 zona com ambiente e dispositivo; `usuarios_config.confirmado` = "sim"; partições preenchidas (nome da A) se áreas independentes = "sim" |
| `validar-ccon` | aguardando_testes_ccon | ativo_monitorado (se aprovado) ou pendencia_tecnica (se reprovado) | aprovar exige: todos os itens da 3.1 e da 3.2 marcados, exceto `comunicacao_contingencia` (3.1 e 3.2) quando a contingência for "nao_possui" e `aplicativo` (3.1 e 3.2) quando nenhum usuário usa app; operador, data e hora preenchidos; os 5 itens = "ok" |
| `registrar-pendencia` | qualquer, exceto ativo_monitorado | pendencia_cadastral (tipo "cadastral") ou pendencia_tecnica (tipo "tecnica") | descrição obrigatória; acrescenta uma linha em `pendencias` |
| `retomar` | pendencia_cadastral → cadastro_em_preenchimento; pendencia_tecnica → em_instalacao (ou aguardando_testes_ccon se a instalação já tinha sido concluída) | — | — |

## 4. API (JSON, prefixo `/api`)

Toda escrita leva `autor` = `{ "nome": "...", "email": "..." }` (obrigatórios na Fase 1) e `versao` (inteiro, controle otimista: versão diferente → 409 "A ficha foi alterada por outra pessoa. Recarregue.").

| Método e caminho | Corpo | Resposta |
|---|---|---|
| `GET /api/saude` | — | `{ "ok": true, "versao": "<git sha ou dev>" }` |
| `GET /api/fichas/modelo` | — | esqueleto `dados` vazio (seção 2) |
| `GET /api/fichas?status=&q=` | — | `[{ id, numero, codigo, status, cliente, vendedor, data_prevista, criado_em, atualizado_em }]`, sendo `q` a busca em cliente, vendedor, código e CPF/CNPJ |
| `POST /api/fichas` | `{ autor, dados? }` | ficha completa (201) |
| `GET /api/fichas/{id}` | — | `{ id, numero, codigo, status, versao, dados, criado_em, atualizado_em, eventos: [...] }` |
| `PUT /api/fichas/{id}/etapa1` | `{ autor, versao, etapa1 }` | ficha completa |
| `PUT /api/fichas/{id}/etapa2` | `{ autor, versao, etapa2 }` | ficha completa |
| `PUT /api/fichas/{id}/etapa3` | `{ autor, versao, testes_tecnicos, testes_ccon }` | ficha completa |
| `PUT /api/fichas/{id}/pendencias` | `{ autor, versao, pendencias }` | ficha completa |
| `POST /api/fichas/{id}/acoes/{acao}` | `{ autor, versao, ...extras }` (`validar-ccon`: `validacao_ccon`; `registrar-pendencia`: `{ tipo, descricao, responsavel?, prazo? }`) | ficha completa, ou 422 `{ "detail": "...", "faltas": ["..."] }` |
| `POST /api/fichas/{id}/acoes/enviar-email` | `{ autor, mensagem? }` (sem `versao`; qualquer status) | ficha completa + evento `enviou_email`; 502 `{detail}` se o SMTP falhar (aí não grava evento) |
| `GET /api/fichas/{id}/travas` | — | `{ "liberar-instalacao": [faltas], "concluir-instalacao": [...], "validar-ccon": [...] }` (a tela mostra o que falta antes de clicar) |

- `codigo` = `FI-<ano>-<numero com 4 dígitos>` (ex.: `FI-2026-0007`); `cliente` = razão social (ou nome fantasia).
- Evento: `{ em, autor_nome, autor_email, acao, status_de, status_para, resumo }`, com `acao` ∈ criou, salvou_etapa1, salvou_etapa2, salvou_etapa3, salvou_pendencias, e as ações da seção 3. Ordem: mais recente primeiro.
- Erros sempre `{ "detail": "<mensagem em PT-BR>" }` (+ `faltas` na trava).

## 5. E-mail

- **Botão "Enviar por e-mail"** (pedido do Alan): envio na hora da ficha completa (seções 1.1 a 1.8 sempre; Etapas 2, 3 e pendências quando preenchidas), com o layout do docx no corpo HTML.
- Automáticos, em background: `liberar-instalacao`, `concluir-instalacao`, `validar-ccon` e `registrar-pendencia`. O `criou` não envia (ficha vazia só geraria ruído).
- SMTP de produção: `mail.neoguard.com.br:465`, SSL, conta `envio@neoguard.com.br`, configurado no `.env` do servidor.
- Para: `NOTIFICAR_PARA` (padrão `ti@neoguard.com.br,suporte@neoguard.com.br,aux.ti@neoguard.com.br`). Reply-To: o e-mail do autor.
- Assunto: `[Ficha FI-2026-0007] <Ação> — <cliente>`. Corpo em texto simples + HTML curto: ação, status novo, autor, cliente, vendedor, data prevista, faltas/observações e link `PORTAL_URL/fichas/<id>`.
- SMTP pelo `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USUARIO`, `SMTP_SENHA`, `SMTP_REMETENTE`, `SMTP_TLS` = starttls|ssl|nenhum). Sem `SMTP_HOST`, não envia e registra no log ("e-mail não configurado"). Falha de envio nunca derruba a ação.
- O envio roda em background (BackgroundTasks) para não travar a tela.

## 6. Telas (fidelidade ao docx)

- **Visual da ficha = visual do docx** (referência renderizada do original):
  - marinho `#1B2A4A` nas faixas de etapa, nos cabeçalhos de tabela e nos títulos;
  - dourado `#B8963E` no número e no filete das seções;
  - linhas alternadas `#F4F5F7`, bordas `#BDBDBD`, avisos com fundo `#F3ECDD`;
  - fonte Arial;
  - logo oficial (extraído do docx) no cabeçalho.
- **Layout geral:**
  - barra do portal com o logo e a marca (dourado `#C9A24B`, laranja de atenção `#E16B01`);
  - menu: **Fichas de Implantação** e **Gerador de Propostas** (link para `/propostas/`);
  - aviso discreto no topo: "Acesso provisório sem login — use só na rede da Neoguard".
- **Lista de fichas:** tabela com código, cliente, vendedor, data prevista, status (tag colorida) e atualizado em; busca, filtro por status e botão "Nova ficha".
- **Editor da ficha** (`/fichas/:id`):
  - topo com código, cliente e a faixa de etapas do docx: VENDA FECHADA → CADASTRO → INSTALAÇÃO/CONFIGURAÇÃO → TESTES → VALIDAÇÃO CCON → ATIVO/MONITORADO, marcando a etapa atual;
  - abas: **Etapa 1 — Cadastro** | **Etapa 2 — Instalação** | **Etapa 3 — Testes e ativação** | **Pendências** | **Histórico**;
  - cada etapa é **uma tela só**, com as seções numeradas do docx (1.1 a 1.8, 2.1 a 2.6, 3.1 a 3.3) e a faixa de título escura "ETAPA X — … | Responsável: …".
- **Tabelas como tabelas:** colunas iguais às do docx, células editáveis, botão "+ Adicionar linha" e "remover" por linha, mantendo a quantidade inicial de linhas do docx.
- **Checkboxes lado a lado:** em grade de 3 colunas (1.7) ou 2 colunas (2.6, 3.1, 3.2), como no docx. Opções exclusivas (Sim/Não, modelo da central, comunicação, OK/PENDENTE) como botões de rádio na mesma linha.
- **Campos condicionais (anexo E do docx):**
  - e-mail da 1.3 só habilitado com "Usa App?" = Sim;
  - nomes das áreas da 1.4 só com Sim;
  - tabela 2.4 só se 1.4 = Sim;
  - na 2.2, as opções de GPRS/3G conforme o modelo: AMT 2018 E → só Ethernet; EG e 2118 EG → Ethernet e GPRS; E3G → Ethernet e 3G; outro → todas.
- **2.5:** mostra a lista de usuários da 1.3 (somente leitura) + "Confirmado? Sim/Não" + exceções.
- **Somente leitura conforme o status** (seção 3), com o motivo exibido.
- **Botões de ação no rodapé da etapa** ("Liberar para instalação", "Concluir instalação", "Validar CCON"):
  - mostram a lista "Falta resolver antes de …" (vinda de `/travas`) e ficam desabilitados enquanto houver faltas;
  - "Registrar pendência" fica sempre disponível (exceto em ATIVO).
- **Salvar:** botão "Salvar" por etapa + aviso de alterações não salvas ao sair. Em 409 de versão, avisa e oferece recarregar.
- **Identificação:** sem nome e e-mail salvos, um modal "Quem está preenchendo?" pede os dois (guardados no localStorage) antes de qualquer escrita. Dá para trocar pelo topo.
- **Histórico:** linha do tempo com os eventos.
- **Impressão:** botão "Imprimir / PDF", que abre `/fichas/:id/imprimir`, uma versão de impressão (A4) com o mesmo layout do docx, para o navegador salvar em PDF. Inclui o bloco de assinaturas (Comercial, Equipe Técnica, CCON), preenchido com o autor e a data das ações correspondentes.
- Responsivo: utilizável em notebook e tablet (o técnico em campo).

## 7. Fora da Fase 1
**Final do projeto, pedido do Alan:** tela "Configurações → E-mail de envio", restrita ao grupo admin do AD:
- campos: servidor, porta, SSL/TLS, usuário, remetente, destinatários e senha;
- a senha é só de escrita (nunca exibida de volta) e fica gravada criptografada no banco, com a chave no `.env`;
- botão "Enviar e-mail de teste" e registro de quem alterou;
- substitui as variáveis `SMTP_*` do `.env`, que valem até lá.

Login AD/MFA/HTTPS público (Fase 2); exportação DOCX preenchida; alertas de prazo de pendência; integração CRM/ERP; histórico central de propostas do Gerador e upload de CCT.
