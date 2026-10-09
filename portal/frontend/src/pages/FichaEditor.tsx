// Editor da ficha: topo com a faixa de etapas, abas por etapa, somente leitura por status,
// ações com travas, aviso de alterações não salvas e histórico.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useBlocker, useParams, useSearchParams } from 'react-router-dom';
import { Alert, App, Button, Spin, Tabs, Timeline, Tooltip } from 'antd';
import type { AcaoComTrava, Evento, Status } from '../api';
import { Etapa1Corpo } from '../components/ficha/Etapa1Corpo';
import { Etapa2Corpo } from '../components/ficha/Etapa2Corpo';
import { Etapa3Corpo } from '../components/ficha/Etapa3Corpo';
import { PendenciasCorpo } from '../components/ficha/PendenciasCorpo';
import { IntroFicha } from '../components/ficha/Cabecalho';
import { ModoProvider } from '../components/ficha/campos';
import {
  ModalEnviarEmail,
  ModalRegistrarPendencia,
  ModalValidarCcon,
  type DadosPendencia,
} from '../components/ModaisAcao';
import { RodapeEtapa } from '../components/RodapeEtapa';
import { StatusTag } from '../components/StatusTag';
import { chavesObrigatoriasTecnicas, progressoDosTestes } from '../domain/condicionais';
import { montarExtrasRegistrarPendencia, montarValidacaoCcon } from '../domain/payload';
import {
  ABAS,
  ACAO_DA_ETAPA,
  ACOES,
  abaPadrao,
  etapaAtualIndice,
  isAbaId,
  motivoSomenteLeitura,
  podeEditar,
  rotuloEvento,
  rotuloStatus,
  type AbaId,
  type SecaoEscrita,
} from '../domain/status';
import { formatarDataHora } from '../domain/util';
import { useIdentidade } from '../state/identidade';
import { useFicha } from '../state/useFicha';

const SECAO_DA_ABA: Record<Exclude<AbaId, 'historico'>, SecaoEscrita> = {
  etapa1: 'etapa1',
  etapa2: 'etapa2',
  etapa3: 'etapa3',
  pendencias: 'pendencias',
};

const CONFIRMA_ACAO: Record<AcaoComTrava, { titulo: string; texto: string }> = {
  'liberar-instalacao': {
    titulo: 'Liberar para instalação?',
    texto:
      'A equipe técnica será avisada por e-mail e a Etapa 1 passa a ser somente leitura. Para corrigir o cadastro depois, será preciso registrar uma pendência cadastral.',
  },
  'concluir-instalacao': {
    titulo: 'Concluir a instalação?',
    texto: 'A Etapa 2 passa a ser somente leitura e a ficha segue para os testes da Etapa 3.',
  },
  'validar-ccon': { titulo: '', texto: '' },
};

