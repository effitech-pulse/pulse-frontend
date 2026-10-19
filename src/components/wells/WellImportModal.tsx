import { App, Button, Input, Modal, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import { DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wellsApi } from '@/api/wells';
import { toApiError } from '@/api/client';
import {
  CANONICAL_FIELDS,
  autoMap,
  buildPreview,
  fieldInvalid,
  parseWorkbook,
  toPayload,
  validateRow,
  type CanonicalKey,
  type ColumnMapping,
  type ParsedSheet,
  type PreviewRow,
} from '@/lib/wellImport';

const EDITABLE: CanonicalKey[] = ['id', 'ngdu', 'well_number', 'armits_id', 'unitek_id', 'department'];

export function WellImportModal({
  open,
  onClose,
  initialFile = null,
}: {
  open: boolean;
  onClose: () => void;
  initialFile?: File | null;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [committing, setCommitting] = useState(false);

  const reset = () => {
    setParsed(null);
    setMapping({});
    setRows([]);
  };
  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File) => {
    try {
      const parsedSheet = parseWorkbook(await file.arrayBuffer());
      if (!parsedSheet.columns.length) {
        message.error('Файл пуст или не распознан');
        return;
      }
      const m = autoMap(parsedSheet.columns);
      setParsed(parsedSheet);
      setMapping(m);
      setRows(buildPreview(parsedSheet, m));
    } catch {
      message.error('Не удалось прочитать файл Excel');
    }
  };

  // File dropped onto the page: parse it as soon as the modal opens.
  useEffect(() => {
    if (open && initialFile) void onFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

  const remap = (key: CanonicalKey, col?: string) => {
    const m: ColumnMapping = { ...mapping, [key]: col };
    setMapping(m);
    if (parsed) setRows(buildPreview(parsed, m));
  };

  const editCell = (rowKey: string, field: CanonicalKey, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== rowKey) return r;
        const next = { ...r, [field]: value };
        next.errors = validateRow(next);
        return next;
      }),
    );
  };

  const removeRow = (rowKey: string) => setRows((prev) => prev.filter((r) => r.key !== rowKey));

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  const commit = async () => {
    const payload = toPayload(rows);
    if (!payload.length) {
      message.warning('Нет валидных строк для сохранения');
      return;
    }
    setCommitting(true);
    try {
      const res = await wellsApi.createBulk(payload);
      message.success(`Добавлено: ${res.created}, пропущено дублей: ${res.skipped}`);
      if (res.errors.length) message.warning(`Отклонено сервером: ${res.errors.length}`);
      queryClient.invalidateQueries({ queryKey: ['wells'] });
      close();
    } catch (e) {
      message.error(toApiError(e).message);
    } finally {
      setCommitting(false);
    }
  };

  const editColumn = (field: CanonicalKey) => ({
    title: CANONICAL_FIELDS.find(f=>f.key===field)?.label ?? field,
    dataIndex: field,
    render: (_: unknown, r: PreviewRow) => (
      <Input
        size="small"
        value={r[field]}
        status={fieldInvalid(field, r[field]) ? 'error' : undefined}
        onChange={(e) => editCell(r.key, field, e.target.value)}
      />
    ),
  });

  const columns: ColumnsType<PreviewRow> = [
    ...EDITABLE.map(editColumn),
    {
      title: 'Статус',
      key: 'status',
      width: 160,
      render: (_: unknown, r: PreviewRow) =>
        r.errors.length ? (
          <Tag color="red">нет: {r.errors.join(', ')}</Tag>
        ) : (
          <Tag color="green">ок</Tag>
        ),
    },
    {
      title: '',
      key: 'del',
      width: 44,
      render: (_: unknown, r: PreviewRow) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeRow(r.key)} />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={close}
      width={960}
      title="Импорт скважин из Excel"
      okText={`Сохранить (${validCount})`}
      cancelText="Отмена"
      okButtonProps={{ disabled: !validCount, loading: committing }}
      onOk={commit}
      destroyOnClose
    >
      {!parsed ? (
        <Upload.Dragger
          accept=".xlsx,.xlsm"
          showUploadList={false}
          beforeUpload={(file) => {
            void onFile(file as unknown as File);
            return false;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Перетащите .xlsx сюда или нажмите для выбора</p>
          <p className="ant-upload-hint">
            Для новых скважин нужны НГДУ и цех; ID Pulse назначается автоматически. В выгрузке из Pulse существующие ID сохраняются, такие строки пропускаются. Внешние ID необязательны.
          </p>
        </Upload.Dragger>
      ) : (
        <>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            Сопоставьте колонки файла с полями (обязательные — со звёздочкой):
          </Typography.Paragraph>
          <Space wrap style={{ marginBottom: 12 }}>
            {CANONICAL_FIELDS.map((f) => (
              <Space key={f.key} direction="vertical" size={2}>
                <span style={{ fontSize: 12 }}>
                  {f.label}
                  {f.required ? ' *' : ''}
                </span>
                <Select
                  allowClear
                  style={{ width: 175 }}
                  value={mapping[f.key]}
                  placeholder="— нет —"
                  onChange={(v) => remap(f.key, v)}
                  options={parsed.columns.map((c) => ({ value: c, label: c }))}
                />
              </Space>
            ))}
          </Space>
          <div style={{ marginBottom: 8 }}>
            <Typography.Text type={invalidCount ? 'warning' : 'success'}>
              Валидных: {validCount} · с ошибками: {invalidCount}
            </Typography.Text>
            <Button type="link" onClick={reset}>
              Загрузить другой файл
            </Button>
          </div>
          <Table
            rowKey="key"
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={{ pageSize: 8 }}
            scroll={{ y: 320 }}
          />
        </>
      )}
    </Modal>
  );
}
