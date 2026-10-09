import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Etapa2Corpo, proximaZona } from './Etapa2Corpo';
import { esqueletoVazio } from '../../domain/modelo';
import { ComEstado } from '../../test/utils';
import type { DadosFicha, Etapa2 } from '../../api/types';

function montar(ajustar?: (d: DadosFicha) => void, opcoes: { readOnly?: boolean } = {}) {
  const dados = esqueletoVazio();
  ajustar?.(dados);
  let ultimo: Etapa2 = dados.etapa2;
  render(
    <ComEstado inicial={dados.etapa2} readOnly={opcoes.readOnly}>
      {(v, set) => (
        <Etapa2Corpo
          valor={v}
          etapa1={dados.etapa1}
          onChange={(n) => {
            ultimo = n;
            set(n);
          }}
        />
      )}
    </ComEstado>,
  );
  return { atual: () => ultimo };
}

const radiosDe = (nome: RegExp | string) =>
  within(screen.getByRole('radiogroup', { name: nome }))
    .getAllByRole('radio')
    .map((r) => r.closest('label')?.textContent);

describe('Etapa 2 a partir do esqueleto vazio', () => {
  it('mostra a faixa e as seções 2.1 a 2.6', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: /ETAPA 2 — INSTALAÇÃO E CONFIGURAÇÃO/ })).toBeInTheDocument();
    expect(screen.getByText('Responsável: EQUIPE TÉCNICA')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '2.1Identificação dos Equipamentos',
      '2.2Comunicação',
      '2.3Mapa de Zonas',
      '2.4Partições',
      '2.5Usuários — Configuração Concluída',
      '2.6Configurações Adicionais',
    ]);
  });

  it('2.1 oferece os 5 modelos do docx', () => {
    montar();
    expect(radiosDe('Modelo da central')).toEqual([
      'AMT 2018 E',
      'AMT 2018 EG',
      'AMT 2118 EG',
      'AMT 2018 E3G',
      'Outro:',
    ]);
  });

  it('2.3 começa em Z01..Z10 e acrescenta Z11', async () => {
    const { atual } = montar();
    const tabela = screen.getByRole('table', { name: 'Mapa de zonas' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(1 + 10);
    expect(within(tabela).getByText('Z01')).toBeInTheDocument();
    expect(within(tabela).getByText('Z10')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Adicionar linha em Mapa de zonas/ }));
    expect(within(tabela).getByText('Z11')).toBeInTheDocument();
    expect(atual().zonas.at(-1)?.zona).toBe('Z11');
  });

  it('proximaZona continua depois da maior zona existente', () => {
    const zonas = esqueletoVazio().etapa2.zonas.filter((z) => z.zona !== 'Z10');
    expect(proximaZona(zonas).zona).toBe('Z10');
    expect(proximaZona([]).zona).toBe('Z01');
  });

  it('2.3 tem as colunas do docx', () => {
    montar();
    const cab = within(screen.getByRole('table', { name: 'Mapa de zonas' }))
      .getAllByRole('columnheader')
      .map((c) => c.textContent)
      .filter(Boolean);
    expect(cab).toEqual(['Zona', 'Ambiente', 'Dispositivo', 'Tipo / Comportamento', 'Área / Partição', 'Testado', 'Observação']);
  });

  it('2.6 tem os 8 itens em 2 colunas', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Configurações adicionais' });
    expect(grupo).toHaveClass('col-2');
    expect(within(grupo).getAllByRole('checkbox')).toHaveLength(8);
  });
});

