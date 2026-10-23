import type {EventFilters, EventType, EventID, EventDetailResponse, EventSummary} from '../api/events.ts';

export const EVENT_TYPES:readonly EventType[] = [
 'manual_check.saved.v1','review.alert.recorded.v1','review.check.recorded.v1',
 'well.archived.v1','well.metadata_changed.v1','well.restored.v1',
];
const MAX_ID='9223372036854775807';
export function validEventWellId(value:unknown):value is string {
 return typeof value==='string' && /^[1-9][0-9]{0,18}$/.test(value) && (value.length<19 || value<=MAX_ID);
}
function invalid():never {throw new Error('invalid_events_request');}
function monthDays(year:number,month:number):number {return [31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1]??0;}
/** Normalize using calendar arithmetic, keeping the fractional source text intact. */
export function normalizeEventTimestamp(value:string):string {
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!match) return invalid();
 let year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]),zone=match[8];
 if(year<1||month<1||month>12||day<1||day>monthDays(year,month)||hour>23||minute>59||second>59)return invalid();
 let offset=0;
 if(zone!=='Z') {const h=Number(zone.slice(1,3)),m=Number(zone.slice(4,6));if(h>23||m>59)return invalid();offset=(h*60+m)*(zone[0]==='+'?1:-1);}
 let minutes=hour*60+minute-offset;
 if(minutes<0){minutes+=1440;day--;if(day<1){month--;if(month<1){month=12;year--;}day=monthDays(year,month);}}
 if(minutes>=1440){minutes-=1440;day++;if(day>monthDays(year,month)){day=1;month++;if(month>12){month=1;year++;}}}
 if(year<1||year>9999)return invalid();
 const pad=(n:number)=>String(n).padStart(2,'0');
 return `${String(year).padStart(4,'0')}-${pad(month)}-${pad(day)}T${pad(Math.floor(minutes/60))}:${pad(minutes%60)}:${pad(second)}.${(match[7]??'').padEnd(6,'0')}Z`;
}
export function normalizeEventFilters(filters:EventFilters):Required<Pick<EventFilters,'limit'|'types'|'archive'>>&EventFilters {
 if(Object.keys(filters).some(key=>!['limit','types','archive','well_id','from','to'].includes(key)))return invalid();
 const limit=filters.limit??25,archive=filters.archive??'all',types=filters.types??EVENT_TYPES;
 if(!Number.isInteger(limit)||limit<1||limit>100||!['all','current','archived'].includes(archive))return invalid();
 if(!Array.isArray(types)||types.length===0||new Set(types).size!==types.length||types.some(type=>!EVENT_TYPES.includes(type)))return invalid();
 if(filters.well_id!==undefined&&!validEventWellId(filters.well_id))return invalid();
 const from=filters.from===undefined?undefined:normalizeEventTimestamp(filters.from);
 const to=filters.to===undefined?undefined:normalizeEventTimestamp(filters.to);
 if(from!==undefined&&to!==undefined&&from>=to)return invalid();
 return {limit,archive,types:[...types].sort(),...(filters.well_id===undefined?{}:{well_id:filters.well_id}),...(from===undefined?{}:{from}),...(to===undefined?{}:{to})};
}
export function parseEventFilters(params:URLSearchParams):EventFilters {
 const filters:EventFilters={};const seen=new Set<string>();
 for(const [key,value] of params){
  if(seen.has(key))return invalid();seen.add(key);
  switch(key){
   case 'limit':if(!/^[1-9][0-9]*$/.test(value))return invalid();filters.limit=Number(value);break;
   case 'types':filters.types=value.split(',') as EventType[];break;
   case 'archive':filters.archive=value as EventFilters['archive'];break;
   case 'well_id':filters.well_id=value;break;
   case 'from':filters.from=value;break;
   case 'to':filters.to=value;break;
   default:return invalid();
  }
 }
 return normalizeEventFilters(filters);
}
export function assertEventTarget(target:string):string {
 if(!target.startsWith('/')||target.startsWith('//')||/[\s#\\]/.test(target)||new TextEncoder().encode(target).length>4096)return invalid();
 return target;
}
function validPrefix(prefix:string):string {
 if(!/^\/(?:[A-Za-z0-9._~-]+\/?)*$/.test(prefix)||prefix.includes('..'))return invalid();
 return prefix.replace(/\/$/,'');
}
function token(value:string):string {
 if(typeof value!=='string'||value.length<1||value.length>2048||!/^[A-Za-z0-9_-]+$/.test(value))return invalid();
 return value;
}
export function validEventId(value:unknown):value is EventID {
 return typeof value==='string'&&value.length<=2048&&/^e1\.[A-Za-z0-9_-]+$/.test(value);
}
export function buildEventsURL(filters:EventFilters,cursor?:string,prefix='/api/v1'):string {
 const normalized=normalizeEventFilters(filters);const params=new URLSearchParams();
 params.set('archive',normalized.archive);params.set('limit',String(normalized.limit));params.set('types',normalized.types.join(','));
 if(normalized.well_id!==undefined)params.set('well_id',normalized.well_id);
 if(normalized.from!==undefined)params.set('from',normalized.from);
 if(normalized.to!==undefined)params.set('to',normalized.to);
 if(cursor!==undefined)params.set('cursor',token(cursor));
 params.sort();return assertEventTarget(`${validPrefix(prefix)}/events?${params}`);
}
export function buildEventURL(eventId:EventID,kind:'api'|'spa',prefix='/api/v1'):string {
 if(!validEventId(eventId))return invalid();
 return assertEventTarget(`${kind==='api'?validPrefix(prefix):''}/events/${encodeURIComponent(eventId)}`);
}
export function buildWellEventURL(wellId:string,eventId:EventID,tab:'checks'|'history'):string {
 if(!validEventWellId(wellId)||!validEventId(eventId)||!['checks','history'].includes(tab))return invalid();
 const params=new URLSearchParams({event:eventId,tab});params.sort();
 return assertEventTarget(`/wells/${encodeURIComponent(wellId)}?${params}`);
}
export function selectEventDetail(data:EventDetailResponse,expectedWellId?:string):EventDetailResponse|null {
 return expectedWellId!==undefined&&data.event.well.id!==expectedWellId?null:data;
}
export function eventVerdictCopy(verdict:string|null):string {
 switch(verdict){case 'norm':return 'Норма';case 'watch':return 'Наблюдение';case 'alert':return 'Тревога';case 'insufficient':return 'Недостаточно данных';case null:return 'Результат не указан';default:return 'Результат не распознан';}
}
export function eventActorCopy(actor:EventSummary['actor']):string {
 if(actor.kind==='unknown')return 'Автор неизвестен';
 if(actor.kind==='shared')return 'Общий доступ';
 if(actor.kind==='service')return 'Сервис';
 return actor.name??'Пользователь';
}
export function eventErrorState(status:number,body?:{code?:string;detail?:unknown}):'unauthorized'|'unavailable'|'invalid'|'restart'|'retry' {
 if(status===401)return 'unauthorized';if(status===403||status===404)return 'unavailable';
 if(status===422)return body?.code==='validation_error'&&body.detail==='cursor_restart_required'?'restart':'invalid';
 return 'retry';
}
export function eventQueryKey(kind:'list'|'detail',privateEpoch:number,signature:string) {
 return ['events',privateEpoch,kind,signature] as const;
}
/** Ticket is captured by AuthProvider's existing PrivateEpoch, never a second auth layer. */
export async function guardEventRequest<T>(ticket:{current:()=>boolean},work:()=>Promise<T>,signal?:AbortSignal):Promise<T> {
 if(!ticket.current()||signal?.aborted)throw new DOMException('Old session','AbortError');
 const result=await work();
 if(!ticket.current()||signal?.aborted)throw new DOMException('Old session','AbortError');
 return result;
}

export const EVENT_TITLES:Record<EventType,string>={
 'manual_check.saved.v1':'Проверка сохранена',
 'review.check.recorded.v1':'Обработка проверки изменена',
 'review.alert.recorded.v1':'Обработка тревоги изменена',
 'well.metadata_changed.v1':'Карточка скважины изменена',
 'well.archived.v1':'Скважина архивирована',
 'well.restored.v1':'Скважина восстановлена',
};
export function eventSourceTab(data:EventDetailResponse):'checks'|'history' {
 return data.detail.kind==='check'||data.detail.kind==='review'&&data.detail.review_kind==='check'?'checks':'history';
}
export function closeWellEventURL(pathname:string,search:string,hash:string):string {
 const params=new URLSearchParams(search);params.delete('event');
 return assertEventTarget(`${pathname}${params.size?`?${params}`:''}`)+hash;
}
/** UTC source formatting keeps all microseconds, including on historical evidence. */
export function formatEventTime(value:string|null):string {
 if(value===null||value==='')return 'Не указано';
 const match=/^(\d{4})-(\d{2})-(\d{2})T(.+)Z$/.exec(value);
 return match?`${match[3]}.${match[2]}.${match[1]}, ${match[4]} UTC`:value;
}
export function reviewStatusCopy(value:string|null):string {
 return value===null||value===''?'Не указано':({new:'Новое',in_progress:'В работе',closed:'Закрыто'}[value]??'Статус не распознан');
}
export function reviewConclusionCopy(value:string|null):string {
 return value===null||value===''?'Не указано':({confirmed:'Подтверждено',not_confirmed:'Не подтверждено',inconclusive:'Недостаточно оснований'}[value]??'Заключение не распознано');
}
/** A masked object denial clears F3 evidence, without changing Q1/global auth. */
export async function purgeEventAccess(client:import('@tanstack/react-query').QueryClient,privateEpoch:number,error:Error,activeKey:readonly unknown[]):Promise<void> {
 const belongs=(key:readonly unknown[])=>key[0]==='events'&&key[1]===privateEpoch;
 const cancellation=client.cancelQueries({predicate:query=>belongs(query.queryKey)&&JSON.stringify(query.queryKey)!==JSON.stringify(activeKey)},{revert:false});
 for(const query of client.getQueryCache().getAll()){
  if(belongs(query.queryKey))query.setState({data:undefined,dataUpdatedAt:0,error,status:'error',fetchStatus:'idle'});
 }
 await cancellation;
}
