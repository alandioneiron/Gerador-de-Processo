# Configuração do GitHub

Configuração única do repositório `alandioneiron/Gerador-de-Processo`. Estes ajustes ficam na interface do GitHub, não em arquivo do projeto. Só o dono do repositório (ou quem tem acesso de administração) consegue fazê-los.

Os nomes dos menus estão em inglês, como aparecem na interface do GitHub, com a tradução entre parênteses na primeira vez.

Faça os passos na ordem. Os itens (a) e (b) são necessários para a primeira release. Os itens (c) e (d) protegem a `main`.

---

## (a) Pages: publicar pelo GitHub Actions

1. Abra **Settings** (Configurações) do repositório.
2. No menu lateral, clique em **Pages**.
3. Em **Build and deployment**, no campo **Source**, escolha **GitHub Actions**.

Sem isso, a publicação feita pela release não chega ao site.

## (b) Ambiente github-pages: aceitar tags v*

A publicação roda no ambiente `github-pages`, que pode bloquear deploys vindos de tag. Sem a regra abaixo, a release falha com:

> Tag ... is not allowed to deploy to github-pages due to environment protection rules.

1. Em **Settings**, clique em **Environments** (Ambientes).
2. Clique em **github-pages**.
3. Em **Deployment branches and tags**, veja a opção atual. Se estiver em **All branches and tags**, a regra não é necessária e você pode parar aqui. Se estiver em outra opção, troque para **Selected branches and tags** e siga com o passo 4.
4. Clique em **Add deployment branch or tag rule**.
5. Em **Ref type**, escolha **Tag**.
6. Em **Name pattern**, digite `v*`.
7. Clique em **Add rule**.

Se o ambiente `github-pages` ainda não aparecer na lista, ele é criado no primeiro deploy. Se esse deploy falhar com a mensagem acima, volte a este passo, adicione a regra e reexecute o job **Publicar em produção** (**Re-run jobs**).

## (c) Ruleset da main: proteger a branch principal

1. Em **Settings**, clique em **Rules** (Regras) e depois em **Rulesets**.
2. Clique em **New ruleset** e escolha **New branch ruleset**.
3. Em **Ruleset Name**, digite `Proteger main`.
4. Em **Enforcement status**, deixe **Active**.
5. Em **Target branches**, clique em **Add target** e escolha **Include default branch**. A branch padrão é a `main`.
6. Marque as regras abaixo:
   - **Restrict deletions**: impede apagar a `main`.
   - **Block force pushes**: impede reescrever o histórico da `main`.
   - **Require a pull request before merging**: toda mudança entra por PR. Em **Required approvals**, deixe `0` se só você mexe no repositório. O PR serve para rodar os testes. Aumente o número se houver revisores.
   - **Require status checks to pass**: marque também **Require branches to be up to date before merging**. Em **Add checks**, adicione os dois checks obrigatórios:
     - **Validação e testes unitários**
     - **Testes E2E**
7. Em **Bypass list**, deixe vazia, para que ninguém contorne a regra.
8. Clique em **Create**.

Os nomes dos checks só aparecem na lista depois que o workflow **CI** rodou pelo menos uma vez. Se não aparecerem, vá em **Actions**, escolha o workflow **CI**, clique em **Run workflow** e escolha a `main`. Depois volte ao ruleset e adicione os checks.

## (d) Permissões do Actions

1. Em **Settings**, clique em **Actions** e depois em **General**.
2. Em **Workflow permissions**, escolha **Read repository contents and packages permissions**.

Os workflows declaram, cada um, só as permissões que precisam: no workflow de release, `pages: write` no build e no deploy, e `id-token: write` só no deploy. Por isso o padrão do repositório pode ficar como leitura.

## (e) Opcional: apagar branches depois do merge

1. Em **Settings**, clique em **General**.
2. Na seção **Pull Requests**, marque **Automatically delete head branches**.

---

## Domínio: propostas.neoguard.com.br

O site responde em **https://propostas.neoguard.com.br**. O endereço padrão `alandioneiron.github.io/Gerador-de-Processo` passa a redirecionar para ele.

| Onde | O quê | Situação |
|---|---|---|
| GitHub → Settings → Pages → Custom domain | `propostas.neoguard.com.br` | Feito (gravado antes do DNS, como o GitHub recomenda) |
| DNS do neoguard.com.br (HostGator → cPanel → Editor de Zona) | CNAME `propostas` → `alandioneiron.github.io` | A fazer |
| Conta do GitHub → Settings → Pages → Add a domain | TXT `_github-pages-challenge-alandioneiron.neoguard.com.br` com o valor mostrado pelo GitHub | Recomendado: impede que outra conta use subdomínios da Neoguard |
| GitHub → Settings → Pages | **Enforce HTTPS** | Depois que o certificado sair (minutos a algumas horas após o DNS) |

Como a publicação é feita pelo GitHub Actions, o domínio fica guardado nas configurações do Pages e não precisa de arquivo `CNAME` no site.

Se o DNS mudar de provedor, recrie o CNAME no provedor novo antes de desligar o antigo. Se o CNAME sumir com o domínio ainda configurado no GitHub, o subdomínio fica exposto a uso por terceiros, e a verificação do domínio (linha 3 da tabela) protege contra isso.

---

## Aviso: o GitHub Pages é público

- Qualquer pessoa com o link vê a página e consegue baixar os arquivos de `data/`, que incluem os parâmetros de custo e o BDI.
- O repositório também é público. Dado que entrar em `data/` fica no histórico do git, mesmo depois de apagado.
- A página tem `noindex`, mas isso só impede que buscadores a listem. Não restringe o acesso.

Se isso for um problema para a Neoguard, a alternativa é publicar em **Cloudflare Pages** e proteger o acesso com **Cloudflare Access**, que pede login por código enviado ao e-mail `@neoguard.com.br`. Essa migração é outro projeto e não está feita.
