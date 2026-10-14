import { Card, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { AuditEntry } from '@/api/types';
import { useAudit } from '@/hooks/useAudit';
import { PageSpin } from '@/components/common/PageSpin';

const METHOD_COLOR: Record<string, string> = {
  POST: 'green',
  PUT: 'blue',
  PATCH: 'gold',
  DELETE: 'red',
};

export function AuditPage() {
  const { data, isLoading, error } = useAudit();

  const columns: ColumnsType<AuditEntry> = [
    { title: 'Время', dataIndex: 'ts', key: 'ts', width: 180,
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss') },
    { title: 'Кто', dataIndex: 'actor', key: 'actor', width: 140,
      render: (a: string | null) => a ?? '—' },
    { title: 'Метод', dataIndex: 'method', key: 'method', width: 100,
      render: (m: string) => <Tag color={METHOD_COLOR[m] ?? 'default'}>{m}</Tag> },
    { title: 'Путь', dataIndex: 'path', key: 'path', ellipsis: true },
    { title: 'Статус', dataIndex: 'status_code', key: 'status_code', width: 100,
      render: (c: number) => <Tag color={c < 400 ? 'green' : 'red'}>{c}</Tag> },
  ];

  return (
    <Card title="Журнал действий">
      <Typography.Paragraph type="secondary">
        Изменяющие запросы (POST/PUT/PATCH/DELETE) к API. Хранится история за последнюю неделю.
      </Typography.Paragraph>
      <PageSpin loading={isLoading} error={error}>
        <Table rowKey="id" columns={columns} dataSource={data ?? []} size="small" pagination={{ pageSize: 20 }} />
      </PageSpin>
    </Card>
  );
}
