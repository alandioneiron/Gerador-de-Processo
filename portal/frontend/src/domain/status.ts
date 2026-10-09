// Regras de status e travas (ESPEC-FASE1, seção 3). Lógica pura, sem React.
import type { AcaoComTrava, AcaoFicha, DadosFicha, Status } from '../api/types';

export const STATUS_ROTULO: Record<Status, string> = {
  cadastro_em_preenchimento: 'Cadastro em preenchimento',
  pendencia_cadastral: 'Pendência cadastral',
  liberado_para_instalacao: 'Liberado para instalação',
  em_instalacao: 'Em instalação',
  pendencia_tecnica: 'Pendência técnica',
  instalacao_concluida: 'Instalação concluída',
  aguardando_testes_ccon: 'Aguardando testes com a CCON',
  ativo_monitorado: 'ATIVO / MONITORADO',
};

export function rotuloStatus(status: string): string {
  return STATUS_ROTULO[status as Status] ?? status;
}

/** Cores das tags de status (paleta Neoguard). */
export const STATUS_COR: Record<Status, { fundo: string; borda: string; texto: string }> = {
  cadastro_em_preenchimento: { fundo: '#F6EFD9', borda: '#C9A24B', texto: '#6B4F12' },
  pendencia_cadastral: { fundo: '#FCE9D6', borda: '#E16B01', texto: '#8A3F00' },
  liberado_para_instalacao: { fundo: '#E6EEF8', borda: '#6C93C9', texto: '#27466F' },
  em_instalacao: { fundo: '#DDEBFA', borda: '#3F7FD0', texto: '#173F78' },
  pendencia_tecnica: { fundo: '#FCE3DE', borda: '#E5533B', texto: '#8C2312' },
  instalacao_concluida: { fundo: '#E0F2F1', borda: '#3E9C97', texto: '#175A56' },
  aguardando_testes_ccon: { fundo: '#EDE6F7', borda: '#8363C2', texto: '#47297F' },
  ativo_monitorado: { fundo: '#E3F4E5', borda: '#54B45F', texto: '#1F6A29' },
};

// ---------- Faixa de etapas do docx ----------
export const FAIXA_ETAPAS = [
  'VENDA FECHADA',
  'CADASTRO',
  'INSTALAÇÃO/CONFIGURAÇÃO',
  'TESTES',
  'VALIDAÇÃO CCON',
  'ATIVO/MONITORADO',
] as const;

/**
 * Índice (0..5) da etapa atual na faixa. `pendencia_tecnica` após reprovação da CCON
 * volta para "VALIDAÇÃO CCON"; nos demais casos fica em "INSTALAÇÃO/CONFIGURAÇÃO".
 */
export function etapaAtualIndice(status: Status, dados?: DadosFicha): number {
  switch (status) {
    case 'cadastro_em_preenchimento':
    case 'pendencia_cadastral':
      return 1;
    case 'liberado_para_instalacao':
    case 'em_instalacao':
      return 2;
    case 'pendencia_tecnica':
      return dados?.etapa3?.validacao_ccon?.resultado === 'reprovado' ? 4 : 2;
    case 'instalacao_concluida':
      return 3;
    case 'aguardando_testes_ccon':
      return 4;
    case 'ativo_monitorado':
      return 5;
    default:
      return 1;
  }
}

// ---------- Somente leitura por status ----------
export type SecaoEscrita = 'etapa1' | 'etapa2' | 'etapa3' | 'pendencias';

const EDITAVEL: Record<Exclude<SecaoEscrita, 'pendencias'>, readonly Status[]> = {
  etapa1: ['cadastro_em_preenchimento', 'pendencia_cadastral'],
  etapa2: ['liberado_para_instalacao', 'em_instalacao', 'pendencia_tecnica'],
  // Só testes_tecnicos e testes_ccon; validacao_ccon só muda pela ação validar-ccon.
  etapa3: ['instalacao_concluida', 'aguardando_testes_ccon'],
};

