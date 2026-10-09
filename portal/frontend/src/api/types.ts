// Tipos escritos à mão a partir de docs/portal/ESPEC-FASE1.md (seções 2, 3 e 4).
// Chaves em snake_case, sem acento — exatamente as do contrato.

export type SimNao = 'sim' | 'nao' | '';

// ---------- Status ----------
export const STATUS_LISTA = [
  'cadastro_em_preenchimento',
  'pendencia_cadastral',
  'liberado_para_instalacao',
  'em_instalacao',
  'pendencia_tecnica',
  'instalacao_concluida',
  'aguardando_testes_ccon',
  'ativo_monitorado',
] as const;
export type Status = (typeof STATUS_LISTA)[number];

export type AcaoFicha =
  | 'liberar-instalacao'
  | 'concluir-instalacao'
  | 'validar-ccon'
  | 'registrar-pendencia'
  | 'retomar'
  | 'enviar-email';

/** Ações que têm lista de travas em GET /travas. */
export type AcaoComTrava = 'liberar-instalacao' | 'concluir-instalacao' | 'validar-ccon';

// ---------- Etapa 1 ----------
export interface Cliente {
  razao_social: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  responsavel_local: string;
  telefone: string;
  endereco: string;
  email: string;
  vendedor: string;
  data_prevista: string; // ISO AAAA-MM-DD
  numero_proposta: string;
  numero_contrato: string;
  servicos_contratados: string;
}

export interface Contato {
  ordem: number;
  nome: string;
  funcao: string;
  tel_principal: string;
  tel_alternativo: string;
  decide: SimNao;
  restricoes: string;
}

export type PermissaoUsuario = 'arma_desarma' | 'so_arma' | '';

export interface Usuario {
  nome: string;
  funcao: string;
  telefone: string;
  teclado: SimNao;
  usa_app: SimNao;
  email_app: string;
  permissao: PermissaoUsuario;
  particao: string;
  observacoes: string;
}

export interface AreasIndependentes {
  possui: SimNao;
  area1: string;
  area2: string;
  outras: string;
}

export interface Ambiente {
  ambiente: string;
  acesso_local: string;
  observacao: string;
}

export interface Rotina {
  seg_sex: string;
  sabado: string;
  domingo_feriados: string;
  funciona_24h: SimNao;
  abertura: string;
  fechamento: string;
  autorizados_fora_horario: string;
  autoativacao: SimNao;
  autoativacao_obs: string;
}

export const PARTICULARIDADES_CHAVES = [
  'animais',
  'portaria_24h',
  'gerador',
  'nobreak',
  'internet',
  'rede_cabeada',
  'wifi',
  'cftv',
  'controle_acesso',
  'cerca_eletrica',
  'automacao',
  'botao_panico',
  'neoguard_imagens',
  'outros_sistemas',
] as const;
export type ParticularidadeChave = (typeof PARTICULARIDADES_CHAVES)[number];

export type Particularidades = Record<ParticularidadeChave, boolean> & { observacoes: string };

export interface InfoCcon {
  particularidades: string;
  orientacao_disparo: string;
  /** Só o desejo (sim/nao) — NUNCA o conteúdo da palavra de segurança. */
  palavra_seguranca: SimNao;
}

export interface Etapa1 {
  cliente: Cliente;
  contatos: Contato[];
  usuarios: Usuario[];
  areas_independentes: AreasIndependentes;
  ambientes: Ambiente[];
  rotina: Rotina;
  particularidades: Particularidades;
  ccon: InfoCcon;
}

// ---------- Etapa 2 ----------
export const MODELOS_CENTRAL = [
  'AMT 2018 E',
  'AMT 2018 EG',
  'AMT 2118 EG',
  'AMT 2018 E3G',
  'outro',
] as const;
export type ModeloCentral = (typeof MODELOS_CENTRAL)[number] | '';

export type ComunicacaoPrincipal = 'ethernet' | 'gprs' | '3g' | 'outra' | '';
export type ComunicacaoContingencia = 'nao_possui' | 'gprs' | 'ethernet' | 'outra' | '';

export interface Equipamentos {
  modelo_central: ModeloCentral;
  modelo_outro: string;
  numero_serie: string;
  mac: string;
  firmware: string;
  teclados: string;
  receptor_sem_fio: string;
  expansores: string;
  sensores: string;
  sirenes: string;
  controles: string;
}

export interface Comunicacao {
  principal: ComunicacaoPrincipal;
  principal_outra: string;
  contingencia: ComunicacaoContingencia;
  contingencia_outra: string;
  conta_ip1: string;
  conta_ip2: string;
  protocolo: string;
}

export interface Zona {
  zona: string;
  ambiente: string;
  dispositivo: string;
  tipo: string;
  particao: string;
  testado: boolean;
  observacao: string;
}

export interface Particao {
  particao: string;
  nome_area: string;
  zonas: string;
  observacao: string;
}

