import { Tag } from 'antd';
import { STATUS_COR, rotuloStatus } from '../domain/status';
import type { Status } from '../api/types';

export function StatusTag({ status }: { status: Status }) {
  const c = STATUS_COR[status] ?? { fundo: '#eee', borda: '#bbb', texto: '#333' };
  return (
    <Tag
      bordered
      style={{ background: c.fundo, borderColor: c.borda, color: c.texto, fontWeight: 700, marginInlineEnd: 0 }}
      data-status={status}
    >
      {rotuloStatus(status)}
    </Tag>
  );
}
