import {Component,useEffect,useRef,useState,type FormEvent,type ReactNode,type RefObject} from 'react';
import {Alert,Button,Card,Input,Select} from 'antd';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import axios from 'axios';
import type {EventFilters,EventSummary,EventType} from '@/api/events';
import {useAuth} from '@/auth/AuthProvider';
import {useEvents} from '@/hooks/useEvents';
import {EventFeedback,focusEventRetry} from '@/components/events/EventDetailView';
import {EVENT_TITLES,EVENT_TYPES,assertEventTarget,buildEventURL,buildEventsURL,eventActorCopy,eventErrorState,eventVerdictCopy,formatEventTime,normalizeEventFilters,parseEventFilters,reviewConclusionCopy,reviewStatusCopy} from '@/lib/events';
import '@/styles/events.css';

const FOOTER='История сохранённых проверок, заключений и изменений карточек; не полный аудит';
const searchFor=(filters:EventFilters)=>{const url=buildEventsURL(filters);return url.slice(url.indexOf('?'));};
interface AppendFocusProps {
 children:ReactNode;items:readonly EventSummary[];beforeCount:number|null;terminal:boolean;
 ticket:{current:()=>boolean};buttonRef:RefObject<HTMLButtonElement>;headingRef:RefObject<HTMLHeadingElement>;
}
interface AppendFocusSnapshot {button:HTMLButtonElement;ticket:AppendFocusProps['ticket']}
/** Snapshot is taken before React removes the focused terminal continuation control. */
export class EventAppendFocusBoundary extends Component<AppendFocusProps,Record<string,never>,AppendFocusSnapshot|null> {
 getSnapshotBeforeUpdate():AppendFocusSnapshot|null {
  const {terminal,beforeCount,items,ticket,buttonRef}=this.props;
  if(!terminal||beforeCount===null||items.length<beforeCount||!ticket.current())return null;
  const button=buttonRef.current;
  return button?.contains(document.activeElement)?{button,ticket}:null;
 }
 componentDidUpdate(_previous:AppendFocusProps,_state:Readonly<Record<string,never>>,snapshot:AppendFocusSnapshot|null) {
  if(!snapshot||!this.props.terminal||!snapshot.ticket.current()||snapshot.button.isConnected||document.activeElement!==document.body)return;
  for(const event of this.props.items.slice(this.props.beforeCount??this.props.items.length)){
   const target=document.getElementById(`event-${event.event_id}`);
   if(target instanceof HTMLAnchorElement&&target.hasAttribute('href')&&!target.hasAttribute('aria-disabled')){target.focus();return;}
  }
  this.props.headingRef.current?.focus();
 }
 render(){return this.props.children;}
}

