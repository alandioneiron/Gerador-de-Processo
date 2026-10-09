import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalEnviarEmail, ModalRegistrarPendencia } from './ModaisAcao';

describe('Modal "Enviar ficha por e-mail"', () => {
  const montar = (extra: Partial<Parameters<typeof ModalEnviarEmail>[0]> = {}) => {
    const onEnviar = vi.fn();
    const onCancelar = vi.fn();
    render(
      <ModalEnviarEmail
        codigo="FI-2026-0007"
        cliente="Padaria Exemplo Ltda"
        emailRemetente="pessoa@exemplo.invalid"
        onEnviar={onEnviar}
        onCancelar={onCancelar}
        {...extra}
      />,
    );
    return { onEnviar, onCancelar, dialogo: screen.getByRole('dialog', { name: 'Enviar ficha por e-mail' }) };
  };

  it('mostra a ficha, os 3 destinatários (só leitura), o campo de mensagem e a nota do Reply-To', () => {
    const { dialogo } = montar();
    expect(within(dialogo).getByText('FI-2026-0007')).toBeInTheDocument();
    expect(within(dialogo).getByText(/Padaria Exemplo Ltda/)).toBeInTheDocument();
    const lista = within(dialogo).getByRole('list', { name: 'Destinatários' });
    expect(within(lista).getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      'ti@neoguard.com.br',
      'suporte@neoguard.com.br',
      'aux.ti@neoguard.com.br',
    ]);
    expect(within(dialogo).getByLabelText('Mensagem (opcional)')).toBeInTheDocument();
    expect(dialogo).toHaveTextContent('As respostas a este e-mail irão para pessoa@exemplo.invalid.');
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('Enviar entrega a mensagem digitada', async () => {
    const { onEnviar, dialogo } = montar();
    await userEvent.type(within(dialogo).getByLabelText('Mensagem (opcional)'), 'Cliente com urgência');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar' }));
    expect(onEnviar).toHaveBeenCalledTimes(1);
    expect(onEnviar).toHaveBeenCalledWith('Cliente com urgência');
  });

  it('a mensagem é opcional: Enviar sem texto também funciona', async () => {
    const { onEnviar, dialogo } = montar();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar' }));
    expect(onEnviar).toHaveBeenCalledWith('');
  });

  it('Cancelar não envia', async () => {
    const { onEnviar, onCancelar, dialogo } = montar();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalled();
    expect(onEnviar).not.toHaveBeenCalled();
  });
});

describe('Modal "Registrar pendência"', () => {
  it('descrição é obrigatória e o tipo padrão segue o status', async () => {
    const onConfirmar = vi.fn();
    render(<ModalRegistrarPendencia status="em_instalacao" onCancelar={() => {}} onConfirmar={onConfirmar} />);
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pendência' });
    expect(within(dialogo).getByRole('radio', { name: /Técnica/ })).toBeChecked();

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pendência' }));
    expect(await within(dialogo).findByText('Descreva a pendência.')).toBeInTheDocument();
    expect(onConfirmar).not.toHaveBeenCalled();

    await userEvent.type(within(dialogo).getByLabelText(/Descrição/), '  Falta o cabo de rede ');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pendência' }));
    expect(onConfirmar).toHaveBeenCalledWith({
      tipo: 'tecnica',
      descricao: '  Falta o cabo de rede ',
      responsavel: '',
      prazo: '',
    });
  });
});
