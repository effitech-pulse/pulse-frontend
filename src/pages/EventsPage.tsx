import {EventFeedback} from '@/components/events/EventDetailView';
import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
import {Component,useEffect,useRef,type ReactNode,type RefObject} from 'react';
import {Link,useLocation} from 'react-router-dom';
import type {EventSummary} from '@/api/events';
import {useAuth} from '@/auth/AuthProvider';
import {EVENT_TITLES,EVENT_TYPES,buildEventURL,legacyEventsTableQuery,eventActorCopy,eventVerdictCopy,formatEventTime,reviewConclusionCopy,reviewStatusCopy} from '@/lib/events';
import '@/styles/events.css';

const FOOTER='История сохранённых проверок, заключений и изменений карточек; не полный аудит';
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

export function EventsPage(){
 const location=useLocation(),auth=useAuth();const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();},[location.pathname]);
 let initialQuery:import('@/lib/tableQuery').TableQuery={version:1,sort:[],filters:[]};
 try{initialQuery=legacyEventsTableQuery(new URLSearchParams(location.search));
 }catch{return <section className="pulse-events-page"><h1>История событий</h1><EventFeedback context="list" error={{isAxiosError:true,response:{status:422,data:{code:'validation_error'}}}}/></section>;}
 return <section className="pulse-events-page" aria-label="История событий"><h1 ref={heading} tabIndex={-1}>История событий</h1>
 <ServerEntityTable<EventSummary> tableKey="events" initialQuery={initialQuery} renderError={(error,retry)=><EventFeedback context="list" error={error} onRetry={()=>retry()}/>} enabled={auth.canAny(['checks.read'],['alerts.read'],['wells.history.read'])} rowKey="event_id" scroll={{x:1400}} read={(q,s)=>getTablePage('/api/v1/events',q,s)}
 fields={[
 {key:'event_type',label:'Тип события',kind:'enum',options:EVENT_TYPES.map(value=>({value,label:EVENT_TITLES[value]})),read:r=>r.event_type},
 {key:'well_id',label:'ID Pulse',column:'Скважина',kind:'pulseId',read:r=>r.well.id},{key:'well_number',label:'№ скважины',column:'Скважина',primary:true,kind:'text',read:r=>r.well.well_number},
 {key:'archive',label:'Карточка сейчас',kind:'enum',options:[{value:'current',label:'Вне архива'},{value:'archived',label:'В архиве'}],read:r=>r.well.archived_at?'archived':'current'},
 {key:'occurred_at',label:'Время события · UTC',kind:'datetime',read:r=>r.occurred_at},
 {key:'actor_name',label:'Имя автора',column:'Автор',primary:true,kind:'text',read:r=>r.actor.name},{key:'actor_kind',label:'Тип автора',column:'Автор',kind:'enum',options:['person','shared','service','unknown'].map(value=>({value,label:({person:'Сотрудник',shared:'Общий доступ',service:'Сервис',unknown:'Неизвестно'} as Record<string,string>)[value]})),read:r=>r.actor.kind},
 {key:'verdict',label:'Заключение модели',column:'Результат',primary:true,kind:'enum',options:[...['norm','watch','alert','insufficient','unknown'].map(value=>({value,label:eventVerdictCopy(value)})),{value:null,label:'Не указано'}],read:r=>r.outcome.verdict},
 {key:'review_status',label:'Статус рассмотрения',column:'Результат',kind:'enum',options:['new','in_progress','closed','unknown'].map(value=>({value,label:reviewStatusCopy(value)})),read:r=>r.outcome.review_status},
 {key:'conclusion',label:'Заключение технолога',column:'Результат',kind:'enum',options:['confirmed','not_confirmed','inconclusive','unknown'].map(value=>({value,label:reviewConclusionCopy(value)})),read:r=>r.outcome.conclusion},
 ]}
 columns={[{title:'Тип события',render:(_,r)=>EVENT_TITLES[r.event_type]},{title:'Скважина',render:(_,r)=><>№ {r.well.well_number??'—'}<small className="pulse-cell-meta">ID Pulse {r.well.id}</small></>},
 {title:'Карточка сейчас',render:(_,r)=>r.well.archived_at?'В архиве':'Вне архива'},
 {title:'Время события · UTC',render:(_,r)=>formatEventTime(r.occurred_at)},
 {title:'Автор',render:(_,r)=>eventActorCopy(r.actor)},
 {title:'Результат',render:(_,r)=><>{eventVerdictCopy(r.outcome.verdict)}<small className="pulse-cell-meta">{reviewStatusCopy(r.outcome.review_status)} · {reviewConclusionCopy(r.outcome.conclusion)}</small></>},
 {title:'Действие',render:(_,r)=><Link id={`event-${r.event_id}`} to={buildEventURL(r.event_id,'spa')} state={{eventReturn:{search:location.search,epoch:auth.privateEpoch}}}>Открыть событие</Link>},
 ]}/><p className="pulse-event-footnote">{FOOTER}</p></section>;
}
