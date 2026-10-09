# Portal Neoguard — frontend (Fase 1)

SPA da **Ficha de Implantação de Alarme Monitorado**: React 18 + Vite + TypeScript (strict) + Ant Design 5 (pt_BR, dayjs) + react-router 6. Contrato em [`docs/portal/ESPEC-FASE1.md`](../../docs/portal/ESPEC-FASE1.md) (seções 2, 3, 4 e 6). Textos da interface em PT-BR. Versões fixadas no `package.json`.

## Rotas

| Rota | Tela |
|---|---|
| `/` | redireciona para `/fichas` |
| `/fichas` | lista (busca, filtro por status, "Nova ficha") |
| `/fichas/:id` | editor com abas (`?aba=etapa1|etapa2|etapa3|pendencias|historico`) |
| `/fichas/:id/imprimir` | impressão A4 (sem menu), para salvar em PDF |
| `/propostas/` | Gerador de Propostas: link comum, fora do SPA |

## Desenvolvimento

```bash
cd portal/frontend
npm install
npm run dev            # http://localhost:5173, proxy /api -> http://localhost:8000
npm run dev:mock       # mesma coisa, mas com o backend simulado (sem FastAPI)
npm test               # Vitest + Testing Library
npm run build          # tsc --noEmit + vite build -> dist/
```

Com o backend real: `cd portal/backend && .venv/Scripts/python.exe -m alembic upgrade head && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` e depois `npm run dev`.

### Mock (`npm run dev:mock`)

`VITE_MOCK=1` (arquivo `.env.mock`) troca o cliente HTTP por `src/api/mock.ts`: um store em memória, guardado em `localStorage` (`portal.mock.v1`), que segue o contrato (versão e 409, status, travas e 422, eventos, `enviar-email`). Traz 3 fichas **fictícias** em status diferentes. Para zerar: `window.__mockReset()` no console. O mock só é carregado em desenvolvimento (`import.meta.env.DEV`); o `npm run build` não inclui o arquivo (conferido: nenhum rastro no `dist/`).

### Variáveis

| Variável | Onde | Para quê |
|---|---|---|
| `VITE_MOCK=1` | `npm run dev:mock` / `.env.local` | liga o backend simulado (ignorada no build de produção) |
| `VITE_API_PROXY` | ambiente do `npm run dev` | destino do proxy `/api` (padrão `http://localhost:8000`) |

Em produção não há variável: o cliente chama `/api/...` na mesma origem e o Nginx roteia (`portal/deploy`). O build gera `dist/` (servido em `/` com fallback para `index.html`).

## Estrutura

```
src/
  api/        types.ts (tipos do contrato), client.ts (fetch /api, ApiError), mock.ts, index.ts
  domain/     lógica pura e testada: status.ts (somente leitura, ações, travas), comunicacao.ts (opções por modelo),
              condicionais.ts, payload.ts (corpo de cada etapa), modelo.ts (esqueleto vazio), rotulos.ts, util.ts
  state/      identidade.tsx (modal "Quem está preenchendo?", localStorage), useFicha.tsx (rascunho, salvar, ações)
  components/ ficha/ (campos.tsx + Etapa1/2/3Corpo + Pendências + Cabeçalho), RodapeEtapa, ModaisAcao, LayoutPortal
  pages/      FichasLista, FichaEditor, FichaImprimir
  styles/     ficha.css (visual do docx), print.css (A4, cabeçalho repetido, "Página X de Y")
```

## Comportamento

- **Fiel ao docx**: mesmas seções e numeração (1.1 a 1.8, 2.1 a 2.6, 3.1 a 3.3, 9 e 10), rótulos e colunas; grades de campos com rótulo em caixa alta; tabelas editáveis com "+ Adicionar linha" e "remover"; checkboxes em 3 colunas (1.7) e 2 colunas (2.6, 3.1, 3.2). Paleta do docx (marinho `#1B2A4A`, dourado `#B8963E`); barra do portal em dourado `#C9A24B`.
- **Somente leitura por status** e motivo exibido; **faltas** de `GET /travas` ("Falta resolver antes de …") e botão desabilitado enquanto houver faltas ou alterações não salvas.
- **Identificação**: sem nome e e-mail no navegador, o modal "Quem está preenchendo?" abre antes de qualquer escrita.
- **Alterações não salvas**: aviso ao sair da ficha (roteador de dados + `beforeunload`) e ponto laranja na aba.
- **Enviar por e-mail**: botão no topo e no rodapé da Etapa 1; salva o que estiver pendente, abre o modal (destinatários só leitura, mensagem opcional, nota do Reply-To) e chama `POST /acoes/enviar-email` (sem `versao`). Erro 502 mostra o `detail` do backend.
- **Impressão**: `/fichas/:id/imprimir` reaproveita os mesmos componentes em modo texto; o navegador gera o PDF (Chrome/Edge 131+ mostram "Página X de Y"). Bloco de assinaturas com o autor e a data das ações.

## Testes

`npm test` (Vitest + Testing Library, jsdom): lógica pura (status e somente leitura, opções de comunicação, condicionais, payload de cada etapa), cliente HTTP (409/422/502), renderização das Etapas 1, 2 e 3 a partir do esqueleto vazio, modais, e o editor completo contra o mock (salvar, identificação, travas, pendência, ATIVO, conflito de versão, envio de e-mail). O `src/test/setup.ts` troca o `getComputedStyle` do jsdom por uma versão leve, senão o antd deixa as consultas por papel lentas.
