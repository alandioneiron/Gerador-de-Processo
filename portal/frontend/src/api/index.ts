// Ponto único de acesso à API. Em desenvolvimento com VITE_MOCK=1 usa o backend simulado
// (src/api/mock.ts, carregado sob demanda). No build de produção `import.meta.env.DEV` é
// `false`, então o ramo do mock é eliminado e o arquivo nem entra no pacote.
import { apiHttp, type Api } from './client';

export { ApiError, type Api, type FiltroFichas } from './client';
export * from './types';

/** `true` só no `npm run dev` com VITE_MOCK=1. */
export const MOCK_ATIVO: boolean = import.meta.env.DEV && import.meta.env.VITE_MOCK === '1';

let implementacao: Promise<Api> | null = null;

function carregar(): Promise<Api> {
  if (!implementacao) {
    implementacao = import.meta.env.DEV && import.meta.env.VITE_MOCK === '1'
      ? import('./mock').then((m) => m.apiMock)
      : Promise.resolve(apiHttp);
  }
  return implementacao;
}

export const api: Api = {
  saude: async () => (await carregar()).saude(),
  modelo: async () => (await carregar()).modelo(),
  listarFichas: async (filtro) => (await carregar()).listarFichas(filtro),
  criarFicha: async (autor) => (await carregar()).criarFicha(autor),
  obterFicha: async (id) => (await carregar()).obterFicha(id),
  salvarEtapa1: async (id, corpo) => (await carregar()).salvarEtapa1(id, corpo),
  salvarEtapa2: async (id, corpo) => (await carregar()).salvarEtapa2(id, corpo),
  salvarEtapa3: async (id, corpo) => (await carregar()).salvarEtapa3(id, corpo),
  salvarPendencias: async (id, corpo) => (await carregar()).salvarPendencias(id, corpo),
  executarAcao: async (id, acao, corpo) => (await carregar()).executarAcao(id, acao, corpo),
  travas: async (id) => (await carregar()).travas(id),
};
