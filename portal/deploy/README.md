# Portal Neoguard — deploy

Tudo para colocar o Portal (Ficha de Implantação + Gerador de Propostas) no ar no servidor `172.16.100.35`, com Docker Compose. Contrato técnico: [`docs/portal/ESPEC-FASE1.md`](../../docs/portal/ESPEC-FASE1.md).

## O que sobe

| Serviço | Imagem | O que faz |
|---|---|---|
| `db` | `postgres:16-alpine` | Banco das fichas. Volume nomeado `portal-neoguard_pgdata`. Sem porta publicada. |
| `api` | `Dockerfile.api` (Python 3.12) | FastAPI. Ao subir roda `alembic upgrade head`. Sem porta publicada. |
| `web` | `Dockerfile.web` (Nginx 1.27) | SPA do portal em `/`, API em `/api/`, Gerador em `/propostas/`. **Única porta publicada: `8090`.** |

Roteamento do Nginx (`nginx.conf`):

| Caminho | Destino |
|---|---|
| `/` | SPA (`index.html` sem cache; `assets/` com hash e cache de 1 ano) |
| `/api/` | `api:8000`, repassando o caminho completo |
| `/propostas/` | Gerador estático (sempre revalida o cache) |
| `/propostas/data/` | Cadastro real, vindo do volume do servidor, `Cache-Control: no-store`. Só `config.json`, `ccts.json`, `municipios.json` e `site.json` são servidos. |

### Isolamento do Access-Control

A VM também roda o Access-Control (portas 3001 e 3443), que aciona hardware real. O Portal não pode encostar nele:

- projeto Compose `portal-neoguard` (o `name:` do arquivo já fixa isso), rede `portal-neoguard_portal` e volume `portal-neoguard_pgdata` próprios;
- **sempre** `-p portal-neoguard` e `-f portal/deploy/docker-compose.yml` nos comandos (o `deploy.sh` já faz);
- sem `container_name` fixo, sem `docker system prune`, sem `docker compose down` fora do projeto;
- única porta publicada: `8090` (a `3001` e a `3443` ficam como estão).

## Primeira instalação no servidor

Entre na VM por SSH com o usuário que usa o Docker (grupo `docker`).

```bash
# 1. Pastas
sudo mkdir -p /opt/portal-neoguard/{cadastro,backups}
sudo chown -R "$USER":"$USER" /opt/portal-neoguard

# 2. Código
git clone https://github.com/alandioneiron/Portal-Neoguard.git /opt/portal-neoguard/repo

# 3. Configuração (fica FORA do repositório; tem senhas)
cp /opt/portal-neoguard/repo/portal/deploy/.env.example /opt/portal-neoguard/.env
chmod 600 /opt/portal-neoguard/.env
nano /opt/portal-neoguard/.env      # preencha ao menos POSTGRES_PASSWORD (openssl rand -hex 24)

# 4. Cadastro real do Gerador (veja a seção abaixo)
cp /opt/portal-neoguard/repo/portal/deploy/cadastro-vazio/*.json /opt/portal-neoguard/cadastro/   # só para começar

# 5. Subir
bash /opt/portal-neoguard/repo/portal/deploy/deploy.sh

# 6. Backup diário (02:30)
( crontab -l 2>/dev/null; echo '30 2 * * * bash /opt/portal-neoguard/repo/portal/deploy/backup-db.sh >> /opt/portal-neoguard/backups/backup.log 2>&1' ) | crontab -
bash /opt/portal-neoguard/repo/portal/deploy/backup-db.sh   # teste manual: deve criar um .sql.gz em /opt/portal-neoguard/backups
```

Depois abra `http://172.16.100.35:8090` (de outro computador da rede) e confira a versão no topo do Gerador em `/propostas/` (aparece `portal-<commit>`).

### `.env`

Modelo completo e comentado em [`.env.example`](.env.example).

| Variável | Para quê |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Banco. **Só letras e números na senha** (ela entra numa URL). A senha só vale na criação do volume: trocar depois no `.env` não troca no banco. |
| `PORTAL_URL` | Base dos links dos e-mails (`PORTAL_URL/fichas/<id>`). |
| `PORTAL_PORTA` | Porta publicada (padrão `8090`). |
| `CADASTRO_DIR` | Pasta do cadastro real (padrão do exemplo: `/opt/portal-neoguard/cadastro`). |
| `NOTIFICAR_PARA` | Destinatários dos avisos, separados por vírgula. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USUARIO`, `SMTP_SENHA`, `SMTP_REMETENTE`, `SMTP_TLS` | E-mail. Com `SMTP_HOST` vazio o portal funciona, mas não envia e-mail (registra "e-mail não configurado" no log). Depois de preencher: `deploy.sh` de novo (ou `docker compose ... up -d api`). |

### Cadastro real do Gerador

O cadastro (parâmetros Neoguard, CCTs e municípios) **nunca vai para o git nem para a imagem**. Ele vive só no servidor, em `CADASTRO_DIR`, e o Nginx o lê por volume somente leitura:

```bash
# do seu computador, com os 4 arquivos gerados pelo importador do Gerador:
scp config.json ccts.json municipios.json site.json usuario@172.16.100.35:/opt/portal-neoguard/cadastro/
ssh usuario@172.16.100.35 'chmod 644 /opt/portal-neoguard/cadastro/*.json'
```

- Atualizar o cadastro **não exige deploy nem reinício**: o Nginx responde com `no-store`, então a próxima abertura do Gerador já usa os arquivos novos.
- A pasta precisa ser legível pelo Nginx (arquivos `644`, pasta `755`).
- Deixe na pasta só esses 4 arquivos. Qualquer outro nome devolve 404 de propósito.
- Sem os arquivos reais, o Gerador abre, mas avisa "Parâmetros Neoguard ainda não cadastrados" e não calcula nada.

## Dia a dia

Atalho para os comandos abaixo (cole no terminal do servidor):

```bash
alias portal='docker compose -p portal-neoguard -f /opt/portal-neoguard/repo/portal/deploy/docker-compose.yml --env-file /opt/portal-neoguard/.env'
```

### Deploy (atualizar)

```bash
bash /opt/portal-neoguard/repo/portal/deploy/deploy.sh
```

O script faz `git pull --ff-only` na `main`, reconstrói as imagens com o commit atual (`GIT_SHA`), sobe o que mudou, mostra o status e testa `http://127.0.0.1:8090/api/saude` por até 60 s. Se o teste falhar, mostra os logs da `api` e do `web` e sai com erro.

