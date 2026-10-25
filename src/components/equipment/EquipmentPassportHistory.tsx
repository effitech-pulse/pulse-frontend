import {useCallback,useState} from 'react';
import {Button,Card,Space} from 'antd';
import {useAuth} from '../../auth/AuthProvider';
import {readEquipmentPassportHistory} from '../../api/equipmentPassports';
import type {PassportAction,PassportEvent,PassportInstallation} from '../../api/equipmentPassports';
import type {TablePageRequest} from '../../lib/tableTransport';
import type {TableQuery} from '../../lib/tableQuery';
import type {EntityField} from '../common/LocalEntityTable';
import {entityColumns} from '../common/LocalEntityTable';
import {useServerTable} from '../../hooks/useServerTable';
import {PulseTable} from '../common/PulseTable';
import {actionLabel,slotLabel} from '../../lib/equipmentPassportDraft';
import {PassportFullDiff} from './EquipmentPassportPreview';
const fields:EntityField<PassportEvent>[]=[
 {key:'recorded_at',label:'Дата',column:'Время / автор',kind:'datetime',read:event=>event.recorded_at,primary:true},
 {key:'actor_name',label:'Автор',column:'Время / автор',kind:'text',read:event=>event.actor.name},
 {key:'source',label:'Источник',column:'Время / автор',kind:'enum',read:event=>event.source,options:[{value:'manual',label:'Вручную'},{value:'excel',label:'Excel'}]},
 {key:'slot',label:'Слот',column:'Слот / действие',kind:'enum',read:event=>event.slot,options:Object.entries(slotLabel).map(([value,label])=>({value,label}))},
 {key:'action',label:'Действие',column:'Слот / действие',kind:'enum',read:event=>event.action,options:Object.entries(actionLabel).map(([value,label])=>({value,label}))},
 {key:'changes',label:'Изменения',column:'Было → стало',kind:'text',read:event=>JSON.stringify(event.diff)},
 {key:'reason',label:'Причина',column:'Было → стало',kind:'text',read:event=>event.reason},
];
const initialQuery:TableQuery={version:1,filters:[],sort:[{field:'recorded_at',direction:'desc'}]};
export function EquipmentPassportHistory({wellId,canUpdate,canExport,busy,onBack,onExport,onEdit,onFailure}:{wellId:string;canUpdate:boolean;canExport:boolean;busy:boolean;onBack:()=>void;onExport:(query:TableQuery)=>void;onEdit:(action:PassportAction,target:PassportInstallation,linked?:string)=>void;onFailure:(error:unknown)=>void}){
 const auth=useAuth();const [selected,setSelected]=useState<PassportEvent>();
 const read=useCallback(async(request:TablePageRequest,signal:AbortSignal)=>{try{return await readEquipmentPassportHistory(wellId,request,signal);}catch(error){if(!signal.aborted)onFailure(error);throw error;}},[wellId,onFailure]);
 const table=useServerTable(`equipmenthistory-${wellId}`,fields,read,auth.can('equipment_passports.history.read'),initialQuery);
 return <><Card className="passport-surface" title="История оборудования">
  <Space wrap><Button onClick={onBack}>Текущий состав</Button>{canExport?<Button disabled={busy} onClick={()=>onExport(table.state.query)}>Экспорт истории</Button>:null}</Space>
  <p>Фильтры выполняются сервером по всей доступной истории. Редакция — справочное значение. Экспорт: не более 1000 событий.</p>
  {table.notice?<p role="status">{table.notice}</p>:null}
  <PulseTable<PassportEvent> mode="server" schema={{fields,defaultSort:initialQuery.sort,rowId:event=>event.id}} query={table.state.query} onQueryChange={table.state.setQuery} page={table.data??{items:[],next_cursor:null}} pagination={table.pagination} loading={table.isFetching} error={table.isError?'Не удалось загрузить историю':undefined}
   columns={entityColumns<PassportEvent>([
    {key:'time',title:'Время / автор',render:(_,event)=><span>{event.recorded_at}<br/>{event.actor.name} · {event.source}</span>},
    {key:'slot-action',title:'Слот / действие',render:(_,event)=><span>{slotLabel[event.slot]} · {actionLabel[event.action]}</span>},
    {key:'changes-reason',title:'Было → стало',render:(_,event)=><span>{event.reason||'Причина не указана'}<br/>{event.diff.before.length} → {event.diff.after.length} эпизодов</span>},
    {key:'revision',title:'Редакция',render:(_,event)=><Button type="link" onClick={()=>setSelected(event)}>{event.revision} · Открыть</Button>},
   ],fields)} headerActions={<Button onClick={table.refresh}>Обновить</Button>}/>
 </Card>{selected?<Card className="passport-surface" title={`Событие ${selected.id} · исходная запись сохранена`}>
  <dl className="passport-metadata"><dt>Способ ввода</dt><dd>{selected.source}</dd><dt>Автор</dt><dd>{selected.actor.name} · {selected.actor.account_id}</dd><dt>Время</dt><dd>{selected.recorded_at}</dd><dt>Причина</dt><dd>{selected.reason||'Не указана'}</dd><dt>Документ</dt><dd>{selected.source_reference??'Не указан'}</dd><dt>Квитанция</dt><dd>{selected.receipt_id??'Неизвестно'}</dd><dt>SHA-256</dt><dd>{selected.source_file_sha256??'Не указан'}</dd><dt>Шаблон</dt><dd>{selected.template_version??'Неизвестно'}</dd><dt>Строка источника</dt><dd>{selected.source_row?`${selected.source_row.sheet}, строка ${selected.source_row.index} · ${selected.source_row.row_key}`:'Не указана'}</dd></dl>
  <PassportFullDiff diff={selected.diff}/>
  {canUpdate?selected.diff.after.filter(target=>target.id&&target.component_id&&target.status!=='voided').map(target=>{
   const successor=selected.diff.after.find(installation=>installation.predecessor_id===target.id);
   return <Space wrap key={target.id}><span>Установка {target.id}</span><Button type="link" onClick={()=>onEdit('correct',target,successor?.id??undefined)}>Исправить запись</Button><Button danger type="link" onClick={()=>onEdit('void',target)}>Аннулировать запись</Button></Space>;
  }):null}
 </Card>:null}</>;
}
