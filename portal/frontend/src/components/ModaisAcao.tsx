// Modais das ações "Registrar pendência" e "Validar CCON".
import { useState } from 'react';
import { Alert, Input, Modal, Radio } from 'antd';
import type { OkPendente, Status, TipoPendencia, ValidacaoCcon } from '../api/types';
import { DESTINATARIOS_EMAIL } from '../domain/status';
import {
  ITENS_VALIDACAO,
  problemasValidacaoCcon,
  tipoPendenciaPadrao,
  validacaoCconVazia,
} from '../domain/payload';

// ---------------------------------------------------------------- Registrar pendência

export interface DadosPendencia {
  tipo: TipoPendencia;
  descricao: string;
  responsavel: string;
  prazo: string;
}

export function ModalRegistrarPendencia({
  status,
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  status: Status;
  ocupado?: boolean;
  onCancelar: () => void;
  onConfirmar: (dados: DadosPendencia) => void;
}) {
  const [tipo, setTipo] = useState<TipoPendencia>(tipoPendenciaPadrao(status));
  const [descricao, setDescricao] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [prazo, setPrazo] = useState('');
  const [erro, setErro] = useState('');

  const confirmar = () => {
    if (!descricao.trim()) {
      setErro('Descreva a pendência.');
      return;
    }
    onConfirmar({ tipo, descricao, responsavel, prazo });
  };

  return (
    <Modal
      open
      title="Registrar pendência"
      okText="Registrar pendência"
      cancelText="Cancelar"
      confirmLoading={ocupado}
      onOk={confirmar}
      onCancel={onCancelar}
      maskClosable={false}
      destroyOnHidden
    >
      <p style={{ marginTop: 0 }}>
        A ficha passa para &quot;Pendência cadastral&quot; ou &quot;Pendência técnica&quot; e a pendência entra na lista da aba
        Pendências. Use &quot;Retomar&quot; quando estiver resolvida.
      </p>
      <div className="campo-modal">
        <label id="lbl-tipo-pend">Tipo</label>
        <div>
          <div role="radiogroup" aria-labelledby="lbl-tipo-pend">
            <Radio.Group value={tipo} onChange={(e) => setTipo(e.target.value as TipoPendencia)}>
              <Radio value="cadastral">Cadastral (volta o cadastro para correção)</Radio>
              <Radio value="tecnica">Técnica (instalação ou testes)</Radio>
            </Radio.Group>
          </div>
        </div>
      </div>
      <div className="campo-modal">
        <label htmlFor="pend-descricao">Descrição (obrigatória)</label>
        <Input.TextArea
          id="pend-descricao"
          rows={3}
          value={descricao}
          status={erro ? 'error' : undefined}
          onChange={(e) => {
            setDescricao(e.target.value);
            setErro('');
          }}
        />
        {erro && <div style={{ color: '#E5533B', fontSize: 12 }}>{erro}</div>}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="campo-modal" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="pend-resp">Responsável</label>
          <Input id="pend-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </div>
        <div className="campo-modal" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="pend-prazo">Data / Prazo</label>
          <Input id="pend-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Validar CCON

const OK_PENDENTE = [
  { value: 'ok', label: 'OK' },
  { value: 'pendente', label: 'PENDENTE' },
];

function agoraLocal(): { data: string; hora: string } {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  return {
    data: `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`,
    hora: `${dois(d.getHours())}:${dois(d.getMinutes())}`,
  };
}

export function ModalValidarCcon({
  operadorInicial,
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  operadorInicial?: string;
  ocupado?: boolean;
  onCancelar: () => void;
  onConfirmar: (v: ValidacaoCcon) => void;
}) {
  const [v, setV] = useState<ValidacaoCcon>(() => ({
    ...validacaoCconVazia(),
    operador: operadorInicial ?? '',
    ...agoraLocal(),
  }));
  const [problemas, setProblemas] = useState<string[]>([]);

  const set = (parcial: Partial<ValidacaoCcon>) => setV((atual) => ({ ...atual, ...parcial }));

  const confirmar = () => {
    const ps = problemasValidacaoCcon(v);
    setProblemas(ps);
    if (ps.length === 0) onConfirmar(v);
  };

  return (
    <Modal
      open
      width={640}
      title="Validar CCON (item 3.3)"
      okText="Registrar validação"
      cancelText="Cancelar"
      confirmLoading={ocupado}
      onOk={confirmar}
      onCancel={onCancelar}
      maskClosable={false}
      destroyOnHidden
    >
      <p style={{ marginTop: 0 }}>
        Preenchido pelo operador da CCON. <b>Aprovado</b> muda a ficha para ATIVO / MONITORADO; <b>reprovado</b> volta
        para Pendência técnica.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="campo-modal" style={{ flex: 2, minWidth: 200 }}>
          <label htmlFor="val-operador">OPERADOR CCON</label>
          <Input id="val-operador" value={v.operador} onChange={(e) => set({ operador: e.target.value })} />
        </div>
        <div className="campo-modal" style={{ flex: 1, minWidth: 150 }}>
          <label htmlFor="val-data">DATA</label>
          <Input id="val-data" type="date" value={v.data} onChange={(e) => set({ data: e.target.value })} />
        </div>
        <div className="campo-modal" style={{ flex: 1, minWidth: 110 }}>
          <label htmlFor="val-hora">HORA</label>
          <Input id="val-hora" type="time" value={v.hora} onChange={(e) => set({ hora: e.target.value })} />
        </div>
      </div>

      {ITENS_VALIDACAO.map(([chave, rotulo]) => (
        <div key={chave} className="linha-modal">
          <b id={`val-${chave}`}>{rotulo}:</b>
          <div role="radiogroup" aria-labelledby={`val-${chave}`}>
            <Radio.Group
              value={v[chave]}
              onChange={(e) => set({ [chave]: e.target.value as OkPendente })}
              options={OK_PENDENTE}
            />
          </div>
        </div>
      ))}

      <div className="linha-modal">
        <b id="val-resultado">Resultado:</b>
        <div role="radiogroup" aria-labelledby="val-resultado">
          <Radio.Group
            value={v.resultado}
            onChange={(e) => set({ resultado: e.target.value as ValidacaoCcon['resultado'] })}
            options={[
              { value: 'aprovado', label: 'APROVADO PARA ATIVAÇÃO' },
              { value: 'reprovado', label: 'REPROVADO / PENDENTE' },
            ]}
          />
        </div>
      </div>

      <div className="campo-modal">
        <label htmlFor="val-obs">Observações</label>
        <Input.TextArea id="val-obs" rows={2} value={v.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />
      </div>

      {problemas.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Corrija antes de registrar"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          }
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Enviar por e-mail

export function ModalEnviarEmail({
  codigo,
  cliente,
  emailRemetente,
  ocupado,
  onCancelar,
  onEnviar,
}: {
  codigo: string;
  cliente?: string;
  /** E-mail de quem está preenchendo: para onde vão as respostas (Reply-To). */
  emailRemetente: string;
  ocupado?: boolean;
  onCancelar: () => void;
  onEnviar: (mensagem: string) => void;
}) {
  const [mensagem, setMensagem] = useState('');

  return (
    <Modal
      open
      title="Enviar ficha por e-mail"
      okText="Enviar"
      cancelText="Cancelar"
      confirmLoading={ocupado}
      onOk={() => onEnviar(mensagem)}
      onCancel={onCancelar}
      maskClosable={false}
      destroyOnHidden
    >
      <p style={{ marginTop: 0 }}>
        Ficha <b>{codigo}</b>
        {cliente ? <> — {cliente}</> : null}
      </p>
      <div className="campo-modal">
        <span id="email-destinatarios" style={{ fontWeight: 700, fontSize: 12, color: '#1B2A4A' }}>
          Destinatários
        </span>
        <ul className="lista-destinatarios" aria-labelledby="email-destinatarios">
          {DESTINATARIOS_EMAIL.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
      <div className="campo-modal">
        <label htmlFor="email-mensagem">Mensagem (opcional)</label>
        <Input.TextArea
          id="email-mensagem"
          rows={3}
          value={mensagem}
          maxLength={2000}
          placeholder="Ex.: cliente com urgência, instalação prevista para a próxima semana."
          onChange={(e) => setMensagem(e.target.value)}
        />
      </div>
      <p className="nota-neutra" style={{ marginBottom: 0 }}>
        As respostas a este e-mail irão para <b>{emailRemetente}</b>.
      </p>
    </Modal>
  );
}
