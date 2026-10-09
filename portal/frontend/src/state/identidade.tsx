// Identificação de quem preenche (Fase 1, sem login): nome + e-mail guardados no navegador.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Form, Input, Modal } from 'antd';
import type { Autor } from '../api';
import { validarAutor } from '../domain/payload';

const CHAVE = 'portal.autor';

export function lerAutorSalvo(): Autor | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const a = JSON.parse(bruto) as Partial<Autor>;
    if (a && typeof a.nome === 'string' && typeof a.email === 'string' && a.nome.trim() && a.email.trim()) {
      return { nome: a.nome, email: a.email };
    }
  } catch {
    /* sem localStorage ou JSON inválido */
  }
  return null;
}

function gravarAutor(autor: Autor | null) {
  try {
    if (autor) window.localStorage.setItem(CHAVE, JSON.stringify(autor));
    else window.localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}

interface IdentidadeCtx {
  autor: Autor | null;
  /** Devolve o autor salvo ou abre o modal "Quem está preenchendo?"; `null` se o usuário cancelar. */
  garantirAutor: () => Promise<Autor | null>;
  /** Abre o modal para trocar a identificação. */
  trocarAutor: () => Promise<Autor | null>;
}

const Contexto = createContext<IdentidadeCtx | null>(null);

export function useIdentidade(): IdentidadeCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useIdentidade precisa do <IdentidadeProvider>.');
  return ctx;
}

export function IdentidadeProvider({ children }: { children: ReactNode }) {
  const [autor, setAutor] = useState<Autor | null>(() => lerAutorSalvo());
  const [aberto, setAberto] = useState(false);
  const resolvedor = useRef<((a: Autor | null) => void) | null>(null);
  const autorRef = useRef(autor);
  autorRef.current = autor;

  const abrir = useCallback((): Promise<Autor | null> => {
    resolvedor.current?.(null);
    setAberto(true);
    return new Promise((resolve) => {
      resolvedor.current = resolve;
    });
  }, []);

  const garantirAutor = useCallback(async () => {
    if (autorRef.current) return autorRef.current;
    return abrir();
  }, [abrir]);

  const fechar = (resultado: Autor | null) => {
    setAberto(false);
    resolvedor.current?.(resultado);
    resolvedor.current = null;
  };

  const salvar = (novo: Autor) => {
    const limpo = { nome: novo.nome.trim(), email: novo.email.trim() };
    gravarAutor(limpo);
    setAutor(limpo);
    autorRef.current = limpo;
    fechar(limpo);
  };

  const valor = useMemo<IdentidadeCtx>(
    () => ({ autor, garantirAutor, trocarAutor: abrir }),
    [autor, garantirAutor, abrir],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aberto && <ModalIdentidade inicial={autor} onSalvar={salvar} onCancelar={() => fechar(null)} />}
    </Contexto.Provider>
  );
}

function ModalIdentidade({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial: Autor | null;
  onSalvar: (a: Autor) => void;
  onCancelar: () => void;
}) {
  const [form] = Form.useForm<Autor>();

  const confirmar = async () => {
    const valores = form.getFieldsValue();
    const erros = validarAutor(valores);
    form.setFields([
      { name: 'nome', errors: erros.nome ? [erros.nome] : [] },
      { name: 'email', errors: erros.email ? [erros.email] : [] },
    ]);
    if (erros.nome || erros.email) return;
    onSalvar({ nome: valores.nome, email: valores.email });
  };

  return (
    <Modal
      open
      title="Quem está preenchendo?"
      okText="Continuar"
      cancelText="Cancelar"
      onOk={confirmar}
      onCancel={onCancelar}
      maskClosable={false}
      destroyOnHidden
    >
      <p style={{ marginTop: 0 }}>
        Informe seu nome e e-mail. Eles ficam guardados neste navegador, aparecem no histórico da
        ficha e entram como resposta (Reply-To) nos e-mails de aviso.
      </p>
      <Form form={form} layout="vertical" initialValues={inicial ?? { nome: '', email: '' }} onFinish={confirmar}>
        <Form.Item name="nome" label="Nome">
          <Input autoFocus autoComplete="name" placeholder="Seu nome completo" />
        </Form.Item>
        <Form.Item name="email" label="E-mail">
          <Input type="email" autoComplete="email" placeholder="voce@neoguard.com.br" />
        </Form.Item>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
      </Form>
    </Modal>
  );
}