As migrações do banco rodam sozinhas na subida da `api` (`alembic upgrade head`).

### Status e logs

```bash
portal ps                              # status e saúde dos 3 serviços
portal logs -f --tail=100 api          # logs da API (idem: web, db)
curl -fsS http://localhost:8090/api/saude
```

Os logs usam o `json-file` com rotação (5 arquivos de 10 MB por serviço).

### Rollback

Voltar o código para uma versão anterior (tag ou commit):

```bash
cd /opt/portal-neoguard/repo && git log --oneline -10      # ache o commit bom
bash /opt/portal-neoguard/repo/portal/deploy/deploy.sh --ref <commit-ou-tag>
```

Para voltar à `main` depois, rode `deploy.sh` sem argumentos (ele troca para a `main` antes do pull).

> **Atenção com o banco.** O rollback do código **não desfaz migrações**. Se a versão que você quer abandonar criou uma migração, volte o banco junto: restaure o último backup (abaixo) ou rode `portal exec api alembic downgrade <revisão>` **antes** de trocar o código. Sem migração nova no meio, o rollback é seguro.

### Backup e restauração

`backup-db.sh` grava `portal-AAAAMMDD-HHMMSS.sql.gz` em `/opt/portal-neoguard/backups` e apaga os de mais de 14 dias. Copie esses arquivos para fora da VM de vez em quando (o backup na mesma máquina não protege contra perda do disco).

Restaurar (apaga os dados atuais do banco do Portal):

```bash
portal stop web api
gunzip -c /opt/portal-neoguard/backups/portal-AAAAMMDD-HHMMSS.sql.gz \
  | portal exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
portal start api web
```

### Parar tudo

```bash
portal down        # para e remove os contêineres do Portal; os dados (volume) ficam
```

**Nunca** use `down -v` no servidor: apaga o banco. Esse comando só é usado no teste local (abaixo).

## Fase 2: fechar a porta 8090

Na Fase 2 entram o login pelo AD (LDAPS), o MFA fora da rede e o HTTPS público. Quando isso entrar, a porta `8090` deixa de ser a porta de entrada:

1. Coloque um proxy HTTPS na frente (Nginx/Traefik do servidor ou do firewall) apontando para o contêiner `web`.
2. Em `docker-compose.yml`, troque `ports: "${PORTAL_PORTA:-8090}:80"` por `expose: ["80"]` (ou `127.0.0.1:${PORTAL_PORTA}:80`, se o proxy rodar na própria VM).
3. Ajuste `PORTAL_URL` no `.env` para o endereço novo e rode `deploy.sh`.
4. Confirme de outro computador que `http://172.16.100.35:8090` não responde mais.

Observação: o Docker publica portas direto no `iptables` e **ignora o `ufw`**. Bloquear a 8090 só no `ufw` não adianta; é preciso tirar o `ports:` do compose (ou filtrar na cadeia `DOCKER-USER`).

## Testar na sua máquina

Precisa de Docker com Compose v2 e `curl`. Da raiz do repositório:

```bash
bash portal/deploy/smoke.sh
```

Sobe a pilha num projeto descartável (`portal-neoguard-teste`, porta `18090`, volumes próprios), testa `/`, `/api/saude` e `/propostas/`, e derruba tudo com `down -v`. O CI roda o mesmo script. Para validar só o compose:

```bash
POSTGRES_PASSWORD=teste docker compose -f portal/deploy/docker-compose.yml --env-file portal/deploy/.env.example config -q
```

## Arquivos

| Arquivo | Para quê |
|---|---|
| `docker-compose.yml` | Pilha `db` + `api` + `web`. |
| `Dockerfile.api` | API: Python 3.12, usuário sem privilégios, migra e sobe o Uvicorn, healthcheck em `/api/saude`. |
| `Dockerfile.web` | Build do frontend (Node 22) + Nginx com a SPA e o Gerador (sem `data/`); grava `propostas/version.json`. |
| `nginx.conf`, `nginx-seguranca.conf` | Roteamento, cache e cabeçalhos de segurança. |
| `.env.example` | Modelo do `.env` do servidor (o `.env` real nunca vai para o git). |
| `cadastro-vazio/` | Cadastro "em branco" usado quando `CADASTRO_DIR` não está definido. |
| `deploy.sh` | Atualiza e sobe a pilha no servidor; `--ref` serve para rollback. |
| `backup-db.sh` | `pg_dump` compactado com retenção de 14 dias. |
| `smoke.sh` | Teste de fumaça (local e CI). |
| `../../.dockerignore` | Mantém `node_modules`, `.git`, `tests/`, `data/` etc. fora do contexto de build. |
