import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {loadDependency} from './load-dependency.mjs';import {legacyAuth} from './auth-fixture.mjs';
import {mlRows,mlScopedRows} from '../src/lib/mlSnapshot.ts';
const require=createRequire(import.meta.url);
test('raw adjacent int64 registry and ML responses retain exact joins, column filter and card route',async()=>{
 const here=new URL('../src/api/wells.ts',import.meta.url).pathname,boundaries={};const {apiClient}=loadDependency('./client',here,boundaries),{wellsApi}=loadDependency('./wells',here,boundaries),{mlApi}=loadDependency('./ml',here,boundaries);const prior=apiClient.defaults.adapter;
 const a='9007199254740992',b='9007199254740993';
 apiClient.defaults.adapter=async config=>({status:200,statusText:'OK',headers:{},config,data:config.url==='/api/v1/wells'?`[{"id":${a},"well_number":"0007А","ngdu":0,"department":-900,"active":false,"archived_at":null},{"id":${b},"well_number":"0008Б","ngdu":0,"department":-900,"active":true,"archived_at":null}]`:`{"profile":"research","wells":[{"app_well_id":${a},"risk":0,"tier":null,"data_ok":false,"rule_findings":[],"window_end":"2026-10-24T00:00:00Z"},{"app_well_id":${b},"risk":0.5,"tier":"alert","data_ok":true,"rule_findings":[],"window_end":"2026-10-24T00:00:00Z"}]}`});
 try{
  const rows=await wellsApi.list(false,undefined,'all'),ml=await mlApi.wells(false);assert.deepEqual(rows.map(r=>r.id),[a,b]);assert.deepEqual(mlScopedRows(mlRows(ml),rows,{search:'',sort:'id_asc'},false).map(r=>r.app_well_id),[a,b]);
  const {QueryClient,QueryClientProvider}=require('@tanstack/react-query'),{MemoryRouter}=require('react-router-dom'),{App}=require('antd');const cache=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});cache.setQueryData(['ml-wells'],ml);
  const {WellsPage}=loadDependency('@/pages/WellsPage',here,{'@/auth/AuthProvider':{useAuth:()=>legacyAuth()},'@/hooks/useWells':{useWells:()=>({data:rows,isLoading:false}),useDepartments:()=>({data:[]}),useNgdus:()=>({data:[]}),useUpdateWell:()=>({})},'@/api/ml':{mlApi:{wells:()=>{throw Error('No recompute');}}},'@/components/wells/WellImportModal':{WellImportModal:()=>null},'@/components/wells/AddWellModal':{AddWellModal:()=>null}});
  const search=new URLSearchParams({'table.wells-monitor':JSON.stringify({query:{version:1,sort:[{field:'id',direction:'asc'}],filters:[{field:'id',op:'contains',value:b}]},page:1,pageSize:20,cursors:[]})});
  const html=renderToStaticMarkup(React.createElement(App,null,React.createElement(QueryClientProvider,{client:cache},React.createElement(MemoryRouter,{initialEntries:[`/structure?${search}`]},React.createElement(WellsPage)))));
  assert.match(html,new RegExp(`href="/wells/${b}"`));assert.doesNotMatch(html,new RegExp(`href="/wells/${a}"`));assert.match(html,/0008Б/);assert.match(html,/Тревога/);
 }finally{apiClient.defaults.adapter=prior;}
});
