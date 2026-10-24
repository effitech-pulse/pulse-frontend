import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
import {Alert,Button,Card,Drawer,Empty,Space,Spin,Typography} from 'antd';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '@/auth/AuthProvider';
import {fileJobsApi,type FileJobStatus} from '@/api/fileJobs';
import {fileJobStates,parseFileCheckLink,fileJobStatusReason} from '@/lib/fileJobs';
import {fileProblem,useFileCapabilities,useFileJobStatus,usePrivateFileRequest} from '@/hooks/useFileJobs';
import {SavedFileCheckResult} from './FileJobResult';

export function FileJobPanel({well,job,initial}:{well:string;job:string;initial?:FileJobStatus}){
 const auth=useAuth();const request=usePrivateFileRequest();const {status,error,reload}=useFileJobStatus(well,job,initial);
 const [actionError,setActionError]=useState<ReturnType<typeof fileProblem>>();const [cancelling,setCancelling]=useState(false);const cancellingRef=useRef(false);const statusRegion=useRef<HTMLDivElement>(null);
 const statusReason=status?fileJobStatusReason(status.state,status.error_code):null;
 const result=useQuery({queryKey:['file-result',auth.privateEpoch,well,job],enabled:auth.can('filechecks.read')&&status?.state==='succeeded'&&!auth.privateBlocked,retry:false,queryFn:({signal})=>request(s=>fileJobsApi.result(well,job,s),signal)});
 useEffect(()=>{if(result.isError)reload();},[result.isError,reload]);
 async function cancel(){if(!auth.can('filechecks.cancel')||!status||cancellingRef.current)return;const ticket=auth.capturePrivate();cancellingRef.current=true;setCancelling(true);setActionError(undefined);
  try{await request(signal=>fileJobsApi.cancel(well,job,status.revision,signal));if(ticket.current()){statusRegion.current?.focus();reload();}}
  catch(problem){if(ticket.current()){setActionError(fileProblem(problem));reload();}}
  finally{cancellingRef.current=false;if(ticket.current())setCancelling(false);}
 }
 if(auth.privateBlocked)return <Alert type="warning" message="Проверка недоступна"/>;
 return <div className="pulse-stack">
  <Card><div ref={statusRegion} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true">{status?fileJobStates[status.state]:'Загрузка состояния проверки…'}</div>
   {status&&<><p>Попытка {status.attempt} из {status.max_attempts}. Процент выполнения недоступен.</p><p>Можно закрыть браузер. Это не отменяет принятую проверку.</p>
    {status.next_attempt_at&&<p>Повтор не ранее: {status.next_attempt_at}</p>}
    {statusReason&&<p>{statusReason}</p>}
   </>}
   <Space wrap><Button onClick={reload}>Обновить состояние</Button>{auth.can('filechecks.cancel')&&status?.cancel_url&&status.state!=='cancel_requested'&&<Button onClick={cancel} loading={cancelling}>Отменить проверку</Button>}
    {status?.state==='succeeded'&&status.check_id&&<Link to={`/wells/${well}?tab=checks&check=${encodeURIComponent(status.check_id)}`}>Открыть в карточке</Link>}
   </Space>
  </Card>
  {(error||actionError)&&<FileProblem problem={actionError??error!}/>}
  {status?.state==='succeeded'&&result.isLoading&&<Spin/>}
  {result.isError&&<FileProblem problem={fileProblem(result.error)} onRetry={()=>{void result.refetch();reload();}}/>}
  {result.data&&<SavedFileCheckResult check={result.data.check}/>}
 </div>;
}
export function FileProblem({problem,onRetry}:{problem:{message:string;http_request_id?:string};onRetry?:()=>void}){
 return <div><Alert type="error" message={problem.message} action={onRetry?<Button onClick={onRetry}>Повторить</Button>:undefined}/>{problem.http_request_id&&<p className="pulse-error-reference">Код обращения: {problem.http_request_id}</p>}</div>;
}
export function FileJobsHistory({wellId}:{wellId:string}){
 const auth=useAuth();const capability=useFileCapabilities();const request=usePrivateFileRequest();const [search,setSearch]=useSearchParams();
 const [selected,setSelected]=useState<string>();const link=parseFileCheckLink(search.get('check'));const job=link.kind==='file'?link.id:selected;
 function close(){setSelected(undefined);if(link.kind==='file')setSearch(p=>{p.delete('check');return p;});}
 if(auth.privateBlocked)return <Alert type="warning" message="Проверка недоступна"/>;
 if(!auth.can('filechecks.read')||auth.mode!=='local')return null;
 return <section className="pulse-stack" aria-label="Мои проверки файлов"><h2>Мои проверки файлов</h2>
  {capability.enabled?<>
   {auth.can('filechecks.run')&&<Link to={`/upload-check?well=${wellId}`}>Новая проверка синтетического файла</Link>}
   <ServerEntityTable<FileJobStatus> tableKey={`file-jobs-${wellId}`} enabled={capability.enabled} read={(q,s)=>request(signal=>getTablePage(`/api/v1/wells/${wellId}/file-check-jobs`,q,signal),s)}
 fields={[{key:'created_at',label:'Проверка',kind:'datetime',read:r=>r.created_at},{key:'state',label:'Состояние',kind:'enum',options:Object.entries(fileJobStates).map(([value,label])=>({value,label})),read:r=>r.state},{key:'model_name',label:'Модель',kind:'text',read:r=>r.execution.model_name}]} rowKey="id" scroll={{x:620}} locale={{emptyText:<Empty description="У вас пока нет сохранённых проверок файлов"/>}} columns={[
    {title:'Проверка',dataIndex:'created_at',render:(value,row)=><Button type="link" onClick={()=>{if(row.state==='succeeded'&&row.check_id)setSearch(p=>{p.set('check',row.check_id!);return p;});else setSelected(row.id);}}>{new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} МСК</Button>},
    {title:'Состояние',dataIndex:'state',render:value=>fileJobStates[value]??'Состояние не передано'},{title:'Модель',render:(_,row)=>row.execution.model_name||'Не передана'},
   ]}/>
  </>:<Typography.Text type="secondary">Сохранённая проверка файлов сейчас недоступна.</Typography.Text>}
  <Drawer title={`Проверка файла · ID Pulse ${wellId}`} open={!!job&&search.get('tab')==='checks'} onClose={close} destroyOnClose width={960}>{job&&<FileJobPanel key={`${wellId}/${job}`} well={wellId} job={job}/>}</Drawer>
 </section>;
}
