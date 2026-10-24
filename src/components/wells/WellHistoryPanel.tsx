import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
import {useAuth} from '@/auth/AuthProvider';
import { Card, Empty, Tag, Typography } from 'antd';
import { type WellEvent } from '@/api/wells';
import type { Well } from '@/api/types';
const actions={metadata:'Изменение карточки',archive:'В архив',restore:'Восстановление'};
const fields:Partial<Record<keyof Well,string>>={well_number:'№ скважины',ngdu:'НГДУ',department:'Цех',active:'Активна',responsible:'Ответственный',unitek_id:'Связь Unitek',armits_id:'Связь Armits',archived_at:'Архив'};
function value(v:unknown){return v==null?'—':typeof v==='boolean'?(v?'Да':'Нет'):String(v);}
function changes(event:WellEvent){return (Object.keys(fields) as (keyof Well)[]).filter(key=>event.before[key]!==event.after[key]).map(key=><div key={key}>{fields[key]}: <span className={['well_number','unitek_id','armits_id'].includes(key)?'sensitive':undefined}>{value(event.before[key])} → {value(event.after[key])}</span></div>);}
export function WellHistoryPanel({wellId}:{wellId:number|string}){
  const {can}=useAuth();
 return <Card title="История карточки скважины"><div className="pulse-stack">
 <Typography.Text type="secondary">Изменения реквизитов, ответственного и состояния архива. Автор определяется сервером. История проверок модели находится во вкладке «Проверки».</Typography.Text>
 <ServerEntityTable<WellEvent & {changes:string}> tableKey={`well-history-${wellId}`} enabled={can('wells.history.read')} read={(q,s)=>getTablePage(`/api/v1/wells/${wellId}/history`,q,s)}
 fields={[{key:'created_at',label:'Дата, МСК',kind:'datetime',read:r=>r.created_at},{key:'kind',label:'Действие',kind:'enum',options:Object.entries(actions).map(([value,label])=>({value,label})),read:r=>r.kind},
 {key:'actor_name',label:'Автор',kind:'text',read:r=>r.actor.name},{key:'changes',label:'Изменения',kind:'text',read:r=>r.changes},{key:'reason',label:'Причина',kind:'text',read:r=>r.reason}]} rowKey="revision" scroll={{x:780}} locale={{emptyText:<Empty description="Изменений карточки ещё нет" />}} columns={[
 {title:'Дата, МСК',dataIndex:'created_at',render:(date:string)=>new Date(date).toLocaleString('ru',{timeZone:'Europe/Moscow'})},
 {title:'Действие',render:(_,e)=><><Tag>{actions[e.kind]}</Tag><div>Версия {e.before.revision} → {e.revision}</div></>},
 {title:'Автор',render:(_,e)=><>{e.actor.name}{!e.actor.authenticated&&<div><Typography.Text type="secondary">Общий доступ</Typography.Text></div>}</>},
 {title:'Изменения',render:(_,e)=>changes(e)},
 {title:'Причина',dataIndex:'reason',render:(text:string)=><span style={{whiteSpace:'pre-wrap'}}>{text||'—'}</span>},
 ]} />
 </div></Card>;
}
