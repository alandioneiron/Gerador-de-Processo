import { describe, expect, it } from 'vitest';
import { esqueletoVazio } from './modelo';
import {
  algumUsuarioUsaApp,
  areasHabilitadas,
  chavesObrigatoriasCcon,
  chavesObrigatoriasTecnicas,
  contingenciaOutraHabilitada,
  emailAppHabilitado,
  modeloOutroHabilitado,
  mostrarParticoes,
  outroConfigHabilitado,
  possuiContingencia,
  principalOutraHabilitada,
  progressoDosTestes,
  usuariosParaConfirmacao,
} from './condicionais';

describe('campos condicionais (anexo E)', () => {
  it('1.3: e-mail só com "Usa App?" = Sim', () => {
    expect(emailAppHabilitado({ usa_app: 'sim' })).toBe(true);
    expect(emailAppHabilitado({ usa_app: 'nao' })).toBe(false);
    expect(emailAppHabilitado({ usa_app: '' })).toBe(false);
  });

  it('1.4: nomes das áreas e tabela 2.4 só com "Sim"', () => {
    const d = esqueletoVazio();
    expect(areasHabilitadas(d.etapa1.areas_independentes)).toBe(false);
    expect(mostrarParticoes(d.etapa1)).toBe(false);
    d.etapa1.areas_independentes.possui = 'nao';
    expect(mostrarParticoes(d.etapa1)).toBe(false);
    d.etapa1.areas_independentes.possui = 'sim';
    expect(areasHabilitadas(d.etapa1.areas_independentes)).toBe(true);
    expect(mostrarParticoes(d.etapa1)).toBe(true);
  });

  it('campos "Outro/Outra" só com a opção marcada', () => {
    expect(modeloOutroHabilitado({ modelo_central: 'outro' })).toBe(true);
    expect(modeloOutroHabilitado({ modelo_central: 'AMT 2018 E' })).toBe(false);
    expect(principalOutraHabilitada({ principal: 'outra' })).toBe(true);
    expect(principalOutraHabilitada({ principal: 'ethernet' })).toBe(false);
    expect(contingenciaOutraHabilitada({ contingencia: 'outra' })).toBe(true);
    expect(contingenciaOutraHabilitada({ contingencia: 'gprs' })).toBe(false);
    expect(outroConfigHabilitado({ outro: true })).toBe(true);
    expect(outroConfigHabilitado({ outro: false })).toBe(false);
  });

  it('2.5 lista só usuários com nome (sem redigitar a 1.3)', () => {
    const d = esqueletoVazio();
    d.etapa1.usuarios[0].nome = 'Ana';
    d.etapa1.usuarios[3].nome = '  ';
    d.etapa1.usuarios[5].nome = 'Bia';
    expect(usuariosParaConfirmacao(d.etapa1.usuarios).map((u) => u.nome)).toEqual(['Ana', 'Bia']);
  });
});

describe('itens obrigatórios dos testes', () => {
  it('3.1 e 3.2 completos quando há contingência e app', () => {
    const d = esqueletoVazio();
    d.etapa2.comunicacao.contingencia = 'gprs';
    d.etapa1.usuarios[0] = { ...d.etapa1.usuarios[0], nome: 'Ana', usa_app: 'sim' };
    expect(chavesObrigatoriasTecnicas(d)).toHaveLength(12);
    expect(chavesObrigatoriasCcon(d)).toHaveLength(13);
    expect(algumUsuarioUsaApp(d.etapa1.usuarios)).toBe(true);
    expect(possuiContingencia(d.etapa2.comunicacao)).toBe(true);
  });

  it('dispensa contingência (3.1 e 3.2) e aplicativo (3.1 e 3.2) quando não se aplicam', () => {
    const d = esqueletoVazio();
    d.etapa2.comunicacao.contingencia = 'nao_possui';
    expect(chavesObrigatoriasTecnicas(d)).not.toContain('comunicacao_contingencia');
    expect(chavesObrigatoriasTecnicas(d)).not.toContain('aplicativo');
    expect(chavesObrigatoriasTecnicas(d)).toHaveLength(10);
    const ccon = chavesObrigatoriasCcon(d);
    expect(ccon).not.toContain('comunicacao_contingencia');
    expect(ccon).not.toContain('aplicativo');
    expect(ccon).toHaveLength(11);
  });

  it('o aplicativo da 3.1 só é obrigatório se algum usuário usa o app', () => {
    const d = esqueletoVazio();
    d.etapa2.comunicacao.contingencia = 'gprs';
    expect(chavesObrigatoriasTecnicas(d)).not.toContain('aplicativo');
    expect(chavesObrigatoriasTecnicas(d)).toHaveLength(11);
    d.etapa1.usuarios[0] = { ...d.etapa1.usuarios[0], nome: 'Ana', usa_app: 'sim' };
    expect(chavesObrigatoriasTecnicas(d)).toContain('aplicativo');
    expect(chavesObrigatoriasTecnicas(d)).toHaveLength(12);
  });

  it('usuário com "usa app" mas sem nome não conta', () => {
    const d = esqueletoVazio();
    d.etapa1.usuarios[0].usa_app = 'sim';
    expect(algumUsuarioUsaApp(d.etapa1.usuarios)).toBe(false);
  });

  it('progresso conta o que falta', () => {
    const d = esqueletoVazio();
    d.etapa2.comunicacao.contingencia = 'nao_possui';
    d.etapa3.testes_tecnicos.arme = true;
    d.etapa3.testes_tecnicos.desarme = true;
    const p = progressoDosTestes(d.etapa3.testes_tecnicos, chavesObrigatoriasTecnicas(d));
    expect(p.feitos).toBe(2);
    expect(p.total).toBe(10);
    expect(p.faltantes).toHaveLength(8);
    expect(p.faltantes).not.toContain('arme');
  });
});
