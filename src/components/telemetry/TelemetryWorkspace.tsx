import {LocalEntityTable} from '@/components/common/LocalEntityTable';
import {useAuth} from '@/auth/AuthProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, DatePicker, Drawer, Dropdown, Empty, Modal, Radio, Segmented, Select, Slider, Space, Switch, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckVerdict } from './ManualChecks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreOutlined, SettingOutlined } from '@ant-design/icons';
import { integrationsApi, type Measurement, type ManualCheck } from '@/api/integrations';
import { toApiError } from '@/api/client';
import { channels, normalizedValue, alignComparison } from '@/lib/telemetry';
import { exportTelemetry } from '@/lib/telemetryFiles';
import { TelemetryChart, seriesColors, type ZoomRange } from './TelemetryChart';
import { ImportTelemetry } from './ImportTelemetry';

const { RangePicker } = DatePicker;
type View = 'channels' | 'combined' | 'compare' | 'table';
export function TelemetryWorkspace({ wellId }: { wellId: string }) {
  const {can,capturePrivate}=useAuth();
  const { message } = App.useApp(); const client = useQueryClient();
  const [search] = useSearchParams();
  const [selected, setSelected] = useState(['Ia', 'Ib', 'Ic']); const [view, setView] = useState<View>('combined');
  const [normalization, setNormalization] = useState<'raw' | 'relative' | 'dual'>('raw');
  const [period, setPeriod] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(15, 'day'), dayjs()]);
  const [compare, setCompare] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(30, 'day'), dayjs().subtract(15, 'day')]);
  const [alignment, setAlignment] = useState('elapsed'); const [commonAxes, setCommonAxes] = useState(true);
  const [zoom, setZoom] = useState<ZoomRange>([0, 1]); const [cursor, setCursor] = useState<number | null>(null);
  const [picker, setPicker] = useState(false); const [importOpen, setImportOpen] = useState(false); const [exportOpen, setExportOpen] = useState(false); const [format, setFormat] = useState<'csv' | 'xlsx' | 'parquet'>('csv'); const [busy, setBusy] = useState(false);
  const [liveMode, setLiveMode] = useState(false), [refreshSeconds, setRefreshSeconds] = useState(60);
  const [settings, setSettings] = useState(false); const [hidden, setHidden] = useState<string[]>([]);
  const [score, setScore] = useState<ManualCheck | null>(null), [scoring, setScoring] = useState(false);
  const request = useRef<{period: string; id: string} | null>(null);
  const checking = useRef(false);
  async function runCheck() {
    if (!can('checks.run') || checking.current) return;
    const ticket=capturePrivate();
    checking.current = true; setScoring(true);
    const start = period[0].toISOString(), end = period[1].toISOString();
    const key = `pulse-check-request:${wellId}:${start}:${end}`;
    try {
      if (request.current?.period !== key) {
        let id: string | null = null;
        try { id = sessionStorage.getItem(key); } catch { /* локальное хранилище недоступно */ }
        request.current = {period:key, id:id ?? crypto.randomUUID()};
        try { sessionStorage.setItem(key, request.current.id); } catch { /* повтор в текущей вкладке сохраняется в ref */ }
      }
      const saved = await integrationsApi.createCheck(wellId, start, end, request.current.id);
      if(!ticket.current())return;
      setScore(saved);
      await Promise.all([client.invalidateQueries({queryKey:['manual-checks', wellId]}),client.invalidateQueries({queryKey:['table',`manual-checks-${wellId}`]})]);
      try { sessionStorage.removeItem(key); } catch { /* запись уже сохранена на сервере */ }
      request.current = null;
      message.success('Проверка сохранена в истории скважины');
    } catch (e) { if(ticket.current())message.error(toApiError(e).message); }
    finally { checking.current = false; if(ticket.current())setScoring(false); }
  }
  useEffect(() => { setScore(null); }, [wellId, period]);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(`pulse-telemetry-view-${wellId}`) ?? 'null'); if (s && Array.isArray(s.selected)) setSelected(s.selected.filter((k: unknown) => typeof k === 'string' && channels.some(c => c.key === k))); } catch { /* используем стандартный вид */ } }, [wellId]);
  useEffect(() => { setHidden([]); setZoom([0, 1]); }, [selected, period, compare, alignment]);
  useEffect(() => { setZoom([0, 1]); setCursor(null); }, [view]);
  useEffect(() => { if (!liveMode) return; const update = () => setPeriod(([start, end]) => { const now = dayjs(); return [now.subtract(end.diff(start), 'millisecond'), now]; }); update(); const timer = window.setInterval(update, refreshSeconds * 1000); return () => clearInterval(timer); }, [liveMode, refreshSeconds]);
  const bounds = useQuery({ enabled:can('telemetry.read'), queryKey: ['telemetry-bounds', wellId], queryFn: () => integrationsApi.bounds(wellId), retry: false });
  const [initialized, setInitialized] = useState(false);
  useEffect(() => { if (!initialized && bounds.data?.end) { const end = dayjs(bounds.data.end); setPeriod([end.subtract(15, 'day'), end]); setCompare([end.subtract(30, 'day'), end.subtract(15, 'day')]); setInitialized(true); } }, [bounds.data, initialized]);
  const query = useQuery({ enabled:can('telemetry.read'), queryKey: ['telemetry', wellId, period[0].toISOString(), period[1].toISOString()], queryFn: () => integrationsApi.telemetry(wellId, period[0].toISOString(), period[1].toISOString()), refetchInterval: refreshSeconds * 1000 });
  const other = useQuery({ queryKey: ['telemetry', wellId, compare[0].toISOString(), compare[1].toISOString()], queryFn: () => integrationsApi.telemetry(wellId, compare[0].toISOString(), compare[1].toISOString()), enabled: can('telemetry.read') && view === 'compare' });
  const live = query.data?.points ?? [];
  const otherPoints = other.data?.points ?? [];
  const modelReady = live.length > 1 && Date.parse(live[live.length-1].timestamp)-Date.parse(live[0].timestamp) >= 30*86400000;
  const active = selected.filter(k => !hidden.includes(k)); const units = [...new Set(active.map(k => channels.find(c => c.key === k)?.unit))];
  const normalized = normalization === 'relative' || (units.length > 1 && normalization !== 'dual') || units.length > 2;
  const commonBounds = useMemo(() => {
    const ranges: Record<string, [number, number]> = {};
    for (const ps of [live, otherPoints]) {
      const bases = Object.fromEntries(active.map(k => [k, ps.find(p => p.values[k] != null)?.values[k] ?? null]));
      for (const p of ps) for (const k of active) { const v = normalized ? normalizedValue(p.values[k] ?? null, bases[k]) : p.values[k]; if (v == null) continue; const unit = normalized ? '%' : channels.find(c => c.key === k)?.unit ?? k; ranges[unit] = ranges[unit] ? [Math.min(ranges[unit][0], v), Math.max(ranges[unit][1], v)] : [v, v]; }
    }
    return ranges;
  }, [live, otherPoints, active.join(','), normalized]);
  function subset(ps: Measurement[]) { if (!ps.length) return []; const lo = Date.parse(ps[0].timestamp), span = Date.parse(ps[ps.length - 1].timestamp) - lo; return ps.filter(p => { const f = span ? (Date.parse(p.timestamp) - lo) / span : 0; return f >= zoom[0] && f <= zoom[1]; }); }
  const visibleRows = subset(live);
  const [displayA, displayB] = alignComparison(live, otherPoints, alignment, [[period[0].toISOString(), live.at(-1)?.timestamp ?? period[1].toISOString()], [compare[0].toISOString(), compare[1].toISOString()]]);
  const chart = (ps: Measurement[], keys = active, shared = false) => <TelemetryChart points={ps} selected={keys} normalized={view !== 'channels' && normalized} dual={normalization === 'dual' && units.length === 2} elapsed={view === 'compare' && alignment === 'elapsed'} zoom={zoom} onZoom={setZoom} cursor={cursor} onCursor={setCursor} sharedBounds={shared && commonAxes ? commonBounds : undefined} />;
  const periodControl = (value: typeof period, onChange: (v: typeof period) => void) => <RangePicker showTime format="DD.MM.YYYY HH:mm" value={value} allowClear={false} onChange={v => { if (v?.[0] && v[1]) { setLiveMode(false); onChange([v[0], v[1]]); } }} />;
  const exportA = subset(view === 'compare' ? displayA : live).filter(p => Object.keys(p.values).length), exportB = view === 'compare' ? subset(displayB).filter(p => Object.keys(p.values).length) : [];
  const exportNow = async () => { setBusy(true); try { await exportTelemetry([...exportA, ...exportB], active, format, view === 'compare' ? [...exportA.map(() => 'A'), ...exportB.map(() => 'B')] : undefined); setExportOpen(false); } catch (e) { message.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  return <div className="pulse-stack">
    <div className="pulse-toolbar">
      <Segmented aria-label="Вид телеметрии" value={view === 'channels' ? 'combined' : view} onChange={v => setView(v as View)} options={[{ value: 'combined', label: 'График' }, { value: 'compare', label: 'Сравнение' }, { value: 'table', label: 'Таблица' }]} />
      <Space><Switch checked={liveMode} onChange={setLiveMode} checkedChildren="Онлайн" unCheckedChildren="Архив" aria-label="Автообновление периода" /><Button icon={<SettingOutlined />} onClick={() => setSettings(true)}>Настройки</Button><Dropdown menu={{ items: [{key:'import',label:'Импорт файла',disabled:!can('telemetry.import')}, {key:'export',label:'Экспорт выбранного интервала',disabled:!active.length || !live.length}, {key:'model',label:scoring ? 'Проверка моделью…' : 'Проверить моделью (от 30 суток)',disabled:!can('checks.run') || !modelReady || query.data?.truncated || scoring}, {key:'save',label:'Сохранить набор каналов'}, {key:'reset',label:'Сбросить масштаб'}], onClick: ({key}) => { if(key==='model' && can('checks.run')) { void runCheck(); } if(key==='import' && can('telemetry.import')) setImportOpen(true); if(key==='export') setExportOpen(true); if(key==='reset') setZoom([0,1]); if(key==='save') { try { localStorage.setItem(`pulse-telemetry-view-${wellId}`,JSON.stringify({selected})); message.success('Набор каналов сохранён'); } catch { message.error('Не удалось сохранить набор'); } } } }} trigger={['click']}><Button aria-label="Действия с телеметрией" icon={<MoreOutlined />} /></Dropdown></Space>
    </div>
    {query.isError && <Alert type="error" message={toApiError(query.error).message} action={<Button onClick={() => query.refetch()}>Повторить</Button>} />}
    {view === 'compare' && other.isError && <Alert type="error" message={`Период B: ${toApiError(other.error).message}`} />}
    {score && <Space wrap><CheckVerdict result={score.result} /><Typography.Text>Период {dayjs(score.start).format('DD.MM.YYYY')} — {dayjs(score.end).format('DD.MM.YYYY')}</Typography.Text><Link to={`?${new URLSearchParams({...Object.fromEntries(search), tab: 'checks', check: score.id})}`}>Открыть сохранённую проверку</Link></Space>}
    {(query.data?.truncated || other.data?.truncated) && <Alert type="warning" message="Достигнут лимит выборки. Сократите период; экспорт содержит только загруженные данные." />}
    <div className="pulse-toolbar"><Space wrap>{periodControl(period, setPeriod)}<Button onClick={() => setPicker(true)}>Параметры · {selected.length}</Button></Space><Typography.Text type="secondary">МСК{query.data?.resolution ? ` · ${query.data.resolution}` : ''}{query.isFetching ? ' · обновление…' : ''}</Typography.Text></div>
    {view !== 'channels' && normalized && <Typography.Text type="secondary">Изменение от первого валидного значения, %. Исходные значения — в подсказках и таблице.</Typography.Text>}
    <Space wrap>{selected.map((k, i) => <Button type="text" key={k} aria-pressed={!hidden.includes(k)} onClick={() => setHidden(v => v.includes(k) ? v.filter(x => x !== k) : [...v, k])} style={{ color: seriesColors[i % seriesColors.length], opacity: hidden.includes(k) ? .45 : 1 }}>━ {channels.find(c => c.key === k)?.label ?? k}</Button>)}</Space>
    {!selected.length ? <Empty description="Выберите параметры для просмотра" /> : view === 'table' ? <Card title={`Измерения · ${visibleRows.length.toLocaleString('ru')} записей`}>
      <LocalEntityTable<Measurement> tableKey={`telemetry-${wellId}`} fields={[
 {key:'timestamp',label:'Время, МСК',kind:'datetime',read:r=>r.timestamp},
 ...active.map(k=>({key:k,label:`${channels.find(c=>c.key===k)?.label??k}, ${channels.find(c=>c.key===k)?.unit??''}`,kind:'number' as const,unit:channels.find(c=>c.key===k)?.unit,read:(r:Measurement)=>r.values[k]})),
 {key:'quality',label:'Качество',kind:'enum',read:r=>active.some(k=>r.values[k]==null)?'missing':r.quality??'unknown',options:[{value:'missing',label:'Пропуски'},{value:'unknown',label:'Качество не передано'},...Array.from(new Set(live.map(r=>r.quality).filter((v):v is string=>!!v))).map(value=>({value,label:value}))]}]} defaultSort={[{field:'timestamp',direction:'asc'}]} rowKey={p => `${p.well_id}:${p.timestamp}`} loading={query.isLoading} scroll={{ x: 900 }} size="small" pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }} dataSource={visibleRows} columns={[{ title: 'Время, МСК', dataIndex: 'timestamp', fixed: 'left', width: 190, sorter: (a, b) => a.timestamp.localeCompare(b.timestamp), render: s => new Date(s).toLocaleString('ru', { timeZone: 'Europe/Moscow' }) }, ...active.map(k => ({ title: `${channels.find(c => c.key === k)?.label ?? k}, ${channels.find(c => c.key === k)?.unit ?? ''}`, render: (_: unknown, p: Measurement) => p.values[k]?.toLocaleString('ru', { maximumFractionDigits: 3 }) ?? '—' })), { title: 'Качество', render: (_, p) => active.some(k => p.values[k] == null) ? <Tag color="gold">Пропуски</Tag> : p.quality ?? 'Качество не передано' }]} />
    </Card> : view === 'compare' ? <>
      <Space wrap><Radio.Group value={alignment} onChange={e => setAlignment(e.target.value)} options={[{ label: 'От начала периода', value: 'elapsed' }, { label: 'По календарю', value: 'calendar' }]} optionType="button" /><Checkbox checked={commonAxes} onChange={e => setCommonAxes(e.target.checked)}>Общие шкалы</Checkbox></Space>
      <div className="pulse-two-columns"><Card title="Период A · исходный">{periodControl(period, setPeriod)}{chart(displayA, active, true)}</Card><Card title="Период B · сравнение">{periodControl(compare, setCompare)}{chart(displayB, active, true)}</Card></div>

    </> : view === 'combined' ? <Card title="Совмещённые каналы">{chart(live)}</Card> : active.map(k => <Card title={`${channels.find(c => c.key === k)?.label ?? k} · ${channels.find(c => c.key === k)?.unit ?? ''}`} key={k}>{chart(live, [k])}</Card>)}
    <Slider range min={0} max={1000} value={[zoom[0] * 1000, zoom[1] * 1000]} onChange={v => { if (Array.isArray(v) && v[1] - v[0] >= 2) setZoom([v[0] / 1000, v[1] / 1000]); }} aria-label="Временной интервал графика" />
    <Typography.Text type="secondary">Выделите участок мышью · колесо — масштаб · двойной щелчок или Escape — сброс · пропуски не интерполируются</Typography.Text>
    <Drawer title="Настройки графика" open={settings} onClose={() => setSettings(false)} width={420}><div className="pulse-stack"><Typography.Text>Размещение каналов</Typography.Text><Radio.Group value={view === 'channels' ? 'channels' : 'combined'} onChange={e => setView(e.target.value)} options={[{value:'combined',label:'Один график'},{value:'channels',label:'По отдельности'}]} /><Typography.Text>Шкала значений</Typography.Text><Select value={normalization} onChange={setNormalization} options={[{value:'raw',label:'Исходные единицы'},{value:'relative',label:'Изменение от начала, %'},{value:'dual',label:'Две оси Y',disabled:units.length!==2}]} /><Typography.Text>Обновление данных</Typography.Text><Select value={refreshSeconds} onChange={setRefreshSeconds} options={[{value:5,label:'Каждые 5 секунд'},{value:60,label:'Раз в минуту'},{value:900,label:'Раз в 15 минут'}]} /><Typography.Text type="secondary">Интервал опроса интерфейса. Частота сбора настраивается у источника в разделе «Интеграции».</Typography.Text></div></Drawer>
    <Drawer title="Параметры телеметрии" open={picker} onClose={() => setPicker(false)} width={480} extra={<Button onClick={() => setPicker(false)} type="primary">Применить</Button>}><Checkbox.Group value={selected} onChange={v => setSelected(v as string[])}><div className="pulse-stack">{[...new Set(channels.map(c => c.group))].map(group => <div key={group}><Typography.Title level={5}>{group}</Typography.Title><div className="pulse-stack">{channels.filter(c => c.group === group).map(c => <Checkbox value={c.key} key={c.key}>{c.label} · {c.unit}</Checkbox>)}</div></div>)}</div></Checkbox.Group></Drawer>
    <Modal title="Импорт телеметрии" open={importOpen} onCancel={() => setImportOpen(false)} footer={null} width={1100} destroyOnClose><ImportTelemetry onImport={async ps => { if (ps.some(p => p.well_id !== wellId)) throw new Error(`В файле есть другие скважины. Для этой карточки нужен ID Pulse ${wellId}`); await integrationsApi.ingest(ps); await client.invalidateQueries({ queryKey: ['telemetry', wellId] }); setImportOpen(false); }} /></Modal>
    <Modal title="Экспорт выбранной телеметрии" open={exportOpen} onCancel={() => setExportOpen(false)} onOk={exportNow} confirmLoading={busy} okText="Скачать файл"><div className="pulse-stack"><Alert type="info" message={`${active.length} каналов · ${exportA.length} строк периода A${view === 'compare' ? ` и ${exportB.length} строк периода B` : ''}`} description="Исходные значения, UTC в ISO 8601, качество и метка периода. Выгружается выделенный интервал." /><Select value={format} onChange={setFormat} options={[{ value: 'csv', label: 'CSV' }, { value: 'xlsx', label: 'Excel (.xlsx)' }, { value: 'parquet', label: 'Parquet' }]} /></div></Modal>
  </div>;
}
