// Peças da ficha com o visual do docx: grade de campos com rótulo em caixa alta, tabelas
// editáveis, rádios/checkboxes em linha e em grade, faixa de etapa e títulos numerados.
// Um contexto de "modo" decide se cada peça é editável, somente leitura ou texto de impressão.
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Button, Checkbox, Input, Radio } from 'antd';
import { formatarData } from '../../domain/util';

// ---------------------------------------------------------------- modo

export interface Modo {
  /** Somente leitura (status da ficha ou aba de consulta). */
  readOnly: boolean;
  /** Versão de impressão: tudo vira texto, sem botões. */
  impressao: boolean;
}

const ModoContext = createContext<Modo>({ readOnly: false, impressao: false });

export function ModoProvider({ readOnly = false, impressao = false, children }: Partial<Modo> & { children: ReactNode }) {
  return <ModoContext.Provider value={{ readOnly: readOnly || impressao, impressao }}>{children}</ModoContext.Provider>;
}

export function useModo(): Modo {
  return useContext(ModoContext);
}

// ---------------------------------------------------------------- texto

type TipoTexto = 'text' | 'date' | 'time' | 'email' | 'tel';

interface TextoProps {
  value: string;
  onChange?: (valor: string) => void;
  /** Nome acessível do campo. */
  rotulo: string;
  tipo?: TipoTexto;
  desabilitado?: boolean;
  placeholder?: string;
  /** `linha` = sublinhado, como os "_____" do docx; `celula` = sem borda dentro de célula. */
  estilo?: 'celula' | 'linha';
  area?: boolean;
  className?: string;
}

function valorImpresso(valor: string, tipo: TipoTexto): string {
  return tipo === 'date' ? formatarData(valor) : valor;
}

