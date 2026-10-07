## O que mudou e por quê

<!-- Explique em poucas linhas o que este Pull Request altera e qual problema resolve. -->

## Tipo de mudança

- [ ] Correção (algo estava errado)
- [ ] Melhoria (funcionalidade nova ou ajuste de uso)
- [ ] Cadastro de CCT / município (dados em `data/`)
- [ ] Modelo da proposta (texto, layout, PDF ou DOCX gerado)

## Checklist

### Sempre

- [ ] Rodei `npm test` localmente e passou
- [ ] Rodei `npm run validate` localmente e passou
- [ ] Não incluí dados reais de clientes (nomes, CNPJs, contatos, valores de propostas)

### Se mexi em dados (`data/`)

- [ ] Conferi a fonte: CCT registrada no Mediador (MTE), lei municipal do ISS e tarifa de transporte
- [ ] Anexei ou linkei a fonte (PDF da CCT, lei, tabela de tarifa):
  <!-- cole aqui o link ou anexe o arquivo -->
- [ ] Rodei `npm run validate:release` (modo estrito) e passou

### Se mexi no modelo da proposta

- [ ] Gerei o PDF e o DOCX e conferi o resultado (texto, valores, formatação)

## Observações

<!-- Opcional: prints, pontos de atenção para quem for revisar, dúvidas em aberto. -->
