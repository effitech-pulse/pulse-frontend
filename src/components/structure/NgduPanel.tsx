import {LocalEntityTable} from '@/components/common/LocalEntityTable';
import {useAuth} from '@/auth/AuthProvider';
import { Button, Popconfirm, Space, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import type { Ngdu } from '@/api/types';
import { useDeleteNgdu, useNgdus } from '@/hooks/useWells';
import { PageSpin } from '@/components/common/PageSpin';
import { NgduModal } from '@/components/structure/NgduModal';

export function NgduPanel() {
  const {can,canFull}=useAuth();
  const { data, isLoading, error, refetch, isFetching } = useNgdus();
  const del = useDeleteNgdu();
  const [editing, setEditing] = useState<Ngdu | null>(null);
  const [open, setOpen] = useState(false);

  const columns: ColumnsType<Ngdu> = [
    { title: 'Код НГДУ', dataIndex: 'id', key: 'id', width: 180 },
    { title: 'Название', dataIndex: 'name', key: 'name' },
    {
      title: '',
      key: 'op',
      width: 96,
      render: (_: unknown, item: Ngdu) => (
        <Space>
          <Button
            size="small" aria-label={`Редактировать НГДУ «${item.name}» (${item.id})`}
            disabled={!canFull('references.update')} icon={<EditOutlined aria-hidden="true" />}
            onClick={() => {
              setEditing(item);
              setOpen(true);
            }}
          />
          <Popconfirm title="Удалить НГДУ?" okText="Да" cancelText="Нет"
            onConfirm={() => del.mutate(item.id)}>
            <Button size="small" aria-label={`Удалить НГДУ «${item.name}» (${item.id})`} danger disabled={!canFull('references.delete')} icon={<DeleteOutlined aria-hidden="true" />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" disabled={!canFull('references.create')} icon={<PlusOutlined aria-hidden="true" />} onClick={() => { setEditing(null); setOpen(true); }}>
          Добавить НГДУ
        </Button>
      </div>
      <Typography.Paragraph type="secondary">
        НГДУ — нефтегазодобывающее управление, верхний уровень структуры. <b>Код НГДУ</b> совпадает с
        полем «НГДУ» у скважины: заведите запись с этим кодом, и название будет подтягиваться в
        таблице скважин.
      </Typography.Paragraph>
      <PageSpin loading={isLoading} error={error}>
        <LocalEntityTable onRefresh={()=>void refetch()} refreshing={isFetching} refreshDisabled={!can('references.read')} tableKey="NgduPanel" fields={[{key:'id',label:'Код НГДУ',kind:'number',read:r=>r.id},{key:'name',label:'Название',kind:'text',read:r=>r.name}]} defaultSort={[{field:'id',direction:'asc'}]} rowKey="id" columns={columns} dataSource={data ?? []} pagination={false} size="middle" />
      </PageSpin>
      <NgduModal open={open} ngdu={editing} onClose={() => setOpen(false)} />
    </>
  );
}
