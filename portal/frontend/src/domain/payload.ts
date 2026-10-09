// Montagem dos corpos de requisição (ESPEC-FASE1, seção 4). Lógica pura.
// Cada função recebe o rascunho da tela e devolve o JSON exato que o backend espera:
// limpa espaços, zera campos condicionais que não se aplicam e renumera o que for sequencial.
import type {
  Autor,
  CorpoEtapa1,
  CorpoEtapa2,
  CorpoEtapa3,
  CorpoPendencias,
  Etapa1,
  Etapa2,
  Etapa3,
  ExtrasRegistrarPendencia,
  OkPendente,
  Pendencia,
  TipoPendencia,
  ValidacaoCcon,
} from '../api/types';

/** Copia profunda aparando espaços de todos os textos. */
export function aparar<T>(valor: T): T {
  if (typeof valor === 'string') return valor.trim() as unknown as T;
  if (Array.isArray(valor)) return valor.map((v) => aparar(v)) as unknown as T;
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, aparar(v)]),
    ) as T;
  }
  return valor;
}

export function montarEtapa1(rascunho: Etapa1): Etapa1 {
  const e = aparar(rascunho);
  return {
    ...e,
    // ordem = sequência de acionamento da CCON
    contatos: e.contatos.map((c, i) => ({ ...c, ordem: i + 1 })),
    // e-mail do aplicativo só vale para quem usa o app
    usuarios: e.usuarios.map((u) => (u.usa_app === 'sim' ? u : { ...u, email_app: '' })),
    // nomes das áreas só valem com "Sim"
    areas_independentes:
      e.areas_independentes.possui === 'sim'
        ? e.areas_independentes
        : { ...e.areas_independentes, area1: '', area2: '', outras: '' },
  };
}

export function montarEtapa2(rascunho: Etapa2): Etapa2 {
  const e = aparar(rascunho);
  return {
    ...e,
    equipamentos: {
      ...e.equipamentos,
      modelo_outro: e.equipamentos.modelo_central === 'outro' ? e.equipamentos.modelo_outro : '',
    },
    comunicacao: {
      ...e.comunicacao,
      principal_outra: e.comunicacao.principal === 'outra' ? e.comunicacao.principal_outra : '',
      contingencia_outra:
        e.comunicacao.contingencia === 'outra' ? e.comunicacao.contingencia_outra : '',
    },
    configuracoes: {
      ...e.configuracoes,
      outro_texto: e.configuracoes.outro ? e.configuracoes.outro_texto : '',
    },
  };
}

export function montarEtapa3(rascunho: Pick<Etapa3, 'testes_tecnicos' | 'testes_ccon'>) {
  return {
    testes_tecnicos: { ...rascunho.testes_tecnicos },
    testes_ccon: { ...rascunho.testes_ccon },
  };
}

export function montarPendencias(rascunho: Pendencia[]): Pendencia[] {
  return aparar(rascunho);
}

export function montarCorpoEtapa1(autor: Autor, versao: number, etapa1: Etapa1): CorpoEtapa1 {
  return { autor, versao, etapa1: montarEtapa1(etapa1) };
}

export function montarCorpoEtapa2(autor: Autor, versao: number, etapa2: Etapa2): CorpoEtapa2 {
  return { autor, versao, etapa2: montarEtapa2(etapa2) };
}

export function montarCorpoEtapa3(
  autor: Autor,
  versao: number,
  etapa3: Pick<Etapa3, 'testes_tecnicos' | 'testes_ccon'>,
): CorpoEtapa3 {
  return { autor, versao, ...montarEtapa3(etapa3) };
}

export function montarCorpoPendencias(
  autor: Autor,
  versao: number,
  pendencias: Pendencia[],
): CorpoPendencias {
  return { autor, versao, pendencias: montarPendencias(pendencias) };
}

// ---------- Ações ----------
export const ITENS_VALIDACAO = [
  ['cadastro', 'Cadastro'],
  ['comunicacao', 'Comunicação'],
  ['eventos', 'Eventos'],
  ['contatos', 'Contatos'],
  ['regras_operacionais', 'Regras operacionais'],
] as const satisfies readonly (readonly [keyof ValidacaoCcon, string])[];

export function validacaoCconVazia(): ValidacaoCcon {
  return {
    operador: '',
    data: '',
    hora: '',
    cadastro: '',
    comunicacao: '',
    eventos: '',
    contatos: '',
    regras_operacionais: '',
    resultado: '',
    observacoes: '',
  };
}

/** Problemas do modal "Validar CCON" que dá para detectar antes de chamar a API. */
export function problemasValidacaoCcon(v: ValidacaoCcon): string[] {
  const problemas: string[] = [];
  if (!v.operador.trim()) problemas.push('Informe o operador da CCON.');
  if (!v.data) problemas.push('Informe a data.');
  if (!v.hora) problemas.push('Informe a hora.');
  for (const [chave, rotulo] of ITENS_VALIDACAO) {
    if (v[chave] === '') problemas.push(`Marque OK ou PENDENTE em "${rotulo}".`);
  }
  if (!v.resultado) {
    problemas.push('Escolha o resultado (aprovado ou reprovado).');
  } else if (v.resultado === 'aprovado') {
    const pendentes = ITENS_VALIDACAO.filter(([chave]) => v[chave] === 'pendente');
    if (pendentes.length > 0) {
      problemas.push(
        `Para aprovar, todos os itens precisam estar OK (pendente: ${pendentes
          .map(([, r]) => r)
          .join(', ')}).`,
      );
    }
  }
  return problemas;
}

export function montarValidacaoCcon(v: ValidacaoCcon): ValidacaoCcon {
  return aparar(v);
}

export function montarCorpoValidarCcon(autor: Autor, versao: number, v: ValidacaoCcon) {
  return { autor, versao, validacao_ccon: montarValidacaoCcon(v) };
}

/** Extras de `registrar-pendencia`: só envia responsável/prazo quando preenchidos. */
export function montarExtrasRegistrarPendencia(extras: {
  tipo: TipoPendencia;
  descricao: string;
  responsavel?: string;
  prazo?: string;
}): ExtrasRegistrarPendencia {
  const corpo: ExtrasRegistrarPendencia = { tipo: extras.tipo, descricao: extras.descricao.trim() };
  if (extras.responsavel?.trim()) corpo.responsavel = extras.responsavel.trim();
  if (extras.prazo) corpo.prazo = extras.prazo;
  return corpo;
}

export function montarCorpoRegistrarPendencia(
  autor: Autor,
  versao: number,
  extras: { tipo: TipoPendencia; descricao: string; responsavel?: string; prazo?: string },
): { autor: Autor; versao: number } & ExtrasRegistrarPendencia {
  return { autor, versao, ...montarExtrasRegistrarPendencia(extras) };
}

export function montarCorpoSimples(autor: Autor, versao: number) {
  return { autor, versao };
}

/** Tipo padrão da pendência conforme o status atual. */
export function tipoPendenciaPadrao(
  status: string,
): TipoPendencia {
  return status === 'cadastro_em_preenchimento' || status === 'pendencia_cadastral'
    ? 'cadastral'
    : 'tecnica';
}

// ---------- Identificação ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarAutor(autor: Partial<Autor>): { nome?: string; email?: string } {
  const erros: { nome?: string; email?: string } = {};
  if (!autor.nome?.trim()) erros.nome = 'Informe o seu nome.';
  const email = autor.email?.trim() ?? '';
  if (!email) erros.email = 'Informe o seu e-mail.';
  else if (!EMAIL_RE.test(email)) erros.email = 'E-mail inválido.';
  return erros;
}

export type { OkPendente };
