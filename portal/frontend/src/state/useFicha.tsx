// Estado do editor: ficha do servidor + rascunho local por seção, travas, salvar e ações.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App } from 'antd';
import {
  ApiError,
  api,
  type AcaoFicha,
  type DadosFicha,
  type Etapa1,
  type Etapa2,
  type Etapa3,
  type Ficha,
  type Pendencia,
  type Travas,
} from '../api';
import { esqueletoVazio } from '../domain/modelo';
import {
  montarCorpoEtapa1,
  montarCorpoEtapa2,
  montarCorpoEtapa3,
  montarCorpoPendencias,
  montarEtapa1,
  montarEtapa2,
  montarEtapa3,
  montarPendencias,
} from '../domain/payload';
import { mensagemEnvioOk, type SecaoEscrita } from '../domain/status';
import { iguais, mesclarModelo } from '../domain/util';
import { useIdentidade } from './identidade';

export interface Rascunho {
  etapa1: Etapa1;
  etapa2: Etapa2;
  etapa3: Pick<Etapa3, 'testes_tecnicos' | 'testes_ccon'>;
  pendencias: Pendencia[];
}

/** Copia os dados do servidor para o formato editável, completando chaves que faltem. */
export function rascunhoDe(dados: DadosFicha): Rascunho {
  const completo = mesclarModelo(esqueletoVazio(), dados);
  return {
    etapa1: completo.etapa1,
    etapa2: completo.etapa2,
    etapa3: {
      testes_tecnicos: completo.etapa3.testes_tecnicos,
      testes_ccon: completo.etapa3.testes_ccon,
    },
    pendencias: completo.pendencias,
  };
}

/** Quais seções têm alterações ainda não salvas (compara já com a normalização do payload). */
export function secoesSujas(base: Rascunho, rascunho: Rascunho): Record<SecaoEscrita, boolean> {
  return {
    etapa1: !iguais(montarEtapa1(rascunho.etapa1), montarEtapa1(base.etapa1)),
    etapa2: !iguais(montarEtapa2(rascunho.etapa2), montarEtapa2(base.etapa2)),
    etapa3: !iguais(montarEtapa3(rascunho.etapa3), montarEtapa3(base.etapa3)),
    pendencias: !iguais(montarPendencias(rascunho.pendencias), montarPendencias(base.pendencias)),
  };
}

const TODAS: SecaoEscrita[] = ['etapa1', 'etapa2', 'etapa3', 'pendencias'];

const ROTULO_SECAO: Record<SecaoEscrita, string> = {
  etapa1: 'Etapa 1',
  etapa2: 'Etapa 2',
  etapa3: 'Etapa 3',
  pendencias: 'Pendências',
};

function ListaFaltas({ itens }: { itens: string[] }): ReactNode {
  return (
    <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
      {itens.map((f) => (
        <li key={f}>{f}</li>
      ))}
    </ul>
  );
}

