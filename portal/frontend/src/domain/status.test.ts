import { describe, expect, it } from 'vitest';
import { STATUS_LISTA, type Status } from '../api/types';
import { esqueletoVazio } from './modelo';
import {
  ACAO_DA_ETAPA,
  abaPadrao,
  acaoPermitidaNoStatus,
  estadoAcaoComTrava,
  etapaAtualIndice,
  mensagemEnvioOk,
  motivoSomenteLeitura,
  podeEditar,
  rotuloEvento,
  rotuloStatus,
  type SecaoEscrita,
} from './status';

const editaveis = (secao: SecaoEscrita): Status[] => STATUS_LISTA.filter((s) => podeEditar(s, secao));

describe('somente leitura por status (ESPEC seção 3)', () => {
  it('etapa 1: só em cadastro em preenchimento e pendência cadastral', () => {
    expect(editaveis('etapa1')).toEqual(['cadastro_em_preenchimento', 'pendencia_cadastral']);
  });

  it('etapa 2: liberado, em instalação e pendência técnica', () => {
    expect(editaveis('etapa2')).toEqual(['liberado_para_instalacao', 'em_instalacao', 'pendencia_tecnica']);
  });

  it('etapa 3 (testes): instalação concluída e aguardando testes', () => {
    expect(editaveis('etapa3')).toEqual(['instalacao_concluida', 'aguardando_testes_ccon']);
  });

  it('pendências: qualquer status, exceto ATIVO / MONITORADO', () => {
    expect(editaveis('pendencias')).toHaveLength(STATUS_LISTA.length - 1);
    expect(podeEditar('ativo_monitorado', 'pendencias')).toBe(false);
  });

  it('ATIVO / MONITORADO é somente leitura em tudo', () => {
    for (const s of ['etapa1', 'etapa2', 'etapa3', 'pendencias'] as const) {
      expect(podeEditar('ativo_monitorado', s)).toBe(false);
    }
  });

  it('o motivo é exibido só quando está bloqueado e cita o status atual', () => {
    expect(motivoSomenteLeitura('cadastro_em_preenchimento', 'etapa1')).toBeNull();
    const m = motivoSomenteLeitura('liberado_para_instalacao', 'etapa1');
    expect(m).toContain('Somente leitura');
    expect(m).toContain('Liberado para instalação');
    expect(motivoSomenteLeitura('cadastro_em_preenchimento', 'etapa2')).toContain('depois que a ficha for liberada');
    expect(motivoSomenteLeitura('em_instalacao', 'etapa3')).toContain('instalação for concluída');
    expect(motivoSomenteLeitura('ativo_monitorado', 'etapa3')).toContain('ATIVO / MONITORADO');
    expect(motivoSomenteLeitura('em_instalacao', 'pendencias')).toBeNull();
  });
});

