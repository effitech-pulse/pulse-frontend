import {useSearchParams} from 'react-router-dom';
import {readTableState,writeTableState} from '../lib/tableState';
import type {TableState} from '../lib/tableState';
import type {FieldSchema,TableQuery} from '../lib/tableQuery';
export function useTableState<T>(key:string,fields:FieldSchema<T>[],initial?:TableQuery){
 const [params,setParams]=useSearchParams();const state=readTableState(params,key,fields,initial);
 const update=(next:TableState)=>setParams(previous=>writeTableState(previous,key,next));
 return {...state,setQuery:(query:TableQuery)=>update({...state,query,page:1,cursors:[],revision:undefined}),
  setPage:(page:number,pageSize:number)=>update({...state,page,pageSize}),
  next:(cursor:string,revision?:string)=>update({...state,cursors:[...state.cursors,cursor],revision}),
  back:()=>update({...state,cursors:state.cursors.slice(0,-1)}),resetCursor:()=>update({...state,cursors:[],revision:undefined})};
}
