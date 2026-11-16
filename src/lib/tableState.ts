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

const HISTORY_KEY='pulse.tables.v1';
export interface TableLocation {pathname:string;search:string;hash:string;state:unknown}
interface TableHistory {owner:string;tables:Record<string,unknown>}
function record(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function history(value:unknown,owner:string):TableHistory {
 const raw=record(record(value)[HISTORY_KEY]);
 return raw.owner===owner?{owner,tables:{...record(raw.tables)}}:{owner,tables:{}};
}
/** Import every URL key together; each table validates its own deferred entry. */
export function importTableLocation(location:TableLocation,owner:string):TableLocation {
 const params=new URLSearchParams(location.search),stored=history(location.state,owner);let changed=false;
 for(const [name,value] of params){if(!name.startsWith('table.'))continue;changed=true;try{stored.tables[name.slice(6)]=JSON.parse(value);}catch{stored.tables[name.slice(6)]=null;}}
 if(!changed)return location;
 for(const name of [...params.keys()])if(name.startsWith('table.'))params.delete(name);
 return {...location,search:params.size?`?${params}`:'',state:{...record(location.state),[HISTORY_KEY]:stored}};
}
export function readHistoryTableState<T>(value:unknown,key:string,fields:FieldSchema<T>[],owner:string,initial?:TableQuery):TableState {
 const params=new URLSearchParams();params.set(`table.${key}`,JSON.stringify(history(value,owner).tables[key]??null));
 return readTableState(params,key,fields,initial);
}
export function updateTableLocation(location:TableLocation,key:string,state:TableState,owner:string):TableLocation {
 const clean=importTableLocation(location,owner),stored=history(clean.state,owner);stored.tables[key]=state;
 return {...clean,state:{...record(clean.state),[HISTORY_KEY]:stored}};
}
export function tableSelectionLink<T>(origin:string,location:TableLocation,key:string,state:TableState,fields:FieldSchema<T>[]):string {
 const params=new URLSearchParams(location.search);
 for(const name of [...params.keys()])if(name.startsWith('table.'))params.delete(name);
 const validated=readTableState(writeTableState(new URLSearchParams(),key,state),key,fields);
 const shared={query:validated.query,page:1,pageSize:validated.pageSize,cursors:[]};
 const url=new URL(location.pathname,origin);url.search=writeTableState(params,key,shared).toString();url.hash=location.hash;return url.href;
}
