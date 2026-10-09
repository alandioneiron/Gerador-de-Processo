// Opções de comunicação conforme o modelo da central (ESPEC-FASE1, seção 6 / anexo E do docx).
//   AMT 2018 E               -> só Ethernet
//   AMT 2018 EG, AMT 2118 EG -> Ethernet e GPRS
//   AMT 2018 E3G             -> Ethernet e 3G
//   outro (ou não escolhido) -> todas
import type {
  ComunicacaoContingencia,
  ComunicacaoPrincipal,
  ModeloCentral,
} from '../api/types';

export interface Opcao<V extends string> {
  value: V;
  label: string;
}

export interface CapacidadesModelo {
  gprs: boolean;
  tresG: boolean;
}

export function capacidadesDoModelo(modelo: ModeloCentral): CapacidadesModelo {
  switch (modelo) {
    case 'AMT 2018 E':
      return { gprs: false, tresG: false };
    case 'AMT 2018 EG':
    case 'AMT 2118 EG':
      return { gprs: true, tresG: false };
    case 'AMT 2018 E3G':
      return { gprs: false, tresG: true };
    case 'outro':
    case '':
    default:
      return { gprs: true, tresG: true };
  }
}

/** Comunicação principal: Ethernet/IP · GPRS · 3G · Outra (GPRS/3G conforme o modelo). */
export function opcoesPrincipal(modelo: ModeloCentral): Opcao<Exclude<ComunicacaoPrincipal, ''>>[] {
  const cap = capacidadesDoModelo(modelo);
  const opcoes: Opcao<Exclude<ComunicacaoPrincipal, ''>>[] = [
    { value: 'ethernet', label: 'Ethernet/IP' },
  ];
  if (cap.gprs) opcoes.push({ value: 'gprs', label: 'GPRS' });
  if (cap.tresG) opcoes.push({ value: '3g', label: '3G' });
  opcoes.push({ value: 'outra', label: 'Outra' });
  return opcoes;
}

/** Contingência: Não possui · GPRS · Ethernet/IP · Outra (GPRS só se o modelo suportar). */
export function opcoesContingencia(
  modelo: ModeloCentral,
): Opcao<Exclude<ComunicacaoContingencia, ''>>[] {
  const cap = capacidadesDoModelo(modelo);
  const opcoes: Opcao<Exclude<ComunicacaoContingencia, ''>>[] = [
    { value: 'nao_possui', label: 'Não possui' },
  ];
  if (cap.gprs) opcoes.push({ value: 'gprs', label: 'GPRS' });
  opcoes.push({ value: 'ethernet', label: 'Ethernet/IP' });
  opcoes.push({ value: 'outra', label: 'Outra' });
  return opcoes;
}

export interface ComunicacaoAjustada {
  principal: ComunicacaoPrincipal;
  contingencia: ComunicacaoContingencia;
  /** `true` se algum valor foi limpo por não existir mais no novo modelo. */
  mudou: boolean;
}

/** Ao trocar o modelo, limpa a escolha que deixou de existir (ex.: GPRS na AMT 2018 E). */
export function ajustarComunicacaoAoModelo(
  modelo: ModeloCentral,
  principal: ComunicacaoPrincipal,
  contingencia: ComunicacaoContingencia,
): ComunicacaoAjustada {
  const okPrincipal = principal === '' || opcoesPrincipal(modelo).some((o) => o.value === principal);
  const okContingencia =
    contingencia === '' || opcoesContingencia(modelo).some((o) => o.value === contingencia);
  return {
    principal: okPrincipal ? principal : '',
    contingencia: okContingencia ? contingencia : '',
    mudou: !okPrincipal || !okContingencia,
  };
}
