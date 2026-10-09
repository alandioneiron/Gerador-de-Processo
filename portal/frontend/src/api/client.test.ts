import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiHttp } from './client';

function respostaJson(status: number, corpo: unknown): Response {
  return new Response(corpo === undefined ? '' : JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente da API', () => {
  it('chama /api com o método, o corpo JSON e devolve o JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(200, { id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    const autor = { nome: 'Ana', email: 'ana@exemplo.invalid' };
    await apiHttp.salvarEtapa1(5, { autor, versao: 2, etapa1: {} as never });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/fichas/5/etapa1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ autor, versao: 2, etapa1: {} });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('monta a busca com status e q', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respostaJson(200, [])));
    vi.stubGlobal('fetch', fetchMock);
    await apiHttp.listarFichas({ status: 'em_instalacao', q: ' padaria ' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/fichas?status=em_instalacao&q=padaria');
    await apiHttp.listarFichas({});
    expect(fetchMock.mock.calls[1][0]).toBe('/api/fichas');
  });

  it('ações e travas usam os caminhos do contrato', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respostaJson(200, {})));
    vi.stubGlobal('fetch', fetchMock);
    const autor = { nome: 'Ana', email: 'ana@exemplo.invalid' };
    await apiHttp.executarAcao(3, 'liberar-instalacao', { autor, versao: 1 });
    await apiHttp.travas(3);
    await apiHttp.salvarPendencias(3, { autor, versao: 1, pendencias: [] });
    expect(fetchMock.mock.calls.map((c) => `${(c[1] as RequestInit).method} ${c[0]}`)).toEqual([
      'POST /api/fichas/3/acoes/liberar-instalacao',
      'GET /api/fichas/3/travas',
      'PUT /api/fichas/3/pendencias',
    ]);
  });

  it('409 de versão: conflito de versão com a mensagem do servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respostaJson(409, { detail: 'A ficha foi alterada por outra pessoa. Recarregue.' })),
    );
    const erro = await apiHttp.obterFicha(1).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ApiError);
    const e = erro as ApiError;
    expect(e.status).toBe(409);
    expect(e.conflitoDeVersao).toBe(true);
    expect(e.edicaoBloqueada).toBe(false);
    expect(e.detail).toBe('A ficha foi alterada por outra pessoa. Recarregue.');
  });

  it('409 de edição bloqueada pelo status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respostaJson(409, { detail: 'A Etapa 1 não pode ser editada no status "Em instalação".' })),
    );
    const e = (await apiHttp.obterFicha(1).catch((x: unknown) => x)) as ApiError;
    expect(e.edicaoBloqueada).toBe(true);
    expect(e.conflitoDeVersao).toBe(false);
  });

  it('422 traz a lista de faltas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respostaJson(422, { detail: 'Não é possível liberar.', faltas: ['Telefone do cliente', 'Vendedor'] }),
      ),
    );
    const e = (await apiHttp.executarAcao(1, 'liberar-instalacao', {
      autor: { nome: 'A', email: 'a@b.c' },
      versao: 1,
    }).catch((x: unknown) => x)) as ApiError;
    expect(e.status).toBe(422);
    expect(e.temFaltas).toBe(true);
    expect(e.faltas).toEqual(['Telefone do cliente', 'Vendedor']);
  });

  it('422 de validação do FastAPI (detail em lista) vira texto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respostaJson(422, { detail: [{ loc: ['body', 'autor'], msg: 'Campo obrigatório', type: 'missing' }] }),
      ),
    );
    const e = (await apiHttp.criarFicha({ nome: '', email: '' }).catch((x: unknown) => x)) as ApiError;
    expect(e.detail).toBe('Campo obrigatório');
    expect(e.temFaltas).toBe(false);
  });

  it('erro de rede vira mensagem clara em PT-BR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const e = (await apiHttp.saude().catch((x: unknown) => x)) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(0);
    expect(e.detail).toMatch(/rede da Neoguard/);
  });

  it('502 do proxy (corpo que não é JSON) vira "servidor indisponível"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 })));
    const e = (await apiHttp.saude().catch((x: unknown) => x)) as ApiError;
    expect(e.status).toBe(502);
    expect(e.detail).toMatch(/indisponível/);
  });
});
