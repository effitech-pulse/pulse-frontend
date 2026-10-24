import {useEffect,useRef} from 'react';
import {Link,useLocation,useParams} from 'react-router-dom';
import {useAuth} from '@/auth/AuthProvider';
import {useEvent} from '@/hooks/useEvents';
import {EventDetailView,EventFeedback,focusEventRetry} from '@/components/events/EventDetailView';
import {assertEventTarget,buildEventsURL,buildEventURL,buildWellEventURL,closeWellEventURL,EVENT_TITLES,eventSourceTab,parseEventFilters,selectEventDetail,validEventId,validEventWellId} from '@/lib/events';

export function EventDetailPage({wellMode=false}:{wellMode?:boolean}) {
 const params=useParams();const location=useLocation();const auth=useAuth();const renderTicket=auth.capturePrivate();
 const queryParams=new URLSearchParams(location.search);
 const eventId=wellMode?queryParams.get('event')??'':params.eventId??'';
 const wellId=params.wellId;
 let valid=validEventId(eventId)&&(!wellMode||(validEventWellId(wellId)&&queryParams.getAll('event').length===1));
 let closeTarget:string|undefined;
 try{
  assertEventTarget(location.pathname+location.search);buildEventURL(eventId,'api');
  if(wellMode){buildWellEventURL(wellId??'',eventId,'checks');closeTarget=closeWellEventURL(location.pathname,location.search,location.hash);}
 }catch{valid=false;}
 const query=useEvent(valid?eventId:'');const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();},[location.key]);
 const data=query.data&&valid&&query.data.event.event_id===eventId?selectEventDetail(query.data,wellMode?wellId:undefined):null;
 let sourceLink:string|undefined;
 if(data){try{sourceLink=buildWellEventURL(data.event.well.id,data.event.event_id,eventSourceTab(data));}catch{valid=false;}}
 const unavailable=!valid||!!query.data&&!data;
 const denied=auth.privateBlocked||!auth.principal;
 const returnInfo=location.state?.eventReturn;
 let returnSearch='';
 if(returnInfo?.epoch===auth.privateEpoch&&typeof returnInfo.search==='string'&&returnInfo.search){
  try{const target=buildEventsURL(parseEventFilters(new URLSearchParams(returnInfo.search)));returnSearch=target.slice(target.indexOf('?'));}catch{/* Invalid history state returns to the safe default list. */}
 }
 const back=<Link className="ant-btn ant-btn-default pulse-event-button" to={`/events${returnSearch}`} state={data?{focusEvent:data.event.event_id,eventEpoch:auth.privateEpoch}:undefined}>К истории событий</Link>;
 return <section className="pulse-events-page" aria-label="Сохранённое событие">
  {!wellMode&&back}
  <h1 ref={heading} tabIndex={-1}>{wellMode?'Основание в карточке':data&&!unavailable&&!query.isError&&!denied?EVENT_TITLES[data.event.event_type]:'Событие'}</h1>
  {wellMode&&(closeTarget?<Link className="ant-btn ant-btn-default pulse-event-button" to={closeTarget}>Закрыть основание</Link>:back)}
  {unavailable?<EventFeedback unavailable/>:denied?<EventFeedback error={{isAxiosError:true,response:{status:403}}}/>:query.isError?<EventFeedback error={query.error} onRetry={source=>{focusEventRetry(source,heading.current,renderTicket);void query.refetch();}}/>:query.isPending?<EventFeedback loading/>:data?<>
   <EventDetailView data={data}/>
   {!wellMode&&sourceLink&&<Link className="ant-btn ant-btn-default pulse-event-button" to={sourceLink}>Открыть основание в карточке</Link>}
   <p className="pulse-event-footnote">Сохранённое основание · Только чтение</p>
  </>:<EventFeedback unavailable/>}
 </section>;
}
