import {useAuth} from '@/auth/AuthProvider';
import { Button, Popconfirm, Space, Table, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import type { Department } from '@/api/types';
import { useDeleteDepartment, useDepartments } from '@/hooks/useWells';
import { PageSpin } from '@/components/common/PageSpin';
import { DepartmentModal } from '@/components/departments/DepartmentModal';

export function DepartmentsPanel() {
  const {can}=useAuth();
  const { data, isLoading, error } = useDepartments();
  const del = useDeleteDepartment();
  const [editing, setEditing] = useState<Department | null>(null);
  const [open, setOpen] = useState(false);

  const columns: ColumnsType<Department> = [
    { title: 'Код цеха (CEX)', dataIndex: 'id', key: 'id', width: 180 },
    { title: 'Название', dataIndex: 'name', key: 'name' },
    {
      title: '',
      key: 'op',
      width: 96,
      render: (_: unknown, dep: Department) => (
        <Space>
          <Button
            size="small"
            disabled={!can('references.update')} icon={<EditOutlined />}
            onClick={() => {
              setEditing(dep);
              setOpen(true);
            }}
          />
          <Popconfirm title="Удалить цех?" okText="Да" cancelText="Нет"
            onConfirm={() => del.mutate(dep.id)}>
            <Button size="small" danger disabled={!can('references.delete')} icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" disabled={!can('references.create')} icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>
          Добавить цех
        </Button>
      </div>
      <Typography.Paragraph type="secondary">
        Цех (ЦДНГ) — низовое подразделение НГДУ. <b>Код цеха (CEX)</b> совпадает с полем «Цех» у
        скважины: заведите запись с этим кодом, и название будет подтягиваться в таблице скважин.
      </Typography.Paragraph>
      <PageSpin loading={isLoading} error={error}>
        <Table rowKey="id" columns={columns} dataSource={data ?? []} pagination={false} size="middle" />
      </PageSpin>
      <DepartmentModal open={open} dept={editing} onClose={() => setOpen(false)} />
    </>
  );
}
