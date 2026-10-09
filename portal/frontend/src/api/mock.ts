// Backend SIMULADO em memória (persistido em localStorage) para desenvolver a tela sem o FastAPI.
// Respeita o contrato da ESPEC-FASE1: versões (409), status e travas (409/422), eventos e travas.
// Só é carregado com `npm run dev:mock` (VITE_MOCK=1); nunca entra no build de produção.
import { ApiError, type Api, type FiltroFichas } from './client';
import type {
  AcaoFicha,
  Autor,
  DadosFicha,
  Evento,
  Ficha,
  FichaResumo,
  Pendencia,
  Status,
  Travas,
  ValidacaoCcon,
} from './types';
import { TESTES_TECNICOS_CHAVES } from './types';
import { esqueletoVazio } from '../domain/modelo';
import { STATUS_ROTULO, podeEditar } from '../domain/status';
import { chavesObrigatoriasCcon, chavesObrigatoriasTecnicas } from '../domain/condicionais';

const CHAVE_ARMAZENAMENTO = 'portal.mock.v1';

interface Estado {
  proximoId: number;
  fichas: Ficha[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const agora = () => new Date().toISOString();
const espera = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms));

function evento(
  autor: Autor,
  acao: string,
  de: Status | '' | null,
  para: Status | '' | null,
  resumo: string,
  em = agora(),
): Evento {
  return { em, autor_nome: autor.nome, autor_email: autor.email, acao, status_de: de, status_para: para, resumo };
}

// ---------------------------------------------------------------- dados de exemplo (FICTÍCIOS)

const AUTOR_DEMO: Autor = { nome: 'Pessoa Teste', email: 'teste@exemplo.invalid' };

function fichaBase(id: number, status: Status, dados: DadosFicha, eventos: Evento[]): Ficha {
  const criado = new Date(Date.now() - 86400000 * (10 - id)).toISOString();
  return {
    id,
    numero: id,
    codigo: `FI-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`,
    status,
    versao: 1 + eventos.length,
    dados,
    criado_em: criado,
    atualizado_em: eventos[0]?.em ?? criado,
    eventos,
  };
}

function cadastroCompleto(razao: string, fantasia: string): DadosFicha {
  const d = esqueletoVazio();
  const c = d.etapa1.cliente;
  c.razao_social = razao;
  c.nome_fantasia = fantasia;
  c.cpf_cnpj = '00.000.000/0001-00';
  c.responsavel_local = 'Fulano de Tal';
  c.telefone = '(00) 00000-0000';
  c.endereco = 'Rua Exemplo, 123 — Centro — Cidade Teste/UF';
  c.email = 'contato@exemplo.invalid';
  c.vendedor = 'Vendedor Teste';
  c.data_prevista = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);
  c.numero_proposta = 'P-0001';
  c.numero_contrato = 'C-0001';
  c.servicos_contratados = 'Alarme monitorado 24h';
  d.etapa1.contatos[0] = {
    ordem: 1, nome: 'Fulano de Tal', funcao: 'Proprietário', tel_principal: '(00) 00000-0000',
    tel_alternativo: '', decide: 'sim', restricoes: 'Não ligar após 22h',
  };
  d.etapa1.contatos[1] = {
    ordem: 2, nome: 'Beltrana Exemplo', funcao: 'Gerente', tel_principal: '(00) 11111-1111',
    tel_alternativo: '', decide: 'nao', restricoes: '',
  };
  d.etapa1.usuarios[0] = {
    nome: 'Fulano de Tal', funcao: 'Proprietário', telefone: '(00) 00000-0000', teclado: 'sim',
    usa_app: 'sim', email_app: 'fulano@exemplo.invalid', permissao: 'arma_desarma', particao: 'A', observacoes: '',
  };
  d.etapa1.usuarios[1] = {
    nome: 'Porteiro Exemplo', funcao: 'Porteiro', telefone: '', teclado: 'sim',
    usa_app: 'nao', email_app: '', permissao: 'so_arma', particao: '', observacoes: '',
  };
  d.etapa1.ambientes[0] = { ambiente: 'Loja', acesso_local: 'Porta principal', observacao: '' };
  d.etapa1.ambientes[1] = { ambiente: 'Estoque', acesso_local: 'Porta dos fundos', observacao: '' };
  d.etapa1.particularidades.internet = true;
  d.etapa1.particularidades.nobreak = true;
  return d;
}

