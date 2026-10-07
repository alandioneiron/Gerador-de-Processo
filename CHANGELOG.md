# Changelog

Todas as mudanças relevantes do Gerador de Propostas Facilities ficam registradas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões seguem [Versionamento Semântico](https://semver.org/lang/pt-BR/): patch para correção e cadastro, minor para função nova, major para mudança de modelo ou de método.

## Não publicado

### Adicionado

- Cadastro em arquivos JSON versionados em `data/` (parâmetros Neoguard, convenções, municípios), com validador (`npm run validate`) que confere tipos, limites e ids.
- Aviso de convenção vencida pelo campo `vigencia_fim`: a página mostra alerta e pede confirmação ao vendedor.
- Pedido de cadastro de convenção para município fora da lista: copia o texto do pedido ou abre o e-mail, com o PDF da convenção anexado pelo vendedor.
- Histórico das propostas emitidas, guardado só no navegador de quem emitiu.
- Versão do gerador no topo da página.
- Bateria de testes: validação do cadastro, testes unitários do cálculo e dos modelos, e testes E2E no navegador que geram PDF, DOCX e XLSX.
- GitHub Actions: CI em todo Pull Request e na `main` (gera a prévia do site como artifact), e release com tag `vX.Y.Z` que publica no GitHub Pages.
- Documentação: README, CONTRIBUTING, referência de campos do cadastro e configuração do repositório no GitHub.

### Alterado

- Convertido de artefato do Claude para site estático. O cadastro, que antes ficava num banco do Claude, passou para arquivos JSON versionados.
- Modelos da proposta em `assets/`: `modelo-proposta.docx` e `modelo-proposta.pdf`. O DOCX traz os marcadores `Cliente: {{CLIENTE}}` e `{{DATA_EXTENSO}}` no lugar dos dados do cliente de exemplo.
- Downloads feitos pelo próprio navegador, sem serviço externo.

### Segurança

- Bibliotecas do CDN (JSZip, SheetJS e pdf-lib) carregadas com verificação de integridade (SRI).
- Content-Security-Policy na página: scripts só do próprio site e do `cdnjs.cloudflare.com`; estilos do próprio site e do Google Fonts; sem `unsafe-eval`; sem envio de dados para outros endereços (`connect-src 'self'`).
- Página marcada com `noindex`, `nofollow` e `referrer` vazio.
