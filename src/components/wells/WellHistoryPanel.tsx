import { Alert, Button, Card, Empty, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { wellsApi, type WellEvent } from '@/api/wells';
import type { Well } from '@/api/types';
import { toApiError } from '@/api/client';
const actions={metadata:'Изменение карточки',archive:'В архив',restore:'Восстановление'};
const fields:Partial<Record<keyof Well,string>>={well_number:'№ скважины',ngdu:'НГДУ',department:'Цех',active:'Активна',responsible:'Ответственный',unitek_id:'Связь Unitek',armits_id:'Связь Armits',archived_at:'Архив'};
function value(v:unknown){return v==null?'—':typeof v==='boolean'?(v?'Да':'Нет'):String(v);}
function changes(event:WellEvent){return (Object.keys(fields) as (keyof Well)[]).filter(key=>event.before[key]!==event.after[key]).map(key=><div key={key}>{fields[key]}: <span className={['well_number','unitek_id','armits_id'].includes(key)?'sensitive':undefined}>{value(event.before[key])} → {value(event.after[key])}</span></div>);}
export function WellHistoryPanel({wellId}:{wellId:number}){
 const [cursors,setCursors]=useState<(number|undefined)[]>([undefined]);const before=cursors.at(-1);
 const query=useQuery({queryKey:['well-history',wellId,before],queryFn:()=>wellsApi.history(wellId,before)});
 return <Card title="История карточки скважины"><div className="pulse-stack">
 <Typography.Text type="secondary">Изменения реквизитов, ответственного и состояния архива. Автор определяется сервером. История проверок модели находится во вкладке «Проверки».</Typography.Text>
 {query.isError&&<Alert type="error" message={toApiError(query.error).message} action={<Button onClick={()=>query.refetch()}>Повторить</Button>} />}
 <Table<WellEvent> rowKey="revision" dataSource={query.data?.events??[]} loading={query.isLoading} pagination={false} scroll={{x:780}} locale={{emptyText:<Empty description="Изменений карточки ещё нет" />}} columns={[
 {title:'Дата, МСК',dataIndex:'created_at',render:(date:string)=>new Date(date).toLocaleString('ru',{timeZone:'Europe/Moscow'})},
 {title:'Действие',render:(_,e)=><><Tag>{actions[e.kind]}</Tag><div>Версия {e.before.revision} → {e.revision}</div></>},
 {title:'Автор',render:(_,e)=><>{e.actor.name}{!e.actor.authenticated&&<div><Typography.Text type="secondary">Общий доступ</Typography.Text></div>}</>},
 {title:'Изменения',render:(_,e)=>changes(e)},
 {title:'Причина',dataIndex:'reason',render:(text:string)=><span style={{whiteSpace:'pre-wrap'}}>{text||'—'}</span>},
 ]} />
 <Space><Button disabled={cursors.length===1} onClick={()=>setCursors(v=>v.slice(0,-1))}>Назад</Button><Button disabled={!query.data?.has_more} onClick={()=>setCursors(v=>[...v,query.data!.events.at(-1)!.revision])}>Предыдущие изменения</Button><Button onClick={()=>query.refetch()} loading={query.isFetching}>Обновить</Button></Space>
 </div></Card>;
}
