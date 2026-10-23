import {Alert,Button,Card,Checkbox,Input,InputNumber,Select,Space,Spin,Table,Upload} from 'antd';
import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {fileJobsApi,type FileMapping,type FileParseSpec,type FileJobStatus} from '@/api/fileJobs';
import {useAuth} from '@/auth/AuthProvider';
import {fileProblem,usePrivateFileRequest} from '@/hooks/useFileJobs';
import {StableFileSubmission} from '@/lib/fileJobs';
import {previewFile,validateFileDraft,previewParseKey,type FilePreview} from '@/lib/fileJobDraft';
import {FileJobPanel,FileProblem} from './FileJobs';
const initialSpec:FileParseSpec={version:'file_input_v1',format:'csv',delimiter:',',sheet:'',header_row:1,time_column:'',timestamp_layout:'rfc3339',timezone:'',well_column:null,well_identity:'',mappings:[]};
export function FileJobUpload({available=true}:{available?:boolean}){
 const auth=useAuth();const request=usePrivateFileRequest();const [search]=useSearchParams();
 const [well,setWell]=useState(search.get('well')??'');const [file,setFile]=useState<File>();const [spec,setSpec]=useState<FileParseSpec>(initialSpec);const [previewSnapshot,setPreviewSnapshot]=useState<{file:File;key:string;value:FilePreview}>();
 const [loading,setLoading]=useState(false);const [previewing,setPreviewing]=useState(false);const [error,setError]=useState<{message:string;http_request_id?:string}>();const [job,setJob]=useState<FileJobStatus>();
 const fileRef=useRef(file);const specRef=useRef(spec);specRef.current=spec;
 const preview=previewSnapshot&&previewSnapshot.file===file&&previewSnapshot.key===previewParseKey(spec)?previewSnapshot.value:undefined;
 const submission=useRef(new StableFileSubmission());const attemptFile=useRef<File>();const fileSequence=useRef(0);const inFlight=useRef(false);const alive=useRef(true);const summary=useRef<HTMLDivElement>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;fileSequence.current++;attemptFile.current=undefined;};},[]);
 function fail(message:string){setError({message});requestAnimationFrame(()=>summary.current?.focus());}
 function invalidatePreview(){fileSequence.current++;setPreviewSnapshot(undefined);setPreviewing(false);setError(undefined);}
 function choose(candidate:File){if(!available||!auth.can('filechecks.run')||inFlight.current)return false;if(!/\.(csv|xlsx)$/i.test(candidate.name)){fail('Выберите CSV или XLSX.');return false;}if(candidate.size>20*1024*1024){fail('Размер файла превышает 20 МБ.');return false;}
  fileRef.current=candidate;setFile(candidate);invalidatePreview();patch({format:/\.xlsx$/i.test(candidate.name)?'xlsx':'csv',delimiter:/\.xlsx$/i.test(candidate.name)?'':',',sheet:'',time_column:'',mappings:[]});return false;
 }
 async function inspect(){
  if(!available||!auth.can('filechecks.run')||!file||previewing)return;
  const capturedFile=file,capturedSpec=spec,key=previewParseKey(capturedSpec);
  const sequence=++fileSequence.current;const ticket=auth.capturePrivate();
  const current=()=>alive.current&&ticket.current()&&sequence===fileSequence.current&&fileRef.current===capturedFile&&previewParseKey(specRef.current)===key;
  setPreviewing(true);setError(undefined);
  try{
   const next=await previewFile(capturedFile,capturedSpec);if(!current())return;
   const resolved=capturedSpec.format==='xlsx'&&!capturedSpec.sheet?{...specRef.current,sheet:next.sheets[0]}:specRef.current;
   specRef.current=resolved;setSpec(resolved);
   setPreviewSnapshot({file:capturedFile,key:previewParseKey(resolved),value:next});setPreviewing(false);
  }catch(problem){if(current()){fail(problem instanceof Error?problem.message:'Не удалось прочитать файл.');setPreviewing(false);}}
 }
 function patch(value:Partial<FileParseSpec>){
  const next={...specRef.current,...value};
  if(previewParseKey(next)!==previewParseKey(specRef.current)){
   invalidatePreview();next.time_column='';next.well_column=null;next.well_identity='';next.mappings=[];
  }
  specRef.current=next;setSpec(next);
 }
 function map(field:string,value:Partial<FileMapping>){
  const current=specRef.current;const old=current.mappings.find(m=>m.field===field)??{field,parameter:'',unit:'',scale:1,offset:0,missing:'',is_set:false};
  patch({mappings:[...current.mappings.filter(m=>m.field!==field),{...old,...value}]});
 }
 async function submit(){if(!auth.can('filechecks.run')||!available||!file||inFlight.current||previewing)return;const validation=validateFileDraft(well,file,spec);if(validation){fail(validation);return;}if(!preview||!previewSnapshot||previewSnapshot.file!==fileRef.current||previewSnapshot.key!==previewParseKey(specRef.current)){fail('Сначала откройте локальный просмотр и проверьте колонки.');return;}
  if(attemptFile.current&&attemptFile.current!==file){fail('Для другого файла начните новую операцию явно.');return;}attemptFile.current=file;
  const ticket=auth.capturePrivate();inFlight.current=true;setLoading(true);setError(undefined);
  try{const accepted=await submission.current.submit(JSON.stringify({well,spec}),key=>request(signal=>fileJobsApi.submit(well,file,spec,key,signal)));if(accepted&&alive.current&&ticket.current())setJob(accepted);}
  catch(problem){if(alive.current&&ticket.current()){if(problem instanceof Error&&problem.message==='new_operation_required')fail('Настройки операции изменились. Для нового запуска нажмите «Начать новую операцию».');else{setError(fileProblem(problem));requestAnimationFrame(()=>summary.current?.focus());}}}
  finally{inFlight.current=false;if(alive.current&&ticket.current())setLoading(false);}
 }
 const disabled=loading||!!job||!available||!auth.can('filechecks.run');
 const uploadProps={accept:'.csv,.xlsx',multiple:false,showUploadList:false,disabled,beforeUpload:choose};
 return <div className="pulse-stack pulse-monitoring-page pulse-monitoring-file">
  <div className="pulse-page-heading pulse-toolbar"><div><h1>Проверка телеметрии</h1><p>Сохранённая проверка · только разрешённые синтетические файлы</p></div><Upload {...uploadProps}><Button type="primary" disabled={disabled}>Выбрать файл</Button></Upload></div>
  {!available&&<Alert type="warning" message="Сохранённая проверка сейчас недоступна. Ваш файл и настройки остаются в черновике текущего сеанса."/>}
  <Alert type="info" message="Синтетический пилот" description="Одна скважина Pulse · CSV/XLSX · до 20 МБ и 100 000 строк. Это проверка файла, без импорта телеметрии в фонд."/>
  <div className="pulse-monitoring-upload-grid">
   <Card className="pulse-monitoring-upload-card"><h2>Архив телеметрии</h2><Upload.Dragger {...uploadProps}><div className="pulse-monitoring-drop-content"><strong>{file?.name??'Перетащите файл сюда'}</strong><p>или выберите файл на компьютере</p><span className="pulse-monitoring-file-choice">Выбрать файл</span></div></Upload.Dragger>
    <label className="pulse-stack">ID Pulse одной скважины<Input aria-label="ID Pulse одной скважины" inputMode="numeric" value={well} disabled={disabled} onChange={e=>setWell(e.target.value)}/></label>
   </Card>
   <Card className="pulse-monitoring-requirements"><h2>Настройки чтения</h2><div className="pulse-stack">
    {spec.format==='csv'?<label>Разделитель<Select aria-label="Разделитель" value={spec.delimiter} disabled={disabled} style={{width:'100%'}} options={[{value:',',label:'Запятая'},{value:';',label:'Точка с запятой'},{value:'\t',label:'Табуляция'}]} onChange={delimiter=>patch({delimiter})}/></label>:<label>Лист<Input aria-label="Лист XLSX" value={spec.sheet} disabled={disabled} placeholder="Название листа; просмотр покажет доступные" onChange={e=>patch({sheet:e.target.value})}/></label>}
    <label>Строка заголовка<InputNumber aria-label="Строка заголовка" min={1} max={100} value={spec.header_row} disabled={disabled} onChange={value=>patch({header_row:value??1})}/></label>
    <label>Часовой пояс IANA<Input aria-label="Часовой пояс IANA" value={spec.timezone} disabled={disabled} placeholder="Например, Europe/Moscow" onChange={e=>patch({timezone:e.target.value})}/></label>
    <label>Формат времени<Select aria-label="Формат времени" style={{width:'100%'}} value={spec.timestamp_layout} disabled={disabled} options={['rfc3339','2006-01-02 15:04:05','2006-01-02','02.01.2006 15:04:05',...(spec.format==='xlsx'?['excel_serial']:[])].map(value=>({value,label:value}))} onChange={timestamp_layout=>patch({timestamp_layout})}/></label>
    <Button onClick={inspect} disabled={!file||disabled} loading={previewing}>Просмотреть колонки</Button>
   </div></Card>
  </div>
  {preview&&<Card title="Локальный просмотр — не результат модели"><div className="pulse-stack">
   <p>{preview.total} строк. Показаны первые {preview.rows.length}. {spec.format==='xlsx'?`Листы: ${preview.sheets.join(', ')}`:''}</p>
   <label>Колонка времени<Select aria-label="Колонка времени" style={{width:'100%'}} value={spec.time_column||undefined} disabled={disabled} options={preview.columns.map(value=>({value,label:value}))} onChange={time_column=>patch({time_column,mappings:spec.mappings.filter(m=>m.field!==time_column)})}/></label>
   <label>Колонка идентификатора скважины<Select aria-label="Колонка идентификатора скважины" allowClear style={{width:'100%'}} disabled={disabled} value={spec.well_column??undefined} options={preview.columns.filter(v=>v!==spec.time_column).map(value=>({value,label:value}))} onChange={value=>patch({well_column:value??null,well_identity:value?'pulse':'',mappings:spec.mappings.filter(m=>m.field!==value)})}/></label>
   {spec.well_column&&<label>Тип идентификатора<Select aria-label="Тип идентификатора" value={spec.well_identity} disabled={disabled} options={['pulse','unitek','armits'].map(value=>({value,label:value}))} onChange={well_identity=>patch({well_identity})}/></label>}
   <Table rowKey="field" size="small" pagination={false} scroll={{x:1050}} dataSource={preview.columns.filter(field=>field!==spec.time_column&&field!==spec.well_column).map(field=>spec.mappings.find(m=>m.field===field)??{field,parameter:'',unit:'',scale:1,offset:0,missing:'',is_set:false})} columns={[
    {title:'Колонка',dataIndex:'field'},{title:'Канал схемы (пусто — пропустить)',render:(_,m)=><Input aria-label={`Канал ${m.field}`} value={m.parameter} disabled={disabled} onChange={e=>{if(!e.target.value)patch({mappings:spec.mappings.filter(v=>v.field!==m.field)});else map(m.field,{parameter:e.target.value});}}/>},
    {title:'Единица',render:(_,m)=><Input aria-label={`Единица ${m.field}`} disabled={disabled} value={m.unit} onChange={e=>map(m.field,{unit:e.target.value})}/>},
    {title:'Множитель',render:(_,m)=><InputNumber aria-label={`Множитель ${m.field}`} disabled={disabled} value={m.scale} onChange={value=>map(m.field,{scale:value??1})}/>},
    {title:'Смещение',render:(_,m)=><InputNumber aria-label={`Смещение ${m.field}`} disabled={disabled} value={m.offset} onChange={value=>map(m.field,{offset:value??0})}/>},
    {title:'Маркер пропуска',render:(_,m)=><Input aria-label={`Маркер ${m.field}`} disabled={disabled} value={m.missing} onChange={e=>map(m.field,{missing:e.target.value})}/>},
    {title:'Уставка',render:(_,m)=><Checkbox aria-label={`Уставка ${m.field}`} disabled={disabled} checked={m.is_set} onChange={e=>map(m.field,{is_set:e.target.checked})}/>},
   ]}/>
   <Table rowKey={(_,index)=>String(index)} size="small" pagination={false} scroll={{x:620}} dataSource={preview.rows} columns={preview.columns.map((title,index)=>({title,key:String(index),render:(_,row)=>row[index]??''}))}/>
  </div></Card>}
  <Space wrap><Button type="primary" onClick={submit} disabled={!file||!preview||disabled||previewing} loading={loading}>Отправить проверку</Button><Button disabled={loading} onClick={()=>{submission.current.reset();attemptFile.current=undefined;setJob(undefined);setError(undefined);}}>Начать новую операцию</Button></Space>
  {loading&&<div role="status" aria-live="polite" aria-atomic="true"><Spin/> Отправка проверки. Принятие ещё не подтверждено.</div>}
  {error&&<div ref={summary} tabIndex={-1}><FileProblem problem={error}/></div>}
  {job&&<FileJobPanel key={job.id} well={well} job={job.id} initial={job}/>}
 </div>;
}
