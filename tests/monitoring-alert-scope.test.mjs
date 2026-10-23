import {legacyAuth} from './auth-fixture.mjs';
import * as authorization from '../src/auth/authorization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const {MemoryRouter}=require('react-router-dom');
const {QueryClient,QueryClientProvider}=require('@tanstack/react-query');
const snapshot=await import('../src/lib/mlSnapshot.ts'),filtersLib=await import('../src/lib/monitoringAlerts.ts'),time=await import('../src/lib/displayTime.ts');
const registry=[{id:1,well_number:'DROP',ngdu:8,department:1},{id:2,well_number:'KEEP',ngdu:9,department:2}];
const filters={search:'KEEP',ngdu:9,department:2,sort:'id_asc'};
const selectedRegistry=registry.filter(well=>well.well_number.includes(filters.search)&&well.ngdu===filters.ngdu&&well.department===filters.department);
function render(profile){
 const rows=registry.map(well=>({well_id:well.id+100,app_well_id:well.id,metadata:well,risk:.2,tier:'alert',alert:true,alert_id:well.id+30,alert_status:'new',data_ok:null,rule_findings:[],windows_fired:1,windows_total:1,window_end:'2026-10-21T00:00:00Z',run_id:35,true_failure_type_name:null}));
 const envelope=profile==='cohort'?{profile,run_id:35,snapshot_id:'s35',as_of:'2026-10-21T00:00:00Z',outcomes:rows.map(row=>({app_well_id:row.app_well_id,status:'scored',metadata:row.metadata,alert_id:row.alert_id,alert_status:row.alert_status,result:{verdict:'alert',latest_risk:.2,n_windows:1,windows_above_watch:1,timeline:[{window_end:row.window_end,risk:.2}],contributions:[]}}))}:{profile,wells:rows.map(({metadata,...row})=>row)};
 const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});client.setQueryData(['ml-snapshot',35],envelope);
 const filename=fileURLToPath(new URL('../src/pages/MlRiskPage.tsx',import.meta.url));
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const never=()=>{throw Error('Unexpected transport or recompute');};
 const boundaries={
 '@/auth/AuthProvider':{useAuth:()=>legacyAuth()},'@/hooks/useWells':{useWells:(_active=true,apply=true)=>({data:apply?selectedRegistry:registry,isLoading:false})},'@/theme/FundFilters':{useFundFilters:()=>({filters})},
 '@/lib/mlSnapshot':snapshot,'@/lib/monitoringAlerts':filtersLib,'@/lib/displayTime':time,
 '@/api/ml':{mlApi:{snapshot:never,wells:never,metrics:never}},'@/components/common/PageSpin':{PageSpin:({children})=>children},'@/components/ml/ExplainBars':{ExplainBars:()=>null},'@/components/layout/FundFilterBar':{FundFilterBar:()=>null},'@/components/telemetry/ReviewPanel':{ReviewPanel:()=>null},'@/hooks/useMlRun':{useMlRun:()=>({running:false,lastRun:null,start:{isPending:false,mutate:never}})},'@/lib/labels':{FAILURE_TYPE_RU:{}},
 };
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>id==='@/auth/authorization'?authorization:id==='@/auth/AuthProvider'&&!Object.hasOwn(boundaries,id)?{useAuth:()=>legacyAuth()}:Object.hasOwn(boundaries,id)?boundaries[id]:require(id);mod._compile(code,filename);
 return renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(MemoryRouter,{initialEntries:['/ml-risk?run_id=35&model=all']},React.createElement(mod.exports.MlRiskPage))));
}
for(const profile of ['research','cohort'])test(`${profile} selected snapshot respects shared well/NGDU/department filters`,()=>{
 const html=render(profile);assert.match(html,/href="\/wells\/2\?run_id=35"/);assert.doesNotMatch(html,/href="\/wells\/1(?:\?|"|\/)/);assert.match(html,/KEEP/);
});
