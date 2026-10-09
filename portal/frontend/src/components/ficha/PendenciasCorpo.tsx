// Seção 9 (Pendências) e 10 (Travas do Processo) do docx.
import type { Pendencia } from '../../api/types';
import { Secao, TabelaEditavel, colMarca, colTexto, type Coluna } from './campos';

const pendenciaVazia = (): Pendencia => ({ descricao: '', responsavel: '', prazo: '', resolvido: false });

const colunasPendencias: Coluna<Pendencia>[] = [
  colTexto<Pendencia>('descricao', 'Pendência', { area: true }),
  colTexto<Pendencia>('responsavel', 'Responsável', { largura: '22%' }),
  colTexto<Pendencia>('prazo', 'Data / Prazo', { largura: '16%', tipo: 'date' }),
  colMarca<Pendencia>('resolvido', 'Resolvido', '10%'),
];


interface Props {
  valor: Pendencia[];
  onChange?: (v: Pendencia[]) => void;
  /** Esconde a seção 10 (travas) quando já aparece em outro lugar. */
  semTravas?: boolean;
}

export function PendenciasCorpo({ valor, onChange, semTravas }: Props) {
  return (
    <div className="etapa-corpo" data-etapa="pendencias">
      <Secao numero="9" titulo="Pendências">
        <TabelaEditavel<Pendencia>
          rotulo="Pendências"
          linhas={valor}
          onChange={onChange}
          novaLinha={pendenciaVazia}
          colunas={colunasPendencias}
          larguraMinima={600}
        />
      </Secao>

      {!semTravas && (
        <Secao numero="10" titulo="Travas do Processo">
          <div className="travas-duas">
            <div>
              <h4>OBRIGATÓRIO PARA LIBERAR INSTALAÇÃO</h4>
              <ul>
                <li>Identificação do cliente e endereço completos</li>
                <li>Ao menos 1 contato de ocorrência cadastrado (item 1.2)</li>
                <li>Usuários e permissões definidos pelo Comercial (item 1.3)</li>
                <li>Data prevista de instalação confirmada</li>
              </ul>
            </div>
            <div>
              <h4>OBRIGATÓRIO PARA ATIVAR MONITORAMENTO</h4>
              <ul>
                <li>Todos os testes técnicos (3.1) concluídos</li>
                <li>Todos os testes com a CCON (3.2) concluídos</li>
                <li>Validação da CCON = APROVADO (3.3)</li>
                <li>Lista de contatos e regras operacionais recebidas pela CCON</li>
              </ul>
            </div>
          </div>
        </Secao>
      )}
    </div>
  );
}
