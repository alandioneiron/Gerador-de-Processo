// Fluxo do editor contra o backend simulado (src/api/mock.ts), que respeita o contrato.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarMock } from '../api/mock';
import { renderRota, salvarAutorNoNavegador } from '../test/utils';

beforeEach(() => {
  vi.stubEnv('VITE_MOCK', '1');
  window.localStorage.clear();
  reiniciarMock();
});

const LIMITE = { timeout: 8000 };

async function abrir(caminho: string, comAutor = true) {
  if (comAutor) salvarAutorNoNavegador();
  const r = renderRota(caminho);
  await screen.findByRole('tablist', undefined, LIMITE);
  return r;
}

describe('Editor da ficha (status: Cadastro em preenchimento)', () => {
  it('mostra código, cliente, status, faixa de etapas e as 5 abas', async () => {
    await abrir('/fichas/1');
    expect(screen.getByText(/FI-\d{4}-0001/)).toBeInTheDocument();
    expect(screen.getAllByText('Padaria Exemplo Ltda').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cadastro em preenchimento').length).toBeGreaterThan(0);
    const abas = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(abas).toEqual([
      'Etapa 1 — Cadastro',
      'Etapa 2 — Instalação',
      'Etapa 3 — Testes e ativação',
      'Pendências',
      'Histórico',
    ]);
    const faixa = screen.getByRole('list', { name: 'Etapas do processo' });
    expect(within(faixa).getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      'VENDA FECHADA',
      'CADASTRO',
      'INSTALAÇÃO/CONFIGURAÇÃO',
      'TESTES',
      'VALIDAÇÃO CCON',
      'ATIVO/MONITORADO',
    ]);
    expect(within(faixa).getByText('CADASTRO')).toHaveAttribute('aria-current', 'step');
  });

  it('o aviso fixo de acesso provisório aparece no topo', async () => {
    await abrir('/fichas/1');
    expect(screen.getByRole('note').textContent).toBe(
      'Acesso provisório sem login — use só na rede da Neoguard',
    );
  });

  it('lista "Falta resolver antes de liberar a instalação" e mantém o botão desabilitado', async () => {
    await abrir('/fichas/1');
    const botao = await screen.findByRole('button', { name: 'Liberar para instalação' }, LIMITE);
    expect(botao).toBeDisabled();
    const faltas = await screen.findByTestId('faltas-liberar-instalacao', undefined, LIMITE);
    expect(screen.getByText('Falta resolver antes de liberar a instalação:')).toBeInTheDocument();
    expect(within(faltas).getByText(/Telefone do cliente/)).toBeInTheDocument();
    expect(within(faltas).getByText(/Ao menos 1 usuário com nome e permissão/)).toBeInTheDocument();
    // "Registrar pendência" sempre disponível fora de ATIVO
    expect(screen.getByRole('button', { name: 'Registrar pendência' })).toBeEnabled();
  });

  it('editar marca "Alterações não salvas" e Salvar grava (ficha com autor identificado)', async () => {
    await abrir('/fichas/1');
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    expect(salvar).toBeDisabled();
    await userEvent.type(screen.getByLabelText('TELEFONE'), '(00) 00000-0000');
    expect(await screen.findByText('● Alterações não salvas')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'alterações não salvas' })).toBeInTheDocument();
    expect(salvar).toBeEnabled();
    await userEvent.click(salvar);
    await waitFor(() => expect(screen.queryByText('● Alterações não salvas')).toBeNull(), LIMITE);
    expect(screen.getByLabelText('TELEFONE')).toHaveValue('(00) 00000-0000');
    // o histórico registra o salvamento
    await userEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
    expect(await screen.findByText('Etapa 1 salva')).toBeInTheDocument();
  });

  it('sem identificação salva, pede "Quem está preenchendo?" antes de gravar', async () => {
    await abrir('/fichas/1', false);
    await userEvent.type(screen.getByLabelText('TELEFONE'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Quem está preenchendo?' }, LIMITE);

    // nome e e-mail são obrigatórios
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    expect(await within(dialogo).findByText('Informe o seu nome.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Informe o seu e-mail.')).toBeInTheDocument();

    await userEvent.type(within(dialogo).getByLabelText('Nome'), 'Pessoa Teste');
    await userEvent.type(within(dialogo).getByLabelText('E-mail'), 'teste@exemplo.invalid');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(screen.queryByText('● Alterações não salvas')).toBeNull(), LIMITE);
    expect(JSON.parse(window.localStorage.getItem('portal.autor') ?? '{}')).toEqual({
      nome: 'Pessoa Teste',
      email: 'teste@exemplo.invalid',
    });
    expect(screen.getByText(/Preenchendo como/)).toHaveTextContent('Pessoa Teste');
  });

  it('cancelar o modal de identificação não grava nada', async () => {
    await abrir('/fichas/1', false);
    await userEvent.type(screen.getByLabelText('TELEFONE'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Quem está preenchendo?' }, LIMITE);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quem está preenchendo?' })).toBeNull());
    expect(screen.getByText('● Alterações não salvas')).toBeInTheDocument();
    expect(window.localStorage.getItem('portal.autor')).toBeNull();
  });

  it('Etapa 2 e 3 ficam somente leitura, com o motivo exibido', async () => {
    await abrir('/fichas/1');
    await userEvent.click(screen.getByRole('tab', { name: 'Etapa 2 — Instalação' }));
    const aviso = await screen.findByTestId('aviso-somente-leitura', undefined, LIMITE);
    expect(aviso).toHaveTextContent('só abre depois que a ficha for liberada para instalação');
    expect(screen.getByLabelText('NÚMERO DE SÉRIE')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();

    await userEvent.click(screen.getByRole('tab', { name: 'Etapa 3 — Testes e ativação' }));
    expect(await screen.findByTestId('aviso-somente-leitura')).toHaveTextContent('só abre quando a instalação for concluída');
    expect(screen.getByRole('checkbox', { name: 'Arme testado' })).toBeDisabled();
  });
});

