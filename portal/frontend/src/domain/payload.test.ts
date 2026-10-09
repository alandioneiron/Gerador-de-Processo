import { describe, expect, it } from 'vitest';
import { esqueletoVazio } from './modelo';
import {
  aparar,
  montarCorpoEtapa1,
  montarCorpoEtapa2,
  montarCorpoEtapa3,
  montarCorpoPendencias,
  montarCorpoRegistrarPendencia,
  montarCorpoValidarCcon,
  montarEtapa1,
  montarEtapa2,
  montarExtrasRegistrarPendencia,
  problemasValidacaoCcon,
  tipoPendenciaPadrao,
  validacaoCconVazia,
  validarAutor,
} from './payload';

const autor = { nome: 'Pessoa Teste', email: 'teste@exemplo.invalid' };

describe('montagem do payload da Etapa 1', () => {
  it('corpo: autor, versão e etapa1', () => {
    const corpo = montarCorpoEtapa1(autor, 7, esqueletoVazio().etapa1);
    expect(Object.keys(corpo).sort()).toEqual(['autor', 'etapa1', 'versao']);
    expect(corpo.versao).toBe(7);
    expect(corpo.autor).toEqual(autor);
    expect(Object.keys(corpo.etapa1)).toEqual([
      'cliente',
      'contatos',
      'usuarios',
      'areas_independentes',
      'ambientes',
      'rotina',
      'particularidades',
      'ccon',
    ]);
  });

  it('apara espaços dos textos', () => {
    const e = esqueletoVazio().etapa1;
    e.cliente.razao_social = '  Padaria Exemplo  ';
    e.contatos[0].nome = ' Ana ';
    expect(montarEtapa1(e).cliente.razao_social).toBe('Padaria Exemplo');
    expect(montarEtapa1(e).contatos[0].nome).toBe('Ana');
  });

  it('renumera a ordem dos contatos (sequência de acionamento da CCON)', () => {
    const e = esqueletoVazio().etapa1;
    e.contatos = [e.contatos[2], e.contatos[4], e.contatos[0]];
    expect(montarEtapa1(e).contatos.map((c) => c.ordem)).toEqual([1, 2, 3]);
  });

  it('só envia e-mail do aplicativo de quem "usa app"', () => {
    const e = esqueletoVazio().etapa1;
    e.usuarios[0] = { ...e.usuarios[0], nome: 'Ana', usa_app: 'sim', email_app: 'ana@exemplo.invalid' };
    e.usuarios[1] = { ...e.usuarios[1], nome: 'Beto', usa_app: 'nao', email_app: 'beto@exemplo.invalid' };
    e.usuarios[2] = { ...e.usuarios[2], nome: 'Caio', usa_app: '', email_app: 'caio@exemplo.invalid' };
    const u = montarEtapa1(e).usuarios;
    expect(u[0].email_app).toBe('ana@exemplo.invalid');
    expect(u[1].email_app).toBe('');
    expect(u[2].email_app).toBe('');
  });

  it('áreas só seguem com "Existem áreas independentes?" = Sim', () => {
    const e = esqueletoVazio().etapa1;
    e.areas_independentes = { possui: 'nao', area1: 'Loja', area2: 'Estoque', outras: 'X' };
    expect(montarEtapa1(e).areas_independentes).toEqual({ possui: 'nao', area1: '', area2: '', outras: '' });
    e.areas_independentes.possui = 'sim';
    expect(montarEtapa1(e).areas_independentes).toEqual({
      possui: 'sim',
      area1: 'Loja',
      area2: 'Estoque',
      outras: 'X',
    });
  });

  it('mantém as linhas iniciais do docx (5 contatos, 8 usuários, 6 ambientes)', () => {
    const e = montarEtapa1(esqueletoVazio().etapa1);
    expect(e.contatos).toHaveLength(5);
    expect(e.usuarios).toHaveLength(8);
    expect(e.ambientes).toHaveLength(6);
  });

  it('não altera o rascunho original', () => {
    const e = esqueletoVazio().etapa1;
    e.cliente.razao_social = ' X ';
    montarEtapa1(e);
    expect(e.cliente.razao_social).toBe(' X ');
  });
});

