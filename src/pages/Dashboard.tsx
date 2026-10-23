import { Alert, Button, Card, Collapse, Empty, Modal, Space, Table, Tag, Typography } from 'antd';
import { Column, Pie } from '@ant-design/charts';
import { MoreOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { useFundFilters } from '@/theme/FundFilters';
import { mlApi, type MlDisplayWell } from '@/api/ml';
import { mlRows, mlScopedRows, mlSnapshotNotice } from '@/lib/mlSnapshot';
import { formatSnapshotTime } from '@/lib/displayTime';
import { incidentsApi } from '@/api/incidents';
import { useMlRun } from '@/hooks/useMlRun';
import { useDepartments, useWells } from '@/hooks/useWells';
import { failureTypeRu } from '@/lib/labels';
import { PageSpin } from '@/components/common/PageSpin';
import { ExplainBars } from '@/components/ml/ExplainBars';
import { FundFilterBar } from '@/components/layout/FundFilterBar';

export function Dashboard() {
  const { can,canFull } = useAuth(), { filters } = useFundFilters();
  const wells = useWells(), departments = useDepartments();
  const ml = useQuery({ enabled:can('risks.read'), queryKey: ['ml-wells'], queryFn: () => mlApi.wells(false) });
  const stats = useQuery({ enabled:can('incidents.read'), queryKey: ['incident-stats', filters], queryFn: () => incidentsApi.stats(filters) });
  const { running, lastRun, start } = useMlRun(ml.data ? (ml.data.profile === 'cohort' ? 'cohort' : 'research') : undefined);
  const [explainWell, setExplainWell] = useState<MlDisplayWell>();
  const [confirmRun, setConfirmRun] = useState(false);
  const rows = mlScopedRows(mlRows(ml.data), wells.data ?? [], filters, ml.data?.profile === 'cohort');
  const wellMap = useMemo(() => new Map([...(wells.data ?? []), ...mlRows(ml.data).flatMap(w => w.metadata ? [w.metadata] : [])].map(w => [w.id, w])), [wells.data, ml.data]);
  const scored = rows.filter(w => w.risk !== null);
  const notice = mlSnapshotNotice(ml.data, lastRun);
  const readableNotice = ml.data?.profile === 'cohort' && ml.data.as_of ? notice?.replace(ml.data.as_of, formatSnapshotTime(ml.data.as_of)) : notice;
  const alerts = scored.filter(w => w.tier === 'alert'), watches = scored.filter(w => w.tier === 'watch');
  // Ярус берётся из модели независимо от риска последнего окна и качества данных.
  const attention = [...alerts, ...watches].sort((a,b) => Number(b.tier === 'alert') - Number(a.tier === 'alert') || (b.risk ?? -1) - (a.risk ?? -1));
  const missing = scored.filter(w => w.data_ok === false).length;
  const unscored = ml.data?.profile === 'cohort' ? rows.length - scored.length : Math.max(0, (wells.data?.length ?? 0) - scored.length);
  const knownQuality = scored.filter(w => w.data_ok !== null).length;
  const quality = knownQuality ? ((knownQuality - missing) / knownQuality * 100).toFixed(1) : '—';
  const columns: ColumnsType<MlDisplayWell> = [
    { title: 'Скважина', key: 'well', width: 160, render: (_,w) => <Link to={`/wells/${w.app_well_id}${w.run_id != null ? `?run_id=${w.run_id}` : ''}`}>№ {wellMap.get(w.app_well_id!)?.well_number || w.app_well_id}<small className="pulse-cell-meta">ID Pulse {w.app_well_id}</small></Link> },
    { title: 'Цех', key: 'department', width: 140, ellipsis: true, render: (_,w) => {const code=wellMap.get(w.app_well_id!)?.department;return <span className="sensitive">{departments.data?.find(d=>d.id===code)?.name ?? code ?? '—'}</span>;} },
    { title: 'Состояние', key: 'tier', width: 150, render: (_,w) => <span className={`pulse-status pulse-status-${w.tier}`}>{w.tier==='alert'?'Тревога':'Наблюдение'}</span> },
    { title: 'Основание оценки', key: 'reason', render: (_,w) => <>{w.rule_findings.length ? w.rule_findings.join(' · ') : `${w.windows_fired} из ${w.windows_total} окон выше порога`}<small className="pulse-cell-meta">Последний риск {w.risk === null ? '—' : (w.risk*100).toFixed(1)}%{w.data_ok === false?' · есть пропуски данных':w.data_ok === null?' · качество окна неизвестно':''}</small></> },
    { title: 'Период данных', dataIndex: 'window_end', width: 125, render: value => value ? dayjs(value).format('DD.MM.YYYY') : '—' },
    { title: '', key: 'action', width: 110, render: (_,w) => <Space><Link to={`/wells/${w.app_well_id}${w.run_id != null ? `?run_id=${w.run_id}` : ''}`}>Открыть</Link><Button type="text" size="small" aria-label={`Объяснение оценки ID Pulse ${w.app_well_id}`} onClick={()=>setExplainWell(w)} icon={<MoreOutlined />} /></Space> },
  ];
  return <div className="pulse-stack pulse-overview">
    <div className="pulse-page-heading pulse-toolbar"><div><h1>Обзор фонда</h1><p title={notice ?? undefined}>{readableNotice ?? (lastRun ? `Последний расчёт ${formatSnapshotTime(lastRun.started_at)}` : 'Сохранённые оценки по доступным скважинам')}</p></div>{canFull('runs.start') && <Button type="primary" loading={running || ml.data?.running || start.isPending} onClick={()=>setConfirmRun(true)}>{running?'Расчёт выполняется':'Запустить расчёт'}</Button>}</div>
    <div className="pulse-metrics" aria-label="Показатели фонда">
      <div><span>В мониторинге</span><strong>{ml.data?.profile === 'cohort' ? rows.length : wells.isSuccess?wells.data.length:'—'}</strong><small>{ml.data?.profile === 'cohort' ? 'видимых участников фонда' : 'активных скважин'}</small></div>
      <div><span>Требуют проверки</span><strong className="pulse-danger">{ml.isSuccess?alerts.length:'—'}</strong><small>тревог модели</small></div>
      <div><span>Под наблюдением</span><strong className="pulse-warning">{ml.isSuccess?watches.length:'—'}</strong><small>изменение режима</small></div>
      <div><span>Качество последнего окна</span><strong>{quality}{knownQuality?'%':''}</strong><small>{missing} с пропусками · {unscored} без оценки</small></div>
    </div>
    <section className="pulse-attention"><div className="pulse-section-heading"><h2>Скважины, требующие внимания</h2><Link to="/ml-risk">Все тревоги →</Link></div><Card className="pulse-attention-card">
      <FundFilterBar />
      <PageSpin loading={wells.isLoading || ml.isLoading} error={wells.error || ml.error}>
        <Table<MlDisplayWell> rowKey={w => w.app_well_id ?? w.well_id!} columns={columns} dataSource={attention} scroll={{x:850}} pagination={{pageSize:5,showSizeChanger:false,showTotal:total=>`${total} скважин · сначала тревоги`}} locale={{emptyText:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={scored.length ? 'В выбранном фонде нет тревог и наблюдений' : 'Оценок риска нет · нормальное состояние не подтверждено'} />}} />
      </PageSpin>
    </Card></section>
    <div className="pulse-two-columns">
      <Card title="Качество данных"><p>{knownQuality ? `${missing} скважин с пропусками в последнем окне модели` : scored.length ? 'Качество последнего окна не представлено в результате' : 'Сохранённых оценок пока нет'}</p><Typography.Text type="secondary">{unscored} скважин без оценки. Полнота окна не означает наличие текущей связи.</Typography.Text><div className="pulse-spacing-top"><Link to="/structure">Проверить телеметрию скважин →</Link></div></Card>
      <Card title={lastRun ? `Последний расчёт · ${formatSnapshotTime(lastRun.started_at)}` : 'Последний расчёт'}><p>{ml.data?.profile === 'cohort' ? (ml.data.snapshot_id === null ? 'Расчёт ещё не запускался' : `${ml.data.coverage.scored_count} скважин с оценкой · ${ml.data.coverage.visible_count - ml.data.coverage.scored_count} без оценки`) : lastRun ? lastRun.status==='done'?`${lastRun.wells_scored ?? '—'} скважин обработано · ${lastRun.alerts_count} тревог`:'Расчёт завершился ошибкой':'Расчёт ещё не запускался'}</p><Typography.Text type="secondary">{lastRun?.drift_verdict==='stable'?'По результатам расчёта дрейф не обнаружен':lastRun?.drift_verdict==='moderate'?'Умеренный дрейф данных':lastRun?.drift_verdict==='severe'?'Существенный дрейф данных':'Оценка дрейфа недоступна'}</Typography.Text><div className="pulse-spacing-top"><Link to="/ml-risk">Открыть результаты расчётов →</Link></div></Card>
    </div>
    <Collapse ghost items={[{key:'statistics',label:'Распределение оценок и история отказов',children:<div className="pulse-two-columns"><Card title="Фонд по ярусам"><Column data={[{tier:'Норма',count:scored.filter(w=>w.tier===null).length},{tier:'Наблюдение',count:watches.length},{tier:'Тревога',count:alerts.length}]} xField="tier" yField="count" height={230} /></Card><Card title="Отказы по типам"><PageSpin loading={stats.isLoading} error={stats.error}>{stats.data?.by_type.length?<Pie data={stats.data.by_type.map(t=>({type:failureTypeRu(t.failure_type),count:t.count}))} angleField="count" colorField="type" innerRadius={0.55} height={250} />:<Empty description="Нет зарегистрированных отказов" />}</PageSpin></Card><Card title="Отказы по месяцам"><Column data={stats.data?.by_month??[]} xField="month" yField="count" height={230} /></Card></div>}]} />
    <Modal open={confirmRun} title="Запустить расчёт по фонду?" okText="Запустить расчёт" cancelText="Отмена" confirmLoading={start.isPending} onCancel={()=>setConfirmRun(false)} onOk={()=>{start.mutate(undefined,{onSuccess:()=>setConfirmRun(false)});}}><p>Модель пересчитает оценки по доступным скважинам. Фильтры обзора не ограничивают этот расчёт.</p><p>Сбор телеметрии работает независимо. Оценки обновятся после завершения расчёта.</p></Modal>
    <Modal open={!!explainWell} title={explainWell?`Скважина · ID Pulse ${explainWell.app_well_id}`:''} onCancel={()=>setExplainWell(undefined)} width={650} footer={explainWell&&<Link to={`/wells/${explainWell.app_well_id}${explainWell.run_id != null ? `?run_id=${explainWell.run_id}` : ''}`}><Button type="primary">Открыть карточку скважины</Button></Link>}>{explainWell&&<Space direction="vertical" style={{width:'100%'}}><Tag color={explainWell.tier==='alert'?'red':'gold'}>{explainWell.tier==='alert'?'Тревога':'Наблюдение'}</Tag>{explainWell.data_ok === false&&<Alert type="warning" message="В последнем окне есть пропуски данных" />}<ExplainBars wellId={explainWell.well_id} contributions={explainWell.contributions} windowKind={explainWell.explanation_window_kind} windowEnd={explainWell.explanation_window_end} /></Space>}</Modal>
  </div>;
}