describe('Etapa 2 — opções de comunicação por modelo', () => {
  it('sem modelo escolhido mostra todas as opções', () => {
    montar();
    expect(radiosDe('Comunicação principal')).toEqual(['Ethernet/IP', 'GPRS', '3G', 'Outra:']);
  });

  it('AMT 2018 E: só Ethernet/IP e Outra', async () => {
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'AMT 2018 E' }));
    expect(radiosDe('Comunicação principal')).toEqual(['Ethernet/IP', 'Outra:']);
    expect(radiosDe('Comunicação de contingência')).toEqual(['Não possui', 'Ethernet/IP', 'Outra:']);
  });

  it('AMT 2018 EG e AMT 2118 EG: Ethernet e GPRS', async () => {
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'AMT 2018 EG' }));
    expect(radiosDe('Comunicação principal')).toEqual(['Ethernet/IP', 'GPRS', 'Outra:']);
    await userEvent.click(screen.getByRole('radio', { name: 'AMT 2118 EG' }));
    expect(radiosDe('Comunicação principal')).toEqual(['Ethernet/IP', 'GPRS', 'Outra:']);
    expect(radiosDe('Comunicação de contingência')).toEqual(['Não possui', 'GPRS', 'Ethernet/IP', 'Outra:']);
  });

  it('AMT 2018 E3G: Ethernet e 3G', async () => {
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'AMT 2018 E3G' }));
    expect(radiosDe('Comunicação principal')).toEqual(['Ethernet/IP', '3G', 'Outra:']);
  });

  it('trocar para um modelo sem GPRS limpa a escolha que deixou de existir', async () => {
    const { atual } = montar();
    await userEvent.click(screen.getByRole('radio', { name: 'AMT 2018 EG' }));
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Comunicação principal' })).getByRole('radio', { name: 'GPRS' }));
    expect(atual().comunicacao.principal).toBe('gprs');
    await userEvent.click(screen.getByRole('radio', { name: 'AMT 2018 E' }));
    expect(atual().comunicacao.principal).toBe('');
    expect(atual().equipamentos.modelo_central).toBe('AMT 2018 E');
  });

  it('"Outro" modelo e "Outra" comunicação só habilitam o texto quando escolhidos', async () => {
    montar();
    const outroModelo = screen.getByLabelText('Outro modelo de central');
    expect(outroModelo).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Outro:' }));
    expect(outroModelo).toBeEnabled();

    const outraPrincipal = screen.getByLabelText('Outra comunicação principal');
    expect(outraPrincipal).toBeDisabled();
    const principal = screen.getByRole('radiogroup', { name: 'Comunicação principal' });
    await userEvent.click(within(principal).getByRole('radio', { name: 'Outra:' }));
    expect(outraPrincipal).toBeEnabled();
  });

  it('"Outro" da 2.6 só habilita o texto com o checkbox marcado', async () => {
    montar();
    const texto = screen.getByLabelText('Outra configuração');
    expect(texto).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Outro:' }));
    expect(texto).toBeEnabled();
  });
});

describe('Etapa 2 — tabela de partições (2.4) e usuários (2.5)', () => {
  it('2.4 não aparece quando a 1.4 não é SIM', () => {
    montar();
    expect(screen.queryByRole('table', { name: 'Partições' })).toBeNull();
    expect(screen.getByTestId('particoes-nao-se-aplica')).toBeInTheDocument();
  });

  it('2.4 aparece com as linhas A, B e Comum quando a 1.4 = SIM', () => {
    montar((d) => {
      d.etapa1.areas_independentes.possui = 'sim';
    });
    const tabela = screen.getByRole('table', { name: 'Partições' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(1 + 3);
    expect(within(tabela).getByText('A')).toBeInTheDocument();
    expect(within(tabela).getByText('B')).toBeInTheDocument();
    expect(within(tabela).getByText('Comum')).toBeInTheDocument();
    expect(screen.queryByTestId('particoes-nao-se-aplica')).toBeNull();
    // tabela fixa: sem adicionar/remover
    expect(screen.queryByRole('button', { name: /Adicionar linha em Partições/ })).toBeNull();
  });

  it('2.5 mostra a lista da 1.3 (somente leitura) sem pedir para redigitar', () => {
    montar((d) => {
      d.etapa1.usuarios[0] = { ...d.etapa1.usuarios[0], nome: 'Ana Exemplo', funcao: 'Gerente', usa_app: 'sim', email_app: 'ana@exemplo.invalid', permissao: 'arma_desarma', particao: 'A' };
      d.etapa1.usuarios[1] = { ...d.etapa1.usuarios[1], nome: 'Beto Exemplo', usa_app: 'nao', permissao: 'so_arma' };
    });
    const tabela = screen.getByRole('table', { name: 'Usuários cadastrados na ficha (1.3)' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(1 + 2);
    expect(within(tabela).getByText('Ana Exemplo')).toBeInTheDocument();
    expect(within(tabela).getByText('ana@exemplo.invalid')).toBeInTheDocument();
    expect(within(tabela).getByText('Arma/Desarma')).toBeInTheDocument();
    expect(within(tabela).getByText('Só arma')).toBeInTheDocument();
    expect(within(tabela).queryAllByRole('textbox')).toHaveLength(0);
    expect(radiosDe(/Usuários da Tabela 1.3/)).toEqual(['SIM', 'NÃO']);
  });

  it('2.5 sem usuários na 1.3 avisa em vez de mostrar tabela vazia', () => {
    montar();
    expect(screen.getByText(/Nenhum usuário informado na Etapa 1/)).toBeInTheDocument();
  });

  it('confirmar na 2.5 atualiza usuarios_config', async () => {
    const { atual } = montar();
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: /Usuários da Tabela 1.3/ })).getByRole('radio', { name: 'SIM' }),
    );
    expect(atual().usuarios_config.confirmado).toBe('sim');
  });
});

describe('Etapa 2 — somente leitura', () => {
  it('trava os campos e remove os botões', () => {
    montar(undefined, { readOnly: true });
    expect(screen.getByLabelText('NÚMERO DE SÉRIE')).toHaveAttribute('readonly');
    expect(screen.getByRole('radio', { name: 'AMT 2018 E' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Adicionar linha/ })).toBeNull();
  });
});
