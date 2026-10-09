// Etapa 2 — Instalação e configuração (seções 2.1 a 2.6), fiel ao docx.
import type {
  ConfiguracaoChave,
  Etapa1,
  Etapa2,
  ModeloCentral,
  Particao,
  Usuario,
  Zona,
} from '../../api/types';
import { CONFIGURACOES_CHAVES } from '../../api/types';
import {
  ajustarComunicacaoAoModelo,
  opcoesContingencia,
  opcoesPrincipal,
} from '../../domain/comunicacao';
import {
  contingenciaOutraHabilitada,
  mostrarParticoes,
  modeloOutroHabilitado,
  outroConfigHabilitado,
  principalOutraHabilitada,
  usuariosParaConfirmacao,
} from '../../domain/condicionais';
import { zonaVazia } from '../../domain/modelo';
import { CONFIGURACOES_ROTULOS, ROTULO_PERMISSAO, ROTULO_SIM_NAO } from '../../domain/rotulos';
import {
  CampoCelula,
  CampoLinha,
  FaixaEtapa,
  GradeCampos,
  GradeMarcas,
  LinhaRotulo,
  Nota,
  Opcoes,
  Secao,
  TabelaEditavel,
  colMarca,
  colTexto,
  type Coluna,
} from './campos';

const MODELOS: { value: Exclude<ModeloCentral, ''>; label: string }[] = [
  { value: 'AMT 2018 E', label: 'AMT 2018 E' },
  { value: 'AMT 2018 EG', label: 'AMT 2018 EG' },
  { value: 'AMT 2118 EG', label: 'AMT 2118 EG' },
  { value: 'AMT 2018 E3G', label: 'AMT 2018 E3G' },
  { value: 'outro', label: 'Outro:' },
];

