import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

afterEach(() => {
  cleanup();
  // O TextArea com autoSize (rc-textarea) cria um <textarea> de medição direto no body; sem layout
  // do jsdom ele pode ficar para trás e aparecer em consultas de outros testes.
  document.body.querySelectorAll(':scope > textarea').forEach((e) => e.remove());
  try {
    window.localStorage.clear();
  } catch {
    /* ignora */
  }
});

// jsdom não implementa matchMedia/ResizeObserver (usados pelo antd).
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= ResizeObserverMock;

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// O jsdom não calcula layout: o TextArea com autoSize do antd gera "NaN" em `height` (só aviso).
const erroOriginal = console.error;
console.error = (...args: unknown[]) => {
  const primeiro = typeof args[0] === 'string' ? args[0] : '';
  if (primeiro.includes('is an invalid value for the `height` css style property')) return;
  erroOriginal(...args);
};

// Consultas por papel ficam muito lentas no jsdom com formulários grandes; a checagem de
// "inacessível" (getComputedStyle em cada ancestral) é a parte cara. Os testes não dependem dela.
configure({ defaultHidden: true, asyncUtilTimeout: 10000 });

// react-router (rotas de dados) cria `new Request(url, { signal })` com o AbortSignal do jsdom,
// que o `Request` nativo do Node recusa. Descartar o `signal` basta nos testes.
const RequestNativo = globalThis.Request;
if (RequestNativo) {
  globalThis.Request = class RequestDeTeste extends RequestNativo {
    constructor(entrada: RequestInfo | URL, init?: RequestInit) {
      if (init && 'signal' in init) {
        const { signal: _ignorado, ...resto } = init;
        void _ignorado;
        super(entrada, resto);
      } else {
        super(entrada, init);
      }
    }
  } as typeof Request;
}

// jsdom calcula `getComputedStyle` percorrendo todas as regras CSS injetadas pelo antd (centenas),
// e as consultas por papel/nome e o userEvent chamam isso milhares de vezes. Os testes só precisam
// do que está inline (display/visibility/pointer-events), então uso uma versão leve.
const estiloVazio = new Proxy(
  {},
  {
    get: (_alvo, chave) => {
      if (chave === 'getPropertyValue') return () => '';
      if (chave === 'length') return 0;
      return '';
    },
  },
) as CSSStyleDeclaration;

window.getComputedStyle = ((elemento: Element, pseudo?: string | null) => {
  if (pseudo || !(elemento instanceof HTMLElement)) return estiloVazio;
  const inline = elemento.style;
  return new Proxy(inline, {
    get: (alvo, chave) => {
      if (chave === 'display') return inline.display || 'block';
      if (chave === 'visibility') return inline.visibility || 'visible';
      if (chave === 'getPropertyValue') return (nome: string) => inline.getPropertyValue(nome);
      const v = Reflect.get(alvo, chave);
      return typeof v === 'function' ? v.bind(alvo) : v;
    },
  });
}) as typeof window.getComputedStyle;
