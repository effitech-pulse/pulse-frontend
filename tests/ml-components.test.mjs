import {legacyAuth} from './auth-fixture.mjs';
import * as authorization from '../src/auth/authorization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Node's strip-types runner does not parse TSX. Transpile the actual component;
// only the HTTP/auth boundaries are substituted, React/Ant Design/query stay real.
const require = createRequire(import.meta.url);
const {QueryClient, QueryClientProvider}=require('@tanstack/react-query');
function loadComponent(relative, boundaries) {
 const filename=fileURLToPath(new URL(relative,import.meta.url));
 const js=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod.require=id=>id==='@/auth/authorization'?authorization:id==='@/auth/AuthProvider'&&!Object.hasOwn(boundaries,id)?{useAuth:()=>legacyAuth()}:Object.hasOwn(boundaries,id)?boundaries[id]:require(id);
 mod._compile(js,filename);return mod.exports;
}
const displayTime = await import('../src/lib/displayTime.ts');
const {ExplainBars}=loadComponent('../src/components/ml/ExplainBars.tsx',{'@/lib/displayTime': displayTime, '@/api/ml':{mlApi:{explain:()=>{throw new Error('unexpected external request');}}}});
function render(props, client=new QueryClient()) {
 return renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(ExplainBars,props)));
}
const contribution={feature:'f0',label:'Ток',value:0,shap:0};

test('persisted SHAP renders actual peak date without claiming latest window',()=>{
 const html=render({wellId:null,contributions:[contribution],windowKind:'peak',windowEnd:'2026-01-01T00:00:00Z'});
 assert.match(html,/TreeSHAP по окну максимального сырого score/);
 assert.match(html,/2026-01-01T00:00:00Z/);
 assert.doesNotMatch(html,/по последнему окну/);
});
test('research latest and historical unknown explanation dates are explicit',()=>{
 const latest=render({wellId:null,contributions:[contribution],windowKind:'latest',windowEnd:'2026-01-02T00:00:00Z'});
 assert.match(latest,/по последнему окну/);assert.match(latest,/2026-01-02T00:00:00Z/);
 const unknown=render({wellId:null,contributions:[contribution],windowKind:'unknown',windowEnd:null});
 assert.match(unknown,/Окно объяснения не передано/);assert.doesNotMatch(unknown,/по последнему окну/);
});
test('each contribution tooltip exposes computed, imputed and unknown sources while preserving literal zero',()=>{
 for (const [source,label] of [['computed','Рассчитано по данным'],['training_median','Медиана обучения'],['zero_fallback','Заполнение нулём'],[null,'Источник не передан'],[undefined,'Источник не передан'],['future_source','Источник не передан'],['constructor','Источник не передан']]) {
  const html=render({wellId:null,contributions:[{...contribution,value_source:source}],windowKind:'unknown'});
  assert.ok(html.includes(label),String(source));
  assert.match(html,/f0 = 0\.000/);
 }
});

