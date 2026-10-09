# Portal Neoguard — backend (Fase 1)

API da Ficha de Implantação de Alarme Monitorado. FastAPI + SQLAlchemy 2 + Alembic, PostgreSQL 16 em produção e SQLite no desenvolvimento e nos testes. O contrato (campos, status, travas, rotas, e-mail) está em [`docs/portal/ESPEC-FASE1.md`](../../docs/portal/ESPEC-FASE1.md); este README só cobre como rodar.

Fase 1 não tem login: quem escreve se identifica com `autor` (`nome` + `email`) no corpo. O ponto único para trocar isso na Fase 2 (AD) é `app/identidade.py`.

## Rodar localmente

Requer Python 3.12 ou mais novo (testado em 3.13 e 3.14).

```bash
cd portal/backend
python -m venv .venv
.venv/Scripts/activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt

alembic upgrade head            # cria portal-dev.db (SQLite) com as tabelas
uvicorn app.main:app --port 8000 --reload
```

- Saúde: `curl http://localhost:8000/api/saude`
- Documentação interativa (Swagger): `http://localhost:8000/api/docs`
- O frontend em desenvolvimento (`http://localhost:5173`) é a única origem liberada no CORS. Em produção o Nginx serve tudo na mesma origem.

Exemplo:

```bash
curl -X POST http://localhost:8000/api/fichas -H "Content-Type: application/json" \
     -d '{"autor": {"nome": "Maria", "email": "maria@neoguard.com.br"}}'
```

## Variáveis de ambiente

Lidas do ambiente ou de um `.env` na pasta atual (veja `.env.example`; o `.env` não vai para o git). Variável vazia vale como não definida.

| Variável | Padrão | Para quê |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./portal-dev.db` | Banco. Produção: `postgresql+psycopg://usuario:senha@db:5432/portal` (`postgresql://` também é aceito e troca para o driver psycopg 3). |
| `PORTAL_URL` | `http://172.16.100.35:8090` | Base do link `…/fichas/<id>` nos e-mails. |
| `NOTIFICAR_PARA` | `ti@neoguard.com.br,suporte@neoguard.com.br,aux.ti@neoguard.com.br` | Destinatários das notificações (vírgula ou ponto e vírgula). |
| `SMTP_HOST` | vazio | Sem ele nenhum e-mail é enviado (as automáticas só vão para o log; o botão "Enviar ficha por e-mail" devolve 502). |
| `SMTP_PORT` | `587` | Produção: `465`. |
| `SMTP_USUARIO` / `SMTP_SENHA` | vazio | Se houver usuário, faz login. |
| `SMTP_REMETENTE` | `SMTP_USUARIO`, ou `portal@neoguard.com.br` | Cabeçalho `From`; aceita `Nome <email>`. O envelope usa só o endereço. |
| `SMTP_TLS` | `starttls` | `starttls`, `ssl` (SSL implícito, `smtplib.SMTP_SSL`) ou `nenhum`. Produção: `ssl`. |
| `SMTP_VERIFICAR_CERTIFICADO` | `true` | `false` aceita certificado autoassinado do servidor SMTP interno. |
| `GIT_SHA` | `dev` | Versão mostrada em `/api/saude` (o deploy injeta o SHA). |
| `CORS_ORIGENS` | `http://localhost:5173` | Origens do CORS (vírgula). |

Produção (Neoguard): `SMTP_HOST=mail.neoguard.com.br`, `SMTP_PORT=465`, `SMTP_TLS=ssl`, `SMTP_USUARIO`/`SMTP_SENHA` da conta que envia e `SMTP_REMETENTE` com o endereço dela. Conexão e leitura têm timeout de 20 s.

## E-mail

- **Notificações automáticas** (`liberar-instalacao`, `concluir-instalacao`, `validar-ccon`, `registrar-pendencia`): enviadas em background depois da gravação, para `NOTIFICAR_PARA`, com Reply-To do autor. Falha de envio só vai para o log e nunca derruba a ação. Criar a ficha **não** envia e-mail.
- **Enviar a ficha por e-mail** (`POST /api/fichas/{id}/acoes/enviar-email`, corpo `{ autor, mensagem? }`, sem `versao`): disponível em qualquer status, **síncrono**. Manda a ficha completa (texto + HTML, seções 1.1 a 1.8, etapas 2 e 3 e pendências só se preenchidas, links da ficha e da impressão) para `NOTIFICAR_PARA`, com Reply-To do autor, e registra o evento `enviou_email`. Se o SMTP não estiver configurado ou falhar, responde `502 {"detail": "Não foi possível enviar o e-mail: <motivo>"}` e não registra o evento.

## Banco e migrações

```bash
alembic upgrade head                      # aplica
alembic revision --autogenerate -m "..."  # nova migração depois de mexer em app/models.py
```

No contêiner, rode `alembic upgrade head` antes de subir o `uvicorn` (a migração é idempotente). A migração inicial cria `fichas`, `ficha_eventos` e `contadores` (número sequencial que nunca é reaproveitado). Um teste confere que a migração e os modelos produzem o mesmo esquema.

## Testes

```bash
python -m pytest
```

Usam SQLite em arquivo temporário e não precisam de SMTP nem de rede; o envio de e-mail é trocado por um gravador. Cobrem: criação/listagem/busca, esqueleto, merge, todas as transições e travas (inclusive as exceções "se aplicável"), edição por status, conflito de versão, pendências/retomar, histórico, e-mails (automáticos e envio da ficha) e `alembic upgrade head`.

## Estrutura

```
app/main.py            FastAPI (rotas em /api), CORS, tratadores de erro
app/config.py          Settings (variáveis de ambiente)
app/db.py, models.py   Engine/sessão e tabelas (fichas, ficha_eventos, contadores)
app/schemas.py         Corpos de requisição e respostas
app/identidade.py      Quem é o autor (Fase 1: vem do corpo)
app/email.py           Montagem e envio das notificações e da ficha por e-mail
app/fichas/modelo.py   Esqueleto vazio, merge profundo, tipos e opções válidas
app/fichas/status.py   Status, rótulos e regras de edição
app/fichas/travas.py   Faltas de cada trava (usadas pelas ações e por /travas)
app/fichas/acoes.py    liberar-instalacao, concluir-instalacao, validar-ccon, registrar-pendencia, retomar
app/fichas/relatorio.py A ficha completa em texto e HTML (corpo do e-mail)
app/fichas/servico.py  Casos de uso com banco, histórico e e-mail
app/routers/           Rotas HTTP
alembic/               Migrações
tests/                 pytest
```
