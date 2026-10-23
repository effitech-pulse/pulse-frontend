import {useAuth} from '@/auth/AuthProvider';
import { App, Collapse, Form, Input, InputNumber, Modal, Switch } from 'antd';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wellsApi } from '@/api/wells';
import { toApiError } from '@/api/client';
import type { WellCreate } from '@/api/types';

export function AddWellModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {can}=useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<WellCreate>();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if(!can('wells.create'))return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await wellsApi.create({ ...values, active: values.active ?? true });
      message.success('Скважина добавлена');
      queryClient.invalidateQueries({ queryKey: ['wells'] });
      form.resetFields();
      onClose();
    } catch (e) {
      message.error(toApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Добавить скважину"
      okText="Добавить"
      cancelText="Отмена"
      okButtonProps={{disabled:!can('wells.create')}} confirmLoading={saving}
      onOk={submit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      forceRender
    >
      <Form form={form} layout="vertical" initialValues={{ active: true }}>
        <p>ID Pulse будет назначен автоматически. Связи с внешними системами можно добавить позже в интеграциях.</p>
        <Form.Item name="well_number" label="№ скважины (необязательно)">
          <Input />
        </Form.Item>
        <Form.Item name="responsible" label="Ответственный (необязательно)"><Input maxLength={120} /></Form.Item>
        <Form.Item name="ngdu" label="НГДУ (NGDU)" rules={[{ required: true, message: 'Обязательно' }]}>
          <InputNumber style={{ width: '100%' }} precision={0} />
        </Form.Item>
        <Form.Item name="department" label="Цех (CEX)" rules={[{ required: true, message: 'Обязательно' }]}>
          <InputNumber style={{ width: '100%' }} precision={0} />
        </Form.Item>
        <Form.Item name="active" label="Активна" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Collapse items={[{key:'external',label:'Связи с внешними системами · необязательно',children:<><Form.Item name="unitek_id" label="ID в Unitek"><InputNumber style={{width:'100%'}} precision={0} /></Form.Item><Form.Item name="armits_id" label="ID в Armits"><InputNumber style={{width:'100%'}} precision={0} /></Form.Item></>}]} />
      </Form>
    </Modal>
  );
}
