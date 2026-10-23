import {useAuth} from '@/auth/AuthProvider';
import { useState } from 'react';
import { Alert, App, Button, Card, Input, InputNumber, Select, Space, Table, Typography, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { Mapping, Measurement } from '@/api/integrations';
import { channels, mapRecords } from '@/lib/telemetry';
import { readTelemetryFile } from '@/lib/telemetryFiles';

export function ImportTelemetry({ onImport }: { onImport: (points: Measurement[]) => Promise<void> }) {
  const {can,capturePrivate}=useAuth();
  const { message } = App.useApp(); const [rows, setRows] = useState<Record<string, unknown>[]>([]); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [encoding, setEncoding] = useState('utf-8'); const [separator, setSeparator] = useState(',');
  const [wellField, setWellField] = useState('well_id'); const [timeField, setTimeField] = useState('timestamp'); const [timezone, setTimezone] = useState('+03:00'); const [mappings, setMappings] = useState<Mapping[]>([]);
  const result = rows.length ? mapRecords(rows, mappings, wellField, timeField, timezone) : { points: [], errors: [] };
  const fields = rows.length ? Object.keys(rows[0]) : [];
  async function read(file: File) {
    if(!can('telemetry.import'))return false;
    const ticket=capturePrivate();
    setBusy(true); setError(''); setRows([]);
    try { const data = await readTelemetryFile(file, encoding, separator); if(!ticket.current())return false;setRows(data); setName(file.name);
      setMappings(fieldsFrom(data).filter(f => !['well_id', 'timestamp'].includes(f)).map(field => ({ field, parameter: channels.find(c => c.key === field)?.key ?? '', unit: '', scale: 1, offset: 0, missing: '', is_set: false })).filter(m => m.parameter));
    } catch (e) { if(ticket.current())setError(String(e instanceof Error ? e.message : e)); } finally { if(ticket.current())setBusy(false); }
    return false;
  }
  const update = (index: number, patch: Partial<Mapping>) => setMappings(ms => ms.map((m, i) => i === index ? { ...m, ...patch } : m));
  return <div className="pulse-stack">
    <Space wrap><Select aria-label="Кодировка CSV" value={encoding} onChange={setEncoding} options={[{ value: 'utf-8', label: 'UTF-8' }, { value: 'windows-1251', label: 'Windows-1251' }]} /><Select aria-label="Разделитель CSV" value={separator} onChange={setSeparator} options={[{ value: ',', label: 'Запятая' }, { value: ';', label: 'Точка с запятой' }, { value: '\t', label: 'Табуляция' }]} /></Space>
    <Upload.Dragger accept=".csv,.xlsx,.xls,.parquet" showUploadList={false} disabled={busy||!can('telemetry.import')} beforeUpload={file => read(file)}><p className="ant-upload-drag-icon"><InboxOutlined /></p><Typography.Title level={4}>Перетащите Excel, CSV или Parquet</Typography.Title><Typography.Text type="secondary">До 20 МБ и 100 000 строк · колонка well_id содержит ID Pulse из реестра</Typography.Text></Upload.Dragger>
    {error && <Alert type="error" message={error} showIcon />}
    {rows.length > 0 && <>
      <Card title={`${name} · ${rows.length.toLocaleString('ru')} строк`}><div className="pulse-form-grid">
        <label>ID Pulse скважины<Select value={wellField} onChange={setWellField} options={fields.map(value => ({ value }))} /></label>
        <label>Время измерения<Select value={timeField} onChange={setTimeField} options={fields.map(value => ({ value }))} /></label>
        <label>Часовой пояс, если его нет в файле<Select value={timezone} onChange={setTimezone} options={[{ value: '+03:00', label: 'МСК (UTC+3)' }, { value: 'Z', label: 'UTC' }]} /></label>
      </div></Card>
      <Card title="Словарь колонок" extra={<Button onClick={() => setMappings(ms => [...ms, { field: fields[0], parameter: '', unit: '', scale: 1, offset: 0, missing: '', is_set: false }])}>Добавить поле</Button>}>
        <Table pagination={false} size="small" scroll={{ x: 700 }} rowKey={(_, i) => String(i)} dataSource={mappings} columns={[
          { title: 'Колонка', render: (_, m, i) => <Select style={{ width: 170 }} value={m.field} onChange={field => update(i, { field })} options={fields.map(value => ({ value }))} /> },
          { title: 'Параметр', render: (_, m, i) => <Select style={{ width: 210 }} value={m.parameter || undefined} placeholder="Выберите параметр" onChange={parameter => update(i, { parameter })} options={channels.map(c => ({ value: c.key, label: `${c.label}, ${c.unit}` }))} /> },
          { title: '× коэффициент', render: (_, m, i) => <InputNumber value={m.scale} onChange={v => update(i, { scale: v ?? 1 })} /> },
          { title: '+ смещение', render: (_, m, i) => <InputNumber value={m.offset} onChange={v => update(i, { offset: v ?? 0 })} /> },
          { title: 'Маркеры', render: (_, m, i) => <Input value={m.missing} placeholder="9999" onChange={e => update(i, { missing: e.target.value })} /> },
          { title: '', render: (_, _m, i) => <Button danger onClick={() => setMappings(ms => ms.filter((_, j) => j !== i))}>Удалить</Button> },
        ]} />
      </Card>
      <Alert type={result.errors.length ? 'warning' : 'success'} showIcon message={`Готово ${result.points.length} · отклонено ${result.errors.length}`} description={result.errors.slice(0, 3).join('; ') || 'Пропуски сохранены. Нули не удаляются. Уставки не используются как измерения.'} />
      <Table size="small" rowKey={(_, i) => String(i)} pagination={false} scroll={{ x: 700 }} dataSource={result.points.slice(0, 5)} columns={[{ title: 'ID Pulse', dataIndex: 'well_id' }, { title: 'Время', dataIndex: 'timestamp' }, ...mappings.filter(m => !m.is_set && m.parameter).map(m => ({ title: m.parameter, render: (_: unknown, p: Measurement) => p.values[m.parameter] ?? '—' }))]} />
      <Button type="primary" loading={busy} disabled={!can('telemetry.import') || !result.points.length || !mappings.length || result.errors.length > 0} onClick={async () => { if(!can('telemetry.import'))return; const ticket=capturePrivate();setBusy(true); try { await onImport(result.points);if(!ticket.current())return; message.success('Импорт завершён'); setRows([]); } catch (e) { if(ticket.current())setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }}>Подтвердить импорт</Button>
    </>}
  </div>;
}
function fieldsFrom(rows: Record<string, unknown>[]) { return Object.keys(rows[0]); }