export function useFicha(id: string) {
  const { message, modal } = App.useApp();
  const { garantirAutor } = useIdentidade();

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [travas, setTravas] = useState<Travas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const idAtual = useRef(id);
  idAtual.current = id;
  // Cópias síncronas do estado: permitem salvar várias seções em sequência (a versão muda a cada save).
  const fichaRef = useRef<Ficha | null>(null);
  const rascunhoRef = useRef<Rascunho | null>(null);
  fichaRef.current = ficha;
  rascunhoRef.current = rascunho;

  const base = useMemo(() => (ficha ? rascunhoDe(ficha.dados) : null), [ficha]);
  const sujas = useMemo(
    () =>
      base && rascunho
        ? secoesSujas(base, rascunho)
        : { etapa1: false, etapa2: false, etapa3: false, pendencias: false },
    [base, rascunho],
  );
  const algumaSuja = TODAS.some((s) => sujas[s]);

  const atualizarTravas = useCallback(async () => {
    try {
      const t = await api.travas(idAtual.current);
      setTravas(t);
    } catch {
      setTravas(null);
    }
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [f, t] = await Promise.all([
        api.obterFicha(idAtual.current),
        api.travas(idAtual.current).catch(() => null),
      ]);
      fichaRef.current = f;
      rascunhoRef.current = rascunhoDe(f.dados);
      setFicha(f);
      setRascunho(rascunhoRef.current);
      setTravas(t);
    } catch (e) {
      setErro(e instanceof ApiError ? e : new ApiError(0, 'Não foi possível carregar a ficha.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [id, recarregar]);

  const tratarErro = useCallback(
    (e: unknown) => {
      if (!(e instanceof ApiError)) {
        void message.error('Algo deu errado. Tente de novo.');
        return;
      }
      if (e.conflitoDeVersao) {
        modal.confirm({
          title: 'A ficha foi alterada por outra pessoa',
          content: `${e.detail} Se recarregar agora, as alterações ainda não salvas desta tela serão descartadas.`,
          okText: 'Recarregar',
          cancelText: 'Continuar editando',
          onOk: () => recarregar(),
        });
      } else if (e.edicaoBloqueada) {
        modal.warning({
          title: 'Edição bloqueada',
          content: e.detail,
          okText: 'Recarregar a ficha',
          onOk: () => recarregar(),
        });
      } else if (e.temFaltas) {
        modal.warning({
          title: e.detail,
          content: (
            <>
              <div>Falta resolver:</div>
              <ListaFaltas itens={e.faltas} />
            </>
          ),
          okText: 'Entendi',
        });
        void atualizarTravas();
      } else {
        void message.error(e.detail);
      }
    },
    [message, modal, recarregar, atualizarTravas],
  );

  const aplicarResposta = useCallback((resp: Ficha, secoes: SecaoEscrita[]) => {
    const novo = rascunhoDe(resp.dados);
    const mantido: Rascunho = rascunhoRef.current ? { ...rascunhoRef.current } : novo;
    for (const s of secoes) (mantido as unknown as Record<string, unknown>)[s] = novo[s];
    fichaRef.current = resp;
    rascunhoRef.current = mantido;
    setFicha(resp);
    setRascunho(mantido);
  }, []);

  const salvar = useCallback(
    async (secao: SecaoEscrita): Promise<boolean> => {
      const ficha = fichaRef.current;
      const rascunho = rascunhoRef.current;
      if (!ficha || !rascunho) return false;
      const autor = await garantirAutor();
      if (!autor) return false;
      setOcupado(secao);
      try {
        let resp: Ficha;
        switch (secao) {
          case 'etapa1':
            resp = await api.salvarEtapa1(ficha.id, montarCorpoEtapa1(autor, ficha.versao, rascunho.etapa1));
            break;
          case 'etapa2':
            resp = await api.salvarEtapa2(ficha.id, montarCorpoEtapa2(autor, ficha.versao, rascunho.etapa2));
            break;
          case 'etapa3':
            resp = await api.salvarEtapa3(ficha.id, montarCorpoEtapa3(autor, ficha.versao, rascunho.etapa3));
            break;
          case 'pendencias':
            resp = await api.salvarPendencias(
              ficha.id,
              montarCorpoPendencias(autor, ficha.versao, rascunho.pendencias),
            );
            break;
        }
        aplicarResposta(resp, [secao]);
        void message.success(`${ROTULO_SECAO[secao]} salva.`);
        void atualizarTravas();
        return true;
      } catch (e) {
        tratarErro(e);
        return false;
      } finally {
        setOcupado(null);
      }
    },
    [garantirAutor, aplicarResposta, message, atualizarTravas, tratarErro],
  );

  const executarAcao = useCallback(
    async (
      acao: AcaoFicha,
      extras: Record<string, unknown> = {},
      mensagemOk?: string,
      /** Seções do rascunho que passam a refletir o servidor depois da ação. */
      secoes: SecaoEscrita[] = TODAS,
    ): Promise<boolean> => {
      if (!ficha) return false;
      const autor = await garantirAutor();
      if (!autor) return false;
      setOcupado(`acao:${acao}`);
      try {
        const resp = await api.executarAcao(ficha.id, acao, { autor, versao: ficha.versao, ...extras });
        aplicarResposta(resp, secoes);
        if (mensagemOk) void message.success(mensagemOk);
        void atualizarTravas();
        return true;
      } catch (e) {
        tratarErro(e);
        return false;
      } finally {
        setOcupado(null);
      }
    },
    [ficha, garantirAutor, aplicarResposta, message, atualizarTravas, tratarErro],
  );

  const alterarRascunho = useCallback((parcial: Partial<Rascunho>) => {
    if (!rascunhoRef.current) return;
    rascunhoRef.current = { ...rascunhoRef.current, ...parcial };
    setRascunho(rascunhoRef.current);
  }, []);
  const setEtapa1 = useCallback((v: Etapa1) => alterarRascunho({ etapa1: v }), [alterarRascunho]);
  const setEtapa2 = useCallback((v: Etapa2) => alterarRascunho({ etapa2: v }), [alterarRascunho]);
  const setEtapa3 = useCallback((v: Rascunho['etapa3']) => alterarRascunho({ etapa3: v }), [alterarRascunho]);
  const setPendencias = useCallback((v: Pendencia[]) => alterarRascunho({ pendencias: v }), [alterarRascunho]);

  /** Salva, em sequência, todas as seções com alterações. Para no primeiro erro. */
  const salvarPendentes = useCallback(async (): Promise<boolean> => {
    for (const secao of TODAS) {
      const f = fichaRef.current;
      const r = rascunhoRef.current;
      if (!f || !r) return false;
      if (secoesSujas(rascunhoDe(f.dados), r)[secao]) {
        const ok = await salvar(secao);
        if (!ok) return false;
      }
    }
    return true;
  }, [salvar]);

  /** "Enviar por e-mail": não muda o status nem exige `versao`; atualiza o histórico. */
  const enviarEmail = useCallback(
    async (mensagem: string): Promise<boolean> => {
      const f = fichaRef.current;
      if (!f) return false;
      const autor = await garantirAutor();
      if (!autor) return false;
      setOcupado('acao:enviar-email');
      try {
        const texto = mensagem.trim();
        const resp = await api.executarAcao(f.id, 'enviar-email', { autor, ...(texto ? { mensagem: texto } : {}) });
        aplicarResposta(resp, []);
        void message.success(mensagemEnvioOk());
        return true;
      } catch (e) {
        tratarErro(e);
        return false;
      } finally {
        setOcupado(null);
      }
    },
    [garantirAutor, aplicarResposta, message, tratarErro],
  );

  return {
    ficha,
    rascunho,
    travas,
    carregando,
    erro,
    ocupado,
    sujas,
    algumaSuja,
    setEtapa1,
    setEtapa2,
    setEtapa3,
    setPendencias,
    salvar,
    salvarPendentes,
    enviarEmail,
    executarAcao,
    recarregar,
  };
}