/** `true` se a seção pode ser editada no status informado. */
export function podeEditar(status: Status, secao: SecaoEscrita): boolean {
  if (secao === 'pendencias') return status !== 'ativo_monitorado';
  return EDITAVEL[secao].includes(status);
}

const ORDEM_FLUXO: Status[] = [
  'cadastro_em_preenchimento',
  'pendencia_cadastral',
  'liberado_para_instalacao',
  'em_instalacao',
  'pendencia_tecnica',
  'instalacao_concluida',
  'aguardando_testes_ccon',
  'ativo_monitorado',
];

/** Texto exibido quando a seção está somente leitura; `null` se estiver editável. */
export function motivoSomenteLeitura(status: Status, secao: SecaoEscrita): string | null {
  if (podeEditar(status, secao)) return null;
  const atual = STATUS_ROTULO[status];
  if (status === 'ativo_monitorado') {
    return 'Ficha ATIVO / MONITORADO: somente leitura. Nenhuma alteração é permitida depois da aprovação da CCON.';
  }
  const posicao = ORDEM_FLUXO.indexOf(status);
  switch (secao) {
    case 'etapa1':
      return `Somente leitura: o cadastro (Etapa 1) só pode ser editado em "Cadastro em preenchimento" ou "Pendência cadastral". Status atual: ${atual}. Para alterar, registre uma pendência cadastral.`;
    case 'etapa2':
      if (posicao < ORDEM_FLUXO.indexOf('liberado_para_instalacao')) {
        return `Somente leitura: a Etapa 2 só abre depois que a ficha for liberada para instalação. Status atual: ${atual}.`;
      }
      return `Somente leitura: a Etapa 2 só pode ser editada em "Liberado para instalação", "Em instalação" ou "Pendência técnica". Status atual: ${atual}.`;
    case 'etapa3':
      if (posicao < ORDEM_FLUXO.indexOf('instalacao_concluida')) {
        return `Somente leitura: a Etapa 3 só abre quando a instalação for concluída. Status atual: ${atual}.`;
      }
      return `Somente leitura: os testes (3.1 e 3.2) só podem ser editados em "Instalação concluída" ou "Aguardando testes com a CCON". Status atual: ${atual}.`;
    case 'pendencias':
      return null;
  }
}

// ---------- Ações ----------
export interface DefinicaoAcao {
  rotulo: string;
  /** Frase usada em "Falta resolver antes de …". */
  antesDe: string;
  de: readonly Status[];
}

export const ACOES: Record<AcaoFicha, DefinicaoAcao> = {
  'liberar-instalacao': {
    rotulo: 'Liberar para instalação',
    antesDe: 'liberar a instalação',
    de: ['cadastro_em_preenchimento', 'pendencia_cadastral'],
  },
  'concluir-instalacao': {
    rotulo: 'Concluir instalação',
    antesDe: 'concluir a instalação',
    de: ['em_instalacao', 'pendencia_tecnica'],
  },
  'validar-ccon': {
    rotulo: 'Validar CCON',
    antesDe: 'validar a CCON',
    de: ['aguardando_testes_ccon'],
  },
  'registrar-pendencia': {
    rotulo: 'Registrar pendência',
    antesDe: 'registrar a pendência',
    de: ORDEM_FLUXO.filter((s) => s !== 'ativo_monitorado'),
  },
  retomar: {
    rotulo: 'Retomar',
    antesDe: 'retomar',
    de: ['pendencia_cadastral', 'pendencia_tecnica'],
  },
  // Não muda o status e vale em qualquer um.
  'enviar-email': {
    rotulo: 'Enviar por e-mail',
    antesDe: 'enviar por e-mail',
    de: ORDEM_FLUXO,
  },
};

export function acaoPermitidaNoStatus(status: Status, acao: AcaoFicha): boolean {
  return ACOES[acao].de.includes(status);
}

export interface EstadoAcao {
  /** A ação existe para este status (senão o botão nem aparece). */
  visivel: boolean;
  habilitada: boolean;
  /** Por que está desabilitada (mostrado ao usuário). */
  motivo: string | null;
  faltas: string[];
}

