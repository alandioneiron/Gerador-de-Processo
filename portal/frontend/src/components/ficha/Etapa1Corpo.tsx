// Etapa 1 — Cadastro para implantação (seções 1.1 a 1.8), fiel ao docx.
import type {
  Ambiente,
  Contato,
  Etapa1,
  ParticularidadeChave,
  SimNao,
  Usuario,
} from '../../api/types';
import { PARTICULARIDADES_CHAVES } from '../../api/types';
import { areasHabilitadas, emailAppHabilitado } from '../../domain/condicionais';
import { PARTICULARIDADES_ROTULOS } from '../../domain/rotulos';
import {
  CampoCelula,
  CampoLinha,
  Celula,
  FaixaEtapa,
  GradeCampos,
  GradeMarcas,
  LinhaRotulo,
  Nota,
  Opcoes,
  OPCOES_SIM_NAO,
  Secao,
  TabelaEditavel,
  Texto,
  colSeletor,
  colTexto,
  type Coluna,
  type OpcaoSeletor,
} from './campos';

const OPCOES_PERMISSAO: OpcaoSeletor[] = [
  { value: 'arma_desarma', label: 'Arma/Desarma' },
  { value: 'so_arma', label: 'Só arma' },
];

const SIM_NAO_RADIO: { value: Exclude<SimNao, ''>; label: string }[] = [
  { value: 'nao', label: 'NÃO' },
  { value: 'sim', label: 'SIM' },
];

const contatoVazio = (linhas: Contato[]): Contato => ({
  ordem: linhas.length + 1,
  nome: '',
  funcao: '',
  tel_principal: '',
  tel_alternativo: '',
  decide: '',
  restricoes: '',
});

const usuarioVazio = (): Usuario => ({
  nome: '',
  funcao: '',
  telefone: '',
  teclado: '',
  usa_app: '',
  email_app: '',
  permissao: '',
  particao: '',
  observacoes: '',
});

const ambienteVazio = (): Ambiente => ({ ambiente: '', acesso_local: '', observacao: '' });

const colunasContatos: Coluna<Contato>[] = [
  {
    id: 'ordem',
    titulo: 'Ord.',
    largura: '5%',
    classe: 'centro',
    render: (_c, i) => <span aria-label={`Ordem de acionamento ${i + 1}`}>{i + 1}</span>,
  },
  colTexto<Contato>('nome', 'Nome', { largura: '20%' }),
  colTexto<Contato>('funcao', 'Função / Relação', { largura: '15%' }),
  colTexto<Contato>('tel_principal', 'Tel. Principal', { largura: '14%', tipo: 'tel' }),
  colTexto<Contato>('tel_alternativo', 'Tel. Alternativo', { largura: '14%', tipo: 'tel' }),
  colSeletor<Contato>('decide', 'Decide?', OPCOES_SIM_NAO, '9%'),
  colTexto<Contato>('restricoes', 'Restrições / Observações', { area: true }),
];

const colunasUsuarios: Coluna<Usuario>[] = [
  colTexto<Usuario>('nome', 'Nome', { largura: '14%' }),
  colTexto<Usuario>('funcao', 'Função', { largura: '9%' }),
  colTexto<Usuario>('telefone', 'Telefone', { largura: '10%', tipo: 'tel' }),
  colSeletor<Usuario>('teclado', 'Teclado', OPCOES_SIM_NAO, '7%'),
  colSeletor<Usuario>('usa_app', <>Usa App?</>, OPCOES_SIM_NAO, '7%', 'Usa App?'),
  {
    id: 'email_app',
    titulo: 'E-mail (se usa app)',
    largura: '16%',
    render: (u, i, atualizar) => (
      <Texto
        rotulo={`E-mail (se usa app) — linha ${i + 1}`}
        tipo="email"
        value={u.email_app}
        desabilitado={!emailAppHabilitado(u)}
        onChange={(v) => atualizar({ email_app: v })}
      />
    ),
  },
  colSeletor<Usuario>(
    'permissao',
    <>
      Permissão <br />
      (Arma/Desarma/Só arma)
    </>,
    OPCOES_PERMISSAO,
    '12%',
    'Permissão',
  ),
  colTexto<Usuario>('particao', 'Área / Partição', { largura: '9%' }),
  colTexto<Usuario>('observacoes', 'Observações', { area: true }),
];

