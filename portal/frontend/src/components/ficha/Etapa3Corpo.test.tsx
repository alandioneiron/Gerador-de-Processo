import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Etapa3Corpo } from './Etapa3Corpo';
import { esqueletoVazio } from '../../domain/modelo';
import { ComEstado } from '../../test/utils';
import type { Etapa3, Status } from '../../api/types';

function montar(opcoes: { status?: Status; ajustar?: (e: Etapa3) => void; readOnly?: boolean } = {}) {
  const e3 = esqueletoVazio().etapa3;
  opcoes.ajustar?.(e3);
  let ultimo = { testes_tecnicos: e3.testes_tecnicos, testes_ccon: e3.testes_ccon };
  render(
    <ComEstado inicial={e3} readOnly={opcoes.readOnly}>
      {(v, set) => (
        <Etapa3Corpo
          valor={v}
          status={opcoes.status ?? 'instalacao_concluida'}
          onChange={(n) => {
            ultimo = n;
            set({ ...v, ...n });
          }}
        />
      )}
    </ComEstado>,
  );
  return { atual: () => ultimo };
}

describe('Etapa 3 a partir do esqueleto vazio', () => {
  it('mostra a faixa, o aviso do docx e as seções 3.1 a 3.3', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: /ETAPA 3 — TESTES E ATIVAÇÃO/ })).toBeInTheDocument();
    expect(screen.getByText('Responsável: EQUIPE TÉCNICA + CCON')).toBeInTheDocument();
    expect(screen.getAllByRole('note')[0]).toHaveTextContent('INSTALAÇÃO CONCLUÍDA NÃO SIGNIFICA MONITORAMENTO ATIVO');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '3.1Testes Técnicos',
      '3.2Testes com a CCON',
      '3.3Validação da CCON',
    ]);
  });

  it('3.1 tem 12 itens e 3.2 tem 13, em 2 colunas', () => {
    montar();
    const g1 = screen.getByRole('group', { name: 'Testes técnicos' });
    const g2 = screen.getByRole('group', { name: 'Testes com a CCON' });
    expect(g1).toHaveClass('col-2');
    expect(g2).toHaveClass('col-2');
    expect(within(g1).getAllByRole('checkbox')).toHaveLength(12);
    expect(within(g2).getAllByRole('checkbox')).toHaveLength(13);
    // ordem de leitura do docx: linha a linha
    expect(within(g1).getAllByRole('checkbox').slice(0, 4).map((c) => c.closest('label')?.textContent)).toEqual([
      'Central energizada corretamente',
      'Arme testado',
      'Bateria instalada e testada',
      'Desarme testado',
    ]);
  });

  it('marcar um teste emite só testes_tecnicos / testes_ccon', async () => {
    const { atual } = montar();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Arme testado' }));
    expect(atual().testes_tecnicos.arme).toBe(true);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Evento de arme recebido' }));
    expect(atual().testes_ccon.evento_arme).toBe(true);
    expect(Object.keys(atual()).sort()).toEqual(['testes_ccon', 'testes_tecnicos']);
  });

  it('3.3 é só leitura (a validação só muda pela ação "Validar CCON")', () => {
    montar({
      status: 'ativo_monitorado',
      ajustar: (e) => {
        e.validacao_ccon = {
          operador: 'Operador Teste',
          data: '2026-10-09',
          hora: '14:30',
          cadastro: 'ok',
          comunicacao: 'ok',
          eventos: 'ok',
          contatos: 'ok',
          regras_operacionais: 'ok',
          resultado: 'aprovado',
          observacoes: 'Tudo certo',
        };
      },
    });
    expect(screen.getByLabelText('OPERADOR CCON')).toHaveValue('Operador Teste');
    expect(screen.getByLabelText('OPERADOR CCON')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('DATA')).toHaveValue('2026-10-09');
    expect(screen.getByLabelText('HORA')).toHaveValue('14:30');
    const cadastro = screen.getByRole('radiogroup', { name: 'Cadastro' });
    expect(within(cadastro).getByRole('radio', { name: 'OK' })).toBeChecked();
    expect(within(cadastro).getByRole('radio', { name: 'OK' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'APROVADO PARA ATIVAÇÃO' })).toBeChecked();
    expect(screen.getByLabelText('Observações da validação')).toHaveValue('Tudo certo');
  });

  it('o bloco de status marca só o status atual e traz o aviso do docx', () => {
    montar({ status: 'aguardando_testes_ccon' });
    const bloco = screen.getByRole('group', { name: 'Status da implantação' });
    const marcados = within(bloco)
      .getAllByRole('checkbox')
      .filter((c) => (c as HTMLInputElement).checked)
      .map((c) => c.closest('label')?.textContent);
    expect(marcados).toEqual(['Aguardando testes com a CCON']);
    expect(within(bloco).getAllByRole('checkbox')).toHaveLength(8);
    expect(screen.getByText(/somente poderá ser utilizado após aprovação da CCON no item 3.3/)).toBeInTheDocument();
  });

  it('somente leitura trava os testes', () => {
    montar({ readOnly: true });
    expect(screen.getByRole('checkbox', { name: 'Arme testado' })).toBeDisabled();
  });
});
