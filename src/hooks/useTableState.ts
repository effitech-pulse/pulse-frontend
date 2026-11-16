import {useContext,useEffect} from 'react';
import {UNSAFE_NavigationContext,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {privateBoundary} from '../lib/privateEpoch';
import {importTableLocation,readHistoryTableState,tableSelectionLink,updateTableLocation} from '../lib/tableState';
import type {TableLocation,TableState} from '../lib/tableState';
import type {FieldSchema,TableQuery} from '../lib/tableQuery';

// Coordinate same-tick writes from nested hooks, while navigation still goes
// through React Router (including its draft blockers).
const pending=new WeakMap<object,{key:string;location:TableLocation}>();
export function useTableState<T>(key:string,fields:FieldSchema<T>[],initial?:TableQuery){
 const location=useLocation(),navigate=useNavigate(),{navigator}=useContext(UNSAFE_NavigationContext),auth=useAuth();
 const owner=JSON.stringify([privateBoundary(auth),auth.privateEpoch]);
 const ticket=auth.capturePrivate();
 const latest=()=>{const cached=pending.get(navigator);return cached?.key===location.key?cached.location:location;};
 const imported=importTableLocation(location,owner);
 const state=readHistoryTableState(imported.state,key,fields,owner,initial);
 const commit=(next:TableLocation,replace=false)=>{
  if(auth.privateBlocked||!ticket.current())return;
  const entry={key:location.key,location:next};pending.set(navigator,entry);
  // Only coalesce synchronous sibling writes. Never retain an unaccepted
  // destination after a blocker cancellation or a later Back navigation.
  queueMicrotask(()=>{if(pending.get(navigator)===entry)pending.delete(navigator);});
  navigate({pathname:next.pathname,search:next.search,hash:next.hash},{state:next.state,replace});
 };
 useEffect(()=>{const base=latest(),clean=importTableLocation(base,owner);if(clean!==base)commit(clean,true);},[location.key,location.search,owner]);
 const update=(change:(current:TableState)=>TableState,search?:URLSearchParams)=>{
  const base=importTableLocation(latest(),owner),current=readHistoryTableState(base.state,key,fields,owner,initial);
  commit(updateTableLocation({...base,...(search?{search:search.size?`?${search}`:''}:{})},key,change(current),owner));
 };
 return {...state,setQuery:(query:TableQuery)=>update(current=>({...current,query,page:1,cursors:[],revision:undefined})),
  setPage:(page:number,pageSize:number)=>update(current=>({...current,page,pageSize})),
  next:(cursor:string,revision?:string)=>update(current=>({...current,cursors:[...current.cursors,cursor],revision})),
  back:()=>update(current=>({...current,cursors:current.cursors.slice(0,-1)})),
  resetCursor:()=>update(current=>({...current,cursors:[],revision:undefined})),
  resetForSearch:(search:URLSearchParams)=>update(current=>({...current,page:1,cursors:[],revision:undefined}),search),
  selectionLink:()=>tableSelectionLink(window.location.origin,latest(),key,readHistoryTableState(importTableLocation(latest(),owner).state,key,fields,owner,initial),fields)};
}
