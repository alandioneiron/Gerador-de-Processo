// Esqueleto vazio da ficha (espelha GET /api/fichas/modelo, seção 2 da ESPEC).
// Usado pelo mock e pelos testes; em produção o esqueleto vem do backend.
import type {
  Configuracoes,
  DadosFicha,
  Particularidades,
  TestesCcon,
  TestesTecnicos,
  Zona,
} from '../api/types';
import {
  CONFIGURACOES_CHAVES,
  PARTICULARIDADES_CHAVES,
  TESTES_CCON_CHAVES,
  TESTES_TECNICOS_CHAVES,
} from '../api/types';

function todosFalsos<K extends string>(chaves: readonly K[]): Record<K, boolean> {
  return Object.fromEntries(chaves.map((k) => [k, false])) as Record<K, boolean>;
}

export function numeroDaZona(n: number): string {
  return `Z${String(n).padStart(2, '0')}`;
}

export function zonaVazia(n: number): Zona {
  return {
    zona: numeroDaZona(n),
    ambiente: '',
    dispositivo: '',
    tipo: '',
    particao: '',
    testado: false,
    observacao: '',
  };
}

export function esqueletoVazio(): DadosFicha {
  const particularidades: Particularidades = {
    ...todosFalsos(PARTICULARIDADES_CHAVES),
    observacoes: '',
  };
  const configuracoes: Configuracoes = { ...todosFalsos(CONFIGURACOES_CHAVES), outro_texto: '' };
  const testesTecnicos: TestesTecnicos = todosFalsos(TESTES_TECNICOS_CHAVES);
  const testesCcon: TestesCcon = todosFalsos(TESTES_CCON_CHAVES);
  return {
    etapa1: {
      cliente: {
        razao_social: '',
        nome_fantasia: '',
        cpf_cnpj: '',
        responsavel_local: '',
        telefone: '',
        endereco: '',
        email: '',
        vendedor: '',
        data_prevista: '',
        numero_proposta: '',
        numero_contrato: '',
        servicos_contratados: '',
      },
      contatos: Array.from({ length: 5 }, (_, i) => ({
        ordem: i + 1,
        nome: '',
        funcao: '',
        tel_principal: '',
        tel_alternativo: '',
        decide: '' as const,
        restricoes: '',
      })),
      usuarios: Array.from({ length: 8 }, () => ({
        nome: '',
        funcao: '',
        telefone: '',
        teclado: '' as const,
        usa_app: '' as const,
        email_app: '',
        permissao: '' as const,
        particao: '',
        observacoes: '',
      })),
      areas_independentes: { possui: '', area1: '', area2: '', outras: '' },
      ambientes: Array.from({ length: 6 }, () => ({
        ambiente: '',
        acesso_local: '',
        observacao: '',
      })),
      rotina: {
        seg_sex: '',
        sabado: '',
        domingo_feriados: '',
        funciona_24h: '',
        abertura: '',
        fechamento: '',
        autorizados_fora_horario: '',
        autoativacao: '',
        autoativacao_obs: '',
      },
      particularidades,
      ccon: { particularidades: '', orientacao_disparo: '', palavra_seguranca: '' },
    },
    etapa2: {
      equipamentos: {
        modelo_central: '',
        modelo_outro: '',
        numero_serie: '',
        mac: '',
        firmware: '',
        teclados: '',
        receptor_sem_fio: '',
        expansores: '',
        sensores: '',
        sirenes: '',
        controles: '',
      },
      comunicacao: {
        principal: '',
        principal_outra: '',
        contingencia: '',
        contingencia_outra: '',
        conta_ip1: '',
        conta_ip2: '',
        protocolo: '',
      },
      zonas: Array.from({ length: 10 }, (_, i) => zonaVazia(i + 1)),
      particoes: [
        { particao: 'A', nome_area: '', zonas: '', observacao: '' },
        { particao: 'B', nome_area: '', zonas: '', observacao: '' },
        { particao: 'Comum', nome_area: '', zonas: '', observacao: '' },
      ],
      usuarios_config: { confirmado: '', excecoes: '' },
      configuracoes,
    },
    etapa3: {
      testes_tecnicos: testesTecnicos,
      testes_ccon: testesCcon,
      validacao_ccon: {
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
      },
    },
    pendencias: Array.from({ length: 3 }, () => ({
      descricao: '',
      responsavel: '',
      prazo: '',
      resolvido: false,
    })),
  };
}