describe('montagem do payload da Etapa 2', () => {
  it('corpo: autor, versão e etapa2', () => {
    const corpo = montarCorpoEtapa2(autor, 3, esqueletoVazio().etapa2);
    expect(Object.keys(corpo).sort()).toEqual(['autor', 'etapa2', 'versao']);
    expect(Object.keys(corpo.etapa2)).toEqual([
      'equipamentos',
      'comunicacao',
      'zonas',
      'particoes',
      'usuarios_config',
      'configuracoes',
    ]);
  });

  it('"Outro modelo" só vale com o modelo "outro"', () => {
    const e = esqueletoVazio().etapa2;
    e.equipamentos.modelo_central = 'AMT 2018 EG';
    e.equipamentos.modelo_outro = 'Modelo X';
    expect(montarEtapa2(e).equipamentos.modelo_outro).toBe('');
    e.equipamentos.modelo_central = 'outro';
    expect(montarEtapa2(e).equipamentos.modelo_outro).toBe('Modelo X');
  });

  it('"Outra" comunicação só vale com a opção "outra"', () => {
    const e = esqueletoVazio().etapa2;
    e.comunicacao.principal = 'ethernet';
    e.comunicacao.principal_outra = 'Rádio';
    e.comunicacao.contingencia = 'outra';
    e.comunicacao.contingencia_outra = 'Satélite';
    const c = montarEtapa2(e).comunicacao;
    expect(c.principal_outra).toBe('');
    expect(c.contingencia_outra).toBe('Satélite');
  });

  it('"Outro" das configurações só vale com o checkbox marcado', () => {
    const e = esqueletoVazio().etapa2;
    e.configuracoes.outro_texto = 'Algo';
    expect(montarEtapa2(e).configuracoes.outro_texto).toBe('');
    e.configuracoes.outro = true;
    expect(montarEtapa2(e).configuracoes.outro_texto).toBe('Algo');
  });

  it('não renumera as zonas (o número é o da central) e mantém Z01..Z10', () => {
    const e = esqueletoVazio().etapa2;
    e.zonas = e.zonas.filter((z) => z.zona !== 'Z03');
    const z = montarEtapa2(e).zonas;
    expect(z).toHaveLength(9);
    expect(z.map((x) => x.zona)).not.toContain('Z03');
    expect(esqueletoVazio().etapa2.zonas.map((x) => x.zona)).toEqual([
      'Z01', 'Z02', 'Z03', 'Z04', 'Z05', 'Z06', 'Z07', 'Z08', 'Z09', 'Z10',
    ]);
  });
});

describe('montagem do payload da Etapa 3 e das Pendências', () => {
  it('etapa3: só testes_tecnicos e testes_ccon (validação só pela ação)', () => {
    const d = esqueletoVazio();
    d.etapa3.testes_tecnicos.arme = true;
    const corpo = montarCorpoEtapa3(autor, 2, d.etapa3);
    expect(Object.keys(corpo).sort()).toEqual(['autor', 'testes_ccon', 'testes_tecnicos', 'versao']);
    expect(corpo.testes_tecnicos.arme).toBe(true);
    expect(Object.keys(corpo.testes_tecnicos)).toHaveLength(12);
    expect(Object.keys(corpo.testes_ccon)).toHaveLength(13);
    expect('validacao_ccon' in corpo).toBe(false);
  });

  it('pendências: lista aparada', () => {
    const p = esqueletoVazio().pendencias;
    p[0].descricao = '  Falta o cabo  ';
    const corpo = montarCorpoPendencias(autor, 5, p);
    expect(Object.keys(corpo).sort()).toEqual(['autor', 'pendencias', 'versao']);
    expect(corpo.pendencias[0].descricao).toBe('Falta o cabo');
    expect(corpo.pendencias).toHaveLength(3);
  });
});

