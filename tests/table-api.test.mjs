import test from 'node:test';import assert from 'node:assert/strict';
import {tablePageParams,isTableCursorError} from '../src/lib/tableTransport.ts';
test('table request preserves ordered keys and never mixes legacy before limit',()=>{
 const query={version:1,filters:[{field:'id',op:'contains',value:'9223372036854775807'}],sort:[{field:'created_at',direction:'desc'},{field:'state',direction:'asc'}]};
 const params=tablePageParams({query,pageSize:25,cursor:'opaque'});assert.deepEqual(JSON.parse(params.table_query),query);assert.equal(params.cursor,'opaque');assert.equal(params.page_size,25);assert.equal('before' in params,false);assert.equal('limit' in params,false);
 assert.equal(tablePageParams({query}).cursor,undefined);
});
test('only precise cursor rejection permits first-page reset',()=>{
 assert.equal(isTableCursorError({code:'invalid_request',message:'invalid_table_cursor'}),true);
 assert.equal(isTableCursorError({code:'table_cursor_invalid'}),true);assert.equal(isTableCursorError({code:'validation_error',detail:{reason:'table_cursor_stale'}}),true);
 assert.equal(isTableCursorError({code:'validation_error',message:'bad range'}),false);
});
test('actual shared HTTP adapter uses all history endpoints, abort signal and exact envelope IDs',async()=>{
 const {loadDependency}=await import('./load-dependency.mjs');const here=new URL('../src/api/table.ts',import.meta.url).pathname;const boundaries={};
 const {apiClient}=loadDependency('./client',here,boundaries),{getTablePage}=loadDependency('./table',here,boundaries);const prior=apiClient.defaults.adapter;const calls=[];
 apiClient.defaults.adapter=async config=>{calls.push(config);return {status:200,statusText:'OK',headers:{},config,data:'{"items":[{"id":9223372036854775807,"n":0,"active":false}],"next_cursor":"opaque"}'};};
 try{for(const route of ['/api/v1/audit','/api/v1/integrations/logs','/api/v1/wells/9223372036854775807/checks','/api/v1/wells/9223372036854775807/file-check-jobs','/api/v1/wells/9223372036854775807/history']){
  const signal=new AbortController().signal,query={version:1,filters:[],sort:[{field:'created_at',direction:'desc'},{field:'model_name',direction:'asc'}]};const page=await getTablePage(route,{query,cursor:'opaque',pageSize:25},signal);
  assert.equal(page.items[0].id,'9223372036854775807');assert.equal(page.items[0].n,0);assert.equal(page.items[0].active,false);assert.equal(calls.at(-1).signal,signal);assert.deepEqual(JSON.parse(calls.at(-1).params.table_query),query);assert.equal(calls.at(-1).params.before,undefined);assert.equal(calls.at(-1).params.limit,undefined);
 }}finally{apiClient.defaults.adapter=prior;}
});
test('users-only facet API uses bounded summary endpoint without roles/groups definition reads',async()=>{
 const {loadDependency}=await import('./load-dependency.mjs');const here=new URL('../src/api/access.ts',import.meta.url).pathname,calls=[];const {managementApi}=loadDependency('./access',here,{'./client':{apiClient:{get:async(url,options)=>{calls.push({url,options});return {data:{items:[{value:'9223372036854775807',label:'Доступная роль'}],next_cursor:null,graph_revision:'7'}};}}}});
 const signal=new AbortController().signal;const page=await managementApi.userFilterOptions('role_ids','роль','cursor',signal);assert.equal(calls[0].url,'/api/v1/auth/users/filter-options');assert.equal(calls[0].options.signal,signal);assert.deepEqual(calls[0].options.params,{field:'role_ids',search:'роль',cursor:'cursor',page_size:25});assert.equal(page.items[0].value,'9223372036854775807');
});
test('groups-only role facet uses visible group IDs without users or role definition reads',async()=>{
 const {loadDependency}=await import('./load-dependency.mjs');const here=new URL('../src/api/access.ts',import.meta.url).pathname,calls=[];const {managementApi}=loadDependency('./access',here,{'./client':{apiClient:{get:async(url,options)=>{calls.push({url,options});return {data:{items:[{value:'9223372036854775807',label:'ID 9223372036854775807'}],next_cursor:null,graph_revision:'9'}};}}}});
 const signal=new AbortController().signal;const page=await managementApi.groupFilterOptions('900','opaque',signal);assert.equal(calls[0].url,'/api/v1/auth/groups/filter-options');assert.deepEqual(calls[0].options.params,{field:'role_ids',search:'900',page_size:25,cursor:'opaque'});assert.equal(calls[0].options.signal,signal);assert.equal(page.items[0].value,'9223372036854775807');
});
