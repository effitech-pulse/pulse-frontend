import { Form, Input, InputNumber, Modal } from 'antd';
import { useEffect } from 'react';
import { useSaveDepartment } from '@/hooks/useWells';
import type { Department } from '@/api/types';

export function DepartmentModal({
  open,
  dept,
  onClose,
}: {
  open: boolean;
  dept: Department | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<{ id: number; name: string }>();
  const save = useSaveDepartment();

  useEffect(() => {
    if (!open) return;
    if (dept) form.setFieldsValue(dept);
    else form.resetFields();
  }, [open, dept, form]);

  const submit = async () => {
    const values = await form.validateFields();
    await save.mutateAsync({ id: values.id, name: values.name, isNew: !dept });
    onClose();
  };

  return (
    <Modal
      open={open}
      title={dept ? 'Переименовать департамент' : 'Новый департамент'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={submit}
      onCancel={onClose}
      forceRender
    >
      <Form form={form} layout="vertical">
        <Form.Item name="id" label="Код цеха (CEX)" rules={[{ required: true, message: 'Обязательно' }]}>
          <InputNumber style={{ width: '100%' }} precision={0} disabled={!!dept} />
        </Form.Item>
        <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Обязательно' }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}