function semear(): Estado {
  const f1 = (() => {
    const d = esqueletoVazio();
    d.etapa1.cliente.razao_social = 'Padaria Exemplo Ltda';
    d.etapa1.cliente.vendedor = 'Vendedor Teste';
    d.etapa1.contatos[0].nome = 'Fulano de Tal';
    return fichaBase(1, 'cadastro_em_preenchimento', d, [
      evento(AUTOR_DEMO, 'criou', null, 'cadastro_em_preenchimento', 'Ficha criada.'),
    ]);
  })();

  const f2 = (() => {
    const d = cadastroCompleto('Oficina Modelo ME', 'Oficina Modelo');
    d.etapa2.equipamentos.modelo_central = 'AMT 2018 EG';
    d.etapa2.equipamentos.numero_serie = 'SN-EXEMPLO-001';
    d.etapa2.zonas[0].ambiente = 'Loja';
    d.etapa2.zonas[0].dispositivo = 'Sensor IVP';
    return fichaBase(2, 'em_instalacao', d, [
      evento(AUTOR_DEMO, 'salvou_etapa2', 'liberado_para_instalacao', 'em_instalacao', 'Etapa 2 salva.'),
      evento(AUTOR_DEMO, 'liberar-instalacao', 'cadastro_em_preenchimento', 'liberado_para_instalacao', 'Liberada para instalação.'),
      evento(AUTOR_DEMO, 'salvou_etapa1', null, null, 'Etapa 1 salva.'),
      evento(AUTOR_DEMO, 'criou', null, 'cadastro_em_preenchimento', 'Ficha criada.'),
    ]);
  })();

  const f3 = (() => {
    const d = cadastroCompleto('Clínica Teste S/A', 'Clínica Teste');
    const eq = d.etapa2.equipamentos;
    eq.modelo_central = 'AMT 2018 E3G';
    eq.numero_serie = 'SN-EXEMPLO-002';
    eq.mac = 'AA:BB:CC:DD:EE:FF';
    d.etapa2.comunicacao.principal = 'ethernet';
    d.etapa2.comunicacao.contingencia = 'ethernet';
    d.etapa2.zonas[0] = { ...d.etapa2.zonas[0], ambiente: 'Recepção', dispositivo: 'Sensor IVP', tipo: 'Instantânea', testado: true };
    d.etapa2.usuarios_config.confirmado = 'sim';
    for (const k of TESTES_TECNICOS_CHAVES) d.etapa3.testes_tecnicos[k] = true;
    return fichaBase(3, 'aguardando_testes_ccon', d, [
      evento(AUTOR_DEMO, 'salvou_etapa3', 'instalacao_concluida', 'aguardando_testes_ccon', 'Testes técnicos concluídos.'),
      evento(AUTOR_DEMO, 'concluir-instalacao', 'em_instalacao', 'instalacao_concluida', 'Instalação concluída.'),
      evento(AUTOR_DEMO, 'liberar-instalacao', 'cadastro_em_preenchimento', 'liberado_para_instalacao', 'Liberada para instalação.'),
      evento(AUTOR_DEMO, 'criou', null, 'cadastro_em_preenchimento', 'Ficha criada.'),
    ]);
  })();

  return { proximoId: 4, fichas: [f1, f2, f3] };
}

let estado: Estado | null = null;

function obterEstado(): Estado {
  if (estado) return estado;
  try {
    const bruto = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (bruto) {
      estado = JSON.parse(bruto) as Estado;
      return estado;
    }
  } catch {
    /* localStorage indisponível: segue só em memória */
  }
  estado = semear();
  persistir();
  return estado;
}

function persistir() {
  try {
    window.localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(estado));
  } catch {
    /* ignora */
  }
}

/** Reinicia o mock (útil no console do navegador: `window.__mockReset()`). */
export function reiniciarMock() {
  estado = semear();
  persistir();
}
if (typeof window !== 'undefined') {
  (window as unknown as { __mockReset?: () => void }).__mockReset = () => {
    reiniciarMock();
    window.location.reload();
  };
}

// ---------------------------------------------------------------- regras

function nomeCliente(d: DadosFicha): string {
  return d.etapa1.cliente.razao_social.trim() || d.etapa1.cliente.nome_fantasia.trim();
}

function resumo(f: Ficha): FichaResumo {
  const c = f.dados.etapa1.cliente;
  return {
    id: f.id, numero: f.numero, codigo: f.codigo, status: f.status,
    cliente: nomeCliente(f.dados), vendedor: c.vendedor, data_prevista: c.data_prevista,
    criado_em: f.criado_em, atualizado_em: f.atualizado_em,
  };
}

