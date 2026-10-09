// Etapa 3 — Testes e ativação (3.1 a 3.3) + status da implantação, fiel ao docx.
import type {
  Etapa3,
  OkPendente,
  Status,
  TesteCconChave,
  TesteTecnicoChave,
  ValidacaoCcon,
} from '../../api/types';
import { TESTES_CCON_CHAVES, TESTES_TECNICOS_CHAVES } from '../../api/types';
import { TESTES_CCON_ROTULOS, TESTES_TECNICOS_ROTULOS } from '../../domain/rotulos';
import { STATUS_ROTULO } from '../../domain/status';
import {
  AvisoDocx,
  CampoCelula,
  CampoLinha,
  FaixaEtapa,
  GradeCampos,
  GradeMarcas,
  LinhaRotulo,
  Marca,
  Nota,
  ModoProvider,
  Opcoes,
  Secao,
  useModo,
} from './campos';

const ORDEM_BLOCO_STATUS: Status[] = [
  'cadastro_em_preenchimento',
  'liberado_para_instalacao',
  'instalacao_concluida',
  'em_instalacao',
  'aguardando_testes_ccon',
  'pendencia_tecnica',
  'pendencia_cadastral',
  'ativo_monitorado',
];

const OK_PENDENTE: { value: Exclude<OkPendente, ''>; label: string }[] = [
  { value: 'ok', label: 'OK' },
  { value: 'pendente', label: 'PENDENTE' },
];

const ITENS_VALIDACAO_3_3: [keyof ValidacaoCcon, string][] = [
  ['cadastro', 'Cadastro:'],
  ['comunicacao', 'Comunicação:'],
  ['eventos', 'Eventos:'],
  ['contatos', 'Contatos:'],
  ['regras_operacionais', 'Regras operacionais:'],
];

interface Props {
  valor: Etapa3;
  status: Status;
  onChange?: (v: Pick<Etapa3, 'testes_tecnicos' | 'testes_ccon'>) => void;
}

/** Validação da CCON (3.3): sempre somente leitura; só muda pela ação "Validar CCON". */
function ValidacaoCconLeitura({ v }: { v: ValidacaoCcon }) {
  const modo = useModo();
  return (
    <ModoProvider readOnly impressao={modo.impressao}>
      {!modo.impressao && (
        <Nota>
          Este item é preenchido pelo operador da CCON no botão &quot;Validar CCON&quot; (rodapé desta etapa); aqui só aparece o
          resultado registrado.
        </Nota>
      )}
      <GradeCampos colunas={6}>
        <CampoCelula rotulo="OPERADOR CCON" span={3} largo value={v.operador} />
        <CampoCelula rotulo="DATA" span={2} tipo="date" value={v.data} />
        <CampoCelula rotulo="HORA" span={1} tipo="time" value={v.hora} />
      </GradeCampos>
      {ITENS_VALIDACAO_3_3.map(([chave, titulo]) => (
        <Opcoes
          key={chave}
          rotulo={titulo.replace(':', '')}
          titulo={titulo}
          value={v[chave] as OkPendente}
          opcoes={OK_PENDENTE}
        />
      ))}
      <Opcoes
        rotulo="Resultado"
        titulo="Resultado:"
        value={v.resultado}
        opcoes={[
          { value: 'aprovado', label: 'APROVADO PARA ATIVAÇÃO' },
          { value: 'reprovado', label: 'REPROVADO / PENDENTE' },
        ]}
      />
      <LinhaRotulo rotulo="Observações:">
        <CampoLinha area rotulo="Observações da validação" value={v.observacoes} />
      </LinhaRotulo>
    </ModoProvider>
  );
}

function BlocoStatus({ status }: { status: Status }) {
  const modo = useModo();
  return (
    <ModoProvider readOnly impressao={modo.impressao}>
      <div className="bloco-status" role="group" aria-label="Status da implantação">
        {ORDEM_BLOCO_STATUS.map((s) => (
          <div key={s} className={`item${s === status ? ' atual' : ''}`} data-status={s}>
            <Marca checked={s === status}>{STATUS_ROTULO[s]}</Marca>
          </div>
        ))}
      </div>
    </ModoProvider>
  );
}

export function Etapa3Corpo({ valor, status, onChange }: Props) {
  const emitir = (parcial: Partial<Pick<Etapa3, 'testes_tecnicos' | 'testes_ccon'>>) =>
    onChange?.({ testes_tecnicos: valor.testes_tecnicos, testes_ccon: valor.testes_ccon, ...parcial });

  return (
    <div className="etapa-corpo" data-etapa="3">
      <FaixaEtapa titulo="ETAPA 3 — TESTES E ATIVAÇÃO" responsavel="EQUIPE TÉCNICA + CCON" />
      <AvisoDocx>
        INSTALAÇÃO CONCLUÍDA NÃO SIGNIFICA MONITORAMENTO ATIVO. O status ATIVO/MONITORADO só pode ser atribuído após
        aprovação da CCON (item 3.3).
      </AvisoDocx>

      <Secao numero="3.1" titulo="Testes Técnicos">
        <GradeMarcas<TesteTecnicoChave>
          rotulo="Testes técnicos"
          colunas={2}
          itens={TESTES_TECNICOS_CHAVES.map((k) => ({ chave: k, rotulo: TESTES_TECNICOS_ROTULOS[k] }))}
          valores={valor.testes_tecnicos}
          onChange={(k, v) => emitir({ testes_tecnicos: { ...valor.testes_tecnicos, [k]: v } })}
        />
      </Secao>

      <Secao numero="3.2" titulo="Testes com a CCON">
        <GradeMarcas<TesteCconChave>
          rotulo="Testes com a CCON"
          colunas={2}
          itens={TESTES_CCON_CHAVES.map((k) => ({ chave: k, rotulo: TESTES_CCON_ROTULOS[k] }))}
          valores={valor.testes_ccon}
          onChange={(k, v) => emitir({ testes_ccon: { ...valor.testes_ccon, [k]: v } })}
        />
      </Secao>

      <Secao numero="3.3" titulo="Validação da CCON">
        <ValidacaoCconLeitura v={valor.validacao_ccon} />
      </Secao>

      <h2 className="faixa-etapa">
        <span className="titulo">STATUS DA IMPLANTAÇÃO E TRAVAS DO PROCESSO</span>
      </h2>
      <BlocoStatus status={status} />
      <AvisoDocx>O status ATIVO / MONITORADO somente poderá ser utilizado após aprovação da CCON no item 3.3.</AvisoDocx>
    </div>
  );
}
