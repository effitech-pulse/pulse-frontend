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
import * as logic from '../src/lib/fileJobs.ts';
const require=createRequire(import.meta.url);
function load(relative,boundaries){const filename=fileURLToPath(new URL(relative,import.meta.url));const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>id==='@/auth/authorization'?authorization:id==='@/auth/AuthProvider'&&!Object.hasOwn(boundaries,id)?{useAuth:()=>legacyAuth()}:Object.hasOwn(boundaries,id)?boundaries[id]:require(id);mod._compile(code,filename);return mod.exports;}
const {SavedFileCheckResult}=load('../src/components/telemetry/FileJobResult.tsx',{'./ReviewPanel':{ReviewPanel:()=>React.createElement('div',{'data-review':true})},'@/api/fileJobs':{fileJobPath:(well,job)=>`/api/v1/wells/${well}/file-check-jobs/${job}`}});
const check={id:'q1_'+'a'.repeat(32),job_id:'a'.repeat(32),well_id:'9223372036854775807',source_kind:'uploaded_file',start:'2026-01-01',end:'2026-02-01',created_at:'2026-02-01',input_sha256:'hash',points_count:'9223372036854775807',resolution:'',result:{verdict:'insufficient',latest_risk:null,peak_risk:null}};
test('saved insufficient projection keeps int64 and review without false zero risk or legacy session copy',()=>{
 const html=renderToStaticMarkup(React.createElement(SavedFileCheckResult,{check}));assert.match(html,/9223372036854775807/);assert.match(html,/data-review/);assert.match(html,/не норма/);assert.doesNotMatch(html,/Пиковый риск|текущем сеансе|0\.0%/);
});
test('saved projection shows literal zero false source and unavailable optional fields honestly',()=>{
 const html=renderToStaticMarkup(React.createElement(SavedFileCheckResult,{check:{...check,result:{verdict:'norm',latest_risk:0,peak_risk:0,timeline:[{window_end:'2026-01-01',risk:0,watch_fired:false,high_fired:null,raw_score:0}],contributions:[{feature:'x',value:0,shap:0,value_source:'zero_fallback'}]}}}));assert.match(html,/0\.0%/);assert.match(html,/Нет/);assert.match(html,/Заполнение нулём/);assert.match(html,/Не передано/);
});
test('actual API adapter uses dedicated paths and exact well string for submit/read/cancel',async()=>{
 const calls=[];const apiClient={get:async(...args)=>{calls.push(['get',...args]);return {data:{items:[]}};},post:async(...args)=>{calls.push(['post',...args]);return {data:{id:'a'.repeat(32)}};}};
 const {fileJobsApi,fileJobPath}=load('../src/api/fileJobs.ts',{'./client':{apiClient},'../lib/fileJobs.ts':logic});const well='9223372036854775807',job='a'.repeat(32),signal=new AbortController().signal;
 assert.equal(fileJobPath(well,job),`/api/v1/wells/${well}/file-check-jobs/${job}`);
 await fileJobsApi.submit(well,new File(['x'],'x.csv'),{format:'csv'},'stable-key-123456',signal);assert.equal(calls[0][2].get('request_id'),'stable-key-123456');assert.equal(calls[0][3].signal,signal);
 await fileJobsApi.status(well,job,signal);await fileJobsApi.result(well,job,signal);await fileJobsApi.cancel(well,job,2,signal);
 assert.ok(calls.every(c=>c[1].includes(well)));assert.ok(calls[2][1].endsWith('/result'));assert.deepEqual(calls[3][2],{revision:2});
});
test('eligible technologist can reach capability-gated file page while viewer remains forbidden',()=>{
 for(const role of ['technologist','viewer']){
 const router=require('react-router-dom');
 const {AppLayout}=load('../src/components/layout/AppLayout.tsx',{'@/auth/AuthProvider':{useAuth:()=>legacyAuth(role)},'@/theme/ThemeProvider':{useTheme:()=>({dark:false,toggle:()=>{}})},'./WorkspaceMenu':{WorkspaceProfile:()=>null,WorkspaceEvents:()=>null},'react-router-dom':{...router,Outlet:()=>React.createElement('div',{'data-file-entry':true})}});
 const html=renderToStaticMarkup(React.createElement(router.MemoryRouter,{initialEntries:['/upload-check']},React.createElement(AppLayout)));
 if(role==='technologist')assert.match(html,/data-file-entry/);else assert.doesNotMatch(html,/data-file-entry/);
 }
});