function exigirAutor(autor: Autor | undefined): Autor {
  if (!autor?.nome?.trim() || !autor?.email?.trim()) {
    throw new ApiError(422, 'Informe o nome e o e-mail de quem está preenchendo.');
  }
  return { nome: autor.nome.trim(), email: autor.email.trim() };
}

function achar(id: string | number): Ficha {
  const f = obterEstado().fichas.find((x) => String(x.id) === String(id));
  if (!f) throw new ApiError(404, 'Ficha não encontrada.');
  return f;
}

function conferirVersao(f: Ficha, versao: number) {
  if (versao !== f.versao) {
    throw new ApiError(409, 'A ficha foi alterada por outra pessoa. Recarregue.');
  }
}

function tocar(f: Ficha, ev: Evento) {
  f.versao += 1;
  f.atualizado_em = ev.em;
  f.eventos.unshift(ev);
  persistir();
}

export function faltasLiberar(d: DadosFicha): string[] {
  const c = d.etapa1.cliente;
  const faltas: string[] = [];
  if (!c.razao_social.trim()) faltas.push('Razão social / nome do cliente');
  if (!c.endereco.trim()) faltas.push('Endereço completo da instalação');
  if (!c.telefone.trim()) faltas.push('Telefone do cliente');
  if (!c.vendedor.trim()) faltas.push('Vendedor responsável');
  if (!c.data_prevista) faltas.push('Data prevista da instalação');
  if (!d.etapa1.contatos.some((x) => x.nome.trim() && x.tel_principal.trim())) {
    faltas.push('Ao menos 1 contato de ocorrência com nome e telefone principal (1.2)');
  }
  const comNome = d.etapa1.usuarios.filter((u) => u.nome.trim());
  if (!comNome.some((u) => u.permissao)) faltas.push('Ao menos 1 usuário com nome e permissão (1.3)');
  comNome.filter((u) => u.usa_app === 'sim' && !u.email_app.trim()).forEach((u) =>
    faltas.push(`E-mail do aplicativo de "${u.nome}" (usa app = Sim)`),
  );
  return faltas;
}

export function faltasConcluir(d: DadosFicha): string[] {
  const e = d.etapa2;
  const faltas: string[] = [];
  if (!e.equipamentos.modelo_central) faltas.push('Modelo da central (2.1)');
  else if (e.equipamentos.modelo_central === 'outro' && !e.equipamentos.modelo_outro.trim()) {
    faltas.push('Qual é o modelo "Outro" da central (2.1)');
  }
  if (!e.equipamentos.numero_serie.trim()) faltas.push('Número de série da central (2.1)');
  if (!e.comunicacao.principal) faltas.push('Comunicação principal (2.2)');
  if (!e.zonas.some((z) => z.ambiente.trim() && z.dispositivo.trim())) {
    faltas.push('Ao menos 1 zona com ambiente e dispositivo (2.3)');
  }
  if (e.usuarios_config.confirmado !== 'sim') faltas.push('Confirmar os usuários cadastrados na central (2.5)');
  if (d.etapa1.areas_independentes.possui === 'sim' && !e.particoes[0]?.nome_area.trim()) {
    faltas.push('Nome / área da partição A (2.4)');
  }
  return faltas;
}

export function faltasTestes(d: DadosFicha): string[] {
  const faltas: string[] = [];
  const tec = chavesObrigatoriasTecnicas(d).filter((k) => !d.etapa3.testes_tecnicos[k]);
  const cc = chavesObrigatoriasCcon(d).filter((k) => !d.etapa3.testes_ccon[k]);
  if (tec.length) faltas.push(`Testes técnicos (3.1) pendentes: ${tec.length}`);
  if (cc.length) faltas.push(`Testes com a CCON (3.2) pendentes: ${cc.length}`);
  return faltas;
}

function faltasValidacao(v: ValidacaoCcon): string[] {
  const faltas: string[] = [];
  if (!v.operador.trim()) faltas.push('Operador da CCON');
  if (!v.data) faltas.push('Data da validação');
  if (!v.hora) faltas.push('Hora da validação');
  (['cadastro', 'comunicacao', 'eventos', 'contatos', 'regras_operacionais'] as const).forEach((k) => {
    if (v[k] !== 'ok') faltas.push(`Item "${k.replace('_', ' ')}" precisa estar OK`);
  });
  return faltas;
}

function todosTecnicosMarcados(d: DadosFicha): boolean {
  return chavesObrigatoriasTecnicas(d).every((k) => d.etapa3.testes_tecnicos[k]);
}

