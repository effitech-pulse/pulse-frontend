import { App, Form, Input, InputNumber, Modal, Switch } from 'antd';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wellsApi } from '@/api/wells';
import { toApiError } from '@/api/client';
import type { WellCreate } from '@/api/types';

export function AddWellModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<WellCreate>();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
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
      confirmLoading={saving}
      onOk={submit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      forceRender
    >
      <Form form={form} layout="vertical" initialValues={{ active: true }}>
        <Form.Item name="unitek_id" label="UNITEK_ID" rules={[{ required: true, message: 'Обязательно' }]}>
          <InputNumber style={{ width: '100%' }} precision={0} />
        </Form.Item>
        <Form.Item name="armits_id" label="ARMITS_ID" rules={[{ required: true, message: 'Обязательно' }]}>
          <InputNumber style={{ width: '100%' }} precision={0} />
        </Form.Item>
        <Form.Item name="well_number" label="№ скважины (необязательно)">
          <Input />
        </Form.Item>
        <Form.Item name="ngdu" label="НГДУ (NGDU)" rules={[{ required: true, message: 'Обязательно' }]}>
          <InputNumber style={{ width: '100%' }} precision={0} />
        </Form.Item>
        <Form.Item name="department" label="Цех (CEX)" rules={[{ required: true, message: 'Обязательно' }]}>
          <InputNumber style={{ width: '100%' }} precision={0} />
        </Form.Item>
        <Form.Item name="active" label="Активна" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
