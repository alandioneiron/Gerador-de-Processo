import { describe, expect, it } from 'vitest';
import { esqueletoVazio } from './modelo';
import { formatarData, formatarDataHora, iguais, mesclarModelo } from './util';

describe('iguais', () => {
  it('ignora a ordem das chaves', () => {
    expect(iguais({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
  });
  it('detecta diferenças em listas e valores', () => {
    expect(iguais({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(iguais({ a: '' }, { a: ' ' })).toBe(false);
  });
});

describe('mesclarModelo', () => {
  it('completa chaves ausentes com o esqueleto e mantém o que veio do servidor', () => {
    const modelo = esqueletoVazio();
    const parcial = { etapa1: { cliente: { razao_social: 'ACME' } } };
    const r = mesclarModelo(modelo, parcial);
    expect(r.etapa1.cliente.razao_social).toBe('ACME');
    expect(r.etapa1.cliente.endereco).toBe('');
    expect(r.etapa1.contatos).toHaveLength(5);
    expect(r.etapa2.zonas).toHaveLength(10);
  });

  it('listas do servidor prevalecem (inclusive mais curtas)', () => {
    const r = mesclarModelo(esqueletoVazio(), {
      etapa1: { ambientes: [{ ambiente: 'A', acesso_local: '', observacao: '' }] },
    });
    expect(r.etapa1.ambientes).toHaveLength(1);
  });

  it('não altera o modelo original', () => {
    const modelo = esqueletoVazio();
    const r = mesclarModelo(modelo, { etapa1: { cliente: { razao_social: 'X' } } });
    r.etapa1.cliente.razao_social = 'Y';
    expect(modelo.etapa1.cliente.razao_social).toBe('');
  });
});

describe('formatação de datas', () => {
  it('ISO -> DD/MM/AAAA', () => {
    expect(formatarData('2026-10-09')).toBe('09/10/2026');
    expect(formatarData('')).toBe('');
    expect(formatarData(null)).toBe('');
  });
  it('data e hora', () => {
    expect(formatarDataHora('2026-10-09T15:30:00')).toBe('09/10/2026 15:30');
  });
});
