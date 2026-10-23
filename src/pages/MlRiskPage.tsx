import { Alert, Button, Card, Collapse, Descriptions, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { useWells } from '@/hooks/useWells';
import { useFundFilters } from '@/theme/FundFilters';
import { mlRows, mlScopedRows, mlSnapshotNotice, cohortStatusLabel, mlAlertReviewPath } from '@/lib/mlSnapshot';
import { filterMonitoringAlerts, type AlertModelFilter, type AlertProcessingFilter } from '@/lib/monitoringAlerts';
import { formatSnapshotTime } from '@/lib/displayTime';
import { mlApi, type MlDisplayWell } from '@/api/ml';
import { PageSpin } from '@/components/common/PageSpin';
import { ExplainBars } from '@/components/ml/ExplainBars';
import { FundFilterBar } from '@/components/layout/FundFilterBar';
import { ReviewPanel } from '@/components/telemetry/ReviewPanel';
import { useMlRun } from '@/hooks/useMlRun';
import { FAILURE_TYPE_RU } from '@/lib/labels';

const PROCESSING = {
  new: { label: 'Новая', color: 'blue' }, acknowledged: { label: 'В работе', color: 'gold' },
  confirmed: { label: 'Подтверждена', color: 'green' }, false_positive: { label: 'Ложная', color: 'default' },
  inconclusive: { label: 'Нужны данные', color: 'gold' },
} as const;
const MODELS = [
  {value:'attention',label:'Тревоги и наблюдения'}, {value:'all',label:'Все оценки'}, {value:'alert',label:'Тревога'},
  {value:'watch',label:'Наблюдение'}, {value:'normal',label:'Норма'}, {value:'unscored',label:'Без оценки'},
];

export function MlRiskPage() {
  const { can,canFull } = useAuth();
  const { filters } = useFundFilters();
  const [search, setSearch] = useSearchParams();
  const selectedRun = Number(search.get('run_id')) || undefined;
  const model = (MODELS.some(item => item.value === search.get('model')) ? search.get('model') : 'attention') as AlertModelFilter;
  const processing = (['new','acknowledged','confirmed','false_positive','inconclusive','unlinked'].includes(search.get('processing') ?? '') ? search.get('processing') : 'all') as AlertProcessingFilter;
  const [explainWell, setExplainWell] = useState<MlDisplayWell | null>(null);
  function selectFilter(key: string, value: string) { const next = new URLSearchParams(search); if (value === (key === 'model' ? 'attention' : 'all')) next.delete(key); else next.set(key, value); setSearch(next, {replace:true}); }
  const wellsQ = useQuery({ enabled:can(selectedRun?'cohort.runs.read':'risks.read'), queryKey: selectedRun ? ['ml-snapshot',selectedRun] : ['ml-wells'], queryFn: () => selectedRun ? mlApi.snapshot(selectedRun) : mlApi.wells(false) });
  const cohort = wellsQ.data?.profile === 'cohort';
  const metricsQ = useQuery({ queryKey: ['ml-metrics'], queryFn: mlApi.metrics, enabled: can('metrics.read') && !!wellsQ.data && !cohort });
  const { running, lastRun, start } = useMlRun(wellsQ.data ? (wellsQ.data.profile === 'cohort' ? 'cohort' : 'research') : undefined);
  const registry = useWells(false, true, 'all');
  const wells = mlScopedRows(mlRows(wellsQ.data), registry.data ?? [], filters, cohort);
  const registryById = useMemo(() => new Map((registry.data ?? []).map(well => [well.id, well])), [registry.data]);
  const shown = filterMonitoringAlerts(wells, model, processing);
  const notice = mlSnapshotNotice(wellsQ.data, lastRun);
  const readableNotice = wellsQ.data?.profile === 'cohort' && wellsQ.data.as_of ? notice?.replace(wellsQ.data.as_of, formatSnapshotTime(wellsQ.data.as_of)) : notice;
  const reviewPath = explainWell ? mlAlertReviewPath(explainWell) : null;
  const stage1 = cohort ? undefined : metricsQ.data?.models.find(item => item.name.startsWith('stage1'));
  const report = stage1?.metrics.report, perWell = stage1?.calibration?.per_well;
  const recall = perWell?.recall ?? report?.class_recall['1'];
  const precision = perWell?.precision ?? report?.class_precision['1'];
  const metadata = (row: MlDisplayWell) => row.metadata ?? (row.app_well_id != null ? registryById.get(row.app_well_id) : undefined);
  const columns: ColumnsType<MlDisplayWell> = [
    { title: 'Скважина', key: 'well', width: 165, render: (_, row) => row.app_well_id != null ? <Link to={`/wells/${row.app_well_id}${row.run_id != null ? `?run_id=${row.run_id}` : ''}`}>№ {metadata(row)?.well_number ?? '—'}<small className="pulse-cell-meta">ID Pulse {row.app_well_id}</small></Link> : 'Не сопоставлена' },
    { title: 'Модель', key: 'model', width: 150, sorter: (a,b) => (a.risk ?? -1) - (b.risk ?? -1), render: (_,row) => <><span className={row.risk === null ? 'pulse-muted' : row.tier === 'alert' ? 'pulse-danger' : row.tier === 'watch' ? 'pulse-warning' : 'pulse-success'}>{cohortStatusLabel(row)}</span>{row.risk !== null && <small className="pulse-cell-meta">Риск {(row.risk * 100).toFixed(1)}%</small>}</> },
    { title: 'Обработка', key: 'processing', width: 145, render: (_,row) => row.alert_id != null && row.alert_status ? <Tag color={PROCESSING[row.alert_status]?.color ?? 'default'}>{PROCESSING[row.alert_status]?.label ?? 'Статус не передан'}</Tag> : <span className="pulse-muted">Нет записи обработки</span> },
    { title: 'Основание / окно', key: 'reason', render: (_,row) => <>{row.rule_findings.length ? row.rule_findings.join(' · ') : row.risk === null ? row.reason_code ?? 'Нет оценки' : `${row.windows_fired ?? '—'} из ${row.windows_total ?? '—'} окон сработало`}<small className="pulse-cell-meta">{row.window_end ? formatSnapshotTime(row.window_end) : 'Дата окна не передана'}{row.data_ok === false ? ' · есть пропуски' : row.data_ok === null ? ' · полнота неизвестна' : ''}</small></> },
    { title: 'Ответственный за скважину', key: 'owner', width: 170, render: (_,row) => metadata(row)?.responsible || 'Не назначен' },
    { title: 'Действие', key: 'action', width: 115, render: (_,row) => <Button type="link" onClick={() => setExplainWell(row)}>{row.alert_status === 'new' ? 'Проверить' : row.alert_status === 'acknowledged' ? 'Продолжить' : 'Открыть'}</Button> },
  ];
  return <div className="pulse-stack pulse-monitoring-page pulse-monitoring-alerts">
    <div className="pulse-page-heading pulse-toolbar"><div><h1>Тревоги</h1><p>Оценка модели и статус обработки отображаются раздельно</p></div>{canFull('runs.start') && <Button type="primary" loading={running || wellsQ.data?.running || start.isPending} onClick={() => start.mutate()}>Запустить расчёт</Button>}</div>
    <FundFilterBar hasExtraFilters={model !== 'attention' || processing !== 'all'} onReset={() => { const next = new URLSearchParams(search); next.delete('model'); next.delete('processing'); setSearch(next, {replace:true}); }} />
    <div className="pulse-monitoring-filters">
      <label><span>Оценка модели</span><Select aria-label="Фильтр оценки модели" value={model} options={MODELS} onChange={value => selectFilter('model',value)} /></label>
      <label><span>Обработка</span><Select aria-label="Фильтр обработки тревоги" value={processing} options={[{value:'all',label:'Все состояния'},...Object.entries(PROCESSING).map(([value,state])=>({value,label:state.label})),{value:'unlinked',label:'Без записи обработки'}]} onChange={value=>selectFilter('processing',value)} /></label>
      <Typography.Text type="secondary">Тревог: {wells.filter(row=>row.tier==='alert'&&row.risk!==null).length} · Под наблюдением: {wells.filter(row=>row.tier==='watch'&&row.risk!==null).length} · Без оценки: {wells.filter(row=>row.risk===null).length}</Typography.Text>
    </div>
    {readableNotice && <p className="pulse-monitoring-caption" title={notice ?? undefined}>{readableNotice}</p>}
    <Card className="pulse-monitoring-table-card"><PageSpin loading={wellsQ.isLoading || (!cohort && registry.isLoading)} error={wellsQ.error || (!cohort ? registry.error : undefined)}>
      <Table<MlDisplayWell> rowKey={row=>row.app_well_id ?? row.well_id!} columns={columns} dataSource={shown} scroll={{x:1080}} pagination={{pageSize:15,showSizeChanger:false,showTotal:total=>`Количество: ${total}`}} locale={{emptyText: <span className="pulse-muted">{model === 'attention' ? 'Тревог и наблюдений в выбранной выборке нет' : 'Нет доступных оценок по выбранным фильтрам'}</span>}} />
    </PageSpin>{wellsQ.isError && <Button onClick={()=>void wellsQ.refetch()}>Повторить</Button>}</Card>
    <Card className="pulse-monitoring-note"><h2>Оценка модели не меняется при обработке тревоги</h2><p>Ответственный за обработку, комментарии и заключение сохраняются в форме проверки. Ответственный в списке указан по паспорту скважины.</p></Card>
    {can('metrics.read') && !cohort && <Collapse items={[{key:'metrics',label:'Метрики модели · историческая CV',children:<PageSpin loading={metricsQ.isLoading} error={metricsQ.error}><Descriptions column={{xs:1,md:2}} items={[{key:'model',label:'Модель',children:stage1?.name ?? '—'},{key:'recall',label:'Recall',children:recall == null ? '—' : `${(recall*100).toFixed(1)}%`},{key:'precision',label:'Precision',children:precision == null ? '—' : `${(precision*100).toFixed(1)}%`}]} /><p className="pulse-monitoring-caption">Историческая CV не является временной приёмкой и не подтверждает качество на текущем фонде.</p></PageSpin>}]} />}
    <Modal open={explainWell !== null} onCancel={()=>setExplainWell(null)} width={720} title={explainWell ? `Скважина · ID Pulse ${explainWell.app_well_id ?? 'не сопоставлена'}` : ''} footer={explainWell?.app_well_id != null ? <Link to={`/wells/${explainWell.app_well_id}${explainWell.run_id != null ? `?run_id=${explainWell.run_id}` : ''}`}><Button type="primary">Открыть карточку скважины</Button></Link> : null}>
      {explainWell && <div className="pulse-stack pulse-monitoring-review">
        {reviewPath !== null && <ReviewPanel key={reviewPath} path={reviewPath} />}
        <div><Typography.Text strong>{cohortStatusLabel(explainWell)}{explainWell.risk !== null ? ` · риск ${(explainWell.risk*100).toFixed(1)}%` : ''}</Typography.Text><p className="pulse-monitoring-caption">Сохранённый ярус и заключение технолога независимы.</p></div>
        {explainWell.rule_findings.length > 0 && <Space wrap>{explainWell.rule_findings.map(finding=><Tag key={finding}>{finding}</Tag>)}</Space>}
        {explainWell.data_ok === false && <Alert type="warning" showIcon message="В последнем окне есть пропуски" description="Ярус опирается на историю наблюдения. Полнота последнего окна не подтверждает текущую связь с установкой." />}
        {explainWell.risk === null ? <Alert type="info" message={cohortStatusLabel(explainWell)} description={explainWell.reason_code} /> : <ExplainBars wellId={explainWell.well_id} contributions={explainWell.contributions} windowKind={explainWell.explanation_window_kind} windowEnd={explainWell.explanation_window_end} />}
        <Typography.Text type="secondary">Зарегистрированный исход по КРС: {explainWell.true_failure_type_name ? FAILURE_TYPE_RU[explainWell.true_failure_type_name] ?? explainWell.true_failure_type_name : 'Не передан'}{explainWell.true_failure_at ? ` · ${formatSnapshotTime(explainWell.true_failure_at)}` : ''}</Typography.Text>
      </div>}
    </Modal>
  </div>;
}