describe('Editor da ficha em outros status', () => {
  it('Em instalação: Etapa 1 é somente leitura e a Etapa 2 editável; mostra o botão "Concluir instalação"', async () => {
    await abrir('/fichas/2?aba=etapa1');
    expect(await screen.findByTestId('aviso-somente-leitura', undefined, LIMITE)).toHaveTextContent('Somente leitura');
    expect(screen.getByLabelText('RAZÃO SOCIAL / NOME')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Liberar para instalação' })).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Etapa 2 — Instalação' }));
    await waitFor(() => expect(screen.queryByTestId('aviso-somente-leitura')).toBeNull());
    expect(screen.getByLabelText('NÚMERO DE SÉRIE')).not.toHaveAttribute('readonly');
    const concluir = await screen.findByRole('button', { name: 'Concluir instalação' });
    expect(concluir).toBeDisabled();
    const faltas = await screen.findByTestId('faltas-concluir-instalacao');
    expect(within(faltas).getByText(/Comunicação principal/)).toBeInTheDocument();
  });

  it('registrar pendência cadastral muda o status e "Retomar" volta ao cadastro', async () => {
    await abrir('/fichas/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar pendência' }, LIMITE));
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar pendência' });

    // descrição obrigatória
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pendência' }));
    expect(await within(dialogo).findByText('Descreva a pendência.')).toBeInTheDocument();

    await userEvent.type(within(dialogo).getByLabelText(/Descrição/), 'Falta o CNPJ do cliente');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pendência' }));

    await screen.findByText('Ficha com pendência cadastral', undefined, LIMITE);
    expect(screen.getAllByText('Pendência cadastral').length).toBeGreaterThan(0);
    expect(screen.getByText(/Falta o CNPJ do cliente/)).toBeInTheDocument();

    // a pendência entrou na lista da aba Pendências
    await userEvent.click(screen.getByRole('tab', { name: 'Pendências' }));
    expect(await screen.findByDisplayValue('Falta o CNPJ do cliente')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Retomar' })[0]);
    await waitFor(() => expect(screen.queryByText('Ficha com pendência cadastral')).toBeNull(), LIMITE);
    expect(screen.getAllByText('Cadastro em preenchimento').length).toBeGreaterThan(0);
  });

  it('ATIVO / MONITORADO fica somente leitura em tudo e sem "Registrar pendência"', async () => {
    // leva a ficha 3 até o fim pelo próprio fluxo da tela
    await abrir('/fichas/3?aba=etapa3');
    const grupo = await screen.findByRole('group', { name: 'Testes com a CCON' }, LIMITE);
    for (const c of within(grupo).getAllByRole('checkbox')) {
      if (!(c as HTMLInputElement).checked) await userEvent.click(c);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const validar = await screen.findByRole('button', { name: 'Validar CCON' }, LIMITE);
    await waitFor(() => expect(validar).toBeEnabled(), LIMITE);

    await userEvent.click(validar);
    const dialogo = await screen.findByRole('dialog', { name: /Validar CCON/ });

    // sem preencher, o modal aponta o que falta
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar validação' }));
    expect(await within(dialogo).findByText('Corrija antes de registrar')).toBeInTheDocument();
    expect(within(dialogo).getByText('Escolha o resultado (aprovado ou reprovado).')).toBeInTheDocument();

    for (const nome of ['Cadastro', 'Comunicação', 'Eventos', 'Contatos', 'Regras operacionais']) {
      const g = within(dialogo).getByRole('radiogroup', { name: `${nome}:` });
      await userEvent.click(within(g).getByRole('radio', { name: 'OK' }));
    }
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'APROVADO PARA ATIVAÇÃO' }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar validação' }));

    await screen.findByText(/a ficha está concluída e somente leitura/, undefined, LIMITE);
    expect(screen.getAllByText('ATIVO / MONITORADO').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Registrar pendência' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Validar CCON' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Arme testado' })).toBeDisabled();
    // a validação registrada aparece na 3.3
    expect(screen.getByLabelText('OPERADOR CCON')).toHaveValue('Pessoa Teste');
    expect(screen.getByRole('radio', { name: 'APROVADO PARA ATIVAÇÃO' })).toBeChecked();
  }, 60000);
});

