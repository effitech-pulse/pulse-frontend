import { Form, Input, InputNumber, Modal } from 'antd';
import { useEffect } from 'react';
import { useSaveNgdu } from '@/hooks/useWells';
import type { Ngdu } from '@/api/types';

export function NgduModal({
  open,
  ngdu,
  onClose,
}: {
  open: boolean;
  ngdu: Ngdu | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<{ id: number; name: string }>();
  const save = useSaveNgdu();

  useEffect(() => {
    if (!open) return;
    if (ngdu) form.setFieldsValue(ngdu);
    else form.resetFields();
  }, [open, ngdu, form]);

  const submit = async () => {
    const values = await form.validateFields();
    await save.mutateAsync({ id: values.id, name: values.name, isNew: !ngdu });
    onClose();
  };

  return (
    <Modal
      open={open}
      title={ngdu ? 'Переименовать НГДУ' : 'Новое НГДУ'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={submit}
      onCancel={onClose}
      forceRender
    >
      <Form form={form} layout="vertical">
        <Form.Item name="id" label="Код НГДУ" rules={[{ required: true, message: 'Обязательно' }]}>
          <InputNumber style={{ width: '100%' }} precision={0} disabled={!!ngdu} />
        </Form.Item>
        <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Обязательно' }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}
