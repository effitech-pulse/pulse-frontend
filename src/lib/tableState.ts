import {createEmptyTableQuery, validateTableFilter} from './tableQuery.ts';
import type {FieldSchema, TableFilter, TableQuery, TableSort} from './tableQuery.ts';
export interface TableState {query:TableQuery;page:number;pageSize:number;cursors:string[];revision?:string}
export function readTableState<T>(params:URLSearchParams,key:string,fields:FieldSchema<T>[],initial?:TableQuery):TableState {
 const empty:TableState={query:initial??createEmptyTableQuery(),page:1,pageSize:20,cursors:[]};
 try {
  const raw=JSON.parse(params.get(`table.${key}`)??'null');if(!raw||raw.query?.version!==1)return empty;
  const seen=new Set<string>();
  const sort:TableSort[]=(Array.isArray(raw.query.sort)?raw.query.sort:[]).filter((s:TableSort)=>{if(!s||!fields.some(f=>f.key===s.field)||!['asc','desc'].includes(s.direction)||seen.has(s.field))return false;seen.add(s.field);return true;});
  const filters:TableFilter[]=(Array.isArray(raw.query.filters)?raw.query.filters:[]).filter((f:TableFilter)=>{
   if(!f||!['contains','in','range','overlap'].includes(f.op))return false;
   if(f.op==='contains'&&(typeof f.value!=='string'||Array.from(f.value).length>120))return false;
   if(f.op==='in'&&(!Array.isArray(f.values)||f.values.length>100||f.values.some(v=>v!==null&&!['string','number','boolean'].includes(typeof v))))return false;
   const field=fields.find(field=>field.key===f.field);return field&&validateTableFilter(field,f);
  });
  return {query:{version:1,sort,filters},page:Number.isInteger(raw.page)&&raw.page>0?raw.page:1,pageSize:Math.max(1,Math.min(100,Number(raw.pageSize)||20)),cursors:Array.isArray(raw.cursors)?raw.cursors.filter((v:unknown)=>typeof v==='string'&&v.length<=16384):[],...(typeof raw.revision==='string'?{revision:raw.revision}:{})};
 }catch{return empty;}
}
export function writeTableState(params:URLSearchParams,key:string,state:TableState):URLSearchParams {
 const next=new URLSearchParams(params);next.set(`table.${key}`,JSON.stringify(state));return next;
}