const colunasAmbientes: Coluna<Ambiente>[] = [
  colTexto<Ambiente>('ambiente', 'Ambiente', { largura: '30%' }),
  colTexto<Ambiente>('acesso_local', 'Acesso / Local', { largura: '30%' }),
  colTexto<Ambiente>('observacao', 'Observação', { area: true }),
];


interface Props {
  valor: Etapa1;
  onChange?: (v: Etapa1) => void;
}

export function Etapa1Corpo({ valor, onChange }: Props) {
  const set = <K extends keyof Etapa1>(chave: K, novo: Etapa1[K]) => onChange?.({ ...valor, [chave]: novo });
  const cli = valor.cliente;
  const setCli = (parcial: Partial<Etapa1['cliente']>) => set('cliente', { ...cli, ...parcial });
  const areas = valor.areas_independentes;
  const setAreas = (parcial: Partial<Etapa1['areas_independentes']>) =>
    set('areas_independentes', { ...areas, ...parcial });
  const rot = valor.rotina;
  const setRot = (parcial: Partial<Etapa1['rotina']>) => set('rotina', { ...rot, ...parcial });
  const part = valor.particularidades;
  const ccon = valor.ccon;
  const setCcon = (parcial: Partial<Etapa1['ccon']>) => set('ccon', { ...ccon, ...parcial });

  return (
    <div className="etapa-corpo" data-etapa="1">
      <FaixaEtapa titulo="ETAPA 1 — CADASTRO PARA IMPLANTAÇÃO" responsavel="COMERCIAL + CLIENTE" />

      {/* 1.1 */}
      <Secao numero="1.1" titulo="Identificação do Cliente">
        <GradeCampos colunas={6}>
          <CampoCelula rotulo="RAZÃO SOCIAL / NOME" span={3} largo value={cli.razao_social} onChange={(v) => setCli({ razao_social: v })} />
          <CampoCelula rotulo="NOME FANTASIA" span={3} largo value={cli.nome_fantasia} onChange={(v) => setCli({ nome_fantasia: v })} />
          <CampoCelula rotulo="CPF / CNPJ" span={2} value={cli.cpf_cnpj} onChange={(v) => setCli({ cpf_cnpj: v })} />
          <CampoCelula rotulo="RESPONSÁVEL PELO LOCAL" span={2} value={cli.responsavel_local} onChange={(v) => setCli({ responsavel_local: v })} />
          <CampoCelula rotulo="TELEFONE" span={2} tipo="tel" value={cli.telefone} onChange={(v) => setCli({ telefone: v })} />
          <CampoCelula rotulo="ENDEREÇO COMPLETO DA INSTALAÇÃO" span={6} largo value={cli.endereco} onChange={(v) => setCli({ endereco: v })} />
          <CampoCelula rotulo="E-MAIL" span={2} tipo="email" value={cli.email} onChange={(v) => setCli({ email: v })} />
          <CampoCelula rotulo="VENDEDOR RESPONSÁVEL" span={2} value={cli.vendedor} onChange={(v) => setCli({ vendedor: v })} />
          <CampoCelula rotulo="DATA PREVISTA DA INSTALAÇÃO" span={2} tipo="date" value={cli.data_prevista} onChange={(v) => setCli({ data_prevista: v })} />
          <CampoCelula rotulo="Nº DA PROPOSTA" span={2} value={cli.numero_proposta} onChange={(v) => setCli({ numero_proposta: v })} />
          <CampoCelula rotulo="Nº DO CONTRATO" span={2} value={cli.numero_contrato} onChange={(v) => setCli({ numero_contrato: v })} />
          <CampoCelula rotulo="SERVIÇOS CONTRATADOS" span={2} value={cli.servicos_contratados} onChange={(v) => setCli({ servicos_contratados: v })} />
        </GradeCampos>
      </Secao>

      {/* 1.2 */}
      <Secao numero="1.2" titulo="Contatos para Ocorrência">
        <Nota>
          A ordem informada será utilizada como sequência de acionamento da Central de Operações (CCON), conforme
          procedimento operacional da Neoguard.
        </Nota>
        <TabelaEditavel<Contato>
          rotulo="Contatos para ocorrência"
          linhas={valor.contatos}
          onChange={(l) => set('contatos', l)}
          aoReordenar={(l) => l.map((c, i) => ({ ...c, ordem: i + 1 }))}
          novaLinha={contatoVazio}
          colunas={colunasContatos}
          larguraMinima={760}
        />
      </Secao>

      {/* 1.3 */}
      <Secao numero="1.3" titulo="Usuários do Alarme">
        <Nota>
          Quem deve ter acesso ao sistema (teclado, controle remoto e/ou aplicativo). Não registrar senha pessoal nem
          senha do aplicativo nesta ficha — se &quot;Usa App?&quot; for SIM, informe o e-mail para o convite de acesso.
        </Nota>
        <TabelaEditavel<Usuario>
          rotulo="Usuários do alarme"
          linhas={valor.usuarios}
          onChange={(l) => set('usuarios', l)}
          novaLinha={usuarioVazio}
          colunas={colunasUsuarios}
          larguraMinima={1080}
        />
      </Secao>

      {/* 1.4 */}
      <Secao numero="1.4" titulo="Áreas Independentes">
        <Opcoes
          rotulo="Existem áreas que precisam ser armadas/desarmadas separadamente?"
          titulo="Existem áreas que precisam ser armadas/desarmadas separadamente?"
          value={areas.possui}
          onChange={(v) => setAreas({ possui: v })}
          opcoes={SIM_NAO_RADIO}
        />
        <LinhaRotulo rotulo="Se SIM —">
          <span className="campo-curto">
            Área 1:
            <CampoLinha curto rotulo="Área 1" value={areas.area1} desabilitado={!areasHabilitadas(areas)} onChange={(v) => setAreas({ area1: v })} />
          </span>
          <span className="campo-curto">
            Área 2:
            <CampoLinha curto rotulo="Área 2" value={areas.area2} desabilitado={!areasHabilitadas(areas)} onChange={(v) => setAreas({ area2: v })} />
          </span>
          <span className="campo-curto">
            Outras:
            <CampoLinha curto rotulo="Outras áreas" value={areas.outras} desabilitado={!areasHabilitadas(areas)} onChange={(v) => setAreas({ outras: v })} />
          </span>
        </LinhaRotulo>
        <Nota>
          Exemplos: Loja / Estoque · Escritório / Galpão · Térreo / Andar superior. O Comercial registra a necessidade;
          o Técnico define as partições e configurações correspondentes.
        </Nota>
      </Secao>

      {/* 1.5 */}
      <Secao numero="1.5" titulo="Ambientes Protegidos">
        <Nota>A definição técnica das zonas (Z01, Z02...) será realizada pelo técnico durante a instalação.</Nota>
        <TabelaEditavel<Ambiente>
          rotulo="Ambientes protegidos"
          linhas={valor.ambientes}
          onChange={(l) => set('ambientes', l)}
          novaLinha={ambienteVazio}
          colunas={colunasAmbientes}
          larguraMinima={560}
        />
      </Secao>

      {/* 1.6 */}
      <Secao numero="1.6" titulo="Rotina do Estabelecimento">
        <GradeCampos colunas={12}>
          <CampoCelula rotulo="FUNCIONAMENTO — SEG. A SEX." span={4} largo value={rot.seg_sex} onChange={(v) => setRot({ seg_sex: v })} />
          <CampoCelula rotulo="SÁBADO" span={2} value={rot.sabado} onChange={(v) => setRot({ sabado: v })} />
          <CampoCelula rotulo="DOMINGO / FERIADOS" span={4} value={rot.domingo_feriados} onChange={(v) => setRot({ domingo_feriados: v })} />
          <Celula rotulo="FUNCIONAMENTO 24H?" span={2}>
            <Opcoes
              rotulo="Funcionamento 24h?"
              value={rot.funciona_24h}
              onChange={(v) => setRot({ funciona_24h: v })}
              opcoes={[
                { value: 'sim', label: 'Sim' },
                { value: 'nao', label: 'Não' },
              ]}
            />
          </Celula>
          <CampoCelula rotulo="HORÁRIO HABITUAL DE ABERTURA" span={3} value={rot.abertura} onChange={(v) => setRot({ abertura: v })} />
          <CampoCelula rotulo="HORÁRIO HABITUAL DE FECHAMENTO" span={3} value={rot.fechamento} onChange={(v) => setRot({ fechamento: v })} />
          <CampoCelula
            rotulo="PESSOAS AUTORIZADAS FORA DO HORÁRIO (QUEM)"
            span={6}
            largo
            value={rot.autorizados_fora_horario}
            onChange={(v) => setRot({ autorizados_fora_horario: v })}
          />
        </GradeCampos>
        <div className="linha-rotulo">
          <Opcoes
            rotulo="Interesse em ativação automática (autoativação)"
            titulo="Interesse em ativação automática (autoativação):"
            value={rot.autoativacao}
            onChange={(v) => setRot({ autoativacao: v })}
            opcoes={[
              { value: 'sim', label: 'SIM' },
              { value: 'nao', label: 'NÃO' },
            ]}
          />
          <b>Observações:</b>
          <CampoLinha rotulo="Observações da autoativação" value={rot.autoativacao_obs} onChange={(v) => setRot({ autoativacao_obs: v })} />
        </div>
      </Secao>

      {/* 1.7 */}
      <Secao numero="1.7" titulo="Particularidades do Local">
        <GradeMarcas<ParticularidadeChave>
          rotulo="Particularidades do local"
          colunas={3}
          itens={PARTICULARIDADES_CHAVES.map((k) => ({ chave: k, rotulo: PARTICULARIDADES_ROTULOS[k] }))}
          valores={part}
          onChange={(k, v) => set('particularidades', { ...part, [k]: v })}
        />
        <LinhaRotulo rotulo="Observações importantes:">
          <CampoLinha area rotulo="Observações importantes" value={part.observacoes} onChange={(v) => set('particularidades', { ...part, observacoes: v })} />
        </LinhaRotulo>
      </Secao>

      {/* 1.8 */}
      <Secao numero="1.8" titulo="Informações Operacionais para a CCON">
        <LinhaRotulo rotulo="Particularidades do estabelecimento relevantes para o atendimento:">
          <CampoLinha area rotulo="Particularidades do estabelecimento relevantes para o atendimento" value={ccon.particularidades} onChange={(v) => setCcon({ particularidades: v })} />
        </LinhaRotulo>
        <LinhaRotulo rotulo="Orientação especial em caso de disparo / situações recorrentes conhecidas:">
          <CampoLinha area rotulo="Orientação especial em caso de disparo" value={ccon.orientacao_disparo} onChange={(v) => setCcon({ orientacao_disparo: v })} />
        </LinhaRotulo>
        <Opcoes
          rotulo="Cliente deseja cadastrar palavra de segurança?"
          titulo="Cliente deseja cadastrar palavra de segurança (identificação verbal em ocorrências)?"
          value={ccon.palavra_seguranca}
          onChange={(v) => setCcon({ palavra_seguranca: v })}
          opcoes={[
            { value: 'nao', label: 'NÃO' },
            { value: 'sim', label: 'SIM — cadastro feito diretamente com a CCON, por canal seguro (não preencher nesta ficha)' },
          ]}
        />
      </Secao>
    </div>
  );
}