describe('ações', () => {
  it('registrar pendência: descrição aparada; responsável e prazo só se houver', () => {
    expect(
      montarCorpoRegistrarPendencia(autor, 4, { tipo: 'tecnica', descricao: '  Sem energia  ' }),
    ).toEqual({ autor, versao: 4, tipo: 'tecnica', descricao: 'Sem energia' });

    expect(
      montarExtrasRegistrarPendencia({
        tipo: 'cadastral',
        descricao: 'Falta CNPJ',
        responsavel: ' Vendedor ',
        prazo: '2026-10-30',
      }),
    ).toEqual({ tipo: 'cadastral', descricao: 'Falta CNPJ', responsavel: 'Vendedor', prazo: '2026-10-30' });
  });

  it('tipo padrão da pendência conforme o status', () => {
    expect(tipoPendenciaPadrao('cadastro_em_preenchimento')).toBe('cadastral');
    expect(tipoPendenciaPadrao('pendencia_cadastral')).toBe('cadastral');
    expect(tipoPendenciaPadrao('em_instalacao')).toBe('tecnica');
    expect(tipoPendenciaPadrao('aguardando_testes_ccon')).toBe('tecnica');
  });

  it('validar CCON: corpo com validacao_ccon aparada', () => {
    const v = { ...validacaoCconVazia(), operador: '  Op  ', resultado: 'aprovado' as const };
    const corpo = montarCorpoValidarCcon(autor, 9, v);
    expect(Object.keys(corpo).sort()).toEqual(['autor', 'validacao_ccon', 'versao']);
    expect(corpo.validacao_ccon.operador).toBe('Op');
  });
});

describe('validação do modal "Validar CCON"', () => {
  const completa = () => ({
    ...validacaoCconVazia(),
    operador: 'Operador Teste',
    data: '2026-10-09',
    hora: '14:30',
    cadastro: 'ok' as const,
    comunicacao: 'ok' as const,
    eventos: 'ok' as const,
    contatos: 'ok' as const,
    regras_operacionais: 'ok' as const,
    resultado: 'aprovado' as const,
  });

  it('vazio: pede operador, data, hora, os 5 itens e o resultado', () => {
    const p = problemasValidacaoCcon(validacaoCconVazia());
    expect(p).toContain('Informe o operador da CCON.');
    expect(p).toContain('Informe a data.');
    expect(p).toContain('Informe a hora.');
    expect(p.filter((x) => x.startsWith('Marque OK ou PENDENTE'))).toHaveLength(5);
    expect(p).toContain('Escolha o resultado (aprovado ou reprovado).');
  });

  it('completo e aprovado: sem problemas', () => {
    expect(problemasValidacaoCcon(completa())).toEqual([]);
  });

  it('aprovar com item PENDENTE é barrado; reprovar com item PENDENTE é permitido', () => {
    const v = { ...completa(), contatos: 'pendente' as const };
    expect(problemasValidacaoCcon(v).join(' ')).toMatch(/todos os itens precisam estar OK.*Contatos/);
    expect(problemasValidacaoCcon({ ...v, resultado: 'reprovado' })).toEqual([]);
  });
});

describe('identificação de quem preenche', () => {
  it('exige nome e e-mail válidos', () => {
    expect(validarAutor({})).toEqual({ nome: 'Informe o seu nome.', email: 'Informe o seu e-mail.' });
    expect(validarAutor({ nome: 'Ana', email: 'ana@' })).toEqual({ email: 'E-mail inválido.' });
    expect(validarAutor({ nome: ' ', email: 'ana@exemplo.invalid' })).toEqual({ nome: 'Informe o seu nome.' });
    expect(validarAutor({ nome: 'Ana', email: 'ana@exemplo.invalid' })).toEqual({});
  });
});

describe('aparar', () => {
  it('trata listas, objetos e valores que não são texto', () => {
    expect(aparar({ a: ' x ', b: [' y ', 2, true, null], c: { d: ' z ' } })).toEqual({
      a: 'x',
      b: ['y', 2, true, null],
      c: { d: 'z' },
    });
  });
});
