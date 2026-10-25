import {useInfiniteQuery, useQuery, useQueryClient} from '@tanstack/react-query';
import axios from 'axios';
import {useAuth} from '@/auth/AuthProvider';
import {eventsApi, type EventFilters, type EventID} from '@/api/events';
import {buildEventsURL, eventQueryKey, guardEventRequest, validEventId, purgeEventAccess} from '@/lib/events';

function useEventRequest() {
 const auth=useAuth();const client=useQueryClient();
 return async <T,>(key:readonly unknown[],work:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T>=>{
  const ticket=auth.capturePrivate();
  try{return await guardEventRequest(ticket,()=>work(signal),signal);}
  catch(error){
   // Object-level 403/404 is not a global private-file/session revocation.
   if(ticket.current()&&!signal.aborted&&axios.isAxiosError(error)&&[403,404].includes(error.response?.status??0)){
    await purgeEventAccess(client,auth.privateEpoch,error,key);
   }
   throw error;
  }
 };
}
export function useEvents(filters:EventFilters) {
 const auth=useAuth(),client=useQueryClient(),request=useEventRequest();
 const key=eventQueryKey('list',auth.privateEpoch,buildEventsURL(filters));
 const query=useInfiniteQuery({
  queryKey:key,enabled:!!auth.principal&&!auth.privateBlocked,
  initialPageParam:undefined as string|undefined,
  queryFn:({signal,pageParam})=>request(key,s=>eventsApi.list(filters,pageParam,s),signal),
  getNextPageParam:page=>page.has_more?(page.next_cursor??undefined):undefined,
  retry:false,staleTime:0,gcTime:0,refetchOnWindowFocus:false,
 });
 return {...query,restart:()=>client.resetQueries({queryKey:key,exact:true})};
}
export function useEvent(eventId:EventID) {
 const auth=useAuth(),request=useEventRequest();const key=eventQueryKey('detail',auth.privateEpoch,eventId);
 return useQuery({
  queryKey:key,enabled:!!auth.principal&&!auth.privateBlocked&&validEventId(eventId),
  queryFn:({signal})=>request(key,s=>eventsApi.get(eventId,s),signal),
  retry:false,staleTime:0,gcTime:0,refetchOnWindowFocus:false,
 });
}
