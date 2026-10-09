// Utilitários puros: comparação estável, mescla com o esqueleto e formatação de datas.
import dayjs from 'dayjs';

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor !== null && typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, ordenar(obj[k])]),
    );
  }
  return valor;
}

/** Comparação profunda independente da ordem das chaves. */
export function iguais(a: unknown, b: unknown): boolean {
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Completa `dados` com as chaves que faltarem em relação ao esqueleto (objetos são mesclados
 * recursivamente; listas e valores simples vindos do servidor prevalecem).
 */
export function mesclarModelo<T>(modelo: T, dados: unknown): T {
  if (dados === undefined || dados === null) return structuredCloneSeguro(modelo);
  if (ehObjeto(modelo) && ehObjeto(dados)) {
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(modelo)) {
      saida[chave] = mesclarModelo(modelo[chave], dados[chave]);
    }
    for (const chave of Object.keys(dados)) {
      if (!(chave in saida)) saida[chave] = structuredCloneSeguro(dados[chave]);
    }
    return saida as T;
  }
  if (Array.isArray(modelo)) {
    return (Array.isArray(dados) ? structuredCloneSeguro(dados) : structuredCloneSeguro(modelo)) as T;
  }
  return structuredCloneSeguro(dados) as T;
}

export function structuredCloneSeguro<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

/** AAAA-MM-DD -> DD/MM/AAAA (valor inválido volta como veio). */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isValid() ? d.format('DD/MM/YYYY') : iso;
}

/** ISO com hora -> DD/MM/AAAA HH:mm. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isValid() ? d.format('DD/MM/YYYY HH:mm') : iso;
}