function SummaryOutcome({event}:{event:EventSummary}) {
 return <>
  {event.event_type==='manual_check.saved.v1'?<p>{eventVerdictCopy(event.outcome.verdict)}</p>:event.event_type.startsWith('review.')?<p>{reviewStatusCopy(event.outcome.review_status)}{event.outcome.conclusion===null?'':` · ${reviewConclusionCopy(event.outcome.conclusion)}`}</p>:null}
  {event.target.revision!==null&&<p>Ревизия {event.target.revision}</p>}
 </>;
}
function EventCard({event}:{event:EventSummary}) {
 const location=useLocation(),navigate=useNavigate(),auth=useAuth();
 let target:string;
 try{target=buildEventURL(event.event_id,'spa');}catch{return <EventFeedback unavailable/>;}
 const actor=eventActorCopy(event.actor)+(event.actor.kind==='person'&&event.actor.name===null&&event.actor.id?` ${event.actor.id}`:'');
 return <Card className="pulse-event-card"><article className="pulse-event-stack" aria-label={EVENT_TITLES[event.event_type]}>
  <h2 className="pulse-event-title">{EVENT_TITLES[event.event_type]}</h2>
  <p>{event.well.well_number===null?'':`№ ${event.well.well_number} · `}ID Pulse: {event.well.id}</p>
  <div className="pulse-event-outcome"><SummaryOutcome event={event}/></div>
  <p className="pulse-event-muted">{formatEventTime(event.occurred_at).replace(/\.\d{6}(?= UTC$)/,'')} · {actor}</p>
  <Link id={`event-${event.event_id}`} className="ant-btn ant-btn-default pulse-event-button" to={target} state={{eventReturn:{search:location.search,epoch:auth.privateEpoch}}} onClick={click=>{
   if(click.button===0&&!click.metaKey&&!click.ctrlKey&&!click.shiftKey&&!click.altKey)navigate({pathname:location.pathname,search:location.search,hash:location.hash},{replace:true,state:{focusEvent:event.event_id,eventEpoch:auth.privateEpoch}});
  }}>Открыть событие</Link>
 </article></Card>;
}
function EventsList({filters}:{filters:EventFilters}) {
 const auth=useAuth(),location=useLocation(),navigate=useNavigate();const query=useEvents(filters);
 const [types,setTypes]=useState<readonly EventType[]>(filters.types?.length===6?[]:filters.types??[]);
 const [well,setWell]=useState(filters.well_id??''),[archive,setArchive]=useState(filters.archive??'all');
 const [from,setFrom]=useState(filters.from??''),[to,setTo]=useState(filters.to??'');
 const [validation,setValidation]=useState('');const heading=useRef<HTMLHeadingElement>(null),focusDone=useRef(false);
 const continuation=useRef<HTMLButtonElement>(null),appendFrom=useRef<number|null>(null);
 const renderTicket=auth.capturePrivate();
 const signature=buildEventsURL(filters),nondefault=signature!==buildEventsURL({});
 const errorStatus=axios.isAxiosError(query.error)?query.error.response?.status??0:0;
 const errorBody=axios.isAxiosError(query.error)?query.error.response?.data:undefined;
 const errorState=eventErrorState(errorStatus,errorBody);
 const privateFailure=query.isError&&[401,403,404].includes(errorStatus);
 const canShow=!!auth.principal&&!auth.privateBlocked&&!privateFailure;
 const pages=canShow?query.data?.pages:undefined;
 const items=pages?.flatMap(page=>page.items)??[];
 const restarting=query.isError&&errorState==='restart';
 useEffect(()=>{focusDone.current=false;heading.current?.focus();},[location.key]);
 useEffect(()=>{
  if(focusDone.current||query.isPending)return;
  const restored=location.state?.eventEpoch===auth.privateEpoch&&typeof location.state?.focusEvent==='string'?document.getElementById(`event-${location.state.focusEvent}`):null;
  if(restored instanceof HTMLAnchorElement)restored.focus();
  focusDone.current=true;
 },[location.key,query.isPending,items.length,auth.privateEpoch]);
 async function restart(source?:HTMLElement){appendFrom.current=null;if(source)focusEventRetry(source,heading.current,renderTicket);await query.restart();}
 function reset(){
  setTypes([]);setWell('');setArchive('all');setFrom('');setTo('');setValidation('');
  if(signature===buildEventsURL({}))void restart();else navigate({pathname:'/events',search:searchFor({})});
 }
 function apply(event:FormEvent){
  event.preventDefault();
  try{
   const next=normalizeEventFilters({...(types.length?{types}:{}),...(well?{well_id:well}:{}),archive,...(from?{from}:{}),...(to?{to}:{})});
   const nextSearch=searchFor(next);setValidation('');
   if(buildEventsURL(next)===signature)void restart();else navigate({pathname:'/events',search:nextSearch});
  }catch{setValidation('Проверьте условия поиска: ID Pulse, типы и период. Даты — RFC3339 с часовым поясом, С раньше До.');}
 }
 return <EventAppendFocusBoundary items={items} beforeCount={appendFrom.current} terminal={canShow&&query.isSuccess&&!query.isFetchingNextPage&&!query.hasNextPage} ticket={renderTicket} buttonRef={continuation} headingRef={heading}><section className="pulse-events-page" aria-label="История событий">
  <h1 ref={heading} tabIndex={-1}>История событий</h1>
  <Button className="pulse-event-button" onClick={()=>{void restart();}} disabled={query.isFetching}>Обновить</Button>
  <Card className="pulse-event-card"><form className="pulse-event-filters" onSubmit={apply} aria-label="Фильтры событий">
   <div className="pulse-event-filter-row">
    <div className="pulse-event-field"><label htmlFor="event-types">Тип события</label><Select id="event-types" mode="multiple" aria-label="Тип события" placeholder="Все типы" value={[...types]} onChange={setTypes} options={EVENT_TYPES.map(value=>({value,label:EVENT_TITLES[value]}))} allowClear/></div>
    <div className="pulse-event-field"><label htmlFor="event-well">ID Pulse</label><Input id="event-well" inputMode="numeric" autoComplete="off" placeholder="Не указан" value={well} onChange={event=>setWell(event.target.value)} aria-invalid={!!validation} aria-describedby={validation?'events-filter-error':undefined}/></div>
    <div className="pulse-event-field"><label htmlFor="event-archive">Карточка сейчас</label><Select id="event-archive" aria-label="Карточка сейчас" value={archive} onChange={setArchive} options={[{value:'all',label:'Все'},{value:'current',label:'Вне архива'},{value:'archived',label:'В архиве'}]}/></div>
   </div>
   <div className="pulse-event-filter-row pulse-event-period">
    <div className="pulse-event-field"><label htmlFor="event-from">С · UTC</label><Input id="event-from" placeholder="Не указано" title="RFC3339, например 2026-10-01T00:00:00.000000Z" value={from} onChange={event=>setFrom(event.target.value)} aria-invalid={!!validation} aria-describedby={validation?'events-filter-error':undefined}/></div>
    <div className="pulse-event-field"><label htmlFor="event-to">До · UTC, не включая</label><Input id="event-to" placeholder="Не указано" title="RFC3339, например 2026-10-22T00:00:00.000000Z" value={to} onChange={event=>setTo(event.target.value)} aria-invalid={!!validation} aria-describedby={validation?'events-filter-error':undefined}/></div>
   </div>
   {validation&&<Alert id="events-filter-error" role="alert" type="error" message={validation}/>}
   <div className="pulse-event-actions"><Button type="primary" htmlType="submit">Применить</Button><Button onClick={reset}>Сбросить</Button></div>
  </form></Card>
  {!canShow?<EventFeedback context="list" error={query.error??{isAxiosError:true,response:{status:403}}}/>:query.isPending?<EventFeedback context="list" loading/>:<>
   {items.length>0&&<div className="pulse-event-list">{items.map(event=><EventCard key={event.event_id} event={event}/>)}</div>}
   {query.isError?<EventFeedback context="list" error={query.error} continuation={query.isFetchNextPageError} onRetry={query.isFetchNextPageError?undefined:source=>{focusEventRetry(source,heading.current,renderTicket);void query.refetch();}} onRestart={items.length===0?source=>{void restart(source);}:undefined}/>:items.length===0?<Card className="pulse-event-card"><div className="pulse-event-stack"><p>Сохранённых событий в выбранных условиях нет</p>{nondefault&&<Button className="pulse-event-button" onClick={reset}>Сбросить фильтры</Button>}</div></Card>:null}
   {items.length>0&&<div className="pulse-event-continuation">
    {(query.hasNextPage||restarting)&&<Button id="events-continuation" ref={continuation} className="pulse-event-button" loading={query.isFetchingNextPage} disabled={query.isFetching&&!query.isFetchingNextPage} onClick={event=>{if(restarting){void restart(event.currentTarget);}else{appendFrom.current=items.length;void query.fetchNextPage({cancelRefetch:false});}}}>{restarting?'Обновить список':query.isFetchingNextPage?'Загрузка…':query.isFetchNextPageError?'Повторить загрузку':'Загрузить ещё'}</Button>}
    <span className="pulse-event-footnote" role="status" aria-live="polite" aria-atomic="true">Загружено {items.length}<span className="pulse-events-sr-only"> событий</span></span>
   </div>}
  </>}
  <p className="pulse-event-footnote">{FOOTER}</p>
 </section></EventAppendFocusBoundary>;
}
/** Invalid URL never starts a query and never enters an endless disabled loading state. */
export function EventsPage() {
 const location=useLocation(),navigate=useNavigate(),auth=useAuth();
 let filters:EventFilters;
 try{assertEventTarget(location.pathname+location.search);filters=parseEventFilters(new URLSearchParams(location.search));}catch{
  return <section className="pulse-events-page"><h1 tabIndex={-1} ref={node=>node?.focus()}>История событий</h1><EventFeedback context="list" error={{isAxiosError:true,response:{status:422,data:{code:'validation_error'}}}}/><Button className="pulse-event-button" onClick={()=>navigate('/events')}>Сбросить фильтры</Button></section>;
 }
 return <EventsList key={`${auth.privateEpoch}:${buildEventsURL(filters)}`} filters={filters}/>;
}
