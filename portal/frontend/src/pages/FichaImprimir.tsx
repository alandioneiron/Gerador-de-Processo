// Versão de impressão (A4) da ficha: mesmo layout do docx, para o navegador salvar em PDF.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Spin } from 'antd';
import { ApiError, api, type Evento, type Ficha } from '../api';
import { CabecalhoPagina, IntroFicha } from '../components/ficha/Cabecalho';
import { ModoProvider } from '../components/ficha/campos';
import { Etapa1Corpo } from '../components/ficha/Etapa1Corpo';
import { Etapa2Corpo } from '../components/ficha/Etapa2Corpo';
import { Etapa3Corpo } from '../components/ficha/Etapa3Corpo';
import { PendenciasCorpo } from '../components/ficha/PendenciasCorpo';
import { etapaAtualIndice } from '../domain/status';
import { esqueletoVazio } from '../domain/modelo';
import { formatarData, mesclarModelo } from '../domain/util';

function normalizar(acao: string): string {
  return acao.replace(/-/g, '_');
}

/** Evento mais recente (a lista vem do mais novo para o mais antigo) que satisfaz o filtro. */
export function eventoDaAssinatura(
  eventos: Evento[],
  acao: 'liberar_instalacao' | 'concluir_instalacao' | 'validar_ccon',
): Evento | undefined {
  return eventos.find((e) => {
    if (normalizar(e.acao) !== acao) return false;
    // A assinatura da CCON só vale para a aprovação.
    return acao !== 'validar_ccon' || e.status_para === 'ativo_monitorado';
  });
}

export function Assinaturas({ eventos }: { eventos: Evento[] }) {
  const itens: { titulo: string; evento?: Evento }[] = [
    { titulo: 'Comercial', evento: eventoDaAssinatura(eventos, 'liberar_instalacao') },
    { titulo: 'Equipe Técnica', evento: eventoDaAssinatura(eventos, 'concluir_instalacao') },
    { titulo: 'CCON', evento: eventoDaAssinatura(eventos, 'validar_ccon') },
  ];
  return (
    <div className="assinaturas" aria-label="Assinaturas">
      {itens.map(({ titulo, evento }) => (
        <div key={titulo} data-assinatura={titulo}>
          <div className="quem">{evento ? <span>{evento.autor_nome}</span> : null}</div>
          <div className="linha">
            {titulo} — <span>Data: {evento ? formatarData(evento.em) : '___/___/______'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FichaImprimir() {
  const { id = '' } = useParams();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .obterFicha(id)
      .then((f) => ativo && setFicha(f))
      .catch((e) => ativo && setErro(e instanceof ApiError ? e.detail : 'Não foi possível carregar a ficha.'));
    return () => {
      ativo = false;
    };
  }, [id]);

  useEffect(() => {
    if (!ficha) return;
    const c = ficha.dados.etapa1.cliente;
    // O navegador usa o título como nome sugerido do PDF.
    document.title = `${ficha.codigo} — ${c.razao_social || c.nome_fantasia || 'Ficha de implantação'}`;
    return () => {
      document.title = 'Portal Neoguard';
    };
  }, [ficha]);

  if (erro) {
    return (
      <div className="pagina">
        <Alert type="error" showIcon message={erro} action={<Link to="/fichas">Voltar à lista</Link>} />
      </div>
    );
  }
  if (!ficha) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 10, color: '#5a5a5a' }}>Preparando a impressão…</div>
      </div>
    );
  }

  const dados = mesclarModelo(esqueletoVazio(), ficha.dados);

  return (
    <div>
      <div className="impressao-barra nao-imprimir">
        <Link to={`/fichas/${ficha.id}`}>← Voltar à ficha</Link>
        <b>{ficha.codigo}</b>
        <span style={{ color: '#5a5a5a' }}>
          Escolha &quot;Salvar como PDF&quot; na janela de impressão (papel A4, margens padrão).
        </span>
        <Button type="primary" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>
          Imprimir / PDF
        </Button>
      </div>

      <div className="impressao-folha" data-testid="folha-impressao">
        <table className="impressao-tabela" role="presentation">
          <thead>
            <tr>
              <td>
                <div className="ficha">
                  <CabecalhoPagina dados={dados} />
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <ModoProvider impressao>
                  <div className="ficha">
                    <IntroFicha
                      atual={etapaAtualIndice(ficha.status, dados)}
                      concluido={ficha.status === 'ativo_monitorado'}
                    />
                    <Etapa1Corpo valor={dados.etapa1} />
                    <Etapa2Corpo valor={dados.etapa2} etapa1={dados.etapa1} />
                    <Etapa3Corpo valor={dados.etapa3} status={ficha.status} />
                    <PendenciasCorpo valor={dados.pendencias} />
                    <Assinaturas eventos={ficha.eventos} />
                  </div>
                </ModoProvider>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="impressao-rodape-tela">
          <span>Grupo Neoguard · Documento interno de implantação · Não reproduzir sem autorização</span>
          <span>Página X de Y (na impressão)</span>
        </div>
      </div>
    </div>
  );
}
