# Gerador de Propostas Facilities

Site da equipe comercial do Grupo Neoguard. O vendedor preenche cliente, município e postos. A página calcula o preço com a convenção coletiva, o ISS e o vale-transporte cadastrados para o município e deixa baixar:

- a **proposta** no modelo Neoguard, em PDF (pronta para o cliente) e em .docx (para editar);
- a **memória de cálculo**, em .xlsx. É uso interno: não envie ao cliente.

- **Site:** https://alandioneiron.github.io/Gerador-de-Processo/ (passa a valer depois da primeira release)
- **Versão em uso:** aparece no topo da página, por exemplo `v1.0.0`.
- **Repositório:** https://github.com/alandioneiron/Gerador-de-Processo

> **Repositório público.** Nunca coloque aqui dados de clientes reais, propostas emitidas ou planilhas internas. Um dado enviado ao git fica no histórico, mesmo depois de apagado.

---

## Para vendedores

### O que sai do gerador

| Arquivo | Uso | Observação |
|---|---|---|
| Proposta (PDF) | Cliente | Pronta para enviar. |
| Proposta (.docx) | Interno | Para quando precisar editar a proposta. |
| Memória de cálculo (.xlsx) | Interno | **Não envie ao cliente.** |

### Passo a passo

1. Abra o site e confira a versão no topo da página.
2. **1. Cliente e local do serviço:** preencha o nome do cliente (como sai na capa), o "Aos cuidados de" (opcional), o município, a data, a versão da proposta e quem está emitindo.
3. Se aparecer **"Dados a conferir antes de emitir"**, confira cada item na fonte e marque a caixa "Conferi este dado". A marcação não fica guardada: a cada vez que abrir a página, marque de novo.
4. **2. Postos:** clique em **+ Adicionar posto** para cada função e escala que o cliente pediu.
   - Escolha a **função** na lista. A página preenche o salário-piso, o kit de uniforme e o enquadramento do ISS.
   - Se o salário for maior que o piso, a página pede o motivo. Salário abaixo do piso não deixa emitir.
   - Se o kit aparecer em branco, informe o valor da planilha de uniformes.
   - Preencha escala, dias e horário e a quantidade de postos.
   - Confira as opções do posto: insalubridade e acúmulo de função só valem se o escopo prevê; o intervalo indenizado aparece só nas escalas 12x36; o prêmio de assiduidade vem marcado por padrão, então desmarque se o escopo não o prevê.
5. **3. Materiais e equipamentos** (opcional): marque a caixa se a proposta inclui materiais ou equipamentos. Use valores cotados com fornecedor.
6. **4. Conferência e emissão:** quando aparecer **"Tudo conferido. Pode emitir."**, baixe a proposta. O nome do arquivo traz cliente, data e versão.

A página não estima nada. Se falta um dado, ela para e diz o que falta.

### Quando o município não está na lista

A página só calcula com dados cadastrados (convenção, ISS e VT do município). Se o município não aparecer:

1. No campo de município, escolha **Outro município (não está na lista)**.
2. Preencha o formulário que aparece: município, UF, registro da CCT (se souber), cliente que motivou o pedido e observações (ISS, tarifa de ônibus, fonte).
3. Clique em **Copiar pedido de cadastro** (ou em **Abrir e-mail de pedido de cadastro**, quando o endereço estiver configurado).
4. Anexe ao e-mail o PDF da convenção coletiva, registrada no Mediador/MTE ou no sindicato, e envie ao responsável pelo cadastro.
5. Não faça proposta com estimativa. O município entra numa nova versão do gerador, depois que o cadastro for feito.

### Histórico

As propostas emitidas aparecem na seção **"Propostas emitidas neste navegador"**: data, cliente, município, versão, colaboradores, valor mensal e quem emitiu. O histórico fica só no navegador e no computador em que a proposta foi emitida. Outro computador ou outro navegador não mostra essa lista, e limpar os dados do navegador apaga o histórico. Guarde uma cópia dos arquivos emitidos.

### Se algo der errado

- A página diz que os parâmetros ou a convenção não estão cadastrados: ela não calcula nada até o cadastro. Avise quem mantém o gerador.
- Mensagens de erro trazem um código entre colchetes, como `[código: modelo]`. Informe esse código a quem mantém o gerador.

---

## Para quem mantém

### Pré-requisitos

- **Node.js 22** (o mínimo é 20; o CI usa 22).
- Git. O GitHub CLI (`gh`) é opcional.

### Rodar localmente

```
npm ci                # instala as dependências (usa package-lock.json)
npm start             # http://localhost:8080 com os dados reais de data/
npm run start:teste   # http://localhost:8080 com dados fictícios de tests/fixtures
```

`npm start` e `npm run start:teste` usam a mesma porta. Pare um antes de subir o outro.

### Validação e testes

```
npm run validate           # valida data/: erros bloqueiam, avisos são lembretes
npm run validate:release   # modo da release: cadastro não pode estar vazio
npm test                   # testes unitários (cálculo e modelos)
npm run test:e2e           # testes no navegador, geram PDF, DOCX e XLSX
npm run build              # gera dist/, que é o que vai para o GitHub Pages
```

Na primeira vez que rodar o teste E2E, instale o navegador do Playwright com `npx playwright install chromium`.

### Prévia do site (depois do merge na main)

O merge na `main` não publica. Ele gera uma prévia para conferência:

1. No GitHub, abra **Actions**, o workflow **CI** e a execução mais recente da `main`. Em **Artifacts**, baixe **site-previa** (um arquivo .zip).
2. Crie uma pasta nova e vazia (por exemplo `C:\previa-site`) e extraia o .zip dentro dela. Não execute nada de dentro do .zip.
3. Na pasta do clone, rode:
   ```
   node scripts/serve.mjs --root "C:\previa-site"
   ```
4. Abra http://localhost:8080. A versão da prévia aparece no topo como `main-<commit>`.

### Estrutura de pastas

```
index.html          página única (textos e formulário)
js/calc.js          cálculo do preço pelo método Neoguard (funções puras)
js/app.js           interface, geração de PDF/DOCX/XLSX, histórico e pedido de cadastro
data/               cadastro versionado
  config.json       parâmetros Neoguard (valem para todos os municípios)
  ccts.json         convenções coletivas
  municipios.json   municípios (ISS, VT e alertas)
  site.json         e-mail do pedido de cadastro e link do repositório
assets/             modelos da proposta (DOCX e PDF)
scripts/            validate-data.mjs (cadastro), build.mjs (dist/), serve.mjs (servidor local)
tests/              dados fictícios (fixtures) e testes
docs/               configuração única do repositório no GitHub
.github/            workflows (CI, prévia e release) e modelos de PR e issue
```

### Fluxo de trabalho

```
branch → Pull Request → CI verde → merge na main (gera prévia) → Release vX.Y.Z (publica)
```

- Toda mudança entra por Pull Request. A `main` é protegida.
- Os checks obrigatórios são **"Validação e testes unitários"** e **"Testes E2E"**.
- Merge na `main` **não publica**.
- Produção só muda com uma **Release** com tag `vX.Y.Z`. Pré-release não publica.

Detalhes, comandos e regras de versão estão em [CONTRIBUTING.md](CONTRIBUTING.md). A configuração única do repositório no GitHub está em [docs/CONFIGURACAO-GITHUB.md](docs/CONFIGURACAO-GITHUB.md). O histórico de mudanças está em [CHANGELOG.md](CHANGELOG.md).