/** Próxima zona: maior número existente + 1 (Z11, Z12…). */
export function proximaZona(linhas: Zona[]): Zona {
  const maior = linhas.reduce((m, z) => {
    const n = Number.parseInt(z.zona.replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return zonaVazia(maior + 1 || linhas.length + 1);
}

const colunasZonas: Coluna<Zona>[] = [
  {
    id: 'zona',
    titulo: 'Zona',
    largura: '7%',
    classe: 'fixa',
    render: (z) => <span>{z.zona}</span>,
  },
  colTexto<Zona>('ambiente', 'Ambiente', { largura: '17%' }),
  colTexto<Zona>('dispositivo', 'Dispositivo', { largura: '17%' }),
  colTexto<Zona>('tipo', 'Tipo / Comportamento', { largura: '17%' }),
  colTexto<Zona>('particao', 'Área / Partição', { largura: '11%' }),
  colMarca<Zona>('testado', 'Testado', '8%'),
  colTexto<Zona>('observacao', 'Observação', { area: true }),
];

const colunasParticoes: Coluna<Particao>[] = [
  { id: 'particao', titulo: 'Partição', largura: '12%', classe: 'fixa', render: (p) => <span>{p.particao}</span> },
  colTexto<Particao>('nome_area', 'Nome / Área', { largura: '28%' }),
  colTexto<Particao>('zonas', 'Zonas relacionadas', { largura: '30%' }),
  colTexto<Particao>('observacao', 'Observação', { area: true }),
];

const colunasUsuarios: Coluna<Usuario>[] = [
  { id: 'nome', titulo: 'Nome', largura: '22%', render: (u) => <span>{u.nome}</span> },
  { id: 'funcao', titulo: 'Função', largura: '16%', render: (u) => <span>{u.funcao}</span> },
  { id: 'usa_app', titulo: 'Usa App?', largura: '9%', classe: 'centro', render: (u) => <span>{ROTULO_SIM_NAO[u.usa_app]}</span> },
  { id: 'email_app', titulo: 'E-mail (convite do app)', largura: '24%', render: (u) => <span>{u.usa_app === 'sim' ? u.email_app : ''}</span> },
  { id: 'permissao', titulo: 'Permissão', largura: '15%', render: (u) => <span>{ROTULO_PERMISSAO[u.permissao]}</span> },
  { id: 'particao', titulo: 'Área / Partição', render: (u) => <span>{u.particao}</span> },
];


interface Props {
  valor: Etapa2;
  /** Etapa 1 (para 1.3 em 2.5 e 1.4 em 2.4), somente consulta. */
  etapa1: Etapa1;
  onChange?: (v: Etapa2) => void;
}

export function Etapa2Corpo({ valor, etapa1, onChange }: Props) {
  const set = <K extends keyof Etapa2>(chave: K, novo: Etapa2[K]) => onChange?.({ ...valor, [chave]: novo });
  const eq = valor.equipamentos;
  const setEq = (p: Partial<Etapa2['equipamentos']>) => set('equipamentos', { ...eq, ...p });
  const com = valor.comunicacao;
  const setCom = (p: Partial<Etapa2['comunicacao']>) => set('comunicacao', { ...com, ...p });
  const cfg = valor.configuracoes;
  const uc = valor.usuarios_config;

  const trocarModelo = (modelo: ModeloCentral) => {
    const ajuste = ajustarComunicacaoAoModelo(modelo, com.principal, com.contingencia);
    onChange?.({
      ...valor,
      equipamentos: { ...eq, modelo_central: modelo },
      comunicacao: { ...com, principal: ajuste.principal, contingencia: ajuste.contingencia },
    });
  };

  const usuarios = usuariosParaConfirmacao(etapa1.usuarios);
  return (
    <div className="etapa-corpo" data-etapa="2">
      <FaixaEtapa titulo="ETAPA 2 — INSTALAÇÃO E CONFIGURAÇÃO" responsavel="EQUIPE TÉCNICA" />

      {/* 2.1 */}
      <Secao numero="2.1" titulo="Identificação dos Equipamentos">
        <Opcoes
          rotulo="Modelo da central"
          titulo="Modelo da central:"
          value={eq.modelo_central}
          onChange={(v) => trocarModelo(v)}
          opcoes={MODELOS.map((m) =>
            m.value === 'outro'
              ? {
                  ...m,
                  extra: (
                    <CampoLinha
                      curto
                      rotulo="Outro modelo de central"
                      value={eq.modelo_outro}
                      desabilitado={!modeloOutroHabilitado(eq)}
                      onChange={(v) => setEq({ modelo_outro: v })}
                    />
                  ),
                }
              : m,
          )}
        />
        <GradeCampos colunas={6}>
          <CampoCelula rotulo="NÚMERO DE SÉRIE" span={2} largo value={eq.numero_serie} onChange={(v) => setEq({ numero_serie: v })} />
          <CampoCelula rotulo="MAC (ETIQUETA QR CODE)" span={2} largo value={eq.mac} onChange={(v) => setEq({ mac: v })} />
          <CampoCelula rotulo="FIRMWARE" span={2} largo value={eq.firmware} onChange={(v) => setEq({ firmware: v })} />
          <CampoCelula rotulo="TECLADO(S) — MODELO E ENDEREÇOS" span={2} largo value={eq.teclados} onChange={(v) => setEq({ teclados: v })} />
          <CampoCelula rotulo="RECEPTOR SEM FIO (EX.: XAR 4000 SMART)" span={2} largo value={eq.receptor_sem_fio} onChange={(v) => setEq({ receptor_sem_fio: v })} />
          <CampoCelula rotulo="EXPANSORES / MÓDULOS" span={2} largo value={eq.expansores} onChange={(v) => setEq({ expansores: v })} />
          <CampoCelula rotulo="SENSORES INSTALADOS (QTD. POR TIPO)" span={2} largo value={eq.sensores} onChange={(v) => setEq({ sensores: v })} />
          <CampoCelula rotulo="SIRENES (QTD. / INTERNA-EXTERNA)" span={2} largo value={eq.sirenes} onChange={(v) => setEq({ sirenes: v })} />
          <CampoCelula rotulo="CONTROLES REMOTOS (QTD.)" span={2} largo value={eq.controles} onChange={(v) => setEq({ controles: v })} />
        </GradeCampos>
      </Secao>

      {/* 2.2 */}
      <Secao numero="2.2" titulo="Comunicação">
        <Opcoes
          rotulo="Comunicação principal"
          titulo="Comunicação principal:"
          value={com.principal}
          onChange={(v) => setCom({ principal: v })}
          opcoes={opcoesPrincipal(eq.modelo_central).map((o) =>
            o.value === 'outra'
              ? {
                  ...o,
                  label: 'Outra:',
                  extra: (
                    <CampoLinha
                      curto
                      rotulo="Outra comunicação principal"
                      value={com.principal_outra}
                      desabilitado={!principalOutraHabilitada(com)}
                      onChange={(v) => setCom({ principal_outra: v })}
                    />
                  ),
                }
              : o,
          )}
        />
        <Opcoes
          rotulo="Comunicação de contingência"
          titulo="Comunicação de contingência:"
          value={com.contingencia}
          onChange={(v) => setCom({ contingencia: v })}
          opcoes={opcoesContingencia(eq.modelo_central).map((o) =>
            o.value === 'outra'
              ? {
                  ...o,
                  label: 'Outra:',
                  extra: (
                    <CampoLinha
                      curto
                      rotulo="Outra comunicação de contingência"
                      value={com.contingencia_outra}
                      desabilitado={!contingenciaOutraHabilitada(com)}
                      onChange={(v) => setCom({ contingencia_outra: v })}
                    />
                  ),
                }
              : o,
          )}
        />
        <GradeCampos colunas={6}>
          <CampoCelula rotulo="CONTA DE MONITORAMENTO — RECEPTORA IP1" span={2} largo value={com.conta_ip1} onChange={(v) => setCom({ conta_ip1: v })} />
          <CampoCelula rotulo="CONTA DE MONITORAMENTO — RECEPTORA IP2 (CONTINGÊNCIA)" span={2} largo value={com.conta_ip2} onChange={(v) => setCom({ conta_ip2: v })} />
          <CampoCelula rotulo="PROTOCOLO DE REPORTAGEM" span={2} largo value={com.protocolo} onChange={(v) => setCom({ protocolo: v })} />
        </GradeCampos>
      </Secao>

      {/* 2.3 */}
      <Secao numero="2.3" titulo="Mapa de Zonas">
        <TabelaEditavel<Zona>
          rotulo="Mapa de zonas"
          linhas={valor.zonas}
          onChange={(l) => set('zonas', l)}
          novaLinha={proximaZona}
          colunas={colunasZonas}
          textoAdicionar="+ Adicionar linha"
          larguraMinima={820}
        />
        <Nota>
          Zonas adicionais (acima de 10): use &quot;+ Adicionar linha&quot;; a numeração continua em Z11, Z12…, mantendo a mesma
          estrutura de colunas.
        </Nota>
      </Secao>

      {/* 2.4 */}
      <Secao numero="2.4" titulo="Partições">
        {mostrarParticoes(etapa1) ? (
          <TabelaEditavel<Particao>
            rotulo="Partições"
            linhas={valor.particoes}
            onChange={(l) => set('particoes', l)}
            colunas={colunasParticoes}
            fixa
            larguraMinima={560}
          />
        ) : (
          <p className="nota-neutra" data-testid="particoes-nao-se-aplica">
            Não se aplica: a ficha informa que não há áreas independentes (item 1.4). A tabela aparece quando a resposta da
            1.4 for SIM.
          </p>
        )}
      </Secao>

      {/* 2.5 */}
      <Secao numero="2.5" titulo="Usuários — Configuração Concluída">
        <Opcoes
          rotulo='Usuários da Tabela 1.3 cadastrados na central e convidados no aplicativo?'
          titulo={'Usuários da Tabela 1.3 cadastrados na central e, quando "Usa App?" = Sim, convidados no aplicativo?'}
          value={uc.confirmado}
          onChange={(v) => set('usuarios_config', { ...uc, confirmado: v })}
          opcoes={[
            { value: 'sim', label: 'SIM' },
            { value: 'nao', label: 'NÃO' },
          ]}
        />
        {usuarios.length > 0 ? (
          <TabelaEditavel<Usuario>
            rotulo="Usuários cadastrados na ficha (1.3)"
            linhas={usuarios}
            colunas={colunasUsuarios}
            fixa
            larguraMinima={640}
          />
        ) : (
          <p className="nota-neutra">Nenhum usuário informado na Etapa 1 (item 1.3).</p>
        )}
        <LinhaRotulo rotulo="Exceções / pendências de cadastro:">
          <CampoLinha area rotulo="Exceções / pendências de cadastro" value={uc.excecoes} onChange={(v) => set('usuarios_config', { ...uc, excecoes: v })} />
        </LinhaRotulo>
      </Secao>

      {/* 2.6 */}
      <Secao numero="2.6" titulo="Configurações Adicionais">
        <GradeMarcas<ConfiguracaoChave>
          rotulo="Configurações adicionais"
          colunas={2}
          itens={CONFIGURACOES_CHAVES.map((k) =>
            k === 'outro'
              ? {
                  chave: k,
                  rotulo: CONFIGURACOES_ROTULOS[k],
                  extra: (
                    <CampoLinha
                      curto
                      rotulo="Outra configuração"
                      value={cfg.outro_texto}
                      desabilitado={!outroConfigHabilitado(cfg)}
                      onChange={(v) => set('configuracoes', { ...cfg, outro_texto: v })}
                    />
                  ),
                }
              : { chave: k, rotulo: CONFIGURACOES_ROTULOS[k] },
          )}
          valores={cfg}
          onChange={(k, v) => set('configuracoes', { ...cfg, [k]: v })}
        />
      </Secao>
    </div>
  );
}