/**
 * Estado de um botão de ação com trava: visível só no status certo; habilitado
 * quando não há faltas (vindas de GET /travas) e não há alterações por salvar.
 */
export function estadoAcaoComTrava(
  status: Status,
  acao: AcaoComTrava,
  faltas: string[] | undefined,
  alteracoesNaoSalvas: boolean,
): EstadoAcao {
  if (!acaoPermitidaNoStatus(status, acao)) {
    return { visivel: false, habilitada: false, motivo: null, faltas: [] };
  }
  const lista = faltas ?? [];
  if (alteracoesNaoSalvas) {
    return {
      visivel: true,
      habilitada: false,
      motivo: 'Salve as alterações desta etapa antes de continuar.',
      faltas: lista,
    };
  }
  if (lista.length > 0) {
    return { visivel: true, habilitada: false, motivo: null, faltas: lista };
  }
  return { visivel: true, habilitada: true, motivo: null, faltas: [] };
}

/** Qual ação com trava pertence ao rodapé de cada etapa. */
export const ACAO_DA_ETAPA: Record<'etapa1' | 'etapa2' | 'etapa3', AcaoComTrava> = {
  etapa1: 'liberar-instalacao',
  etapa2: 'concluir-instalacao',
  etapa3: 'validar-ccon',
};

export type AbaId = 'etapa1' | 'etapa2' | 'etapa3' | 'pendencias' | 'historico';

export const ABAS: { id: AbaId; rotulo: string }[] = [
  { id: 'etapa1', rotulo: 'Etapa 1 — Cadastro' },
  { id: 'etapa2', rotulo: 'Etapa 2 — Instalação' },
  { id: 'etapa3', rotulo: 'Etapa 3 — Testes e ativação' },
  { id: 'pendencias', rotulo: 'Pendências' },
  { id: 'historico', rotulo: 'Histórico' },
];

export function isAbaId(valor: string | null): valor is AbaId {
  return ABAS.some((a) => a.id === valor);
}

/** Aba aberta por padrão: a etapa onde a ficha está. */
export function abaPadrao(status: Status): AbaId {
  switch (status) {
    case 'cadastro_em_preenchimento':
    case 'pendencia_cadastral':
      return 'etapa1';
    case 'liberado_para_instalacao':
    case 'em_instalacao':
    case 'pendencia_tecnica':
      return 'etapa2';
    default:
      return 'etapa3';
  }
}

/** Rótulos do histórico (ação → texto). Aceita "-" ou "_" na chave. */
const EVENTO_ROTULO: Record<string, string> = {
  criou: 'Ficha criada',
  salvou_etapa1: 'Etapa 1 salva',
  salvou_etapa2: 'Etapa 2 salva',
  salvou_etapa3: 'Etapa 3 salva',
  salvou_pendencias: 'Pendências salvas',
  liberar_instalacao: 'Liberada para instalação',
  concluir_instalacao: 'Instalação concluída',
  validar_ccon: 'Validação da CCON',
  registrar_pendencia: 'Pendência registrada',
  retomar: 'Ficha retomada',
  enviar_email: 'Enviou a ficha por e-mail',
  enviou_email: 'Enviou a ficha por e-mail',
};

export function rotuloEvento(acao: string): string {
  return EVENTO_ROTULO[acao.replace(/-/g, '_')] ?? acao;
}

/** Quem recebe a ficha no botão "Enviar por e-mail" (definidos pelo backend; aqui só para exibir). */
export const DESTINATARIOS_EMAIL = [
  'ti@neoguard.com.br',
  'suporte@neoguard.com.br',
  'aux.ti@neoguard.com.br',
] as const;

export function mensagemEnvioOk(): string {
  const [ti, suporte, auxTi] = DESTINATARIOS_EMAIL;
  return `Ficha enviada para ${ti}, ${suporte} e ${auxTi}.`;
}