export function Texto({
  value,
  onChange,
  rotulo,
  tipo = 'text',
  desabilitado,
  placeholder,
  estilo = 'celula',
  area,
  className,
}: TextoProps) {
  const { readOnly, impressao } = useModo();
  if (impressao) {
    return <span className={`valor ${className ?? ''}`}>{valorImpresso(value, tipo)}</span>;
  }
  const variante = estilo === 'celula' ? 'borderless' : 'outlined';
  if (area) {
    return (
      <Input.TextArea
        aria-label={rotulo}
        className={className}
        variant={variante}
        autoSize={{ minRows: 1, maxRows: 8 }}
        value={value}
        readOnly={readOnly}
        disabled={desabilitado}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  }
  return (
    <Input
      aria-label={rotulo}
      className={className}
      variant={variante}
      type={tipo}
      value={value}
      readOnly={readOnly}
      disabled={desabilitado}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

// ---------------------------------------------------------------- seletor nativo (Sim/Não etc.)

export interface OpcaoSeletor {
  value: string;
  label: string;
}

export const OPCOES_SIM_NAO: OpcaoSeletor[] = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];

export function Seletor({
  value,
  onChange,
  opcoes,
  rotulo,
  desabilitado,
}: {
  value: string;
  onChange?: (valor: string) => void;
  opcoes: OpcaoSeletor[];
  rotulo: string;
  desabilitado?: boolean;
}) {
  const { readOnly, impressao } = useModo();
  if (impressao) {
    return <span className="valor">{opcoes.find((o) => o.value === value)?.label ?? ''}</span>;
  }
  return (
    <select
      className="seletor"
      aria-label={rotulo}
      value={value}
      disabled={readOnly || desabilitado}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="" />
      {opcoes.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------- rádios em linha

export interface OpcaoRadio<V extends string> {
  value: V;
  label: string;
  /** Conteúdo logo após a opção (ex.: "Outra: ______"). */
  extra?: ReactNode;
}

interface OpcoesProps<V extends string> {
  value: V | '';
  onChange?: (valor: V | '') => void;
  opcoes: OpcaoRadio<V>[];
  rotulo: string;
  /** Texto em negrito à esquerda da linha (ex.: "Modelo da central:"). */
  titulo?: ReactNode;
}

/**
 * Opções exclusivas na mesma linha (botões de rádio). Clicar de novo na opção marcada
 * limpa a escolha, como desmarcar o quadradinho do docx.
 */
export function Opcoes<V extends string>({ value, onChange, opcoes, rotulo, titulo }: OpcoesProps<V>) {
  const { readOnly, impressao } = useModo();

  if (impressao) {
    return (
      <div className="opcoes-linha">
        {titulo && <span className="rotulo-linha">{titulo}</span>}
        {opcoes.map((o) => (
          <span key={o.value} className="opcao-impressa">
            {value === o.value ? '☒' : '☐'} {o.label}
            {o.extra}
          </span>
        ))}
      </div>
    );
  }

  const aoClicar = (e: MouseEvent<HTMLElement>, v: V) => {
    // Só o clique no <input> conta (o clique no texto gera um segundo clique no input).
    if ((e.target as HTMLElement).tagName === 'INPUT' && value === v && !readOnly) onChange?.('');
  };

  return (
    <div className="opcoes-linha" role="radiogroup" aria-label={rotulo}>
      {titulo && <span className="rotulo-linha">{titulo}</span>}
      {opcoes.map((o) => (
        <span key={o.value} className="opcao-extra">
          <Radio
            checked={value === o.value}
            disabled={readOnly}
            onChange={() => onChange?.(o.value)}
            onClick={(e) => aoClicar(e, o.value)}
          >
            {o.label}
          </Radio>
          {o.extra}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- checkboxes

export function Marca({
  checked,
  onChange,
  children,
  rotulo,
}: {
  checked: boolean;
  onChange?: (valor: boolean) => void;
  children: ReactNode;
  rotulo?: string;
}) {
  const { readOnly, impressao } = useModo();
  if (impressao) {
    return (
      <span className="opcao-impressa">
        {checked ? '☒' : '☐'} {children}
      </span>
    );
  }
  return (
    <Checkbox
      checked={checked}
      disabled={readOnly}
      aria-label={rotulo}
      onChange={(e) => onChange?.(e.target.checked)}
    >
      {children}
    </Checkbox>
  );
}

export interface ItemMarca<K extends string> {
  chave: K;
  rotulo: string;
  /** Conteúdo após o rótulo (ex.: campo "Outro: ____"). */
  extra?: ReactNode;
}

/** Checkboxes em grade de N colunas, preenchida linha a linha como no docx. */
export function GradeMarcas<K extends string>({
  itens,
  valores,
  onChange,
  colunas,
  rotulo,
}: {
  itens: ItemMarca<K>[];
  valores: Record<K, boolean>;
  onChange?: (chave: K, marcado: boolean) => void;
  colunas: 2 | 3;
  rotulo: string;
}) {
  return (
    <div className={`marcas-grade col-${colunas}`} role="group" aria-label={rotulo}>
      {itens.map((i) => (
        <div key={i.chave} className="marca-extra">
          <Marca checked={!!valores[i.chave]} onChange={(v) => onChange?.(i.chave, v)}>
            {i.rotulo}
          </Marca>
          {i.extra}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- grade de campos (células com borda)

export function GradeCampos({ colunas = 6, children }: { colunas?: number; children: ReactNode }) {
  const estilo = { '--colunas': colunas } as CSSProperties;
  return (
    <div className="grade-campos" style={estilo}>
      {children}
    </div>
  );
}

export function Celula({
  rotulo,
  span = 1,
  largo,
  children,
}: {
  rotulo: string;
  span?: number;
  /** Ocupa a linha inteira em telas pequenas. */
  largo?: boolean;
  children: ReactNode;
}) {
  const estilo = { '--span': span } as CSSProperties;
  return (
    <div className={`celula${largo ? ' largo' : ''}`} style={estilo}>
      <span className="rotulo">{rotulo}</span>
      {children}
    </div>
  );
}

/** Célula com um campo de texto dentro. */
export function CampoCelula({
  rotulo,
  span,
  largo,
  ...texto
}: Omit<TextoProps, 'estilo' | 'rotulo'> & { rotulo: string; span?: number; largo?: boolean }) {
  return (
    <Celula rotulo={rotulo} span={span} largo={largo}>
      <Texto rotulo={rotulo} {...texto} />
    </Celula>
  );
}

// ---------------------------------------------------------------- linha com rótulo e sublinhado

export function LinhaRotulo({
  rotulo,
  children,
}: {
  rotulo: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="linha-rotulo">
      <b>{rotulo}</b>
      {children}
    </div>
  );
}

export function CampoLinha({
  rotulo,
  value,
  onChange,
  desabilitado,
  area,
  curto,
}: {
  rotulo: string;
  value: string;
  onChange?: (v: string) => void;
  desabilitado?: boolean;
  area?: boolean;
  /** Campo curto inline ("Outra: ______"). */
  curto?: boolean;
}) {
  return (
    <span className={curto ? 'campo-curto' : 'campo-livre'}>
      <Texto
        rotulo={rotulo}
        value={value}
        onChange={onChange}
        desabilitado={desabilitado}
        estilo="linha"
        area={area}
      />
    </span>
  );
}

// ---------------------------------------------------------------- títulos e faixas

export function FaixaEtapa({ titulo, responsavel }: { titulo: string; responsavel: string }) {
  return (
    <h2 className="faixa-etapa">
      <span className="titulo">{titulo}</span>
      <span className="sep" aria-hidden="true">
        |
      </span>
      <span className="resp">Responsável: {responsavel}</span>
    </h2>
  );
}

export function Secao({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="secao" data-secao={numero}>
      <h3 className="secao-titulo">
        <span className="num">{numero}</span>
        <span>{titulo}</span>
      </h3>
      {children}
    </section>
  );
}

export function Nota({ children }: { children: ReactNode }) {
  return <p className="nota">{children}</p>;
}

export function AvisoDocx({ children }: { children: ReactNode }) {
  return (
    <div className="aviso-docx" role="note">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- tabela editável

export interface Coluna<T> {
  id: string;
  titulo: ReactNode;
  /** Largura CSS (ex.: "14%"). */
  largura?: string;
  /** Classe extra da célula (ex.: "centro", "fixa"). */
  classe?: string;
  render: (linha: T, indice: number, atualizar: (parcial: Partial<T>) => void) => ReactNode;
}

interface TabelaEditavelProps<T> {
  linhas: T[];
  onChange?: (linhas: T[]) => void;
  colunas: Coluna<T>[];
  /** Nome acessível da tabela. */
  rotulo: string;
  novaLinha?: (linhas: T[]) => T;
  /** Sem "+ Adicionar linha" nem "remover" (ex.: partições A/B/Comum). */
  fixa?: boolean;
  /** Menor quantidade de linhas depois de remover. */
  minLinhas?: number;
  textoAdicionar?: string;
  /** Largura mínima da tabela antes de aparecer a rolagem horizontal. */
  larguraMinima?: number;
  /** Chamado com a lista nova depois de adicionar/remover (ex.: renumerar). */
  aoReordenar?: (linhas: T[]) => T[];
}

interface LinhaProps<T> {
  linha: T;
  indice: number;
  colunas: Coluna<T>[];
  comAcoes: boolean;
  desabilitarRemover: boolean;
  rotulo: string;
  atualizar: (indice: number, parcial: Partial<T>) => void;
  remover: (indice: number) => void;
}

// A linha só renderiza de novo quando a própria linha muda: digitar numa célula não refaz a tabela inteira.
const LinhaTabela = memo(function LinhaTabela<T>({
  linha,
  indice,
  colunas,
  comAcoes,
  desabilitarRemover,
  rotulo,
  atualizar,
  remover,
}: LinhaProps<T>) {
  return (
    <tr>
      {colunas.map((c) => (
        <td key={c.id} className={c.classe}>
          {c.render(linha, indice, (p) => atualizar(indice, p))}
        </td>
      ))}
      {comAcoes && (
        <td className="col-acao">
          <Button
            type="link"
            size="small"
            danger
            disabled={desabilitarRemover}
            aria-label={`Remover linha ${indice + 1} de ${rotulo}`}
            onClick={() => remover(indice)}
          >
            remover
          </Button>
        </td>
      )}
    </tr>
  );
}) as <T>(props: LinhaProps<T>) => ReactElement;

export function TabelaEditavel<T>({
  linhas,
  onChange,
  colunas,
  rotulo,
  novaLinha,
  fixa,
  minLinhas = 1,
  textoAdicionar = '+ Adicionar linha',
  larguraMinima = 640,
  aoReordenar,
}: TabelaEditavelProps<T>) {
  const { readOnly, impressao } = useModo();
  const comAcoes = !fixa && !readOnly && !impressao;

  // Callbacks estáveis (leem o estado mais recente por ref) para a memoização das linhas funcionar.
  const ultimo = useRef({ linhas, onChange, aoReordenar });
  ultimo.current = { linhas, onChange, aoReordenar };

  const emitir = useCallback((nova: T[]) => {
    const { onChange: mudar, aoReordenar: reordenar } = ultimo.current;
    mudar?.(reordenar ? reordenar(nova) : nova);
  }, []);

  const atualizar = useCallback((indice: number, parcial: Partial<T>) => {
    const { linhas: atuais, onChange: mudar } = ultimo.current;
    mudar?.(atuais.map((l, i) => (i === indice ? { ...l, ...parcial } : l)));
  }, []);

  const remover = useCallback(
    (indice: number) => emitir(ultimo.current.linhas.filter((_, j) => j !== indice)),
    [emitir],
  );

  return (
    <>
      <div className="tabela-scroll">
        <table className="tabela-ficha" aria-label={rotulo} style={{ minWidth: impressao ? undefined : larguraMinima }}>
          <colgroup>
            {colunas.map((c) => (
              <col key={c.id} style={c.largura ? { width: c.largura } : undefined} />
            ))}
            {comAcoes && <col style={{ width: 74 }} />}
          </colgroup>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.id} scope="col">
                  {c.titulo}
                </th>
              ))}
              {comAcoes && <th className="col-acao" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, i) => (
              <LinhaTabela<T>
                key={i}
                linha={linha}
                indice={i}
                colunas={colunas}
                comAcoes={comAcoes}
                desabilitarRemover={linhas.length <= minLinhas}
                rotulo={rotulo}
                atualizar={atualizar}
                remover={remover}
              />
            ))}
          </tbody>
        </table>
      </div>
      {comAcoes && novaLinha && (
        <div className="tabela-acoes">
          <Button
            size="small"
            onClick={() => emitir([...ultimo.current.linhas, novaLinha(ultimo.current.linhas)])}
            aria-label={`${textoAdicionar.replace(/^\+\s*/, '')} em ${rotulo}`}
          >
            {textoAdicionar}
          </Button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- colunas prontas

type ChavesTexto<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T] & string;
type ChavesBool<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T] & string;

function aria(titulo: ReactNode, indice: number): string {
  return `${typeof titulo === 'string' ? titulo : 'Campo'} — linha ${indice + 1}`;
}

export function colTexto<T>(
  campo: ChavesTexto<T>,
  titulo: string,
  opcoes: { largura?: string; area?: boolean; tipo?: TipoTexto; desabilitada?: (linha: T) => boolean } = {},
): Coluna<T> {
  return {
    id: campo,
    titulo,
    largura: opcoes.largura,
    render: (linha, i, atualizar) => (
      <Texto
        rotulo={aria(titulo, i)}
        value={linha[campo] as unknown as string}
        tipo={opcoes.tipo}
        area={opcoes.area}
        desabilitado={opcoes.desabilitada?.(linha)}
        onChange={(v) => atualizar({ [campo]: v } as unknown as Partial<T>)}
      />
    ),
  };
}

export function colSeletor<T>(
  campo: ChavesTexto<T>,
  titulo: ReactNode,
  opcoes: OpcaoSeletor[],
  largura?: string,
  ariaTitulo?: string,
): Coluna<T> {
  return {
    id: campo,
    titulo,
    largura,
    render: (linha, i, atualizar) => (
      <Seletor
        rotulo={aria(ariaTitulo ?? titulo, i)}
        value={linha[campo] as unknown as string}
        opcoes={opcoes}
        onChange={(v) => atualizar({ [campo]: v } as unknown as Partial<T>)}
      />
    ),
  };
}

export function colMarca<T>(campo: ChavesBool<T>, titulo: string, largura?: string): Coluna<T> {
  return {
    id: campo,
    titulo,
    largura,
    classe: 'centro',
    render: (linha, i, atualizar) => (
      <Marca
        rotulo={aria(titulo, i)}
        checked={linha[campo] as unknown as boolean}
        onChange={(v) => atualizar({ [campo]: v } as unknown as Partial<T>)}
      >
        {''}
      </Marca>
    ),
  };
}