export interface UsuariosConfig {
  confirmado: SimNao;
  excecoes: string;
}

export const CONFIGURACOES_CHAVES = [
  'temporizacoes',
  'identificacao_zonas',
  'autoativacao',
  'identificacao_usuarios',
  'pgm_automacao',
  'notificacoes_app',
  'panico',
  'outro',
] as const;
export type ConfiguracaoChave = (typeof CONFIGURACOES_CHAVES)[number];

export type Configuracoes = Record<ConfiguracaoChave, boolean> & { outro_texto: string };

export interface Etapa2 {
  equipamentos: Equipamentos;
  comunicacao: Comunicacao;
  zonas: Zona[];
  particoes: Particao[];
  usuarios_config: UsuariosConfig;
  configuracoes: Configuracoes;
}

// ---------- Etapa 3 ----------
export const TESTES_TECNICOS_CHAVES = [
  'central_energizada',
  'arme',
  'bateria',
  'desarme',
  'sirene',
  'aplicativo',
  'sensores',
  'comunicacao_principal',
  'todas_zonas',
  'comunicacao_contingencia',
  'identificacao_zonas',
  'particoes',
] as const;
export type TesteTecnicoChave = (typeof TESTES_TECNICOS_CHAVES)[number];
export type TestesTecnicos = Record<TesteTecnicoChave, boolean>;

export const TESTES_CCON_CHAVES = [
  'evento_arme',
  'falha_energia',
  'evento_desarme',
  'restabelecimento',
  'disparo',
  'comunicacao_principal',
  'zona_correta',
  'comunicacao_contingencia',
  'usuario_identificado',
  'lista_contatos',
  'ordem_contatos',
  'regras_operacionais',
  'aplicativo',
] as const;
export type TesteCconChave = (typeof TESTES_CCON_CHAVES)[number];
export type TestesCcon = Record<TesteCconChave, boolean>;

export type OkPendente = 'ok' | 'pendente' | '';

export interface ValidacaoCcon {
  operador: string;
  data: string; // ISO AAAA-MM-DD
  hora: string; // HH:mm
  cadastro: OkPendente;
  comunicacao: OkPendente;
  eventos: OkPendente;
  contatos: OkPendente;
  regras_operacionais: OkPendente;
  resultado: 'aprovado' | 'reprovado' | '';
  observacoes: string;
}

export interface Etapa3 {
  testes_tecnicos: TestesTecnicos;
  testes_ccon: TestesCcon;
  validacao_ccon: ValidacaoCcon;
}

// ---------- Pendências ----------
export interface Pendencia {
  descricao: string;
  responsavel: string;
  prazo: string;
  resolvido: boolean;
}

// ---------- Ficha ----------
export interface DadosFicha {
  etapa1: Etapa1;
  etapa2: Etapa2;
  etapa3: Etapa3;
  pendencias: Pendencia[];
}

export interface Autor {
  nome: string;
  email: string;
}

export interface Evento {
  em: string;
  autor_nome: string;
  autor_email: string;
  acao: string;
  status_de: Status | '' | null;
  status_para: Status | '' | null;
  resumo: string;
}

export interface Ficha {
  id: number | string;
  numero: number;
  codigo: string;
  status: Status;
  versao: number;
  dados: DadosFicha;
  criado_em: string;
  atualizado_em: string;
  eventos: Evento[];
}

export interface FichaResumo {
  id: number | string;
  numero: number;
  codigo: string;
  status: Status;
  cliente: string;
  vendedor: string;
  data_prevista: string;
  criado_em: string;
  atualizado_em: string;
}

export type Travas = Record<AcaoComTrava, string[]>;

// ---------- Corpos de requisição ----------
export interface CorpoEscrita {
  autor: Autor;
  versao: number;
}

export interface CorpoEtapa1 extends CorpoEscrita {
  etapa1: Etapa1;
}
export interface CorpoEtapa2 extends CorpoEscrita {
  etapa2: Etapa2;
}
export interface CorpoEtapa3 extends CorpoEscrita {
  testes_tecnicos: TestesTecnicos;
  testes_ccon: TestesCcon;
}
export interface CorpoPendencias extends CorpoEscrita {
  pendencias: Pendencia[];
}

export type TipoPendencia = 'cadastral' | 'tecnica';

export interface ExtrasRegistrarPendencia {
  tipo: TipoPendencia;
  descricao: string;
  responsavel?: string;
  prazo?: string;
}
export interface ExtrasValidarCcon {
  validacao_ccon: ValidacaoCcon;
}
/** `enviar-email` não exige `versao` e não muda o status (corpo: autor + mensagem opcional). */
export interface CorpoEnviarEmail {
  autor: Autor;
  mensagem?: string;
}
export type ExtrasAcao = ExtrasRegistrarPendencia | ExtrasValidarCcon | Record<string, never>;
