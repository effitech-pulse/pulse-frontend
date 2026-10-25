/** Календарные даты суточного источника: форматируем без преобразования в timestamp. */
export type DailyPeriod = 7 | 30 | 90;
export interface DailyQuery {start_date?:string;end_date?:string;dataset_version?:string}
export interface DailyRow {date:string;actual:number|null;expected:number|null;delta:number|null;delta_percent:number|null;record_state:'present'|'missing_day';comparison_status:'paired'|'zero_expected'|'missing_actual'|'missing_expected'|'missing_both'}
export interface DailyFlowView {
 enabled:true;schema_version:'daily-flow-v1';well_id:string;start_date:string;end_date:string;calendar_timezone:'Europe/Moscow';quantity:'liquid_rate';unit:'m3/day';dataset_version:string;view_id:string;
 source:{kind:'test_generated';synthetic:true;label:string;expected_definition:'synthetic_reference';scenario_code:string;recipe_version:string;manifest_sha256:string;dataset_sha256:string};
 available:{start_date:string;end_date:string};coverage:{calendar_days:number;recorded_days:number;actual_days:number;expected_days:number;paired_days:number;comparable_percent_days:number};rows:DailyRow[];
}
export type DailyFlowResult=DailyFlowView|{enabled:false;reason:'disabled'};
const iso=/^\d{4}-\d{2}-\d{2}$/;
function dateStamp(value:unknown):number {
 if(typeof value!=='string'||!iso.test(value))throw Error('Некорректная дата суточного дебита');
 const stamp=Date.parse(`${value}T00:00:00Z`);
 if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==value)throw Error('Некорректная дата суточного дебита');
 return stamp;
}
export function dailyRange(end:string,days:DailyPeriod){return {start_date:new Date(dateStamp(end)-(days-1)*86400000).toISOString().slice(0,10),end_date:end};}
export const dailyDate=(value:string)=>value.split('-').reverse().join('.');
export function dailyNumber(value:number|null,signed=false):string {return value===null?'—':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:signed?'exceptZero':'auto'}).format(value);}
export function lastDailyRow(view:DailyFlowView):DailyRow {return view.rows[view.rows.length-1];}
export function validateDailyFlow(value:unknown,wellId:string,query:DailyQuery={}):DailyFlowResult {
 const invalid=()=>{throw Error('Некорректный ответ суточного дебита. Повторите запрос.');};
 if(!value||typeof value!=='object')return invalid();
 const enabled=(value as {enabled?:unknown}).enabled;
 const v=value as DailyFlowView;
 if(enabled===false) {if((value as {reason?:string}).reason==='disabled')return {enabled:false,reason:'disabled'};return invalid();}
 if(v.enabled!==true||v.schema_version!=='daily-flow-v1'||v.well_id!==wellId||typeof v.well_id!=='string'||v.calendar_timezone!=='Europe/Moscow'||v.quantity!=='liquid_rate'||v.unit!=='m3/day')return invalid();
 const start=dateStamp(v.start_date),end=dateStamp(v.end_date),n=(end-start)/86400000+1;
 if(n<1||n>90||!Number.isInteger(n)||!v.available||start<dateStamp(v.available.start_date)||end>dateStamp(v.available.end_date))return invalid();
 if((query.start_date&&query.start_date!==v.start_date)||(query.end_date&&query.end_date!==v.end_date)||(query.dataset_version&&query.dataset_version!==v.dataset_version))return invalid();
 if(typeof v.dataset_version!=='string'||!v.dataset_version.length||v.dataset_version.length>128||typeof v.view_id!=='string'||!/^[a-f0-9]{64}$/.test(v.view_id))return invalid();
 const s=v.source;
 if(!s||s.kind!=='test_generated'||s.synthetic!==true||s.expected_definition!=='synthetic_reference'||![s.label,s.scenario_code,s.recipe_version].every(x=>typeof x==='string'&&x.length>0&&x.length<=256)||![s.manifest_sha256,s.dataset_sha256].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))return invalid();
 if(!v.coverage||v.coverage.calendar_days!==n||!['recorded_days','actual_days','expected_days','paired_days','comparable_percent_days'].every(k=>{const x=v.coverage[k as keyof DailyFlowView['coverage']];return Number.isInteger(x)&&x>=0&&x<=n;}))return invalid();
 if(!Array.isArray(v.rows)||v.rows.length!==n)return invalid();
 for(let i=0;i<n;i++) {const r=v.rows[i];if(!r||dateStamp(r.date)!==start+i*86400000||!['present','missing_day'].includes(r.record_state)||!['paired','zero_expected','missing_actual','missing_expected','missing_both'].includes(r.comparison_status)||!['actual','expected','delta','delta_percent'].every(k=>{const x=r[k as keyof DailyRow];return x===null||(typeof x==='number'&&Number.isFinite(x));}))return invalid();}
 return v;
}
export function dailySettings(search:URLSearchParams):{mode:'daily'|'parameters';period:DailyPeriod}{const p=search.get('daily_period');return {mode:search.get('daily_mode')==='daily'?'daily':'parameters',period:p==='7'?7:p==='90'?90:30};}
export function dailySearch(search:URLSearchParams,settings:{mode:'daily'|'parameters';period:DailyPeriod}){const next=new URLSearchParams(search);next.set('daily_mode',settings.mode);next.set('daily_period',String(settings.period));return next;}
export function dailySegments(rows:Pick<DailyRow,'actual'|'expected'>[],field:'actual'|'expected') {const segments:{index:number;value:number}[][]=[];let part:{index:number;value:number}[]=[];rows.forEach((row,index)=>{const value=row[field];if(value===null){if(part.length)segments.push(part);part=[];}else part.push({index,value});});if(part.length)segments.push(part);return segments;}
export const dailyStatus=(row:DailyRow):string=>row.record_state==='missing_day'?'Нет записи за день':({paired:'Оба значения есть',zero_expected:'Ожидание 0 · % не определён',missing_actual:'Нет факта',missing_expected:'Нет ожидания',missing_both:'Оба значения отсутствуют'}[row.comparison_status]);
/** Отдельная последовательность для read/export; cleanup отменяет даже transport, игнорирующий abort. */
export class DailyRequestScope {
 private sequence=0;private controller:AbortController|undefined;
 start(privateCurrent:()=>boolean){this.dispose();const sequence=this.sequence;const controller=new AbortController();this.controller=controller;return {signal:controller.signal,current:()=>!controller.signal.aborted&&sequence===this.sequence&&privateCurrent()};}
 dispose(){this.sequence++;this.controller?.abort();this.controller=undefined;}
}
interface DownloadEnvironment {create:(blob:Blob)=>string;revoke:(url:string)=>void;click:(url:string,filename:string)=>void}
const browserDownload:DownloadEnvironment={create:blob=>URL.createObjectURL(blob),revoke:url=>URL.revokeObjectURL(url),click:(url,filename)=>{const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);try{a.click();}finally{a.remove();}}};
export function downloadDailyBlob(blob:Blob,filename:string,current:()=>boolean,env:DownloadEnvironment=browserDownload):boolean {if(!current())return false;const url=env.create(blob);try{if(!current())return false;env.click(url,filename);return true;}finally{env.revoke(url);}}
