import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Etapa1Corpo } from './Etapa1Corpo';
import { esqueletoVazio } from '../../domain/modelo';
import { ComEstado } from '../../test/utils';
import type { Etapa1 } from '../../api/types';

function montar(opcoes: { inicial?: Etapa1; readOnly?: boolean; impressao?: boolean } = {}) {
  const inicial = opcoes.inicial ?? esqueletoVazio().etapa1;
  let ultimo: Etapa1 = inicial;
  render(
    <ComEstado inicial={inicial} readOnly={opcoes.readOnly} impressao={opcoes.impressao}>
      {(v, set) => (
        <Etapa1Corpo
          valor={v}
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

const linhasDe = (nome: string) => within(screen.getByRole('table', { name: nome })).getAllByRole('row');

describe('Etapa 1 a partir do esqueleto vazio', () => {
  it('mostra a faixa da etapa e as seções 1.1 a 1.8 com a numeração do docx', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: /ETAPA 1 — CADASTRO PARA IMPLANTAÇÃO/ })).toBeInTheDocument();
    expect(screen.getByText('Responsável: COMERCIAL + CLIENTE')).toBeInTheDocument();
    const esperados = [
      ['1.1', 'Identificação do Cliente'],
      ['1.2', 'Contatos para Ocorrência'],
      ['1.3', 'Usuários do Alarme'],
      ['1.4', 'Áreas Independentes'],
      ['1.5', 'Ambientes Protegidos'],
      ['1.6', 'Rotina do Estabelecimento'],
      ['1.7', 'Particularidades do Local'],
      ['1.8', 'Informações Operacionais para a CCON'],
    ];
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual(esperados.map(([n, t]) => `${n}${t}`));
  });

  it('1.1 tem os campos do docx em células com rótulo', () => {
    montar();
    for (const rotulo of [
      'RAZÃO SOCIAL / NOME',
      'NOME FANTASIA',
      'CPF / CNPJ',
      'RESPONSÁVEL PELO LOCAL',
      'TELEFONE',
      'ENDEREÇO COMPLETO DA INSTALAÇÃO',
      'E-MAIL',
      'VENDEDOR RESPONSÁVEL',
      'DATA PREVISTA DA INSTALAÇÃO',
      'Nº DA PROPOSTA',
      'Nº DO CONTRATO',
      'SERVIÇOS CONTRATADOS',
    ]) {
      expect(screen.getByLabelText(rotulo)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('DATA PREVISTA DA INSTALAÇÃO')).toHaveAttribute('type', 'date');
  });

  it('1.2, 1.3 e 1.5 começam com a quantidade de linhas do docx', () => {
    montar();
    expect(linhasDe('Contatos para ocorrência')).toHaveLength(1 + 5);
    expect(linhasDe('Usuários do alarme')).toHaveLength(1 + 8);
    expect(linhasDe('Ambientes protegidos')).toHaveLength(1 + 6);
  });

  it('colunas da 1.2 e 1.3 iguais às do docx', () => {
    montar();
    const cab = (nome: string) =>
      within(screen.getByRole('table', { name: nome }))
        .getAllByRole('columnheader')
        .map((c) => c.textContent?.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    expect(cab('Contatos para ocorrência')).toEqual([
      'Ord.',
      'Nome',
      'Função / Relação',
      'Tel. Principal',
      'Tel. Alternativo',
      'Decide?',
      'Restrições / Observações',
    ]);
    expect(cab('Usuários do alarme')).toEqual([
      'Nome',
      'Função',
      'Telefone',
      'Teclado',
      'Usa App?',
      'E-mail (se usa app)',
      'Permissão (Arma/Desarma/Só arma)',
      'Área / Partição',
      'Observações',
    ]);
    expect(cab('Ambientes protegidos')).toEqual(['Ambiente', 'Acesso / Local', 'Observação']);
  });

  it('1.7 tem os 14 checkboxes do docx, na ordem, em grade de 3 colunas', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Particularidades do local' });
    expect(grupo).toHaveClass('col-3');
    const rotulos = within(grupo)
      .getAllByRole('checkbox')
      .map((c) => c.closest('label')?.textContent);
    expect(rotulos).toEqual([
      'Animais',
      'Portaria 24h',
      'Gerador',
      'Nobreak',
      'Internet disponível',
      'Rede cabeada',
      'Wi-Fi',
      'CFTV',
      'Controle de acesso',
      'Cerca elétrica',
      'Automação',
      'Botão de pânico',
      'Neoguard Imagens',
      'Outros sistemas de segurança',
    ]);
  });

  it('1.8 não tem campo para o conteúdo da palavra de segurança', () => {
    montar();
    const grupo = screen.getByRole('radiogroup', { name: /palavra de segurança/i });
    expect(within(grupo).getAllByRole('radio')).toHaveLength(2);
    expect(grupo).toHaveTextContent('não preencher nesta ficha');
    expect(screen.queryByLabelText(/palavra.*seguran/i, { selector: 'input[type=text]' })).toBeNull();
  });

  it('digitar na 1.1 atualiza o rascunho', async () => {
    const { atual } = montar();
    await userEvent.type(screen.getByLabelText('RAZÃO SOCIAL / NOME'), 'Padaria Exemplo');
    expect(atual().cliente.razao_social).toBe('Padaria Exemplo');
  });
});

describe('Etapa 1 — campos condicionais', () => {
  it('e-mail da 1.3 só é habilitado com "Usa App?" = Sim', async () => {
    montar();
    const email = screen.getByLabelText('E-mail (se usa app) — linha 1');
    const usaApp = screen.getByLabelText('Usa App? — linha 1');
    expect(email).toBeDisabled();
    await userEvent.selectOptions(usaApp, 'sim');
    expect(email).toBeEnabled();
    await userEvent.type(email, 'ana@exemplo.invalid');
    await userEvent.selectOptions(usaApp, 'nao');
    expect(email).toBeDisabled();
  });

  it('nomes das áreas da 1.4 só são habilitados com SIM', async () => {
    montar();
    const grupo = screen.getByRole('radiogroup', { name: /Existem áreas/ });
    const area1 = screen.getByLabelText('Área 1');
    expect(area1).toBeDisabled();
    await userEvent.click(within(grupo).getByRole('radio', { name: 'NÃO' }));
    expect(area1).toBeDisabled();
    await userEvent.click(within(grupo).getByRole('radio', { name: 'SIM' }));
    expect(area1).toBeEnabled();
    expect(screen.getByLabelText('Área 2')).toBeEnabled();
    expect(screen.getByLabelText('Outras áreas')).toBeEnabled();
  });

  it('clicar de novo na opção marcada limpa a escolha', async () => {
    const { atual } = montar();
    const grupo = screen.getByRole('radiogroup', { name: /Existem áreas/ });
    const sim = within(grupo).getByRole('radio', { name: 'SIM' });
    await userEvent.click(sim);
    expect(atual().areas_independentes.possui).toBe('sim');
    await userEvent.click(sim);
    expect(atual().areas_independentes.possui).toBe('');
    expect(sim).not.toBeChecked();
  });
});

describe('Etapa 1 — tabelas editáveis', () => {
  it('"+ Adicionar linha" acrescenta uma linha e continua a numeração dos contatos', async () => {
    const { atual } = montar();
    await userEvent.click(screen.getByRole('button', { name: /Adicionar linha em Contatos para ocorrência/ }));
    expect(linhasDe('Contatos para ocorrência')).toHaveLength(1 + 6);
    expect(atual().contatos.at(-1)?.ordem).toBe(6);
  });

  it('remover uma linha renumera a ordem de acionamento', async () => {
    const { atual } = montar();
    const tabela = within(screen.getByRole('table', { name: 'Contatos para ocorrência' }));
    await userEvent.type(tabela.getByLabelText('Nome — linha 2'), 'Segundo');
    await userEvent.type(tabela.getByLabelText('Nome — linha 3'), 'Terceiro');
    await userEvent.click(screen.getByRole('button', { name: 'Remover linha 1 de Contatos para ocorrência' }));
    expect(atual().contatos).toHaveLength(4);
    expect(atual().contatos.map((c) => c.ordem)).toEqual([1, 2, 3, 4]);
    expect(atual().contatos[0].nome).toBe('Segundo');
    expect(atual().contatos[1].nome).toBe('Terceiro');
  });

  it('adicionar usuário e ambiente também funciona', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: /Adicionar linha em Usuários do alarme/ }));
    await userEvent.click(screen.getByRole('button', { name: /Adicionar linha em Ambientes protegidos/ }));
    expect(linhasDe('Usuários do alarme')).toHaveLength(1 + 9);
    expect(linhasDe('Ambientes protegidos')).toHaveLength(1 + 7);
  });
});

describe('Etapa 1 — somente leitura e impressão', () => {
  it('somente leitura: campos travados e sem botões de linha', () => {
    montar({ readOnly: true });
    expect(screen.getByLabelText('RAZÃO SOCIAL / NOME')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Usa App? — linha 1')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Adicionar linha/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remover linha/ })).toBeNull();
    const grupo = screen.getByRole('group', { name: 'Particularidades do local' });
    for (const c of within(grupo).getAllByRole('checkbox')) expect(c).toBeDisabled();
  });

  it('impressão: tudo vira texto, sem campos nem botões', () => {
    const e = esqueletoVazio().etapa1;
    e.cliente.razao_social = 'Padaria Exemplo';
    e.cliente.data_prevista = '2026-10-16';
    e.particularidades.cftv = true;
    montar({ inicial: e, impressao: true });
    expect(screen.getByText('Padaria Exemplo')).toBeInTheDocument();
    expect(screen.getByText('16/10/2026')).toBeInTheDocument();
    expect(screen.getByText('☒ CFTV')).toBeInTheDocument();
    expect(screen.getByText('☐ Animais')).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
