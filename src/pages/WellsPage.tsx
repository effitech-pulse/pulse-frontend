import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Switch,
  Table,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileSearchOutlined,
  InboxOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useState, type DragEvent, type HTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Well } from '@/api/types';
import { wellsApi } from '@/api/wells';
import { toApiError } from '@/api/client';
import { useDeleteWell, useDepartments, useNgdus, useUpdateWell, useWells } from '@/hooks/useWells';
import { PageSpin } from '@/components/common/PageSpin';
import { WellImportModal } from '@/components/wells/WellImportModal';
import { AddWellModal } from '@/components/wells/AddWellModal';

const XLSX_RE = /\.(xlsx|xlsm)$/i;

type CellInput = 'text' | 'number';

interface EditableCellProps extends HTMLAttributes<HTMLElement> {
  editing: boolean;
  dataIndex: string;
  inputType: CellInput;
  children?: ReactNode;
}

function EditableCell({ editing, dataIndex, inputType, children, ...rest }: EditableCellProps) {
  return (
    <td {...rest}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={inputType === 'number' ? [{ required: true, message: '' }] : []}
        >
          {inputType === 'number' ? (
            <InputNumber style={{ width: '100%' }} precision={0} />
          ) : (
            <Input />
          )}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
}

export function WellsPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [showInactive, setShowInactive] = useState(false);
  const { data, isLoading, error } = useWells(!showInactive);
  const departments = useDepartments();
  const ngdus = useNgdus();
  const updateWell = useUpdateWell();
  const deleteWell = useDeleteWell();

  const deptLabel = (code: number): string => {
    const name = departments.data?.find((d) => d.id === code)?.name;
    return name ? `${name} (${code})` : String(code);
  };

  const ngduLabel = (code: number): string => {
    const name = ngdus.data?.find((n) => n.id === code)?.name;
    return name ? `${name} (${code})` : String(code);
  };

  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isEditing = (well: Well) => well.id === editingKey;
  const edit = (well: Well) => {
    form.setFieldsValue(well);
    setEditingKey(well.id);
  };
  const cancel = () => setEditingKey(null);
  const save = async (id: number) => {
    const row = await form.validateFields();
    if (row.well_number === '') row.well_number = null;
    await updateWell.mutateAsync({ id, data: row });
    setEditingKey(null);
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportFile(null);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!XLSX_RE.test(file.name)) {
      message.error('Перетащите файл Excel (.xlsx)');
      return;
    }
    setImportFile(file);
    setImportOpen(true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await wellsApi.exportXlsx();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wells.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error(toApiError(e).message);
    } finally {
      setExporting(false);
    }
  };

  const baseColumns: (ColumnsType<Well>[number] & {
    editable?: boolean;
    inputType?: CellInput;
  })[] = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '№ скв.', dataIndex: 'well_number', key: 'well_number', editable: true, inputType: 'text',
      render: (v: string | null) => v ?? '—' },
    { title: 'Unitek ID', dataIndex: 'unitek_id', key: 'unitek_id', editable: true, inputType: 'number' },
    { title: 'Armits ID', dataIndex: 'armits_id', key: 'armits_id', editable: true, inputType: 'number' },
    { title: 'НГДУ', dataIndex: 'ngdu', key: 'ngdu', editable: true, inputType: 'number',
      render: (v: number) => ngduLabel(v) },
    { title: 'Цех', dataIndex: 'department', key: 'department', editable: true, inputType: 'number',
      render: (v: number) => deptLabel(v) },
    {
      title: 'Активна',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      render: (active: boolean, well: Well) => (
        <Switch
          checked={active}
          disabled={isEditing(well)}
          onChange={(checked) => updateWell.mutate({ id: well.id, data: { active: checked } })}
        />
      ),
    },
    {
      title: '',
      key: 'op',
      width: 140,
      render: (_: unknown, well: Well) =>
        isEditing(well) ? (
          <Space>
            <Button type="primary" size="small" icon={<CheckOutlined />} loading={updateWell.isPending}
              onClick={() => save(well.id)} />
            <Button size="small" icon={<CloseOutlined />} onClick={cancel} />
          </Space>
        ) : (
          <Space>
            <Button size="small" icon={<FileSearchOutlined />} onClick={() => navigate(`/wells/${well.id}`)} />
            <Button size="small" icon={<EditOutlined />} disabled={editingKey !== null} onClick={() => edit(well)} />
            <Popconfirm title="Удалить скважину?" okText="Да" cancelText="Нет"
              onConfirm={() => deleteWell.mutate(well.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
    },
  ];

  const columns: ColumnsType<Well> = baseColumns.map((col) => {
    if (!col.editable) return col;
    const dataIndex = (col as { dataIndex: string }).dataIndex;
    const inputType: CellInput = col.inputType ?? 'text';
    return {
      ...col,
      onCell: (record: Well) =>
        ({ editing: isEditing(record), dataIndex, inputType }) as unknown as HTMLAttributes<HTMLElement>,
    };
  });

  return (
    <div
      style={{ position: 'relative' }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <Card
        extra={
          <Space>
            <Switch
              checkedChildren="все"
              unCheckedChildren="активные"
              checked={showInactive}
              onChange={setShowInactive}
            />
            <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Добавить
            </Button>
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Импорт из Excel
            </Button>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
              Экспорт в Excel
            </Button>
          </Space>
        }
      >
        <PageSpin loading={isLoading} error={error}>
          <Form form={form} component={false}>
            <Table
              rowKey="id"
              components={{ body: { cell: EditableCell } }}
              columns={columns}
              dataSource={data ?? []}
              size="middle"
              pagination={{ pageSize: 20 }}
            />
          </Form>
        </PageSpin>
      </Card>

      {dragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(22,119,255,0.06)',
            border: '2px dashed #1677ff',
            borderRadius: 8,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <InboxOutlined style={{ fontSize: 40, color: '#1677ff' }} />
          <span style={{ color: '#1677ff', fontWeight: 600 }}>Отпустите файл .xlsx для импорта</span>
        </div>
      )}

      <WellImportModal open={importOpen} onClose={closeImport} initialFile={importFile} />
      <AddWellModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