export function FichaEditor() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { modal } = App.useApp();
  const { autor, garantirAutor } = useIdentidade();
  const f = useFicha(id);
  const [dlgPendencia, setDlgPendencia] = useState(false);
  const [dlgValidar, setDlgValidar] = useState(false);
  const [dlgEmail, setDlgEmail] = useState(false);

  // ---- aviso de alterações não salvas (troca de página e fechar a aba)
  const bloqueador = useBlocker(
    ({ currentLocation, nextLocation }) =>
      f.algumaSuja && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (bloqueador.state !== 'blocked') return;
    modal.confirm({
      title: 'Há alterações não salvas',
      content: 'Se sair agora, o que você preencheu e ainda não salvou será perdido.',
      okText: 'Sair sem salvar',
      okButtonProps: { danger: true },
      cancelText: 'Continuar editando',
      onOk: () => bloqueador.proceed?.(),
      onCancel: () => bloqueador.reset?.(),
    });
  }, [bloqueador, modal]);
  useEffect(() => {
    if (!f.algumaSuja) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [f.algumaSuja]);

  const status: Status | null = f.ficha?.status ?? null;

  const abaParam = params.get('aba');
  const abaAtiva: AbaId = isAbaId(abaParam) ? abaParam : status ? abaPadrao(status) : 'etapa1';

  const ultimaPendencia = useMemo(
    () => f.ficha?.eventos.find((e) => e.acao.replace(/-/g, '_') === 'registrar_pendencia'),
    [f.ficha],
  );

  useEffect(() => {
    if (f.ficha) document.title = `${f.ficha.codigo} — Portal Neoguard`;
    return () => {
      document.title = 'Portal Neoguard';
    };
  }, [f.ficha]);

  if (f.carregando && !f.ficha) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 10, color: '#5a5a5a' }}>Carregando a ficha…</div>
      </div>
    );
  }
  if (f.erro || !f.ficha || !f.rascunho || !status) {
    return (
      <Alert
        type="error"
        showIcon
        message={f.erro?.status === 404 ? 'Ficha não encontrada.' : f.erro?.detail ?? 'Não foi possível carregar a ficha.'}
        action={
          <>
            <Button size="small" onClick={() => void f.recarregar()}>
              Tentar de novo
            </Button>{' '}
            <Link to="/fichas">Voltar à lista</Link>
          </>
        }
      />
    );
  }

  const { ficha, rascunho } = f;
  const dados = ficha.dados;
  const cliente = dados.etapa1.cliente.razao_social || dados.etapa1.cliente.nome_fantasia;

  // ---- ações
  const confirmarAcao = (acao: AcaoComTrava) => {
    if (acao === 'validar-ccon') {
      setDlgValidar(true);
      return;
    }
    const c = CONFIRMA_ACAO[acao];
    modal.confirm({
      title: c.titulo,
      content: c.texto,
      okText: ACOES[acao].rotulo,
      cancelText: 'Cancelar',
      onOk: async () => {
        await f.executarAcao(acao, {}, `${ACOES[acao].rotulo}: feito.`);
      },
    });
  };

  const retomar = () => {
    void f.executarAcao('retomar', {}, 'Ficha retomada.', []);
  };

  const registrarPendencia = async (d: DadosPendencia) => {
    const ok = await f.executarAcao(
      'registrar-pendencia',
      { ...montarExtrasRegistrarPendencia(d) },
      'Pendência registrada.',
      ['pendencias'],
    );
    if (ok) setDlgPendencia(false);
  };

  const validarCcon = async (v: Parameters<typeof montarValidacaoCcon>[0]) => {
    const validacao = montarValidacaoCcon(v);
    const ok = await f.executarAcao(
      'validar-ccon',
      { validacao_ccon: validacao },
      validacao.resultado === 'aprovado'
        ? 'Aprovado pela CCON: a ficha está ATIVO / MONITORADO.'
        : 'Validação registrada como reprovada: a ficha voltou para Pendência técnica.',
    );
    if (ok) setDlgValidar(false);
  };

  // "Enviar por e-mail": salva o que estiver pendente, confirma quem preenche e abre o modal.
  const abrirModalEmail = async () => {
    const quem = await garantirAutor();
    if (quem) setDlgEmail(true);
  };
  const pedirEnvioEmail = () => {
    if (f.algumaSuja) {
      modal.confirm({
        title: 'Salvar antes de enviar?',
        content: 'Há alterações não salvas. O e-mail leva a ficha como ela está salva, então salve antes de enviar.',
        okText: 'Salvar e enviar',
        cancelText: 'Cancelar',
        onOk: async () => {
          if (await f.salvarPendentes()) await abrirModalEmail();
        },
      });
      return;
    }
    void abrirModalEmail();
  };

  const mudarAba = (chave: string) => {
    const proximo = new URLSearchParams(params);
    proximo.set('aba', chave);
    setParams(proximo, { replace: true });
  };

  const rodape = (aba: Exclude<AbaId, 'historico'>, dica?: ReactNode) => {
    const secao = SECAO_DA_ABA[aba];
    const acao = aba === 'pendencias' ? undefined : ACAO_DA_ETAPA[aba];
    return (
      <RodapeEtapa
        status={status}
        editavel={podeEditar(status, secao)}
        sujo={f.sujas[secao]}
        algumaSuja={f.algumaSuja}
        ocupado={f.ocupado}
        salvando={f.ocupado === secao}
        bloquearRegistrar={f.sujas.pendencias}
        onSalvar={() => void f.salvar(secao)}
        acao={acao}
        faltas={f.travas ? f.travas[acao ?? 'liberar-instalacao'] : f.travas}
        onAcao={confirmarAcao}
        onRegistrarPendencia={() => setDlgPendencia(true)}
        onRetomar={retomar}
        onEnviarEmail={aba === 'etapa1' ? pedirEnvioEmail : undefined}
        dica={dica}
      />
    );
  };

  const avisoLeitura = (secao: SecaoEscrita) => {
    const motivo = motivoSomenteLeitura(status, secao);
    return motivo ? (
      <Alert type="info" showIcon message={motivo} style={{ marginBottom: 10 }} data-testid="aviso-somente-leitura" />
    ) : null;
  };

  const progresso = progressoDosTestes(rascunho.etapa3.testes_tecnicos, chavesObrigatoriasTecnicas(dados));
  const dicaEtapa2 =
    status === 'liberado_para_instalacao'
      ? 'Ao salvar a Etapa 2 pela primeira vez, a ficha passa para "Em instalação".'
      : undefined;
  const dicaEtapa3 =
    status === 'instalacao_concluida'
      ? `Testes técnicos (3.1): ${progresso.feitos} de ${progresso.total}. Ao marcar todos e salvar, a ficha passa para "Aguardando testes com a CCON".`
      : status === 'aguardando_testes_ccon'
        ? 'Conclua os testes com a CCON (3.2) e salve; depois use "Validar CCON".'
        : undefined;

  const itens = [
    {
      key: 'etapa1',
      label: rotuloAba('etapa1', f.sujas.etapa1),
      children: (
        <ModoProvider readOnly={!podeEditar(status, 'etapa1')}>
          <div className="ficha">
            {avisoLeitura('etapa1')}
            <Etapa1Corpo valor={rascunho.etapa1} onChange={f.setEtapa1} />
            {rodape('etapa1')}
          </div>
        </ModoProvider>
      ),
    },
    {
      key: 'etapa2',
      label: rotuloAba('etapa2', f.sujas.etapa2),
      children: (
        <ModoProvider readOnly={!podeEditar(status, 'etapa2')}>
          <div className="ficha">
            {avisoLeitura('etapa2')}
            <Etapa2Corpo valor={rascunho.etapa2} etapa1={rascunho.etapa1} onChange={f.setEtapa2} />
            {rodape('etapa2', dicaEtapa2)}
          </div>
        </ModoProvider>
      ),
    },
    {
      key: 'etapa3',
      label: rotuloAba('etapa3', f.sujas.etapa3),
      children: (
        <ModoProvider readOnly={!podeEditar(status, 'etapa3')}>
          <div className="ficha">
            {avisoLeitura('etapa3')}
            <Etapa3Corpo
              valor={{ ...rascunho.etapa3, validacao_ccon: dados.etapa3.validacao_ccon }}
              status={status}
              onChange={f.setEtapa3}
            />
            {rodape('etapa3', dicaEtapa3)}
          </div>
        </ModoProvider>
      ),
    },
    {
      key: 'pendencias',
      label: rotuloAba('pendencias', f.sujas.pendencias),
      children: (
        <ModoProvider readOnly={!podeEditar(status, 'pendencias')}>
          <div className="ficha">
            {avisoLeitura('pendencias')}
            <PendenciasCorpo valor={rascunho.pendencias} onChange={f.setPendencias} />
            {rodape('pendencias')}
          </div>
        </ModoProvider>
      ),
    },
    {
      key: 'historico',
      label: 'Histórico',
      children: (
        <div className="ficha">
          <Historico eventos={ficha.eventos} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link to="/fichas">← Fichas de Implantação</Link>
      </div>

      <div className="editor-topo">
        <div className="editor-linha">
          <span className="editor-codigo">{ficha.codigo}</span>
          <span className="editor-cliente">{cliente || 'Cliente ainda não informado'}</span>
          <StatusTag status={status} />
          <div className="editor-acoes">
            <Button type="primary" loading={f.ocupado === 'acao:enviar-email'} disabled={f.ocupado !== null} onClick={pedirEnvioEmail}>
              Enviar por e-mail
            </Button>
            <Tooltip title={f.algumaSuja ? 'A impressão usa o que está salvo. Salve antes para incluir as alterações.' : ''}>
              <Button href={`/fichas/${ficha.id}/imprimir`} target="_blank" rel="noopener noreferrer">
                Imprimir / PDF
              </Button>
            </Tooltip>
            <Button
              onClick={() => {
                if (!f.algumaSuja) return void f.recarregar();
                modal.confirm({
                  title: 'Recarregar a ficha?',
                  content: 'As alterações ainda não salvas serão descartadas.',
                  okText: 'Recarregar',
                  cancelText: 'Cancelar',
                  onOk: () => f.recarregar(),
                });
              }}
              loading={f.carregando}
            >
              Atualizar
            </Button>
          </div>
        </div>
        <IntroFicha atual={etapaAtualIndice(status, dados)} concluido={status === 'ativo_monitorado'} />
      </div>

      {(status === 'pendencia_cadastral' || status === 'pendencia_tecnica') && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Ficha com ${rotuloStatus(status).toLowerCase()}`}
          description={
            <>
              {ultimaPendencia?.resumo ? <div>{ultimaPendencia.resumo}</div> : null}
              <div>Quando a pendência estiver resolvida, use &quot;Retomar&quot; para continuar o fluxo.</div>
            </>
          }
          action={
            <Button type="primary" loading={f.ocupado === 'acao:retomar'} disabled={f.ocupado !== null} onClick={retomar}>
              Retomar
            </Button>
          }
        />
      )}
      {status === 'ativo_monitorado' && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message="ATIVO / MONITORADO — a ficha está concluída e somente leitura."
        />
      )}

      <Tabs
        activeKey={abaAtiva}
        onChange={mudarAba}
        destroyOnHidden
        items={itens}
        type="card"
        style={{ marginBottom: 0 }}
      />

      {dlgPendencia && (
        <ModalRegistrarPendencia
          status={status}
          ocupado={f.ocupado === 'acao:registrar-pendencia'}
          onCancelar={() => setDlgPendencia(false)}
          onConfirmar={(d) => void registrarPendencia(d)}
        />
      )}
      {dlgEmail && (
        <ModalEnviarEmail
          codigo={ficha.codigo}
          cliente={cliente}
          emailRemetente={autor?.email ?? ''}
          ocupado={f.ocupado === 'acao:enviar-email'}
          onCancelar={() => setDlgEmail(false)}
          onEnviar={(m) => {
            void f.enviarEmail(m).then((ok) => ok && setDlgEmail(false));
          }}
        />
      )}
      {dlgValidar && (
        <ModalValidarCcon
          operadorInicial={autor?.nome}
          ocupado={f.ocupado === 'acao:validar-ccon'}
          onCancelar={() => setDlgValidar(false)}
          onConfirmar={(v) => void validarCcon(v)}
        />
      )}
    </div>
  );
}

function rotuloAba(id: AbaId, sujo: boolean): ReactNode {
  const base = ABAS.find((a) => a.id === id)?.rotulo ?? id;
  return (
    <span>
      {base}
      {sujo && <span className="aba-ponto" role="img" aria-label="alterações não salvas" />}
    </span>
  );
}

function Historico({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) return <p>Sem eventos ainda.</p>;
  return (
    <div className="lista-historico">
      <Timeline
        items={eventos.map((e, i) => ({
          key: `${e.em}-${i}`,
          color: e.status_para && e.status_para !== e.status_de ? '#B8963E' : 'gray',
          children: (
            <div>
              <div>
                <span className="when">{formatarDataHora(e.em)}</span> — <span className="quem">{e.autor_nome}</span>{' '}
                <span className="when">({e.autor_email})</span>
              </div>
              <div>
                <b>{rotuloEvento(e.acao)}</b>
                {e.status_de && e.status_para && e.status_de !== e.status_para && (
                  <span className="when">
                    {' '}
                    · {rotuloStatus(e.status_de)} → {rotuloStatus(e.status_para)}
                  </span>
                )}
              </div>
              {e.resumo && <div className="resumo">{e.resumo}</div>}
            </div>
          ),
        }))}
      />
    </div>
  );
}