function exigirEditavel(f: Ficha, secao: 'etapa1' | 'etapa2' | 'etapa3' | 'pendencias', nome: string) {
  if (!podeEditar(f.status, secao)) {
    throw new ApiError(409, `${nome} não pode ser editada no status "${STATUS_ROTULO[f.status]}".`);
  }
}

// ---------------------------------------------------------------- API simulada

export const apiMock: Api = {
  async saude() {
    await espera(30);
    return { ok: true, versao: 'mock' };
  },

  async modelo() {
    await espera(30);
    return esqueletoVazio();
  },

  async listarFichas(filtro?: FiltroFichas) {
    await espera();
    const q = (filtro?.q ?? '').trim().toLowerCase();
    return obterEstado()
      .fichas.filter((f) => !filtro?.status || f.status === filtro.status)
      .filter((f) => {
        if (!q) return true;
        const c = f.dados.etapa1.cliente;
        return [nomeCliente(f.dados), c.vendedor, f.codigo, c.cpf_cnpj].some((t) => t.toLowerCase().includes(q));
      })
      .map(resumo)
      .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
  },

  async criarFicha(autorEntrada) {
    await espera();
    const autor = exigirAutor(autorEntrada);
    const st = obterEstado();
    const id = st.proximoId++;
    const f = fichaBase(id, 'cadastro_em_preenchimento', esqueletoVazio(), [
      evento(autor, 'criou', null, 'cadastro_em_preenchimento', 'Ficha criada.'),
    ]);
    f.criado_em = f.atualizado_em = agora();
    f.versao = 1;
    st.fichas.push(f);
    persistir();
    return clone(f);
  },

  async obterFicha(id) {
    await espera();
    return clone(achar(id));
  },

  async salvarEtapa1(id, corpo) {
    await espera();
    const autor = exigirAutor(corpo.autor);
    const f = achar(id);
    conferirVersao(f, corpo.versao);
    exigirEditavel(f, 'etapa1', 'A Etapa 1');
    f.dados.etapa1 = clone(corpo.etapa1);
    tocar(f, evento(autor, 'salvou_etapa1', f.status, f.status, 'Etapa 1 salva.'));
    return clone(f);
  },

  async salvarEtapa2(id, corpo) {
    await espera();
    const autor = exigirAutor(corpo.autor);
    const f = achar(id);
    conferirVersao(f, corpo.versao);
    exigirEditavel(f, 'etapa2', 'A Etapa 2');
    f.dados.etapa2 = clone(corpo.etapa2);
    const de = f.status;
    if (f.status === 'liberado_para_instalacao') f.status = 'em_instalacao';
    tocar(f, evento(autor, 'salvou_etapa2', de, f.status, 'Etapa 2 salva.'));
    return clone(f);
  },

  async salvarEtapa3(id, corpo) {
    await espera();
    const autor = exigirAutor(corpo.autor);
    const f = achar(id);
    conferirVersao(f, corpo.versao);
    exigirEditavel(f, 'etapa3', 'Os testes da Etapa 3');
    f.dados.etapa3.testes_tecnicos = clone(corpo.testes_tecnicos);
    f.dados.etapa3.testes_ccon = clone(corpo.testes_ccon);
    const de = f.status;
    if (f.status === 'instalacao_concluida' && todosTecnicosMarcados(f.dados)) {
      f.status = 'aguardando_testes_ccon';
    }
    tocar(f, evento(autor, 'salvou_etapa3', de, f.status, 'Etapa 3 salva.'));
    return clone(f);
  },

  async salvarPendencias(id, corpo) {
    await espera();
    const autor = exigirAutor(corpo.autor);
    const f = achar(id);
    conferirVersao(f, corpo.versao);
    exigirEditavel(f, 'pendencias', 'As pendências');
    f.dados.pendencias = clone(corpo.pendencias);
    tocar(f, evento(autor, 'salvou_pendencias', f.status, f.status, 'Pendências salvas.'));
    return clone(f);
  },

  async executarAcao(id, acao: AcaoFicha, corpo) {
    await espera(180);
    const autor = exigirAutor(corpo.autor);
    const f = achar(id);
    if (acao !== 'enviar-email') conferirVersao(f, corpo.versao as number);
    const de = f.status;
    const rotulo = (s: Status) => STATUS_ROTULO[s];
    const falhar = (detail: string, faltas: string[]) => {
      throw new ApiError(422, detail, faltas);
    };
    const invalida = () => {
      throw new ApiError(409, `A ação "${acao}" não é permitida no status "${rotulo(f.status)}".`);
    };

    switch (acao) {
      case 'liberar-instalacao': {
        if (f.status !== 'cadastro_em_preenchimento' && f.status !== 'pendencia_cadastral') invalida();
        const faltas = faltasLiberar(f.dados);
        if (faltas.length) falhar('Não é possível liberar a instalação ainda.', faltas);
        f.status = 'liberado_para_instalacao';
        tocar(f, evento(autor, acao, de, f.status, 'Cadastro liberado para instalação.'));
        break;
      }
      case 'concluir-instalacao': {
        if (f.status !== 'em_instalacao' && f.status !== 'pendencia_tecnica') invalida();
        const faltas = faltasConcluir(f.dados);
        if (faltas.length) falhar('Não é possível concluir a instalação ainda.', faltas);
        f.status = 'instalacao_concluida';
        if (todosTecnicosMarcados(f.dados)) f.status = 'aguardando_testes_ccon';
        tocar(f, evento(autor, acao, de, f.status, 'Instalação concluída.'));
        break;
      }
      case 'validar-ccon': {
        if (f.status !== 'aguardando_testes_ccon') invalida();
        const v = corpo.validacao_ccon as ValidacaoCcon | undefined;
        if (!v) falhar('Dados da validação ausentes.', ['validacao_ccon']);
        const faltas = [...faltasTestes(f.dados)];
        if (v!.resultado === 'aprovado') {
          faltas.push(...faltasValidacao(v!));
          if (faltas.length) falhar('Não é possível aprovar a ativação ainda.', faltas);
          f.status = 'ativo_monitorado';
        } else if (v!.resultado === 'reprovado') {
          if (!v!.operador.trim()) falhar('Informe o operador da CCON.', ['Operador da CCON']);
          f.status = 'pendencia_tecnica';
        } else {
          falhar('Informe o resultado da validação.', ['Resultado (aprovado ou reprovado)']);
        }
        f.dados.etapa3.validacao_ccon = clone(v!);
        tocar(f, evento(autor, acao, de, f.status,
          v!.resultado === 'aprovado' ? 'Aprovado pela CCON: ATIVO / MONITORADO.' : 'Reprovado pela CCON.'));
        break;
      }
      case 'registrar-pendencia': {
        if (f.status === 'ativo_monitorado') invalida();
        const descricao = String(corpo.descricao ?? '').trim();
        if (!descricao) falhar('Descreva a pendência.', ['Descrição da pendência']);
        const nova: Pendencia = {
          descricao,
          responsavel: String(corpo.responsavel ?? ''),
          prazo: String(corpo.prazo ?? ''),
          resolvido: false,
        };
        const vazio = f.dados.pendencias.findIndex((p) => !p.descricao.trim() && !p.responsavel.trim());
        if (vazio >= 0) f.dados.pendencias[vazio] = nova;
        else f.dados.pendencias.push(nova);
        f.status = corpo.tipo === 'cadastral' ? 'pendencia_cadastral' : 'pendencia_tecnica';
        tocar(f, evento(autor, acao, de, f.status, `Pendência ${corpo.tipo === 'cadastral' ? 'cadastral' : 'técnica'}: ${descricao}`));
        break;
      }
      case 'enviar-email': {
        // Simula o envio com sucesso: registra o evento, não muda o status.
        const extra = String(corpo.mensagem ?? '').trim();
        tocar(f, evento(autor, 'enviou_email', f.status, f.status,
          `Ficha enviada por e-mail para ti@, suporte@ e aux.ti@neoguard.com.br${extra ? `. Mensagem: ${extra}` : '.'}`));
        break;
      }
      case 'retomar': {
        if (f.status === 'pendencia_cadastral') {
          f.status = 'cadastro_em_preenchimento';
        } else if (f.status === 'pendencia_tecnica') {
          const jaConcluida = f.eventos.some(
            (e) => e.status_para === 'pendencia_tecnica' &&
              (e.status_de === 'instalacao_concluida' || e.status_de === 'aguardando_testes_ccon'),
          );
          f.status = jaConcluida ? 'aguardando_testes_ccon' : 'em_instalacao';
        } else {
          invalida();
        }
        tocar(f, evento(autor, acao, de, f.status, 'Ficha retomada.'));
        break;
      }
    }
    return clone(f);
  },

  async travas(id) {
    await espera(60);
    const f = achar(id);
    const t: Travas = {
      'liberar-instalacao': faltasLiberar(f.dados),
      'concluir-instalacao': faltasConcluir(f.dados),
      // As faltas dos campos da validação (operador, data, hora, 5 itens) vêm no momento da ação.
      'validar-ccon': faltasTestes(f.dados),
    };
    return t;
  },
};
