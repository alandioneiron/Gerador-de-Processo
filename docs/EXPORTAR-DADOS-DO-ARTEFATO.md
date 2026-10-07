# Exportar o cadastro do artefato original

O artefato original do Claude (`https://claude.ai/artifact/Dbtpr8sv716RcmZ5Ww6zGk`) guarda o cadastro num banco que só a conta dona consegue ler.
Para trazer esse cadastro para `data/`, abra o Claude **logado na conta que criou o artefato** (app ou Claude Code) e cole o pedido abaixo.

```text
Leia o banco de dados do artefato https://claude.ai/artifact/Dbtpr8sv716RcmZ5Ww6zGk
(Gerador de Propostas Facilities) e me entregue 3 arquivos JSON, sem alterar nenhum valor:

1. config.json: só os campos do documento "config/neoguard" (sem id, versão ou metadados).
2. ccts.json: um objeto { "<id do documento>": { ...campos } } com TODOS os documentos da coleção "ccts".
3. municipios.json: um objeto { "<id do documento>": { ...campos } } com TODOS os documentos da coleção "municipios".

Regras: JSON com indentação de 2 espaços; números continuam números (percentuais como estão,
ex.: 0.05); mantenha os ids originais. NÃO exporte as coleções "propostas" nem "pendencias",
porque elas têm dados de clientes. No texto da resposta, liste numa tabela as pendências de CCT
abertas (município/UF, registro, status), sem nomes de clientes.
```

Depois:

1. Salve os 3 arquivos numa pasta fora do repositório e passe para quem mantém o projeto.
2. Quem mantém cria a branch `dados/cadastro-inicial`, copia os arquivos para `data/`, roda `npm run validate:release` (ajusta ids fora do padrão `minusculas-com-hifen`, mantendo as referências `municipio.cct`) e abre o Pull Request.
3. Com o PR aprovado e na `main`, publique a Release `v1.0.0`. É ela que coloca o site no ar.

> Lembrete: o repositório e o GitHub Pages são públicos. Tudo o que entra em `data/` (inclusive BDI e encargos) fica visível para quem tiver o link.
