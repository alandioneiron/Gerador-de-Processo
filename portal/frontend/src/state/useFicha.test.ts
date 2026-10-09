import { describe, expect, it } from 'vitest';
import { esqueletoVazio } from '../domain/modelo';
import { rascunhoDe, secoesSujas } from './useFicha';

describe('rascunho e alterações não salvas', () => {
  it('um rascunho recém-criado não está sujo', () => {
    const base = rascunhoDe(esqueletoVazio());
    expect(secoesSujas(base, rascunhoDe(esqueletoVazio()))).toEqual({
      etapa1: false,
      etapa2: false,
      etapa3: false,
      pendencias: false,
    });
  });

  it('dados incompletos do servidor são completados sem marcar como alterados', () => {
    const base = rascunhoDe({ etapa1: { cliente: { razao_social: 'A' } } } as never);
    expect(base.etapa1.contatos).toHaveLength(5);
    expect(secoesSujas(base, structuredClone(base)).etapa1).toBe(false);
  });

  it('marca só a seção editada', () => {
    const base = rascunhoDe(esqueletoVazio());
    const r = structuredClone(base);
    r.etapa2.equipamentos.numero_serie = 'ABC';
    expect(secoesSujas(base, r)).toEqual({ etapa1: false, etapa2: true, etapa3: false, pendencias: false });
  });

  it('mudança só de espaços não conta como alteração', () => {
    const base = rascunhoDe(esqueletoVazio());
    const r = structuredClone(base);
    r.etapa1.cliente.razao_social = '   ';
    expect(secoesSujas(base, r).etapa1).toBe(false);
  });

  it('voltar ao valor original limpa a marca', () => {
    const base = rascunhoDe(esqueletoVazio());
    const r = structuredClone(base);
    r.pendencias[0].descricao = 'x';
    expect(secoesSujas(base, r).pendencias).toBe(true);
    r.pendencias[0].descricao = '';
    expect(secoesSujas(base, r).pendencias).toBe(false);
  });

  it('marcar um teste da etapa 3 sujou apenas a etapa 3', () => {
    const base = rascunhoDe(esqueletoVazio());
    const r = structuredClone(base);
    r.etapa3.testes_ccon.evento_arme = true;
    expect(secoesSujas(base, r)).toEqual({ etapa1: false, etapa2: false, etapa3: true, pendencias: false });
  });
});
