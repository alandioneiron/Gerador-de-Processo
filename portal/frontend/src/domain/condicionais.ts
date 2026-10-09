// Campos condicionais (anexo E do docx) e regras de aplicabilidade. Lógica pura.
import type {
  AreasIndependentes,
  Comunicacao,
  Configuracoes,
  DadosFicha,
  Equipamentos,
  Etapa1,
  TesteCconChave,
  TesteTecnicoChave,
  Usuario,
} from '../api/types';
import { TESTES_CCON_CHAVES, TESTES_TECNICOS_CHAVES } from '../api/types';

/** 1.3 — o e-mail só é habilitado com "Usa App?" = Sim. */
export function emailAppHabilitado(usuario: Pick<Usuario, 'usa_app'>): boolean {
  return usuario.usa_app === 'sim';
}

/** 1.4 — nomes das áreas só com "Existem áreas independentes?" = Sim. */
export function areasHabilitadas(areas: Pick<AreasIndependentes, 'possui'>): boolean {
  return areas.possui === 'sim';
}

/** 2.4 — a tabela de partições só aparece se 1.4 = Sim. */
export function mostrarParticoes(etapa1: Pick<Etapa1, 'areas_independentes'>): boolean {
  return areasHabilitadas(etapa1.areas_independentes);
}

/** 2.1 — "Outro: ____" só com o modelo "outro". */
export function modeloOutroHabilitado(eq: Pick<Equipamentos, 'modelo_central'>): boolean {
  return eq.modelo_central === 'outro';
}

/** 2.2 — "Outra: ____" da comunicação principal. */
export function principalOutraHabilitada(com: Pick<Comunicacao, 'principal'>): boolean {
  return com.principal === 'outra';
}

/** 2.2 — "Outra: ____" da contingência. */
export function contingenciaOutraHabilitada(com: Pick<Comunicacao, 'contingencia'>): boolean {
  return com.contingencia === 'outra';
}

/** 2.6 — "Outro: ____" só com o checkbox marcado. */
export function outroConfigHabilitado(cfg: Pick<Configuracoes, 'outro'>): boolean {
  return cfg.outro;
}

/** 2.5 — usuários da 1.3 que realmente existem (têm nome), sem redigitar. */
export function usuariosParaConfirmacao(usuarios: Usuario[]): Usuario[] {
  return usuarios.filter((u) => u.nome.trim() !== '');
}

export function algumUsuarioUsaApp(usuarios: Usuario[]): boolean {
  return usuarios.some((u) => u.nome.trim() !== '' && u.usa_app === 'sim');
}

export function possuiContingencia(com: Pick<Comunicacao, 'contingencia'>): boolean {
  return com.contingencia !== 'nao_possui';
}

// ---------- Progresso dos testes (itens obrigatórios) ----------
export interface Progresso {
  feitos: number;
  total: number;
  faltantes: string[];
}

/**
 * Itens da 3.1 que contam: a contingência é dispensada com "Não possui" e o aplicativo
 * só vale se algum usuário da 1.3 usa o app.
 */
export function chavesObrigatoriasTecnicas(dados: DadosFicha): TesteTecnicoChave[] {
  const semContingencia = dados.etapa2.comunicacao.contingencia === 'nao_possui';
  const semApp = !algumUsuarioUsaApp(dados.etapa1.usuarios);
  return TESTES_TECNICOS_CHAVES.filter((k) => {
    if (semContingencia && k === 'comunicacao_contingencia') return false;
    if (semApp && k === 'aplicativo') return false;
    return true;
  });
}

/** Itens da 3.2 que contam (contingência e aplicativo podem ser dispensados). */
export function chavesObrigatoriasCcon(dados: DadosFicha): TesteCconChave[] {
  const semContingencia = dados.etapa2.comunicacao.contingencia === 'nao_possui';
  const semApp = !algumUsuarioUsaApp(dados.etapa1.usuarios);
  return TESTES_CCON_CHAVES.filter((k) => {
    if (semContingencia && k === 'comunicacao_contingencia') return false;
    if (semApp && k === 'aplicativo') return false;
    return true;
  });
}

export function progressoDosTestes<K extends string>(
  marcados: Record<K, boolean>,
  obrigatorios: readonly K[],
): Progresso {
  const faltantes = obrigatorios.filter((k) => !marcados[k]);
  return {
    feitos: obrigatorios.length - faltantes.length,
    total: obrigatorios.length,
    faltantes: faltantes as string[],
  };
}
