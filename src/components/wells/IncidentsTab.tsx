import {useAuth} from '@/auth/AuthProvider';
import {
  Button,
  Card,
  DatePicker,
  Form,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Incident } from '@/api/types';
import {
  useCreateIncident,
  useDeleteIncident,
  useIncidents,
} from '@/hooks/useIncidents';
import { PageSpin } from '@/components/common/PageSpin';

const FAILURE_TYPES = [
  'отложение на приеме',
  'утечка снизу',
  'утечка сверху',
  'отложение АСПО/солей',
  'нормальный режим',
].map((v) => ({ value: v, label: v }));

export function IncidentsTab({ wellId }: { wellId: number }) {
  const {can}=useAuth();
  const { data, isLoading, error } = useIncidents(wellId);
  const create = useCreateIncident(wellId);
  const del = useDeleteIncident(wellId);
  const [form] = Form.useForm();

  const submit = async () => {
    const v = await form.validateFields();
    await create.mutateAsync({
      failure_type: v.failure_type,
      failure_date: v.failure_date.format('YYYY-MM-DD'),
      days_before: v.days_before,
    });
    form.resetFields();
  };

  const columns: ColumnsType<Incident> = [
    { title: 'Тип поломки', dataIndex: 'failure_type', key: 'failure_type' },
    { title: 'Дата отказа', dataIndex: 'failure_date', key: 'failure_date', width: 140 },
    { title: 'История, дней', dataIndex: 'days_before', key: 'days_before', width: 130 },
    {
      title: '',
      key: 'op',
      width: 180,
      render: (_: unknown, r: Incident) => (
        <Space>
          <Popconfirm title="Удалить отказ?" okText="Да" cancelText="Нет" onConfirm={() => del.mutate(r.id)}>
            <Button disabled={!can('incidents.delete')} size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {can('incidents.create') && <Card size="small" title="Новый отказ (конфигурация инцидента)">
        <Form form={form} layout="inline" initialValues={{ days_before: 60 }}>
          <Form.Item name="failure_type" label="Тип" rules={[{ required: true, message: '' }]}>
            <Select options={FAILURE_TYPES} style={{ width: 220 }} placeholder="класс отказа" />
          </Form.Item>
          <Form.Item name="failure_date" label="Дата" rules={[{ required: true, message: '' }]}>
            <DatePicker format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="days_before" label="История, дней">
            <InputNumber min={1} max={365} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<PlusOutlined />} loading={create.isPending} onClick={submit}>
              Добавить
            </Button>
          </Form.Item>
        </Form>
      </Card>}

      <PageSpin loading={isLoading} error={error}>
        <Table rowKey="id" columns={columns} dataSource={data ?? []} pagination={false} size="small" />
      </PageSpin>
    </div>
  );
}
