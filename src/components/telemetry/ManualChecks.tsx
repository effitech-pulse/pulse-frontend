import {useAuth} from '@/auth/AuthProvider';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Space, Table, Tag, Typography } from 'antd';
import { TelemetryChart, type ZoomRange } from './TelemetryChart';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { integrationsApi, type ManualCheck, type TelemetryScore } from '@/api/integrations';
import { ReviewPanel } from './ReviewPanel';
import { toApiError } from '@/api/client';
import {parseFileCheckLink} from '@/lib/fileJobs';
import {FileJobsHistory} from './FileJobs';

const dates = (s: string) => new Date(s).toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'});
const verdicts = {alert: 'Тревога', watch: 'Наблюдение', norm: 'Норма', insufficient: 'Недостаточно данных'};
export function CheckVerdict({result}: {result: TelemetryScore}) {
  return <Tag color={{alert: 'red', watch: 'gold', norm: 'green', insufficient: 'default'}[result.verdict]}>{verdicts[result.verdict] ?? 'Нет заключения'}</Tag>;
}
export function ManualChecks({wellId,periodEnabled=true}: {wellId: string;periodEnabled?:boolean}) {
  const {can}=useAuth();
  const [search, setSearch] = useSearchParams();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const before = cursors[cursors.length - 1];
  const selected=parseFileCheckLink(search.get('check'));
  const id=selected.kind==='period'?selected.id:null;
  const list = useQuery({queryKey: ['manual-checks', wellId, before], queryFn: () => integrationsApi.checks(wellId, before),enabled:can('checks.read')&&periodEnabled});
  const detail = useQuery({queryKey: ['manual-check', wellId, id], queryFn: () => integrationsApi.savedCheck(wellId, id!), enabled: can('checks.read') && !!id});
  const open = (value?: string) => setSearch(p => { if (value) p.set('check', value); else p.delete('check'); return p; });
  const v = detail.data, r = v?.result;
  return <div className="pulse-stack">
    <h2>Проверки за период</h2>
    {selected.kind==='invalid'&&<Alert type="warning" message="Некорректная ссылка на проверку"/>}
    <Typography.Text type="secondary">Сохранённые ручные проверки телеметрии. Для новой проверки выберите период от 30 суток во вкладке «Телеметрия» → «⋯» → «Проверить моделью».</Typography.Text>
    {list.isError && <Alert type="error" message={toApiError(list.error).message} action={<Button disabled={!can('checks.read')} onClick={() => list.refetch()}>Повторить</Button>} />}
    <Table<ManualCheck> rowKey="id" loading={list.isLoading} dataSource={list.data} pagination={false} scroll={{x: 760}} locale={{emptyText: <Empty description="Сохранённых проверок пока нет" />}} columns={[
      {title: 'Проверка, МСК', dataIndex: 'created_at', render: (value: string, row) => <Button type="link" onClick={() => open(row.id)}>{dates(value)}</Button>},
      {title: 'Период, МСК', render: (_, row) => `${dates(row.start)} — ${dates(row.end)}`},
      {title: 'Результат', render: (_, row) => <CheckVerdict result={row.result} />},
      {title: 'Модель', render: (_, row) => row.result.model_name ?? 'Версия не передана'},
    ]} />
    <Space><Button disabled={cursors.length === 1} onClick={() => setCursors(c => c.slice(0,-1))}>Назад</Button><Button disabled={list.data?.length !== 25} onClick={() => setCursors(c => [...c, list.data!.at(-1)!.id])}>Далее</Button><Button disabled={!can('checks.read')} onClick={() => list.refetch()} loading={list.isFetching}>Обновить</Button></Space>
    <FileJobsHistory key={wellId} wellId={wellId}/>
    <Drawer title={`Ручная проверка · ID Pulse ${wellId}`} open={!!id && search.get('tab') === 'checks'} onClose={() => open()} width={960}>
      {detail.isLoading && <Typography.Text>Загрузка проверки…</Typography.Text>}
      {detail.isError && <Alert type="error" message={toApiError(detail.error).message} action={<Button onClick={() => detail.refetch()}>Повторить</Button>} />}
      {v && r && <div className="pulse-stack">
        <Space wrap><CheckVerdict result={r} /><Typography.Text>Сохранено {dates(v.created_at)} МСК</Typography.Text></Space>
        <ReviewPanel key={v.id} path={`/api/v1/wells/${encodeURIComponent(wellId)}/checks/${encodeURIComponent(v.id)}/review`} />
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Период, МСК">{dates(v.start)} — {dates(v.end)}</Descriptions.Item>
          <Descriptions.Item label="Модель">{r.model_name ?? 'Не передана'}</Descriptions.Item>
          <Descriptions.Item label="Версия артефактов"><Typography.Text copyable={!!r.model_version} style={{overflowWrap:'anywhere'}}>{r.model_version ?? 'ML-сервис не передал версию'}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="Данные">{v.points_count.toLocaleString('ru')} точек · {r.features_total-r.features_unavailable} из {r.features_total} признаков рассчитано · {v.resolution || 'Исходная дискретность'}</Descriptions.Item>
          <Descriptions.Item label="Расчётные окна">{r.n_windows} всего · {r.windows_running} рабочих · {r.features_unavailable} недоступных признаков</Descriptions.Item>
          <Descriptions.Item label="Отпечаток входных данных"><Typography.Text copyable style={{overflowWrap:'anywhere'}}>{v.input_sha256}</Typography.Text></Descriptions.Item>
        </Descriptions>
        {r.verdict === 'insufficient' ? <Alert type="warning" message="Недостаточно данных для заключения модели" /> : <Typography.Text>Последний риск: {(r.latest_risk * 100).toFixed(1)}% · максимальный: {(r.peak_risk * 100).toFixed(1)}%{r.peak_window_end ? ` · ${dates(r.peak_window_end)} МСК` : ''}</Typography.Text>}
        {!!r.timeline?.length && <Card title="Сохранённая динамика риска"><SavedRiskChart key={v.id} check={v} /><Typography.Text type="secondary">МСК · выделите участок для увеличения · колесо — масштаб · Escape — сброс.</Typography.Text></Card>}
        <Card title="Признаки в окне максимального риска"><Table size="small" rowKey="feature" pagination={false} dataSource={r.contributions ?? []} locale={{emptyText:'Модель не передала объяснение'}} columns={[
          {title:'Признак', render: (_, c) => c.label || c.feature},
          {title:'Источник значения', dataIndex:'value_source', render:(source: string | null) => <Typography.Text type={source === 'computed' ? undefined : 'secondary'}>{({computed:'Рассчитано по данным',training_median:'Медиана обучения',zero_fallback:'Заполнение нулём'} as Record<string,string>)[source ?? ''] ?? 'Источник не передан'}</Typography.Text>},
          {title:'Значение', dataIndex:'value', render:(n: number) => n.toLocaleString('ru', {maximumFractionDigits:4})},
          {title:'Вклад SHAP', dataIndex:'shap', render:(n: number) => <Typography.Text type={n > 0 ? 'danger' : 'secondary'}>{n > 0 ? '+' : ''}{n.toFixed(4)}</Typography.Text>},
        ]} /><Typography.Text type="secondary">Положительный вклад повышает оценку риска, отрицательный — снижает. Показан ответ модели на момент проверки.</Typography.Text></Card>
      </div>}
    </Drawer>
  </div>;
}

function SavedRiskChart({check}: {check: ManualCheck}) {
  const [zoom, setZoom] = useState<ZoomRange>([0,1]);
  const [cursor, setCursor] = useState<number | null>(null);
  const label = 'Риск, %';
  return <TelemetryChart points={check.result.timeline.map(p => ({well_id:String(check.well_id), timestamp:p.window_end, values:{[label]:p.risk * 100}}))} selected={[label]} fixedBounds={{[label]:[0,100]}} zoom={zoom} onZoom={setZoom} cursor={cursor} onCursor={setCursor} />;
}