describe('Conflitos', () => {
  it('versão desatualizada (409): avisa e oferece recarregar', async () => {
    await abrir('/fichas/1');
    await userEvent.type(screen.getByLabelText('TELEFONE'), '1');

    // outra pessoa salva a mesma ficha antes
    const { apiMock } = await import('../api/mock');
    const atual = await apiMock.obterFicha(1);
    await apiMock.salvarEtapa1(1, {
      autor: { nome: 'Outra Pessoa', email: 'outra@exemplo.invalid' },
      versao: atual.versao,
      etapa1: atual.dados.etapa1,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'A ficha foi alterada por outra pessoa' }, LIMITE);
    expect(dialogo).toHaveTextContent('Recarregue');
    expect(within(dialogo).getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Continuar editando' })).toBeInTheDocument();

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Recarregar' }));
    await waitFor(() => expect(screen.queryByText('● Alterações não salvas')).toBeNull(), LIMITE);
    expect(screen.getByLabelText('TELEFONE')).toHaveValue('');
  });
});

describe('Enviar por e-mail', () => {
  const MENSAGEM_OK =
    'Ficha enviada para ti@neoguard.com.br, suporte@neoguard.com.br e aux.ti@neoguard.com.br.';

  it('botão primário no topo (qualquer status) e no rodapé da Etapa 1; envia e atualiza o histórico', async () => {
    await abrir('/fichas/1');
    // topo + rodapé da Etapa 1, ao lado de "Liberar para instalação"
    expect(screen.getAllByRole('button', { name: 'Enviar por e-mail' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Liberar para instalação' })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar por e-mail' })[0]);
    const dialogo = await screen.findByRole('dialog', { name: 'Enviar ficha por e-mail' });
    expect(dialogo).toHaveTextContent('As respostas a este e-mail irão para teste@exemplo.invalid.');
    expect(within(dialogo).getAllByRole('listitem')).toHaveLength(3);

    await userEvent.type(within(dialogo).getByLabelText('Mensagem (opcional)'), 'Urgente');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText(MENSAGEM_OK)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Enviar ficha por e-mail' })).toBeNull());

    // o status não muda e o histórico ganha o evento
    expect(screen.getAllByText('Cadastro em preenchimento').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
    expect(await screen.findByText('Enviou a ficha por e-mail')).toBeInTheDocument();
  });

  it('em outras abas e em ATIVO o botão do topo continua disponível, sem o do rodapé', async () => {
    await abrir('/fichas/2?aba=etapa2');
    expect(await screen.findByRole('button', { name: 'Concluir instalação' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Enviar por e-mail' })).toHaveLength(1);
  });

  it('com alterações não salvas, salva antes de abrir o modal', async () => {
    await abrir('/fichas/1');
    await userEvent.type(screen.getByLabelText('TELEFONE'), '(00) 00000-0000');
    expect(await screen.findByText('● Alterações não salvas')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar por e-mail' })[1]);
    const confirma = await screen.findByRole('dialog', { name: 'Salvar antes de enviar?' });
    await userEvent.click(within(confirma).getByRole('button', { name: 'Salvar e enviar' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Enviar ficha por e-mail' });
    expect(screen.queryByText('● Alterações não salvas')).toBeNull();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(MENSAGEM_OK)).toBeInTheDocument();

    // salvou a Etapa 1 e depois enviou
    await userEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
    expect(await screen.findByText('Enviou a ficha por e-mail')).toBeInTheDocument();
    expect(screen.getByText('Etapa 1 salva')).toBeInTheDocument();
  });

  it('erro 502 do envio mostra o motivo do backend e mantém o modal aberto', async () => {
    const { apiMock } = await import('../api/mock');
    const { ApiError } = await import('../api/client');
    const espiao = vi
      .spyOn(apiMock, 'executarAcao')
      .mockRejectedValueOnce(new ApiError(502, 'Não foi possível enviar o e-mail: servidor SMTP indisponível.'));

    await abrir('/fichas/1');
    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar por e-mail' })[0]);
    const dialogo = await screen.findByRole('dialog', { name: 'Enviar ficha por e-mail' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar' }));

    expect(
      await screen.findByText('Não foi possível enviar o e-mail: servidor SMTP indisponível.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Enviar ficha por e-mail' })).toBeInTheDocument();
    expect(screen.queryByText(MENSAGEM_OK)).toBeNull();

    // o corpo da ação não leva `versao` e a ação é "enviar-email"
    const [, acao, corpo] = espiao.mock.calls[0];
    expect(acao).toBe('enviar-email');
    expect(Object.keys(corpo as object)).toEqual(['autor']);
    espiao.mockRestore();
  });
});