const snapshots=await import('../src/lib/mlSnapshot.ts');
const {ReviewPanel}=loadComponent('../src/components/telemetry/ReviewPanel.tsx',{
 '@/hooks/useFileJobs':{usePrivateFileRequest:()=>async fn=>fn(),fileProblem:e=>e},
 '@/auth/AuthProvider':{useAuth:()=>legacyAuth()},
 '@/api/reviews':{reviewsApi:{get:()=>{throw new Error('unexpected external request');}}},
 '@/api/client':{toApiError:e=>({message:String(e)})},
});
test('selected cohort run opens real ReviewPanel using its alert ID, not Pulse ID or newest run alert',()=>{
 const old=snapshots.mlOutcomeRow({app_well_id:42,status:'scored',reason_code:'evaluated',result:{verdict:'alert',latest_risk:.1,n_windows:1,timeline:[],contributions:[]},bounds:null,resolution:'',run_id:17,alert_id:71,alert_status:'acknowledged'});
 const reviewPath=snapshots.mlAlertReviewPath(old);
 assert.equal(reviewPath,'/api/v1/ml/alerts/71/review');
 const client=new QueryClient();
 client.setQueryData(['review',reviewPath,undefined],{state:{revision:3,status:'closed',owner:'',conclusion:'confirmed',updated_at:null},events:[],has_more:false});
 client.setQueryData(['review','/api/v1/ml/alerts/99/review',undefined],{state:{revision:1,status:'new',owner:'',conclusion:'',updated_at:null},events:[],has_more:false});
 const html=renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(ReviewPanel,{path:reviewPath})));
 assert.match(html,/Работа технолога с результатом/);assert.match(html,/Завершена/);assert.doesNotMatch(html,/>Новая</);
 assert.equal(snapshots.mlAlertReviewPath({...old,alert_id:null,alert_status:null}),null);
});
test('real queue selector exposes only new cohort alert linkage and removes handled/missing alerts',()=>{
 const alert={app_well_id:42,status:'scored',reason_code:'evaluated',result:{verdict:'alert',latest_risk:0,n_windows:1,timeline:[],contributions:[]},bounds:null,resolution:'',alert_id:99,alert_status:'new'};
 const envelope={profile:'cohort',run_id:18,snapshot_id:'s',as_of:'2026-01-01',outcomes:[alert]};
 const queue=snapshots.mlNewAlerts(envelope);
 assert.equal(queue.length,1);assert.equal(queue[0].alert_id,99);assert.equal(queue[0].run_id,18);assert.equal(queue[0].risk,0);
 for(const alert_status of ['acknowledged','false_positive','confirmed','inconclusive',null])assert.equal(snapshots.mlNewAlerts({...envelope,outcomes:[{...alert,alert_status}]}).length,0);
 assert.equal(snapshots.mlNewAlerts({...envelope,outcomes:[{...alert,alert_id:null,alert_status:null}]}).length,0);
});

// Actual native/Ant button semantics used by the mobile header control.
test('navigation toggle exposes correct open/close accessible state and controls target',()=>{
 const boundaries={
  '@/theme/ThemeProvider':{useTheme:()=>({dark:false,toggle:()=>{}})},
  '@/auth/AuthProvider':{useAuth:()=>legacyAuth()},
  '@/api/client':{toApiError:e=>({message:String(e)})},
  './FundFilterBar':{FundFilterBar:()=>null},
  './WorkspaceMenu':{WorkspaceEvents:()=>null,WorkspaceProfile:()=>null},
 };
 const {NavigationToggle}=loadComponent('../src/components/layout/AppLayout.tsx',boundaries);
 for(const [collapsed,label,expanded] of [[true,'Открыть навигацию','false'],[false,'Закрыть навигацию','true']]){
  const html=renderToStaticMarkup(React.createElement(NavigationToggle,{collapsed,onToggle:()=>{}}));
  assert.match(html,/<button/);assert.ok(html.includes(`aria-label="${label}"`));
  assert.ok(html.includes(`aria-expanded="${expanded}"`));assert.match(html,/aria-controls="pulse-main-navigation"/);
 }
});

test('review panel selects the resource permission for check, alert and private file independently',()=>{
 for(const [kind,path,privateFile,keys] of [
  ['checks','/api/v1/wells/1/checks/abcd/review',false,['wells.read','checks.read','checks.review']],
  ['alerts','/api/v1/ml/alerts/71/review',false,['wells.read','risks.read','alerts.read','alerts.review']],
  ['filechecks','/api/v1/wells/1/file-check-jobs/abcd/review',true,['wells.read','filechecks.read','filechecks.review']],
 ]){
  const seen=[];const principal={authenticated:true,role:'viewer',access_model:'rbac_v1',permission_keys:keys};
  const {ReviewPanel:Panel}=loadComponent('../src/components/telemetry/ReviewPanel.tsx',{
   '@/auth/AuthProvider':{useAuth:()=>({can:(...keys)=>{seen.push(...keys);return authorization.can(principal,...keys);},capturePrivate:()=>({current:()=>true}),privateEpoch:0})},
   '@/hooks/useFileJobs':{usePrivateFileRequest:()=>async fn=>fn(),fileProblem:e=>e},
   '@/api/reviews':{reviewsApi:{}},'@/api/client':{toApiError:e=>e},
  });
  const client=new QueryClient();renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(Panel,{path,privateFile})));
  assert.deepEqual([...new Set(seen)],[`${kind}.review`,`${kind}.read`]);
  assert.equal(client.getQueryCache().getAll()[0].options.enabled,true);
 }
});