describe('ações e travas', () => {
  it('cada ação só existe nos status de origem', () => {
    expect(acaoPermitidaNoStatus('cadastro_em_preenchimento', 'liberar-instalacao')).toBe(true);
    expect(acaoPermitidaNoStatus('pendencia_cadastral', 'liberar-instalacao')).toBe(true);
    expect(acaoPermitidaNoStatus('em_instalacao', 'liberar-instalacao')).toBe(false);
    expect(acaoPermitidaNoStatus('em_instalacao', 'concluir-instalacao')).toBe(true);
    expect(acaoPermitidaNoStatus('liberado_para_instalacao', 'concluir-instalacao')).toBe(false);
    expect(acaoPermitidaNoStatus('aguardando_testes_ccon', 'validar-ccon')).toBe(true);
    expect(acaoPermitidaNoStatus('instalacao_concluida', 'validar-ccon')).toBe(false);
    expect(acaoPermitidaNoStatus('ativo_monitorado', 'registrar-pendencia')).toBe(false);
    expect(acaoPermitidaNoStatus('em_instalacao', 'registrar-pendencia')).toBe(true);
    expect(acaoPermitidaNoStatus('pendencia_tecnica', 'retomar')).toBe(true);
    expect(acaoPermitidaNoStatus('em_instalacao', 'retomar')).toBe(false);
  });

  it('"Enviar por e-mail" vale em qualquer status, inclusive ATIVO / MONITORADO', () => {
    for (const s of STATUS_LISTA) expect(acaoPermitidaNoStatus(s, 'enviar-email')).toBe(true);
  });

  it('o aviso de envio cita os 3 destinatários', () => {
    expect(mensagemEnvioOk()).toBe(
      'Ficha enviada para ti@neoguard.com.br, suporte@neoguard.com.br e aux.ti@neoguard.com.br.',
    );
  });

  it('a ação de cada etapa é a do rodapé correspondente', () => {
    expect(ACAO_DA_ETAPA).toEqual({
      etapa1: 'liberar-instalacao',
      etapa2: 'concluir-instalacao',
      etapa3: 'validar-ccon',
    });
  });

  it('botão desabilitado enquanto houver faltas', () => {
    const e = estadoAcaoComTrava('cadastro_em_preenchimento', 'liberar-instalacao', ['Telefone do cliente'], false);
    expect(e).toMatchObject({ visivel: true, habilitada: false, faltas: ['Telefone do cliente'] });
  });

  it('botão habilitado quando não há faltas e nada por salvar', () => {
    const e = estadoAcaoComTrava('em_instalacao', 'concluir-instalacao', [], false);
    expect(e).toMatchObject({ visivel: true, habilitada: true, motivo: null });
  });

  it('alterações não salvas bloqueiam a ação, com motivo', () => {
    const e = estadoAcaoComTrava('aguardando_testes_ccon', 'validar-ccon', [], true);
    expect(e.habilitada).toBe(false);
    expect(e.motivo).toMatch(/Salve/);
  });

  it('fora do status de origem o botão nem aparece', () => {
    expect(estadoAcaoComTrava('liberado_para_instalacao', 'concluir-instalacao', [], false).visivel).toBe(false);
  });
});

describe('faixa de etapas e abas', () => {
  it('marca a etapa atual da faixa conforme o status', () => {
    const idx = (s: Status) => etapaAtualIndice(s);
    expect(idx('cadastro_em_preenchimento')).toBe(1);
    expect(idx('pendencia_cadastral')).toBe(1);
    expect(idx('liberado_para_instalacao')).toBe(2);
    expect(idx('em_instalacao')).toBe(2);
    expect(idx('pendencia_tecnica')).toBe(2);
    expect(idx('instalacao_concluida')).toBe(3);
    expect(idx('aguardando_testes_ccon')).toBe(4);
    expect(idx('ativo_monitorado')).toBe(5);
  });

  it('pendência técnica depois de reprovação da CCON volta para "validação"', () => {
    const d = esqueletoVazio();
    d.etapa3.validacao_ccon.resultado = 'reprovado';
    expect(etapaAtualIndice('pendencia_tecnica', d)).toBe(4);
  });

  it('abre a aba da etapa onde a ficha está', () => {
    expect(abaPadrao('cadastro_em_preenchimento')).toBe('etapa1');
    expect(abaPadrao('em_instalacao')).toBe('etapa2');
    expect(abaPadrao('aguardando_testes_ccon')).toBe('etapa3');
    expect(abaPadrao('ativo_monitorado')).toBe('etapa3');
  });
});

describe('rótulos', () => {
  it('status', () => {
    expect(rotuloStatus('ativo_monitorado')).toBe('ATIVO / MONITORADO');
    expect(rotuloStatus('aguardando_testes_ccon')).toBe('Aguardando testes com a CCON');
    expect(rotuloStatus('desconhecido')).toBe('desconhecido');
  });
  it('eventos aceitam hífen ou sublinhado', () => {
    expect(rotuloEvento('liberar-instalacao')).toBe('Liberada para instalação');
    expect(rotuloEvento('liberar_instalacao')).toBe('Liberada para instalação');
    expect(rotuloEvento('salvou_etapa2')).toBe('Etapa 2 salva');
    expect(rotuloEvento('enviou_email')).toBe('Enviou a ficha por e-mail');
    expect(rotuloEvento('enviar-email')).toBe('Enviou a ficha por e-mail');
    expect(rotuloEvento('outra_coisa')).toBe('outra_coisa');
  });
});
