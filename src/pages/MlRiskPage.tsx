import {CopyTableSelectionButton} from '@/components/common/CopyTableSelectionButton';
import {LocalEntityTable} from '@/components/common/LocalEntityTable';
import type {EntityField} from '@/components/common/LocalEntityTable';
import { Alert, App, Button, Card, Collapse, Descriptions, Dropdown, Modal, Select, Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { useWells } from '@/hooks/useWells';
import { mlRows, mlSnapshotNotice, cohortStatusLabel, mlAlertReviewPath } from '@/lib/mlSnapshot';
import { type AlertModelFilter, type AlertProcessingFilter } from '@/lib/monitoringAlerts';
import { formatSnapshotTime } from '@/lib/displayTime';
import { mlApi, type MlDisplayWell } from '@/api/ml';
import { PageSpin } from '@/components/common/PageSpin';
import { ExplainBars } from '@/components/ml/ExplainBars';
import { ReviewPanel } from '@/components/telemetry/ReviewPanel';
import { useMlRun } from '@/hooks/useMlRun';
import {DownloadOutlined, MenuOutlined} from '@ant-design/icons';
import {availableAlertRuns, createAlertWorkbook, normalizeResponsible, selectAlertRun} from '@/lib/alertExport';
import type {TableQuery} from '@/lib/tableQuery';
import {useTableState} from '@/hooks/useTableState';
import {guardTablePage} from '@/lib/tableTransport';
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
  const {can, canFull, privateBlocked, privateEpoch, capturePrivate} = useAuth();
  const {message} = App.useApp();
  const [search] = useSearchParams();
  const rawRun = search.get('run_id');
  const selectedRun = rawRun !== null && /^[1-9]\d*$/.test(rawRun) && Number.isSafeInteger(Number(rawRun)) ? Number(rawRun) : undefined;
  const invalidRun = rawRun !== null && selectedRun === undefined;
  const canRead = !privateBlocked && can('risks.read') && (!rawRun || can('cohort.runs.read'));
  const canReadRuns = !privateBlocked && can('risks.read', 'cohort.runs.read');
  const contextKey = `${privateEpoch}:${rawRun ?? 'latest'}:${canRead}`;
  const [detail, setDetail] = useState<{row:MlDisplayWell; context:string} | null>(null);
  const explainWell = detail?.context === contextKey && canRead ? detail.row : null;
  const setExplainWell = (row: MlDisplayWell | null) => setDetail(row ? {row, context:contextKey} : null);
  useEffect(() => {setDetail(null);}, [contextKey]);
  const [exporting, setExporting] = useState(false);
  const exportVersion = useRef('');
  const model = (MODELS.some(item => item.value === search.get('model')) ? search.get('model') : 'attention') as AlertModelFilter;
  const processing = (['new','acknowledged','confirmed','false_positive','inconclusive','unlinked'].includes(search.get('processing') ?? '') ? search.get('processing') : 'all') as AlertProcessingFilter;
  const runsQ = useQuery({enabled:canReadRuns, queryKey:['ml-alert-run-options',1000,privateEpoch],
    queryFn:({signal}) => guardTablePage(capturePrivate(), () => mlApi.runs(1000,signal), signal)});
  const wellsQ = useQuery({enabled:canRead && !invalidRun, queryKey:selectedRun ? ['ml-snapshot',selectedRun,privateEpoch] : ['ml-wells',privateEpoch],
    queryFn:({signal}) => guardTablePage(capturePrivate(), () => selectedRun ? mlApi.snapshot(selectedRun,signal) : mlApi.wells(false,signal), signal)});
  const data = canRead && !invalidRun && !wellsQ.isError ? wellsQ.data : undefined;
  const cohort = data?.profile === 'cohort';
  const runOptions = availableAlertRuns(canReadRuns ? runsQ.data?.runs ?? [] : []);
  const dataError = invalidRun ? new Error('Некорректный номер расчёта') : !canRead ? new Error('Нет доступа к выбранному расчёту') : wellsQ.error;
  const exportRows = async (rows: MlDisplayWell[], query: TableQuery) => {
    if (!canRead || !can('risks.export') || !data || wellsQ.isFetching || dataError || !rows.length || exporting) return;
    const ticket = capturePrivate(), version = exportVersion.current;
    setExporting(true);
    try {
      const runId = data.profile === 'cohort' ? data.run_id : selectedRun;
      const book = await createAlertWorkbook(rows,{runId,query,exportedAt:new Date().toISOString(),asOf:data.profile === 'cohort' ? data.as_of : null,metadata});
      const XLSX = await import('xlsx');
      if (!ticket.current() || version !== exportVersion.current) return;
      XLSX.writeFile(book,`Тревоги_расчёт_${runId ?? 'последний'}.xlsx`);
    } catch {if (ticket.current()) message.error('Не удалось создать Excel. Повторите выгрузку.');}
    finally {if (ticket.current()) setExporting(false);}
  };
  const metricsQ = useQuery({ queryKey: ['ml-metrics'], queryFn: mlApi.metrics, enabled: can('metrics.read') && !!data && !cohort && !privateBlocked });
  const { running, lastRun, start } = useMlRun(data ? (data.profile === 'cohort' ? 'cohort' : 'research') : undefined);
  const registry = useWells(false, false, 'all');
  const wells = mlRows(data);
  const registryById = useMemo(() => new Map((registry.data ?? []).map(well => [String(well.id), well])), [registry.data]);

  const notice = mlSnapshotNotice(data, lastRun);
  const readableNotice = data?.profile === 'cohort' && data.as_of ? notice?.replace(data.as_of, formatSnapshotTime(data.as_of)) : notice;
  const reviewPath = explainWell ? mlAlertReviewPath(explainWell) : null;
  const stage1 = cohort ? undefined : metricsQ.data?.models.find(item => item.name.startsWith('stage1'));
  const report = stage1?.metrics.report, perWell = stage1?.calibration?.per_well;
  const recall = perWell?.recall ?? report?.class_recall['1'];
  const precision = perWell?.precision ?? report?.class_precision['1'];
  const exportContext = `${contextKey}:${search.toString()}:${wellsQ.dataUpdatedAt}:${wellsQ.isFetching}:${registry.dataUpdatedAt}:${registry.isFetching}:${!!dataError}:${can('risks.export')}`;
  const metadata = (row: MlDisplayWell) => row.metadata ?? (!cohort && row.app_well_id != null ? registryById.get(String(row.app_well_id)) : undefined);
  const columns: ColumnsType<MlDisplayWell> = [
    { title: 'Скважина', key: 'well', width: 165, render: (_, row) => row.app_well_id != null ? <Link to={`/wells/${row.app_well_id}${row.run_id != null ? `?run_id=${row.run_id}` : ''}`}>№ {metadata(row)?.well_number ?? '—'}<small className="pulse-cell-meta">ID Pulse {row.app_well_id}</small></Link> : 'Не сопоставлена' },
    { title: 'Модель', key: 'model', width: 150, sorter: (a,b) => (a.risk ?? -1) - (b.risk ?? -1), render: (_,row) => <><span className={row.risk === null ? 'pulse-muted' : row.tier === 'alert' ? 'pulse-danger' : row.tier === 'watch' ? 'pulse-warning' : 'pulse-success'}>{cohortStatusLabel(row)}</span>{row.risk !== null && <small className="pulse-cell-meta">Риск {(row.risk * 100).toFixed(1)}%</small>}</> },
    { title: 'Обработка', key: 'processing', width: 145, render: (_,row) => row.alert_id != null && row.alert_status ? <Tag color={PROCESSING[row.alert_status]?.color ?? 'default'}>{PROCESSING[row.alert_status]?.label ?? 'Статус не передан'}</Tag> : <span className="pulse-muted">Нет записи обработки</span> },
    { title: 'Основание / окно', key: 'reason', render: (_,row) => <>{row.rule_findings.length ? row.rule_findings.join(' · ') : row.risk === null ? row.reason_code ?? 'Нет оценки' : `${row.windows_fired ?? '—'} из ${row.windows_total ?? '—'} окон сработало`}<small className="pulse-cell-meta">{row.window_end ? formatSnapshotTime(row.window_end) : 'Дата окна не передана'}{row.data_ok === false ? ' · есть пропуски' : row.data_ok === null ? ' · полнота неизвестна' : ''}</small></> },
    { title: 'Ответственный за скважину', key: 'owner', width: 170, render: (_,row) => normalizeResponsible(metadata(row)?.responsible) ?? 'Не назначен' },
    { title: 'Действия', key: 'action', width: 100, render: (_,row) => <Dropdown trigger={['click']} menu={{items:[{key:'review',label:row.alert_status === 'new' ? 'Проверить' : row.alert_status === 'acknowledged' ? 'Продолжить' : 'Открыть',onClick:()=>setExplainWell(row)}]}}><Button aria-label={`Действия скважины ${row.app_well_id ?? 'не сопоставлена'}`} icon={<MenuOutlined />} /></Dropdown> },
  ];
  const fields:EntityField<MlDisplayWell>[]=[
 {key:'id',label:'ID Pulse',column:'Скважина',kind:'pulseId',read:r=>r.app_well_id},
 {key:'number',label:'№ скважины',column:'Скважина',primary:true,kind:'text',read:r=>metadata(r)?.well_number},
 {key:'assessment',label:'Модель',kind:'enum',options:[{value:0,label:'Норма'},{value:1,label:'Наблюдение'},{value:2,label:'Тревога'},{value:null,label:'Без оценки'}],read:r=>r.risk===null?null:r.tier==='alert'?2:r.tier==='watch'?1:0},
 {key:'processing',label:'Обработка',kind:'enum',options:[...Object.entries(PROCESSING).map(([value,state])=>({value,label:state.label})),{value:null,label:'Без записи обработки'}],read:r=>r.alert_id==null?null:r.alert_status},
 {key:'reason',label:'Основание',column:'Основание / окно',kind:'text',read:r=>r.rule_findings.join(' · ')||r.reason_code||''},
 {key:'window_end',label:'Дата окна',column:'Основание / окно',primary:true,kind:'datetime',read:r=>r.window_end},
 {key:'owner',label:'Ответственный за скважину',kind:'enum',options:[...new Set(wells.map(row=>normalizeResponsible(metadata(row)?.responsible)))].map(value=>({value,label:value ?? 'Не назначен'})),read:r=>normalizeResponsible(metadata(r)?.responsible)},
 {key:'ngdu',label:'НГДУ',kind:'enum',read:r=>metadata(r)?.ngdu},{key:'department',label:'Цех',kind:'enum',read:r=>metadata(r)?.department},
 ];
 const initialQuery={version:1 as const,sort:[],filters:[...(model==='all'?[]:[{field:'assessment',op:'in' as const,values:model==='attention'?[1,2]:[model==='alert'?2:model==='watch'?1:model==='normal'?0:null]}]),...(processing==='all'?[]:[{field:'processing',op:'in' as const,values:[processing==='unlinked'?null:processing]}])]};
  const tableState=useTableState('alerts',fields,initialQuery);
  exportVersion.current = `${exportContext}:${JSON.stringify({query:tableState.query,page:tableState.page,pageSize:tableState.pageSize,cursors:tableState.cursors,revision:tableState.revision})}`;
  const tableLoading = canRead && !invalidRun && (wellsQ.isLoading || (!!data && !cohort && registry.isLoading));
  const tableError = dataError || (!cohort ? registry.error : undefined);
  const runControl = <label className="pulse-alert-run-field"><span>Расчёт</span><Select aria-label="Расчёт" value={selectedRun ?? 'latest'}
        disabled={!canReadRuns} loading={runsQ.isFetching} showSearch optionFilterProp="label"
        options={[{value:'latest',label:'Последний доступный'},...runOptions.map(run=>({value:run.id,label:`№ ${run.id} · ${formatSnapshotTime(run.finished_at ?? run.started_at)}`})) ,...(selectedRun && !runOptions.some(run=>run.id === selectedRun) ? [{value:selectedRun,label:`№ ${selectedRun}`}]:[])]}
        onChange={value=>{setExplainWell(null);tableState.resetForSearch(selectAlertRun(search,value === 'latest' ? undefined : Number(value)));}} /></label>;
  const renderReportControls = (rows?: MlDisplayWell[], query?: TableQuery) => <div className="pulse-alert-report-controls">
    {runControl}
    {can('risks.export') && !privateBlocked ? <Button icon={<DownloadOutlined />} loading={exporting}
      disabled={!data || !!tableError || wellsQ.isFetching || (!cohort && registry.isFetching) || !rows?.length}
      onClick={()=>{if(rows && query) void exportRows(rows,query);}}>Экспорт в Excel</Button> : null}
    {can('risks.read') ? <CopyTableSelectionButton getLink={tableState.selectionLink} /> : null}
    {rows && !rows.length && data ? <span role="status" className="pulse-muted">Нет строк для экспорта по текущим фильтрам</span> : null}
  </div>;
  return <div className="pulse-stack pulse-monitoring-page pulse-monitoring-alerts">
    <div className="pulse-page-heading pulse-toolbar"><div><h1>Тревоги</h1><p>Оценка модели и статус обработки отображаются раздельно</p></div>{!privateBlocked && canFull('runs.start') && <Button type="primary" loading={running || wellsQ.data?.running || start.isPending} onClick={() => start.mutate()}>Запустить расчёт</Button>}</div>
    {readableNotice && <p className="pulse-monitoring-caption" title={notice ?? undefined}>{readableNotice}</p>}
    {canReadRuns && runsQ.isError ? <Alert type="warning" showIcon message="Не удалось загрузить список расчётов" action={<Button onClick={()=>void runsQ.refetch()}>Повторить</Button>} /> : null}
    {canReadRuns && (runsQ.data?.runs.length ?? 0) >= 1000 ? <p className="pulse-monitoring-caption">Список ограничен последними 1000 расчётами текущей версии фонда.</p> : null}
    {(tableLoading || tableError) ? renderReportControls() : null}
    <Card className="pulse-monitoring-table-card"><PageSpin loading={tableLoading} error={tableError}>
      <LocalEntityTable<MlDisplayWell> variant="alerts" renderControls={({rows,query}) => renderReportControls(rows,query)} onRefresh={()=>{void wellsQ.refetch();if(canReadRuns)void runsQ.refetch();if(!cohort && can('wells.read'))void registry.refetch();}} refreshing={wellsQ.isFetching||registry.isFetching} refreshDisabled={!canRead} tableKey="alerts" fields={fields} initialQuery={initialQuery} defaultSort={[{field:'assessment',direction:'desc'},{field:'window_end',direction:'desc'}]} rowKey={row=>row.app_well_id ?? row.well_id!} columns={[...columns.slice(0,1),{title:'НГДУ',render:(_,r)=>metadata(r)?.ngdu??'—'},{title:'Цех',render:(_,r)=>metadata(r)?.department??'—'},...columns.slice(1)]} dataSource={wells} scroll={{x:1080}} pagination={{pageSize:15,showSizeChanger:false,showTotal:total=>`Количество: ${total}`}} locale={{emptyText: <span className="pulse-muted">{model === 'attention' ? 'Тревог и наблюдений в выбранной выборке нет' : 'Нет доступных оценок по выбранным фильтрам'}</span>}} />
    </PageSpin>{wellsQ.isError && <Button onClick={()=>void wellsQ.refetch()}>Повторить</Button>}</Card>
    {canRead && !!data && can('metrics.read') && !cohort && <Collapse items={[{key:'metrics',label:'Метрики модели · историческая CV',children:<PageSpin loading={metricsQ.isLoading} error={metricsQ.error}><Descriptions column={{xs:1,md:2}} items={[{key:'model',label:'Модель',children:stage1?.name ?? '—'},{key:'recall',label:'Recall',children:recall == null ? '—' : `${(recall*100).toFixed(1)}%`},{key:'precision',label:'Precision',children:precision == null ? '—' : `${(precision*100).toFixed(1)}%`}]} /><p className="pulse-monitoring-caption">Историческая CV не является временной приёмкой и не подтверждает качество на текущем фонде.</p></PageSpin>}]} />}
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
