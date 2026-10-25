import {useCallback,useEffect,useReducer,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import axios from 'axios';
import {Alert,Button,Card,Dropdown,Space,Spin} from 'antd';
import {useAuth} from '../../auth/AuthProvider';
import {apiClient,toApiError} from '../../api/client';
import type {Well} from '../../api/types';
import {cancelEquipmentPassportPreview,commitEquipmentPassport,downloadEquipmentPassportTemplate,exportEquipmentPassports,importEquipmentPassport,prepareEquipmentPassport,readEquipmentPassport} from '../../api/equipmentPassports';
import type {PassportAction,PassportInstallation,PassportIssue,PassportMutation,PassportReceipt,PassportSlot} from '../../api/equipmentPassports';
import {actionLabel,attributeLabels,createPassportDraft,PassportDraftValidationError,passportSlots,reducePassportDraft,slotAttributes,slotLabel,toPassportChangeSet} from '../../lib/equipmentPassportDraft';
import type {PassportDraftEvent} from '../../lib/equipmentPassportDraft';
import {guardTablePage} from '../../lib/tableTransport';
import type {TableQuery} from '../../lib/tableQuery';
import {EquipmentPassportEditor} from './EquipmentPassportEditor';
import {EquipmentPassportPreview} from './EquipmentPassportPreview';
import {EquipmentPassportImport} from './EquipmentPassportImport';
import {EquipmentPassportHistory} from './EquipmentPassportHistory';
import './EquipmentPassport.css';

type Mode='current'|'editor'|'import'|'history';
interface Failure {message:string;code?:string;requestId?:string;status?:number;issues:PassportIssue[]}
function Receipt({receipt,filename,onBack}:{receipt:PassportReceipt;filename?:string;onBack:()=>void}){
 const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>heading.current?.focus(),[receipt.id]);
 return <Card className="passport-surface"><h3 tabIndex={-1} ref={heading}>Квитанция {receipt.id}</h3><p role="status">{receipt.changed_count===0?'Завершено без изменений':'Изменения сохранены'} · {receipt.changed_count} изменений · {receipt.unchanged_count} без изменений</p>
  <dl className="passport-metadata"><dt>Автор</dt><dd>{receipt.actor.name} · {receipt.actor.account_id}</dd><dt>Время записи</dt><dd>{receipt.recorded_at}</dd><dt>Способ ввода</dt><dd>{receipt.source}</dd><dt>Request ID</dt><dd>{receipt.request_id}</dd><dt>SHA-256 файла</dt><dd>{receipt.source_file_sha256??'Не указан'}</dd>{filename?<><dt>Файл в текущем сеансе</dt><dd>{filename}</dd></>:null}</dl>
  {receipt.wells.map(well=><p key={well.well_id}>ID Pulse {well.well_id} · версия {well.before_revision} → {well.after_revision}</p>)}
  {receipt.rows.map(row=><p key={row.row_key}>Строка {row.row_key} · скважина {row.well_id} · экземпляр {row.component_id??'Не указан'} · установка {row.installation_id??'Не указана'}</p>)}
  <Button type="primary" onClick={onBack}>Открыть оборудование</Button>
 </Card>;
}
/** Единственный well seam: private owner state не попадает в URL или browser storage. */
export function EquipmentPassportPanel({wellId}:{wellId:string}){
 const auth=useAuth();const client=useQueryClient();
 const [draft,dispatch]=useReducer(reducePassportDraft,undefined,()=>createPassportDraft());
 const [mode,setMode]=useState<Mode>('current'),[file,setFile]=useState<File|null>(null),[selected,setSelected]=useState<string[]>([wellId]);
 const [original,setOriginal]=useState<PassportInstallation>(),[linkedId,setLinkedId]=useState<string>();
 const [openActions,setOpenActions]=useState<PassportSlot|null>(null);
 const actionTriggers=useRef(new Map<PassportSlot,HTMLButtonElement|HTMLAnchorElement>()),returnToSlot=useRef<PassportSlot|null>(null);
 const [failure,setFailure]=useState<Failure|null>(null),[pending,setPending]=useState(''),[denied,setDenied]=useState(false),[ambiguous,setAmbiguous]=useState(false);
 const sequence=useRef(0),busy=useRef(false),controllers=useRef(new Set<AbortController>()),urls=useRef(new Set<string>()),errorHeading=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const allowed=auth.mode==='local'&&auth.principal?.mechanism==='session'&&auth.principal.access_model==='rbac_v1'&&auth.can('equipment_passports.read')&&!auth.privateBlocked&&!denied;
 const clearWork=useCallback(()=>{sequence.current++;controllers.current.forEach(controller=>controller.abort());controllers.current.clear();urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();busy.current=false;},[]);
 useEffect(()=>()=>clearWork(),[wellId,auth.privateEpoch,clearWork]);
 const handleFailure=useCallback((error:unknown)=>{
  if(axios.isCancel(error)||(error instanceof DOMException&&error.name==='AbortError'))return;
  const status=axios.isAxiosError(error)?error.response?.status:undefined;
  if(status===401||status===403||status===404){
   clearWork();dispatch({type:'private_reset'});setFile(null);setSelected([]);setOriginal(undefined);setLinkedId(undefined);setMode('current');setFailure(null);setPending('');setAmbiguous(false);setDenied(true);
   const owns=(key:readonly unknown[])=>String(key[0]).startsWith('equipment-passport')||(key[0]==='table'&&String(key[1]).startsWith('equipmenthistory-'));
   void client.cancelQueries({predicate:query=>owns(query.queryKey)});client.removeQueries({predicate:query=>owns(query.queryKey)});return;
  }
  const problem=toApiError(error);const detail=problem.detail as {issues?:PassportIssue[]}|undefined;
  const message=status===409?'Данные изменились. Черновик сохранён. Перечитайте актуальные данные и повторите проверку.':status===410?'Предпросмотр истёк или отменён. Повторите проверку.':status===413?'Превышены лимиты файла или пакета. Выберите XLSX до 2 МиБ, до 100 скважин и 300 строк.':status===429?'Проверка занята. Повторите позже или отмените собственный предпросмотр.':problem.message;
  setFailure({message,code:problem.code,requestId:problem.http_request_id,status,issues:error instanceof PassportDraftValidationError?error.issues:detail?.issues??[]});
  if(status===409)dispatch({type:'conflict'});if(status===410)dispatch({type:'invalidate'});
  requestAnimationFrame(()=>errorHeading.current?.focus());
 },[clearWork,client]);
 const read=useQuery({queryKey:['equipment-passport',auth.privateEpoch,wellId],enabled:allowed,retry:false,queryFn:({signal})=>guardTablePage(auth.capturePrivate(),async()=>{try{return await readEquipmentPassport(wellId,signal);}catch(error){if(!signal.aborted)handleFailure(error);throw error;}},signal)});
 const metadata=useQuery({queryKey:['equipment-passport-well',auth.privateEpoch,wellId],enabled:allowed,retry:false,queryFn:({signal})=>guardTablePage(auth.capturePrivate(),async()=>{try{return (await apiClient.get<Well>(`/api/v1/wells/${encodeURIComponent(wellId)}`,{signal,params:{include_archived:true}})).data;}catch(error){if(!signal.aborted)handleFailure(error);throw error;}},signal)});
 const archived=!!metadata.data?.archived_at;
 const canWrite=allowed&&auth.can('equipment_passports.update')&&!!metadata.data&&!archived;
 const canImport=canWrite&&auth.can('equipment_passports.import');const canExport=allowed&&auth.can('equipment_passports.export');
 async function operation<T>(label:string,work:(signal:AbortSignal)=>Promise<T>,accept:(value:T)=>void,commit=false){
  if(busy.current||!allowed)return;busy.current=true;const current=++sequence.current;const ticket=auth.capturePrivate();const controller=new AbortController();controllers.current.add(controller);setPending(label);setFailure(null);
  try{const value=await work(controller.signal);if(!controller.signal.aborted&&ticket.current()&&current===sequence.current)accept(value);}
  catch(error){
   if(!controller.signal.aborted&&ticket.current()&&current===sequence.current){
    // Binary responseType also applies to JSON problem responses; decode only that error.
    if(axios.isAxiosError(error)&&error.response?.data instanceof Blob){try{error.response.data=JSON.parse(await error.response.data.text());}catch{/* Keep safe generic error. */}}
    if(!ticket.current()||controller.signal.aborted||current!==sequence.current)return;
    const status=axios.isAxiosError(error)?error.response?.status:undefined;
    if(commit&&status!==400&&status!==401&&status!==403&&status!==404&&status!==409&&status!==410){setAmbiguous(true);const problem=toApiError(error);setFailure({code:problem.code,requestId:problem.http_request_id,message:'Не удалось подтвердить результат. Повторите тот же commit с прежним ключом.',status,issues:[]});}
    else {setAmbiguous(false);handleFailure(error);}
   }
  }finally{controllers.current.delete(controller);if(current===sequence.current&&ticket.current()){busy.current=false;setPending('');}}
 }
 function edit(event:PassportDraftEvent){clearWork();setPending('');setFailure(null);setAmbiguous(false);dispatch(event);}
 function start(action:PassportAction,slot:PassportSlot,target?:PassportInstallation,successor?:string){
  if(!canWrite||!read.data)return;
  const row:PassportMutation={row_key:'manual-1',well_id:wellId,expected_well_revision:read.data.well_revision,expected_passport_revision:read.data.revision,slot,action,change_reason:'',source_reference:''};
  if(action!=='register'){row.component_id=target?.component_id;row.installation_id=target?.id;}
  setOriginal(action==='register'||action==='replace'?undefined:target);setLinkedId(auth.can('equipment_passports.history.read')?successor:undefined);setOpenActions(null);
  edit({type:'begin',rows:[row]});setMode('editor');
 }
 function check(){
  if(draft.conflict||mode==='import'&&!canImport||mode==='editor'&&!canWrite)return;
  const version=draft.version;
  if(mode==='import'){if(file)void operation('Проверяем файл…',signal=>importEquipmentPassport(file,signal),preview=>dispatch({type:'preview',version,preview,idempotencyKey:crypto.randomUUID()}));}
  else {try{const input=toPassportChangeSet(draft);void operation('Проверяем изменения…',signal=>prepareEquipmentPassport(input,signal),preview=>dispatch({type:'preview',version,preview,idempotencyKey:crypto.randomUUID()}));}catch(error){handleFailure(error);}}
 }
 function commit(ack:boolean){
  if(!draft.preview||!draft.idempotencyKey||mode==='import'&&!canImport||mode==='editor'&&!canWrite)return;
  const version=draft.version;const input={preview_id:draft.preview.id,digest:draft.preview.digest,idempotency_key:draft.idempotencyKey,acknowledge_warnings:ack};
  void operation('Сохраняем изменения…',signal=>commitEquipmentPassport(input,signal),receipt=>{
   setAmbiguous(false);dispatch({type:'commit',version,receipt});
   receipt.wells.forEach(well=>{void client.invalidateQueries({queryKey:['equipment-passport',auth.privateEpoch,well.well_id]});void client.invalidateQueries({queryKey:['table',`equipmenthistory-${well.well_id}`,auth.privateEpoch]});});
  },true);
 }
 function cancel(destination:Mode='current'){
  if(ambiguous)return;
  const preview=draft.preview;clearWork();setPending('');setFailure(null);dispatch({type:'invalidate'});setMode(destination);
  if(destination==='current'){dispatch({type:'private_reset'});setOriginal(undefined);setLinkedId(undefined);setFile(null);const ticket=auth.capturePrivate();const slot=returnToSlot.current;returnToSlot.current=null;requestAnimationFrame(()=>{if(ticket.current())(slot?actionTriggers.current.get(slot)??heading.current:heading.current)?.focus();});}
  if(preview)void operation('Отменяем предпросмотр…',signal=>cancelEquipmentPassportPreview(preview.id,signal),()=>{});
 }
 function download(kind:'template'|'current_components'|'history',query?:TableQuery){
  const ids=kind==='history'?[wellId]:selected;
  if(kind==='template'?!canImport:!canExport||kind==='history'&&!auth.can('equipment_passports.history.read'))return;
  void operation('Готовим книгу…',signal=>kind==='template'?downloadEquipmentPassportTemplate(ids,signal):exportEquipmentPassports({well_ids:ids,mode:kind,query},signal),blob=>{
   const url=URL.createObjectURL(blob);urls.current.add(url);const anchor=document.createElement('a');anchor.href=url;anchor.download=kind==='template'?'equipment-passport-v1.xlsx':`equipment-passports-${kind}.xlsx`;anchor.click();URL.revokeObjectURL(url);urls.current.delete(url);
  });
 }
 function reread(){void operation('Перечитываем актуальные данные…',async signal=>{
  const [current,well]=await Promise.all([readEquipmentPassport(wellId,signal),apiClient.get<Well>(`/api/v1/wells/${encodeURIComponent(wellId)}`,{signal,params:{include_archived:true}}).then(result=>result.data)]);return {current,well};
 },({current,well})=>{
  client.setQueryData(['equipment-passport',auth.privateEpoch,wellId],current);client.setQueryData(['equipment-passport-well',auth.privateEpoch,wellId],well);
  if(draft.rows.length)edit({type:'begin',rows:draft.rows.map(row=>({...row,expected_well_revision:current.well_revision,expected_passport_revision:current.revision}))});else edit({type:'begin',rows:[]});
 });}
 if(!allowed)return <Alert type="warning" message={denied||auth.privateBlocked?'Скважина недоступна':'Нет доступа к паспорту оборудования'}/>;
 const current=read.data;
 return <div className="equipment-passport"><h2 tabIndex={-1} ref={heading}>Паспорт оборудования</h2>
  <p>Установленное оборудование и сведения из паспортов. Неизвестные данные отображаются явно.</p>
  {pending?<div role="status" aria-live="polite"><Spin size="small"/> {pending}</div>:null}
  {failure?<div role="alert" tabIndex={-1} ref={errorHeading} className="passport-error"><Alert type="error" message={failure.message} description={<>{failure.requestId?<p>Код обращения: {failure.requestId}</p>:null}{failure.code?<details><summary>Подробнее</summary>{failure.code}</details>:null}{failure.issues.map((issue,index)=><p key={index}><a href={`#passport-${issue.field??'change_reason'}`}>{issue.row_key} · {issue.field??'строка'} · {issue.message}</a></p>)}</>}/>{draft.conflict?<Button disabled={!!pending} onClick={reread}>Перечитать актуальные данные</Button>:null}</div>:null}
  {draft.conflict&&!failure?<Alert type="warning" message="Перед новой проверкой перечитайте актуальные данные" action={<Button disabled={!!pending} onClick={reread}>Перечитать актуальные данные</Button>}/>:null}
  {archived?<Alert type="warning" message="Скважина в архиве. Паспорт доступен только для чтения."/>:null}
  {draft.receipt?<Receipt receipt={draft.receipt} filename={mode==='import'?file?.name:undefined} onBack={()=>cancel()}/>:draft.preview?<EquipmentPassportPreview key={draft.preview.id} preview={draft.preview} busy={!!pending} ambiguous={ambiguous} isImport={mode==='import'} onCommit={commit} onBack={()=>cancel(mode)}/>:mode==='editor'&&draft.rows[0]?<EquipmentPassportEditor row={draft.rows[0]} original={original} linkedId={linkedId} issues={failure?.issues??[]} busy={!!pending||!canWrite} checkBlocked={draft.conflict} onEvent={edit} onCheck={check} onCancel={()=>cancel()}/>:mode==='import'?<EquipmentPassportImport selected={selected} onSelection={setSelected} file={file} onFile={next=>{setFile(next);edit({type:'invalidate'});}} checkBlocked={draft.conflict} onCheck={check} onTemplate={()=>download('template')} onExport={()=>download('current_components')} onBack={()=>cancel()} onFailure={handleFailure} canImport={canImport} canExport={canExport} busy={!!pending} issues={failure?.issues??[]}/>:mode==='history'?<EquipmentPassportHistory wellId={wellId} canUpdate={canWrite} canExport={canExport} busy={!!pending} onBack={()=>cancel()} onExport={query=>download('history',query)} onFailure={handleFailure} onEdit={(action,target,successor)=>start(action,target.slot,target,successor)}/>:<>
   <Space wrap>{canImport?<Button type="primary" disabled={!!pending} onClick={()=>setMode('import')}>Импорт Excel</Button>:null}{canExport?<Button disabled={!!pending} onClick={()=>setMode('import')}>Экспорт Excel</Button>:null}{auth.can('equipment_passports.history.read')?<Button type="link" onClick={()=>setMode('history')}>История оборудования</Button>:null}</Space>
   {read.isError||metadata.isError?<Alert type="error" message="Не удалось загрузить паспорт" action={<Button onClick={()=>{setFailure(null);void read.refetch();void metadata.refetch();}}>Повторить</Button>}/>:!current||!metadata.data?<div className="passport-slots" role="status" aria-live="polite">{passportSlots.map(slot=><Card key={slot} title={slotLabel[slot]}>Загружаем паспорт…</Card>)}</div>:<>
    <div className="passport-slots">{passportSlots.map(slot=>{const installation=current.slots.find(item=>item.slot===slot);const provenance=current.provenance?.find(item=>item.slot===slot)?.last_change;
     return <Card className="passport-surface" key={slot} title={slotLabel[slot]}>{installation?<>
      <p>Текущая установка</p><dl className="passport-values">{slotAttributes(slot).slice(0,3).map(field=><div key={field}><dt>{attributeLabels[field]}</dt><dd>{installation.attributes[field]??'Не указано'}</dd></div>)}<div><dt>Дата установки</dt><dd>{installation.installed_on??'Дата неизвестна'}</dd></div>{slotAttributes(slot).slice(3).map(field=><div key={field}><dt>{attributeLabels[field]}</dt><dd>{installation.attributes[field]??'Не указано'}</dd></div>)}<div><dt>Экземпляр / установка</dt><dd>{installation.component_id} / {installation.id}</dd></div></dl>
      <div className="passport-provenance"><p>Последнее изменение записи: {provenance?`${provenance.source==='excel'?'Excel':'вручную'} · ${provenance.recorded_at}`:'Неизвестно'}</p><p>Автор: {provenance?.actor.name??'Неизвестно'}</p><p>Документ: {provenance?.source_reference??'Не указан'}</p></div>
      {canWrite?<><Button type="link" block disabled={!!pending} onClick={()=>start('update',slot,installation)}>{actionLabel.update}</Button><Space wrap><Button disabled={!!pending} onClick={()=>start('replace',slot,installation)}>Заменить</Button><Button disabled={!!pending} onClick={()=>start('close',slot,installation)}>Снять</Button>
       <Dropdown trigger={['click']} disabled={!!pending} open={openActions===slot} onOpenChange={open=>setOpenActions(open?slot:null)} overlayClassName="passport-current-actions" menu={{items:[{key:'correct',label:'Исправить запись'},{key:'void',label:'Отметить запись ошибочной',danger:true}],onClick:({key})=>{if(key==='correct'||key==='void'){returnToSlot.current=slot;start(key,slot,installation);}}}}>
        <Button ref={node=>{if(node)actionTriggers.current.set(slot,node);else actionTriggers.current.delete(slot);}} disabled={!!pending} aria-label={`Действия с текущей записью: ${slotLabel[slot]}`} aria-haspopup="menu" aria-expanded={openActions===slot}>Ещё</Button>
       </Dropdown>
      </Space></>:null}
     </>:<><p>Сведения отсутствуют</p><p>Это не означает физическое отсутствие оборудования.</p>{canWrite?<Button disabled={!!pending} onClick={()=>start('register',slot)}>Добавить сведения</Button>:null}</>}</Card>;
    })}</div><p>Версия паспорта {current.revision} · административная карточка и результаты расчётов независимы.</p>
   </>}
  </>}
 </div>;
}
