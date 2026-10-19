import {useWells} from '@/hooks/useWells';
import {useAuth} from '@/auth/AuthProvider';
import { Alert, App, Button, Card, Collapse, Empty, Space, Table, Tag, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { presentationApi, type PresentationWell } from '@/api/presentation';
import { integrationsApi } from '@/api/integrations';
import { toApiError } from '@/api/client';
import { FundFilterBar } from '@/components/layout/FundFilterBar';

export function PresentationOverview() {
  const {isAdmin,canOperate}=useAuth();
  const {message} = App.useApp(), client = useQueryClient();
  const query = useQuery({queryKey:['presentation-summary'], queryFn:presentationApi.summary,refetchInterval:30000});
  const scenario = useQuery({queryKey:['presentation-scenario'],enabled:isAdmin,queryFn:presentationApi.scenario,refetchInterval:30000});
  const [checking, setChecking] = useState<number>();
  const [retry, setRetry] = useState<{well:number; start:string; end:string; id:string}>();
  const selected=useWells();
  const byID=new Map(query.data?.wells.map(w=>[w.id,w]));
  const rows=(selected.data??[]).map(w=>byID.get(w.id)).filter((w):w is PresentationWell=>!!w);
  const data=query.data&&selected.data?{...query.data,wells:rows,count:rows.length,checked:rows.filter(w=>w.latest_check).length,watch:rows.filter(w=>w.latest_check?.verdict==='watch').length,alert:rows.filter(w=>w.latest_check?.verdict==='alert').length,insufficient:rows.filter(w=>w.latest_check?.verdict==='insufficient').length}:undefined;
  async function check(well: PresentationWell) {
    if (checking != null) return;
    setChecking(well.id);
    try {
      let request = retry?.well === well.id ? retry : undefined;
      if (!request) {
        const bounds = await integrationsApi.bounds(String(well.id));
        if (!bounds.end || !bounds.start || Date.parse(bounds.end)-Date.parse(bounds.start)<30*86400000) throw new Error('Для проверки нужны не менее 30 суток телеметрии');
        const end = bounds.end, start = new Date(Math.max(Date.parse(bounds.start), Date.parse(end)-31*86400000)).toISOString();
        request={well:well.id,start,end,id:crypto.randomUUID()};setRetry(request);
      }
      const saved = await integrationsApi.createCheck(String(well.id),request.start,request.end,request.id);
      setRetry(undefined);await client.invalidateQueries({queryKey:['presentation-summary']});
      await client.invalidateQueries({queryKey:['manual-checks',String(well.id)]});
      message.success(`Проверка ID Pulse ${well.id} сохранена: ${{norm:'норма',watch:'наблюдение',alert:'тревога',insufficient:'недостаточно данных'}[saved.result.verdict]}`);
    } catch (e) {message.error(toApiError(e).message);} finally {setChecking(undefined);}
  }
  return <div className="pulse-stack pulse-overview">
    <div className="pulse-page-heading"><h1>Обзор фонда</h1><p>Показательный фонд · последние сохранённые проверки скважин</p></div>
    <Alert type="info" showIcon message="Показательный фонд" description="Синтетические обезличенные скважины. Реальная телеметрия не раскрывается в связи с NDA." />
    {selected.isError && <Alert type="error" message={toApiError(selected.error).message} />}
    {query.isError && <Alert type="error" message={toApiError(query.error).message} action={<Button onClick={() => query.refetch()}>Повторить</Button>} />}
    <div className="pulse-metrics">{[['В мониторинге',data?.count],['Проверены вручную',data?.checked],['Под наблюдением',data?.watch],['Требуют проверки',data?.alert]].map(([label,value]) => <div key={label}><span>{label}</span><strong className={label==='Требуют проверки'?'pulse-danger':label==='Под наблюдением'?'pulse-warning':undefined}>{value ?? '—'}</strong><small>скважин</small></div>)}</div>
    <FundFilterBar />
    {scenario.data && <Collapse items={[{key:'scenario', label:`Сценарий: ${scenario.data.count-scenario.data.affected} стабильных режимов и ${scenario.data.affected} вариантов деградации`,children:<div className="pulse-stack"><Typography.Text>{scenario.data.count} скважин · {scenario.data.affected} сценариев деградации · развитие за {scenario.data.ramp_days} суток</Typography.Text><Typography.Text type="secondary">Начало: {new Date(scenario.data.origin).toLocaleString('ru',{timeZone:'Europe/Moscow'})} МСК · seed {scenario.data.seed} · {scenario.data.profile_count} исходных агрегированных профилей</Typography.Text><Typography.Text type="secondary" copyable style={{overflowWrap:'anywhere'}}>Сценарий: {scenario.data.scenario_id}</Typography.Text></div>}]} />}
    {scenario.isError && <Alert type="warning" message="Параметры сценария Pulse Data недоступны" description={toApiError(scenario.error).message} />}
    {!!data?.insufficient && <Typography.Text type="secondary">У {data.insufficient} скважин последняя проверка не дала заключения из-за недостаточности данных.</Typography.Text>}
    <Typography.Text type="secondary">Показаны последние сохранённые ручные проверки. Сценарии генератора не назначают риск или ярус. Новые значения телеметрии появляются независимо от запуска модели.</Typography.Text>
    <Card title="Скважины показательного фонда" extra={<Button loading={query.isFetching} onClick={() => query.refetch()}>Обновить</Button>}>
      <Table<PresentationWell> rowKey="id" dataSource={data?.wells} loading={query.isLoading || selected.isLoading} pagination={{pageSize:15}} scroll={{x:780}} locale={{emptyText:<Empty description="По выбранным фильтрам скважин нет" />}} columns={[
        {title:'ID Pulse',dataIndex:'id',render:(id:number)=><Link to={`/wells/${id}?tab=telemetry`}>{id}</Link>},
        {title:'Скважина',dataIndex:'well_number'},
        {title:'Последняя проверка, МСК',render:(_,w)=>w.latest_check ? new Date(w.latest_check.created_at).toLocaleString('ru',{timeZone:'Europe/Moscow'}) : 'Не выполнялась'},
        {title:'Результат модели',render:(_,w)=> w.latest_check ? <Tag color={{alert:'red',watch:'gold',norm:'green'}[w.latest_check.verdict]}>{({norm:'Норма',watch:'Наблюдение',alert:'Тревога',insufficient:'Недостаточно данных'} as Record<string,string>)[w.latest_check.verdict] ?? 'Нет заключения'}</Tag> : '—'},
        {title:'Действия',render:(_,w)=><Space><Button size="small" disabled={checking != null || !canOperate} loading={checking===w.id} onClick={() => check(w)}>Проверить месяц</Button>{w.latest_check && <Link to={`/wells/${w.id}?tab=checks&check=${w.latest_check.id}`}>Результат</Link>}</Space>},
      ]} />
    </Card>
  </div>;
}
