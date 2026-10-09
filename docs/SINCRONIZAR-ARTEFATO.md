# Sincronizar com o artefato do C.O

O Gerador nasce e evolui num artefato do Claude mantido pelo C.O:
`https://claude.ai/artifact/Dbtpr8sv716RcmZ5Ww6zGk`.
Este repositório é a versão publicada para os vendedores (https://propostas.neoguard.com.br).

O chat do C.O não consegue enviar nada ao GitHub: ele roda em outra conta do Claude, sem git. Por isso o caminho é:

```
C.O muda o artefato → o chat dele publica a versão + NOTAS-DA-VERSAO.md e entrega o cadastro.json só para download
  → C.O avisa o Alan ("pronto para o GitHub")
  → Alan pede ao Claude Code nesta pasta: "C.O terminou, sincroniza o artefato"
  → Claude Code lê o artefato, importa, testa e abre o PR sync/artefato-<versão>
  → CI verde → merge na main → (quando o Alan quiser) Release vX.Y.Z → site atualizado
```

O banco do artefato (parâmetros, CCTs, municípios) só é legível pela conta do C.O. Por isso o chat dele gera uma cópia em `cadastro.json` para download. O C.O manda esse arquivo ao Alan por canal interno. O cadastro (BDI, encargos) NÃO vai para o artefato, que é público, nem para o git: fica só no servidor do Portal.

## 1. Prompt para o chat do C.O (colar uma vez, no chat que criou o artefato)

```text
A partir de agora este artefato (Gerador de Propostas Facilities) também é publicado para os
vendedores como site, a partir do repositório GitHub alandioneiron/Gerador-de-Processo. Quem
converte é outro chat (Claude Code do Alan), que lê os ARQUIVOS PUBLICADOS deste artefato, mas não
consegue ler o banco de dados daqui. Em toda rodada de mudanças, siga estas regras:

1. Arquivos: mantenha index.html, calc.js, modelo.js (window.MODELO_B64="...") e tpl.js
   (window.TPL_PDF_B64="..."). Se criar arquivo novo, cite nas notas da versão.
2. calc.js: todo o cálculo de preço fica nele, como funções puras (sem DOM e sem window.claude),
   mantendo "var NG = ..." e a última linha
   if (typeof module !== "undefined") module.exports = NG;
   Esse arquivo vai para o site sem alteração.
3. Modelo DOCX (modelo.js): use cliente e valores de exemplo FICTÍCIOS. Mantenha no index.html a
   conferência do modelo com x.indexOf("Cliente: <cliente de exemplo>")<0 e
   x.indexOf("<data por extenso>.")<0, porque o conversor usa essas duas frases para achar os campos.
   A primeira tabela do documento continua sendo a tabela de preços.
4. Modelo PDF (tpl.js): capa, área da tabela e data em branco (o código desenha por cima). Se mudar
   a quantidade ou a ordem das páginas (hoje são 12), descreva nas notas.
5. Ao terminar cada rodada:
   a) NÃO publique o cadastro no artefato (ele é público). Gere cadastro.json como ARQUIVO PARA
      DOWNLOAD nesta conversa, para o C.O enviar ao Alan por canal interno, com o conteúdo atual
      do banco, no formato
      {"config": {campos do documento config/neoguard},
       "ccts": {"<id do documento>": {campos}},
       "municipios": {"<id do documento>": {campos}}}
      Números continuam números (percentuais em fração, ex.: 0.05) e os ids são os originais.
      NÃO inclua as coleções "propostas" e "pendencias", porque têm dados de clientes.
   b) Publique junto com o artefato o arquivo NOTAS-DA-VERSAO.md com: data; o que mudou para o vendedor; o que mudou no código (telas,
      validações, textos da proposta); campos novos ou alterados no banco (nome, significado,
      unidade, exemplo); se os modelos DOCX/PDF mudaram; pendências de CCT abertas
      (município/UF, registro, status — sem nome de cliente).
6. No fim, responda com a linha "PRONTO PARA O GITHUB – versão <data e hora>" e um resumo de 3
   linhas, para o C.O repassar ao Alan.

O repositório e o site são públicos: nunca coloque nos arquivos publicados nomes de clientes
reais, propostas emitidas ou planilhas internas.
```

A primeira rodada com esse prompt já resolve o cadastro inicial: o `cadastro.json` traz os parâmetros, as CCTs e os municípios que hoje só existem no banco do artefato.

## 2. O que o Claude Code faz ao ouvir "C.O terminou, sincroniza"

Procedimento completo em [`CLAUDE.md`](../CLAUDE.md). Em resumo:

1. Lê o artefato (versão e arquivos publicados) e baixa os arquivos para uma pasta temporária, fora do repositório.
2. `git switch -c sync/artefato-<versão>` a partir da `main` atualizada.
3. `npm run importar-artefato -- <pasta> --versao <versão>`. O script:
   - copia o `calc.js` para `js/calc.js`;
   - converte o `modelo.js` em `assets/modelo-proposta.docx`, trocando o cliente de exemplo e a data pelos marcadores e a tabela de exemplo por `{{TABELA_DE_PRECOS}}`;
   - converte o `tpl.js` em `assets/modelo-proposta.pdf` e confere as 12 páginas;
   - distribui o `cadastro.json` em `cadastro-local/` (pasta fora do git) e roda o validador. Para o Portal, essa pasta é copiada para `/opt/portal-neoguard/cadastro/` no servidor. Para testar local: `npm run start:local`;
   - guarda `index.html` e `NOTAS-DA-VERSAO.md` em `upstream/` e atualiza `upstream/artefato.json`.
4. Porta à mão o que mudou no `index.html` do artefato (`git diff upstream/index.html`) para `index.html` e `js/app.js`. O site não tem `window.claude`: o banco virou `data/*.json`, os downloads são do navegador e o histórico é local.
5. Campo novo no banco: atualiza o validador, a referência de campos do `CONTRIBUTING.md` e, se mexer no cálculo, os testes.
6. `npm test`, `npm run test:e2e` e `npm run validate:release`; atualiza o `CHANGELOG.md`; abre o PR e mescla quando o CI ficar verde.
7. A Release (que atualiza o site) só sai quando o Alan pedir.

## Se a leitura do artefato falhar

Se o Claude Code não enxergar algum arquivo publicado (por exemplo, o `cadastro.json`), o C.O pede ao chat dele os arquivos e manda para o Alan. O Alan coloca tudo numa pasta e passa o caminho ao Claude Code, que segue do passo 3.
