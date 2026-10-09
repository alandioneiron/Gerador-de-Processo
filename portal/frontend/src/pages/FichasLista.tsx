// Lista de fichas: busca, filtro por status, "Nova ficha".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Empty, Input, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApiError, api, STATUS_LISTA, type FichaResumo, type Status } from '../api';
import { StatusTag } from '../components/StatusTag';
import { STATUS_ROTULO } from '../domain/status';
import { formatarData, formatarDataHora } from '../domain/util';
import { useIdentidade } from '../state/identidade';

export function FichasLista() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { garantirAutor } = useIdentidade();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [fichas, setFichas] = useState<FichaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const pedido = useRef(0);

  const carregar = useCallback(async (q: string, st: Status | '') => {
    const meu = ++pedido.current;
    setCarregando(true);
    setErro(null);
    try {
      const lista = await api.listarFichas({ q, status: st });
      if (meu === pedido.current) setFichas(lista);
    } catch (e) {
      if (meu === pedido.current) setErro(e instanceof ApiError ? e.detail : 'Não foi possível carregar as fichas.');
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregar(busca, status), busca ? 300 : 0);
    return () => clearTimeout(t);
  }, [busca, status, carregar]);

  const novaFicha = async () => {
    const autor = await garantirAutor();
    if (!autor) return;
    setCriando(true);
    try {
      const f = await api.criarFicha(autor);
      void message.success(`Ficha ${f.codigo} criada.`);
      navigate(`/fichas/${f.id}`);
    } catch (e) {
      void message.error(e instanceof ApiError ? e.detail : 'Não foi possível criar a ficha.');
    } finally {
      setCriando(false);
    }
  };

  const colunas: ColumnsType<FichaResumo> = [
    {
      title: 'Código',
      dataIndex: 'codigo',
      width: 140,
      sorter: (a, b) => a.codigo.localeCompare(b.codigo),
      render: (codigo: string, f) => <Link to={`/fichas/${f.id}`}>{codigo}</Link>,
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente',
      sorter: (a, b) => a.cliente.localeCompare(b.cliente),
      render: (c: string) => c || <span style={{ color: '#888' }}>(sem nome)</span>,
    },
    { title: 'Vendedor', dataIndex: 'vendedor', width: 170, sorter: (a, b) => a.vendedor.localeCompare(b.vendedor) },
    {
      title: 'Data prevista',
      dataIndex: 'data_prevista',
      width: 130,
      sorter: (a, b) => a.data_prevista.localeCompare(b.data_prevista),
      render: (d: string) => formatarData(d),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 230,
      render: (s: Status) => <StatusTag status={s} />,
    },
    {
      title: 'Atualizado em',
      dataIndex: 'atualizado_em',
      width: 150,
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.atualizado_em.localeCompare(b.atualizado_em),
      render: (d: string) => formatarDataHora(d),
    },
  ];

  return (
    <section aria-labelledby="titulo-lista">
      <div className="editor-linha">
        <h1 id="titulo-lista" style={{ margin: 0, fontSize: 22, color: '#1B2A4A' }}>
          Fichas de Implantação
        </h1>
        <div className="editor-acoes">
          <Button type="primary" size="large" loading={criando} onClick={() => void novaFicha()}>
            Nova ficha
          </Button>
        </div>
      </div>

      <div className="editor-linha" style={{ background: '#fff', border: '1px solid #bdbdbd', padding: 10 }}>
        <Input.Search
          allowClear
          placeholder="Buscar por cliente, vendedor, código ou CPF/CNPJ"
          aria-label="Buscar fichas"
          style={{ maxWidth: 440, flex: 1, minWidth: 220 }}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onSearch={(v) => void carregar(v, status)}
        />
        <Select<Status | ''>
          aria-label="Filtrar por status"
          style={{ width: 260 }}
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Todos os status' },
            ...STATUS_LISTA.map((s) => ({ value: s, label: STATUS_ROTULO[s] })),
          ]}
        />
      </div>

      {erro && (
        <Alert
          type="error"
          showIcon
          style={{ margin: '10px 0' }}
          message={erro}
          action={
            <Button size="small" onClick={() => void carregar(busca, status)}>
              Tentar de novo
            </Button>
          }
        />
      )}

      <Table<FichaResumo>
        rowKey="id"
        size="middle"
        loading={carregando}
        columns={colunas}
        dataSource={fichas}
        pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
        scroll={{ x: 900 }}
        style={{ marginTop: 10 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={busca || status ? 'Nenhuma ficha encontrada com esse filtro.' : 'Nenhuma ficha ainda. Clique em "Nova ficha".'}
            />
          ),
        }}
        onRow={(f) => ({
          onClick: (e) => {
            if ((e.target as HTMLElement).closest('a')) return;
            navigate(`/fichas/${f.id}`);
          },
          style: { cursor: 'pointer' },
        })}
      />
    </section>
  );
}
