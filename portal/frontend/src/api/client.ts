// Cliente HTTP da API (ESPEC-FASE1, seção 4). `fetch` relativo a /api.
import type {
  AcaoFicha,
  Autor,
  CorpoEtapa1,
  CorpoEtapa2,
  CorpoEtapa3,
  CorpoPendencias,
  DadosFicha,
  Ficha,
  FichaResumo,
  Status,
  Travas,
} from './types';

export const BASE_API = '/api';

/** Erro de API com o `detail` em PT-BR do backend e, no 422, a lista de `faltas`. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly faltas: string[];

  constructor(status: number, detail: string, faltas: string[] = []) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.faltas = faltas;
  }

  /** 409 de controle otimista: outra pessoa alterou a ficha antes. */
  get conflitoDeVersao(): boolean {
    return this.status === 409 && /alterada por outra pessoa|recarregue/i.test(this.detail);
  }

  /** 409 de edição bloqueada pelo status. */
  get edicaoBloqueada(): boolean {
    return this.status === 409 && !this.conflitoDeVersao;
  }

  /** 422 com a lista de pendências de uma trava. */
  get temFaltas(): boolean {
    return this.status === 422 && this.faltas.length > 0;
  }
}

export interface FiltroFichas {
  status?: Status | '';
  q?: string;
}

/** Contrato usado pelas telas (o mock em src/api/mock.ts implementa o mesmo). */
export interface Api {
  saude(): Promise<{ ok: boolean; versao: string }>;
  modelo(): Promise<DadosFicha>;
  listarFichas(filtro?: FiltroFichas): Promise<FichaResumo[]>;
  criarFicha(autor: Autor): Promise<Ficha>;
  obterFicha(id: string | number): Promise<Ficha>;
  salvarEtapa1(id: string | number, corpo: CorpoEtapa1): Promise<Ficha>;
  salvarEtapa2(id: string | number, corpo: CorpoEtapa2): Promise<Ficha>;
  salvarEtapa3(id: string | number, corpo: CorpoEtapa3): Promise<Ficha>;
  salvarPendencias(id: string | number, corpo: CorpoPendencias): Promise<Ficha>;
  executarAcao(
    id: string | number,
    acao: AcaoFicha,
    corpo: { autor: Autor; versao?: number } & Record<string, unknown>,
  ): Promise<Ficha>;
  travas(id: string | number): Promise<Travas>;
}

function detalheDe(corpo: unknown, status: number): { detail: string; faltas: string[] } {
  if (corpo && typeof corpo === 'object') {
    const c = corpo as { detail?: unknown; faltas?: unknown };
    const faltas = Array.isArray(c.faltas) ? c.faltas.map(String) : [];
    if (typeof c.detail === 'string' && c.detail) return { detail: c.detail, faltas };
    // FastAPI/Pydantic devolve `detail` como lista de { loc, msg } em erros de validação.
    if (Array.isArray(c.detail)) {
      const msgs = c.detail
        .map((d) =>
          d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d),
        )
        .filter(Boolean);
      if (msgs.length) return { detail: msgs.join('; '), faltas };
    }
  }
  if (status === 502 || status === 503 || status === 504) {
    return {
      detail: 'O servidor do portal está indisponível no momento. Tente de novo em instantes.',
      faltas: [],
    };
  }
  return { detail: `Erro inesperado do servidor (HTTP ${status}).`, faltas: [] };
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_API}${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      'Não foi possível falar com o servidor do portal. Confira se você está na rede da Neoguard e tente de novo.',
    );
  }

  let json: unknown = null;
  const texto = await resposta.text();
  if (texto) {
    try {
      json = JSON.parse(texto);
    } catch {
      json = null;
    }
  }

  if (!resposta.ok) {
    const { detail, faltas } = detalheDe(json, resposta.status);
    throw new ApiError(resposta.status, detail, faltas);
  }
  return json as T;
}

function queryString(filtro?: FiltroFichas): string {
  const p = new URLSearchParams();
  if (filtro?.status) p.set('status', filtro.status);
  if (filtro?.q?.trim()) p.set('q', filtro.q.trim());
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const apiHttp: Api = {
  saude: () => requisitar('GET', '/saude'),
  modelo: () => requisitar('GET', '/fichas/modelo'),
  listarFichas: (filtro) => requisitar('GET', `/fichas${queryString(filtro)}`),
  criarFicha: (autor) => requisitar('POST', '/fichas', { autor }),
  obterFicha: (id) => requisitar('GET', `/fichas/${id}`),
  salvarEtapa1: (id, corpo) => requisitar('PUT', `/fichas/${id}/etapa1`, corpo),
  salvarEtapa2: (id, corpo) => requisitar('PUT', `/fichas/${id}/etapa2`, corpo),
  salvarEtapa3: (id, corpo) => requisitar('PUT', `/fichas/${id}/etapa3`, corpo),
  salvarPendencias: (id, corpo) => requisitar('PUT', `/fichas/${id}/pendencias`, corpo),
  executarAcao: (id, acao, corpo) => requisitar('POST', `/fichas/${id}/acoes/${acao}`, corpo),
  travas: (id) => requisitar('GET', `/fichas/${id}/travas`),
};
