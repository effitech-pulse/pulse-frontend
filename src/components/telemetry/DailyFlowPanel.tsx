import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Radio,Tag} from 'antd';
import {useAuth} from '@/auth/AuthProvider';
import {readDailyFlow,exportDailyFlow} from '@/api/dailyFlow';
import {toApiError} from '@/api/client';
import {DailyRequestScope,dailyRange,dailyDate,dailyNumber,lastDailyRow,downloadDailyBlob,type DailyFlowResult,type DailyFlowView,type DailyPeriod} from '@/lib/dailyFlow';
import {DailyFlowChart} from './DailyFlowChart';
import {DailyFlowTable,DailyValue} from './DailyFlowTable';
import './dailyFlow.css';

export function DailyChoice<T extends string|number>({label,value,options,onChange,disabled=false}:{label:string;value:T;options:{value:T;label:string}[];onChange:(value:T)=>void;disabled?:boolean}) {
 return <div className="daily-choice-container" onKeyDown={e=>{if(disabled||!['Home','End','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const i=options.findIndex(o=>o.value===value);const index=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+options.length)%options.length;onChange(options[index].value);e.currentTarget.querySelectorAll<HTMLInputElement>('input')[index]?.focus();}}><Radio.Group className="daily-choice" aria-label={label} disabled={disabled} value={value} optionType="button" buttonStyle="solid" options={options} onChange={e=>onChange(e.target.value)}/></div>;
}
const statusOf=(error:unknown)=>(error as {response?:{status?:number}})?.response?.status;
interface Problem {kind:'read'|'denied'|'conflict'|'period';message:string}
export function DailyFlowPanel({wellId,period,active,onPeriod,onParameters}:{wellId:string;period:DailyPeriod;active:boolean;onPeriod:(period:DailyPeriod)=>void;onParameters:()=>void}) {
 const {privateEpoch,privateBlocked,can,capturePrivate}=useAuth();
 const [result,setResult]=useState<DailyFlowResult>();const [loadedIdentity,setLoadedIdentity]=useState('');const [loading,setLoading]=useState(true);const [problem,setProblem]=useState<Problem>();const [reload,setReload]=useState(0);
 const [refreshFocused,setRefreshFocused]=useState(false);
 const [exporting,setExporting]=useState(false);const [exportProblem,setExportProblem]=useState('');const [announcement,setAnnouncement]=useState('');
 const available=useRef<DailyFlowView['available']>();const requiresRefresh=useRef(false);const readScope=useRef(new DailyRequestScope());const exportScope=useRef(new DailyRequestScope());const notice=useRef<HTMLDivElement>(null);
 const identity=`${wellId}:${privateEpoch}:${period}:${reload}`;const latest=useRef(identity);latest.current=identity;const activeRef=useRef(active);activeRef.current=active;
 useEffect(()=>{
  const privateTicket=capturePrivate();const ticket=readScope.current.start(()=>privateTicket.current()&&latest.current===identity&&!privateBlocked);exportScope.current.dispose();setExporting(false);setExportProblem('');setAnnouncement('');setProblem(undefined);setResult(undefined);setLoading(true);
  if(privateBlocked||!can('telemetry.read')){setLoading(false);setProblem({kind:'denied',message:'Суточный дебит недоступен'});return()=>readScope.current.dispose();}
  if(requiresRefresh.current){setLoading(false);setProblem({kind:'conflict',message:'Данные изменились. Обновите экран'});return()=>{readScope.current.dispose();exportScope.current.dispose();};}
  async function read(){try {
   const query=available.current?dailyRange(available.current.end_date,period):{};
   let next=await readDailyFlow(wellId,query,ticket.signal);if(!ticket.current())return;
   if(next.enabled){available.current=next.available;const target=dailyRange(next.available.end_date,period);if(next.start_date!==target.start_date||next.end_date!==target.end_date){next=await readDailyFlow(wellId,target,ticket.signal);if(!ticket.current())return;}}
   setResult(next);setLoadedIdentity(identity);setAnnouncement(next.enabled?`Период ${dailyDate(next.start_date)} — ${dailyDate(next.end_date)} загружен`:'Суточный режим выключен');
  } catch(error){if(!ticket.current())return;const status=statusOf(error);setResult(undefined);if(status===401)return;if(status===403||status===404){available.current=undefined;setProblem({kind:'denied',message:'Суточный дебит недоступен'});}else if(status===409){requiresRefresh.current=true;setProblem({kind:'conflict',message:'Данные изменились. Обновите экран'});}else if(status===422)setProblem({kind:'period',message:'Недоступный период суточного дебита'});else setProblem({kind:'read',message:`Не удалось загрузить суточный дебит. ${toApiError(error).message}`});
  } finally{if(ticket.current())setLoading(false);}}
  void read();return()=>{readScope.current.dispose();exportScope.current.dispose();};
 },[wellId,privateEpoch,privateBlocked,period,reload]);
 useEffect(()=>{if(!active){exportScope.current.dispose();setExporting(false);}},[active]);
 useEffect(()=>{if(active&&problem?.kind==='denied')notice.current?.focus();},[active,problem?.kind]);
 function refresh(){requiresRefresh.current=false;available.current=undefined;setReload(n=>n+1);}
 async function download(){if(!result?.enabled||loadedIdentity!==identity||loading||exporting||problem?.kind==='conflict')return;const view=result;const privateTicket=capturePrivate();const ticket=exportScope.current.start(()=>privateTicket.current()&&latest.current===identity&&activeRef.current&&!privateBlocked);setExporting(true);setExportProblem('');setAnnouncement('');
  try {const blob=await exportDailyFlow(view,ticket.signal);if(!ticket.current())return;const filename=`pulse-${view.well_id}-daily-flow-${view.start_date}-${view.end_date}-TEST.xlsx`;if(downloadDailyBlob(blob,filename,ticket.current))setAnnouncement('Файл скачан');}
  catch(error){if(!ticket.current())return;const status=statusOf(error);if(status===401){setResult(undefined);available.current=undefined;}else if(status===403||status===404){setResult(undefined);available.current=undefined;setProblem({kind:'denied',message:'Суточный дебит недоступен'});}else if(status===409){requiresRefresh.current=true;setProblem({kind:'conflict',message:'Данные изменились. Обновите экран'});}else setExportProblem('Excel не удалось скачать');}
  finally{if(ticket.current())setExporting(false);}
 }
 if(!active)return null;
 const currentResult=loadedIdentity===identity&&!privateBlocked&&can('telemetry.read')?result:undefined;
 const view=currentResult?.enabled?currentResult:undefined;const last=view?lastDailyRow(view):undefined;
 return <div className="daily-flow" aria-busy={loading}>
  <div className="daily-heading"><h2>Суточный дебит жидкости</h2>{view&&<Tag color="blue" className="daily-test-tag">{view.source.label}</Tag>}</div>
  {view&&<><p>Ожидание — тестовый ориентир.</p><p className="daily-small">Доступно: {dailyDate(view.available.start_date)}–{dailyDate(view.available.end_date)} · Жидкость, м³/сут · Москва</p></>}
  <div className="daily-controls"><DailyChoice label="Период суточного дебита" value={period} disabled={problem?.kind==='conflict'} onChange={next=>{if(problem?.kind!=='conflict')onPeriod(next);}} options={[{value:7,label:'7 дней'},{value:30,label:'30 дней'},{value:90,label:'90 дней'}]}/><span className="daily-dates">{view?`${dailyDate(view.start_date)}–${dailyDate(view.end_date)}`:'—'}</span><Button data-action="export" aria-busy={exporting} onClick={download} loading={exporting} disabled={!view||loading||exporting||problem?.kind==='conflict'}>Экспорт Excel</Button></div>
  <div aria-live="polite" aria-atomic="true" className="daily-small">{loading?'Загрузка суточного дебита':announcement}</div>
  {(problem?.kind==='conflict'||refreshFocused)&&<Alert role={problem?.kind==='conflict'?'alert':'status'} type={problem?.kind==='conflict'?'warning':'success'} message={problem?.kind==='conflict'?problem.message:loading?'Обновление суточного дебита':'Данные обновлены'} description={problem?.kind==='conflict'&&view?'Показанный вид относится к прежней версии. Экспорт заблокирован до явного обновления.':undefined} action={<Button data-action="refresh" onFocus={()=>setRefreshFocused(true)} onBlur={()=>setRefreshFocused(false)} loading={loading} onClick={refresh}>Обновить данные</Button>}/>}
  {problem&&problem.kind!=='conflict'&&<div ref={notice} tabIndex={-1}><Alert role="alert" type="error" message={problem.message} description={problem.kind==='period'&&available.current?`Доступно: ${dailyDate(available.current.start_date)} — ${dailyDate(available.current.end_date)}`:undefined} action={problem.kind==='denied'?<Button onClick={onParameters}>К параметрам</Button>:problem.kind==='period'?<Button onClick={()=>{onPeriod(30);refresh();}}>Последние 30 дней</Button>:<Button onClick={refresh}>Повторить</Button>}/></div>}
  {currentResult?.enabled===false&&<Alert type="info" message="Суточный режим выключен" action={<Button onClick={onParameters}>К параметрам</Button>}/>}
  {exportProblem&&<Alert role="alert" type="error" message={exportProblem} action={<Button onClick={download} disabled={exporting}>Повторить экспорт</Button>}/>}
  {view&&last&&<>
   <section className="daily-panel daily-summary"><h3>Последний день · {dailyDate(view.end_date)} · м³/сут</h3><div className="daily-summary-values"><div><span>Факт</span><strong><DailyValue row={last} field="actual"/></strong></div><div><span>Ожидание</span><strong><DailyValue row={last} field="expected"/></strong></div><div><span>Отклонение</span><strong><DailyValue row={last} field="delta" signed/></strong><span aria-label={last.delta_percent===null?'Процент не определён':undefined}>{dailyNumber(last.delta_percent,true)}{last.delta_percent===null?'':'%'}</span></div></div>
    {last.actual===null&&<p className="daily-small">За {dailyDate(view.end_date).slice(0,5)} нет факта. Предыдущий день не подставляется.</p>}
    {last.comparison_status==='zero_expected'&&<p className="daily-small">Ожидание 0 · % не определён</p>}
   </section>
   {view.coverage.actual_days===0&&view.coverage.expected_days===0&&<Alert type="info" message="Нет суточных значений за выбранный период" description="Все даты показаны в таблице. Это не нулевой дебит. Экспорт доступен."/>}
   <DailyFlowChart key={view.view_id} view={view}/>
   <p className="daily-small">Сопоставимые факт/ожидание: {view.coverage.paired_days} из {view.coverage.calendar_days} дней · Процент: {view.coverage.comparable_percent_days} из {view.coverage.calendar_days}</p>
   <DailyFlowTable view={view}/><p className="daily-small">Excel повторяет показанный период и данные. Метаданные источника — в файле.</p>
  </>}
 </div>;
}
