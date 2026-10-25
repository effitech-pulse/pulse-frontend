import axios from 'axios';
import {purgeEventAccess} from '../lib/events';
import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/auth/AuthProvider';
import {toApiError} from '@/api/client';
import {guardTablePage,isTableCursorError} from '../lib/tableTransport';
import type {TablePage,TablePageRequest} from '../lib/tableTransport';
import type {FieldSchema,TableQuery} from '../lib/tableQuery';
import {useTableState} from './useTableState';
export function useServerTable<T>(key:string,fields:FieldSchema<T>[],read:(request:TablePageRequest,signal:AbortSignal)=>Promise<TablePage<T>>,enabled=true,initial?:TableQuery){
 const auth=useAuth();const client=useQueryClient();const state=useTableState(key,fields,initial);const [notice,setNotice]=useState('');
 const cursor=state.cursors.at(-1);const scopeKey=key==='events'?['events',auth.privateEpoch,'table']:['table',key,auth.privateEpoch];const queryKey=[...scopeKey,state.query,cursor,state.revision];const result=useQuery({queryKey,enabled:enabled&&!auth.privateBlocked,retry:false,
  queryFn:async({signal})=>{const ticket=auth.capturePrivate();let response:TablePage<T>;try{response=await guardTablePage(ticket,()=>read({query:state.query,pageSize:25,cursor,graph_revision:state.revision},signal),signal);}catch(error){if(key==='events'&&ticket.current()&&axios.isAxiosError(error)&&[403,404].includes(error.response?.status??0))await purgeEventAccess(client,auth.privateEpoch,error,queryKey);throw error;}if(signal.aborted||!ticket.current())throw new DOMException('Устаревший сеанс','AbortError');return response;}});
 useEffect(()=>{if(cursor&&result.isError&&axios.isAxiosError(result.error)&&result.error.response?.status===400&&isTableCursorError(toApiError(result.error))){state.resetCursor();setNotice('Список изменился. Открыта первая страница.');}},[cursor,result.isError,result.error]);
 const canRefresh=enabled&&!auth.privateBlocked;
 const refetch=()=>{if(canRefresh)return result.refetch();};
 return {...result,refetch,refreshDisabled:!canRefresh,data:result.isError&&axios.isAxiosError(result.error)&&[401,403,404].includes(result.error.response?.status??0)?undefined:result.data,state,notice,refresh:()=>{if(!canRefresh||result.isFetching)return;if(cursor){void client.invalidateQueries({queryKey:[...scopeKey,state.query,undefined,undefined],exact:true,refetchType:'none'});state.resetCursor();}else void refetch();},pagination:{canPrevious:state.cursors.length>0,onPrevious:state.back,onNext:()=>{if(result.data?.next_cursor)state.next(result.data.next_cursor,result.data.graph_revision);}}};
}
