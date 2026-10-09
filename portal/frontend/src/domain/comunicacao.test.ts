import { describe, expect, it } from 'vitest';
import {
  ajustarComunicacaoAoModelo,
  capacidadesDoModelo,
  opcoesContingencia,
  opcoesPrincipal,
} from './comunicacao';

const valores = <T extends { value: string }>(opcoes: T[]) => opcoes.map((o) => o.value);

describe('opções de comunicação por modelo da central', () => {
  it('AMT 2018 E: só Ethernet (e "Outra")', () => {
    expect(valores(opcoesPrincipal('AMT 2018 E'))).toEqual(['ethernet', 'outra']);
    expect(valores(opcoesContingencia('AMT 2018 E'))).toEqual(['nao_possui', 'ethernet', 'outra']);
  });

  it.each(['AMT 2018 EG', 'AMT 2118 EG'] as const)('%s: Ethernet e GPRS', (modelo) => {
    expect(valores(opcoesPrincipal(modelo))).toEqual(['ethernet', 'gprs', 'outra']);
    expect(valores(opcoesContingencia(modelo))).toEqual(['nao_possui', 'gprs', 'ethernet', 'outra']);
  });

  it('AMT 2018 E3G: Ethernet e 3G (sem GPRS)', () => {
    expect(valores(opcoesPrincipal('AMT 2018 E3G'))).toEqual(['ethernet', '3g', 'outra']);
    expect(valores(opcoesContingencia('AMT 2018 E3G'))).not.toContain('gprs');
  });

  it('"outro" e modelo ainda não escolhido: todas as opções', () => {
    for (const m of ['outro', ''] as const) {
      expect(valores(opcoesPrincipal(m))).toEqual(['ethernet', 'gprs', '3g', 'outra']);
      expect(valores(opcoesContingencia(m))).toEqual(['nao_possui', 'gprs', 'ethernet', 'outra']);
      expect(capacidadesDoModelo(m)).toEqual({ gprs: true, tresG: true });
    }
  });

  it('rótulos seguem o docx', () => {
    expect(opcoesPrincipal('outro').map((o) => o.label)).toEqual(['Ethernet/IP', 'GPRS', '3G', 'Outra']);
    expect(opcoesContingencia('outro').map((o) => o.label)).toEqual(['Não possui', 'GPRS', 'Ethernet/IP', 'Outra']);
  });
});

describe('ajustarComunicacaoAoModelo', () => {
  it('limpa o que o novo modelo não oferece', () => {
    const r = ajustarComunicacaoAoModelo('AMT 2018 E', 'gprs', 'gprs');
    expect(r).toEqual({ principal: '', contingencia: '', mudou: true });
  });

  it('mantém o que continua valendo', () => {
    const r = ajustarComunicacaoAoModelo('AMT 2018 EG', 'gprs', 'ethernet');
    expect(r).toEqual({ principal: 'gprs', contingencia: 'ethernet', mudou: false });
  });

  it('3G some ao trocar para um modelo EG', () => {
    expect(ajustarComunicacaoAoModelo('AMT 2118 EG', '3g', 'nao_possui').principal).toBe('');
  });
});
