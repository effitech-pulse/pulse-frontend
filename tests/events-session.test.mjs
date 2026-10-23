import test from 'node:test';import assert from 'node:assert/strict';import {QueryClient} from '@tanstack/react-query';
import {PrivateEpoch} from '../src/lib/privateEpoch.ts';import {guardEventRequest,eventQueryKey} from '../src/lib/events.ts';
for(const kind of ['list','detail'])test(`${kind}: late old-session response cannot populate React Query cache`,async()=>{
 const epoch=new PrivateEpoch();const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});let release;
 const key=eventQueryKey(kind,epoch.capture().value,'scope');const ticket=epoch.capture();
 const pending=client.fetchQuery({queryKey:key,queryFn:()=>guardEventRequest(ticket,()=>new Promise(resolve=>{release=resolve;}))});
 epoch.invalidate();release({private:'old'});await assert.rejects(pending,{name:'AbortError'});assert.equal(client.getQueryData(key),undefined);
 const next=eventQueryKey(kind,epoch.capture().value,'scope');assert.notDeepEqual(next,key);
 assert.equal(await client.fetchQuery({queryKey:next,queryFn:()=>guardEventRequest(epoch.capture(),async()=> 'new')}),'new');client.clear();
});
test('external cancellation rejects even when transport resolves, and valid current ticket succeeds',async()=>{
 const epoch=new PrivateEpoch();const c=new AbortController();c.abort();await assert.rejects(guardEventRequest(epoch.capture(),async()=>123,c.signal),{name:'AbortError'});
 assert.equal(await guardEventRequest(epoch.capture(),async()=>0),0);
});

test('masked404 purges only current event cache and cancels other inflight reads without revoking session',async()=>{
 const {purgeEventAccess}=await import('../src/lib/events.ts');
 const {AxiosError}=await import('axios');
 const epoch=new PrivateEpoch(),client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
 const list=eventQueryKey('list',0,'filters'),detail=eventQueryKey('detail',0,'selected');
 client.setQueryData(list,{private:'list'});client.setQueryData(detail,{private:'detail'});client.setQueryData(['file-capabilities',0],{enabled:true});
 let release,aborted=false;const inflightKey=eventQueryKey('detail',0,'inflight');
 const pending=client.fetchQuery({queryKey:inflightKey,queryFn:({signal})=>new Promise(resolve=>{release=resolve;signal.addEventListener('abort',()=>{aborted=true;});})});
 const rejected=assert.rejects(pending);
 const error=new AxiosError('hidden','ERR_BAD_REQUEST',undefined,undefined,{status:404,data:{code:'not_found'},headers:{},config:{},statusText:'Not Found'});
 await purgeEventAccess(client,0,error,detail);release({private:'late'});await rejected;assert.equal(aborted,true);assert.equal(client.getQueryData(inflightKey),undefined);
 assert.equal(client.getQueryData(list),undefined);assert.equal(client.getQueryData(detail),undefined);assert.deepEqual(client.getQueryData(['file-capabilities',0]),{enabled:true});assert.equal(epoch.capture().current(),true);client.clear();
});
