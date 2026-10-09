// Rodapé de cada aba: Salvar, ação da etapa (com a lista "Falta resolver antes de …"),
// Registrar pendência e Retomar.
import type { ReactNode } from 'react';
import { Button } from 'antd';
import type { AcaoComTrava, Status } from '../api/types';
import { ACOES, acaoPermitidaNoStatus, estadoAcaoComTrava } from '../domain/status';

export interface RodapeProps {
  status: Status;
  /** Pode editar esta seção no status atual. */
  editavel: boolean;
  /** Esta seção tem alterações não salvas. */
  sujo: boolean;
  /** Qualquer seção da ficha tem alterações não salvas (bloqueia as ações). */
  algumaSuja: boolean;
  ocupado: string | null;
  salvando: boolean;
  /** Impede "Registrar pendência" (ex.: a lista de pendências tem alterações não salvas). */
  bloquearRegistrar?: boolean;
  onSalvar: () => void;
  /** Ação com trava que pertence a esta aba (liberar / concluir / validar). */
  acao?: AcaoComTrava;
  faltas?: string[] | null;
  onAcao?: (acao: AcaoComTrava) => void;
  onRegistrarPendencia: () => void;
  onRetomar: () => void;
  /** Mostra "Enviar por e-mail" no rodapé (Etapa 1). */
  onEnviarEmail?: () => void;
  /** Texto de apoio exibido ao lado das pendências. */
  dica?: ReactNode;
}

export function RodapeEtapa({
  status,
  editavel,
  sujo,
  algumaSuja,
  ocupado,
  salvando,
  bloquearRegistrar,
  onSalvar,
  acao,
  faltas,
  onAcao,
  onRegistrarPendencia,
  onRetomar,
  onEnviarEmail,
  dica,
}: RodapeProps) {
  const estado = acao
    ? estadoAcaoComTrava(status, acao, faltas ?? undefined, algumaSuja)
    : null;
  const travasIndisponiveis = acao && estado?.visivel && faltas === null;
  const ativo = status === 'ativo_monitorado';
  const podeRetomar = acaoPermitidaNoStatus(status, 'retomar');
  const ocupadoGeral = ocupado !== null;

  return (
    <div className="rodape-etapa" role="region" aria-label="Ações da etapa">
      <div className="rodape-faltas" aria-live="polite">
        {acao && estado?.visivel && (
          <>
            {travasIndisponiveis ? (
              <div className="titulo">Não foi possível conferir o que falta. Recarregue a ficha.</div>
            ) : estado.faltas.length > 0 ? (
              <>
                <div className="titulo">Falta resolver antes de {ACOES[acao].antesDe}:</div>
                <ul data-testid={`faltas-${acao}`}>
                  {estado.faltas.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="ok">Tudo certo para {ACOES[acao].antesDe}.</div>
            )}
            {estado.motivo && <div className="nao-salvo">{estado.motivo}</div>}
          </>
        )}
        {dica && <div className="nota-neutra">{dica}</div>}
      </div>

      <div className="rodape-botoes">
        {sujo && <span className="nao-salvo">● Alterações não salvas</span>}
        <Button
          type={sujo ? 'primary' : 'default'}
          disabled={!editavel || !sujo || ocupadoGeral}
          loading={salvando}
          onClick={onSalvar}
        >
          Salvar
        </Button>
        {acao && estado?.visivel && (
          <Button
            type="primary"
            disabled={!estado.habilitada || ocupadoGeral}
            loading={ocupado === `acao:${acao}`}
            onClick={() => onAcao?.(acao)}
          >
            {ACOES[acao].rotulo}
          </Button>
        )}
        {onEnviarEmail && (
          <Button type="primary" disabled={ocupadoGeral} loading={ocupado === 'acao:enviar-email'} onClick={onEnviarEmail}>
            Enviar por e-mail
          </Button>
        )}
        {podeRetomar && (
          <Button disabled={ocupadoGeral} loading={ocupado === 'acao:retomar'} onClick={onRetomar}>
            Retomar
          </Button>
        )}
        {!ativo && (
          <Button danger disabled={bloquearRegistrar || ocupadoGeral} onClick={onRegistrarPendencia}>
            Registrar pendência
          </Button>
        )}
      </div>
    </div>
  );
}
