// Cabeçalho da ficha (logo + título + cliente/proposta), introdução e faixa do fluxo.
import logo from '../../assets/logo-neoguard.png';
import type { DadosFicha } from '../../api/types';
import { FAIXA_ETAPAS } from '../../domain/status';

export function FaixaFluxo({ atual, concluido }: { atual: number; concluido?: boolean }) {
  return (
    <div className="fluxo" role="list" aria-label="Etapas do processo">
      {FAIXA_ETAPAS.map((nome, i) => {
        const estado = i < atual || (concluido && i === atual) ? 'feito' : i === atual ? 'atual' : '';
        return (
          <span key={nome} style={{ display: 'contents' }}>
            <span
              role="listitem"
              className={`passo ${estado}`}
              aria-current={i === atual && !concluido ? 'step' : undefined}
              data-passo={i}
            >
              {nome}
            </span>
            {i < FAIXA_ETAPAS.length - 1 && (
              <span className="seta" aria-hidden="true">
                →
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

interface CabecalhoProps {
  dados: Pick<DadosFicha, 'etapa1'>;
  comLogo?: boolean;
}

/** Linha repetida no topo de cada página do docx: logo, título, cliente e proposta/contrato. */
export function CabecalhoPagina({ dados, comLogo = true }: CabecalhoProps) {
  const c = dados.etapa1.cliente;
  const cliente = c.razao_social || c.nome_fantasia;
  const propostaContrato = [c.numero_proposta, c.numero_contrato].filter(Boolean).join(' / ');
  return (
    <div className="ficha-cabecalho">
      {comLogo && <img src={logo} alt="Grupo Neoguard — Segurança e Serviços" />}
      <div className="ficha-cabecalho-texto">
        <div className="ficha-titulo-doc">FICHA DE IMPLANTAÇÃO — ALARME MONITORADO</div>
        <div className="ficha-cliente-linha">
          <span>
            Cliente: <span className="v">{cliente}</span>
          </span>
          <span>
            Proposta/Contrato nº: <span className="v">{propostaContrato}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** "Grupo Neoguard", subtítulo em itálico e a linha do fluxo. */
export function IntroFicha({ atual, concluido }: { atual: number; concluido?: boolean }) {
  return (
    <div className="ficha-intro">
      <div className="marca">Grupo Neoguard</div>
      <div className="sub">
        Do fechamento da venda à ativação do monitoramento — Central Intelbras AMT 2018 E e modelos compatíveis da
        família AMT
      </div>
      <FaixaFluxo atual={atual} concluido={concluido} />
    </div>
  );
}
