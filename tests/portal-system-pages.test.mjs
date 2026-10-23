import {legacyAuth} from './auth-fixture.mjs';
import * as authorization from '../src/auth/authorization.ts';
import * as accessDraft from '../src/lib/accessDraft.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const { MemoryRouter } = require('react-router-dom');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const { App } = require('antd');
function load(relative, boundaries) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => id.endsWith('.css') ? {} : id==='@/auth/authorization'?authorization:id==='@/lib/accessDraft'?accessDraft:id==='@/auth/AuthProvider'&&!Object.hasOwn(boundaries,id)?{useAuth:()=>legacyAuth()}:Object.hasOwn(boundaries, id) ? boundaries[id] : require(id);
  mod._compile(code, filename);
  return mod.exports;
}
function render(Component, cache, props) {
  return renderToStaticMarkup(React.createElement(App, null, React.createElement(QueryClientProvider, {client: cache}, React.createElement(MemoryRouter, null, React.createElement(Component, props)))));
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
const account = (id, name, active) => ({id, access_id:String(id),access_revision:'2',name,login:`person${id}`,active,role:'viewer',revision:2,scope:{funds:['presentation'],ngdus:[1],departments:[]},role_ids:[],group_ids:[],roles:[],groups:[]});
function usersHtml(){
 const {UsersPanel}=load('../src/components/access/UsersPanel.tsx',{
  '@/api/access':{managementApi:{users:()=>Promise.resolve({items:[]})}},
  '@/api/client':{toApiError:e=>e},
  '@/auth/AuthProvider':{useAuth:()=>({...legacyAuth('admin'),privateEpoch:0,privateBlocked:false})},
 });
 const cache=client();cache.setQueryData(['access','users',0,'',undefined,undefined],{items:[account(11,'Артём Ветров',true),account(1,'Прежний пользователь',false)],next_cursor:null,total_visible:2,graph_revision:'1'});
 return render(UsersPanel,cache,{open:()=>{throw Error('No writes while rendering');}});
}
test('System shows server-authorized users including disabled historical authors without local status filtering',()=>{
 const html=usersHtml();assert.match(html,/Артём Ветров/);assert.match(html,/Прежний пользователь/);assert.match(html,/Отключён/);assert.match(html,/Добавить пользователя/);assert.match(html,/Доступные записи/);
});
test('cohort well connections are readable without source identity edit controls',()=>{
  const {WellConnections}=load('../src/components/integrations/WellConnections.tsx',{
    '@/hooks/useWells':{useWells:()=>({data:[{id:11,well_number:'111',unitek_id:0,armits_id:null,archived_at:null}],isLoading:false})},
    '@/api/wells':{wellsApi:{}},'@/api/client':{toApiError:e=>e},
  });
  const html=render(WellConnections,client(),{readOnly:true});assert.match(html,/ID в Unitek/);assert.match(html,/>0</);assert.doesNotMatch(html,/Настроить связи/);assert.match(html,/доступны для просмотра/);
});
test('integration loading state does not invent zero metrics or unavailable data',()=>{
  const {IntegrationsPage}=load('../src/pages/IntegrationsPage.tsx',{
    '@/api/integrations':{integrationsApi:{list:()=>new Promise(()=>{}),logs:()=>Promise.resolve([])}},
    '@/api/client':{toApiError:e=>e},'@/api/ml':{mlApi:{wells:()=>new Promise(()=>{})}},
    '@/lib/telemetry':{channels:[],defaultMappings:[],mapRecords:()=>null},
    '@/components/integrations/WellConnections':{WellConnections:()=>null},
    '@/components/telemetry/ImportTelemetry':{ImportTelemetry:()=>null},
  });
  const html=render(IntegrationsPage,client());assert.match(html,/Активные источники/);assert.equal((html.match(/<strong>—<\/strong>/g)??[]).length,4);assert.doesNotMatch(html,/99,6|124|Показательный|Демо/);
});
test('access preview preserves the removed direct source in before and the retained group source in after',()=>{
 const {AccessPreview}=load('../src/components/access/AccessPreview.tsx',{'@/lib/accessDraft':accessDraft,'./UsersPanel':{organizationLabel:()=>''}});
 const source=(role_name,group_id,group_name)=>({role_id:'1',role_name,role_revision:'1',builtin_key:null,group_id,group_name});
 const base={active:true,scope:{funds:[],ngdus:null,departments:null},role_ids:['1'],group_ids:['8'],roles:[],direct_roles:[],groups:[],permission_keys:['wells.read']};
 const preview={graph_revision:'1',actor_epoch:'1',fingerprint:'f',assigned_users:1,changed_users:0,disabled_users:0,self_affected:false,next_cursor:null,items:[{user:account(1,'Сотрудник',true),before:{...base,permission_sources:{'wells.read':[source('Прежний источник',null,null)]}},after:{...base,permission_sources:{'wells.read':[source('Сохранённый источник','8','Смена')]}},retained_by_other_source:['wells.read']}]};
 const html=render(AccessPreview,client(),{preview,search:'',onSearch:()=>{},loading:false,onNext:()=>{},onBack:()=>{},hasBack:false,catalog:[],userChange:true});
 assert.match(html,/Прежний источник/);assert.match(html,/Сохранённый источник/);assert.match(html,/напрямую/);assert.match(html,/группа «Смена»/);
});
test('profile uses actual modern role/group summaries including empty groups and only legacy adapter uses enum labels',()=>{
 const {profileAccessSummary}=load('../src/components/layout/WorkspaceMenu.tsx',{'@/api/access':{roleLabels:{viewer:'Наблюдатель',admin:'Администратор'}},'@/api/client':{toApiError:e=>e},'@/lib/mlSnapshot':{},'@/api/ml':{},'@/api/integrations':{}});
 assert.deepEqual(profileAccessSummary({access_model:'rbac_v1',role:'viewer',roles:[{id:'1',name:'Технолог'},{id:'2',name:'Пустая роль'}],groups:[{id:'8',name:'Пустая группа',role_ids:[]}]}),{label:'Роли',roles:'Технолог, Пустая роль',groups:'Пустая группа'});
 assert.deepEqual(profileAccessSummary({access_model:'rbac_v1',role:'admin',roles:[],groups:[]}),{label:'Роли',roles:'Роли не назначены',groups:'Группы не назначены'});
 assert.deepEqual(profileAccessSummary({access_model:'legacy',role:'viewer'}),{label:'Роль',roles:'Наблюдатель',groups:null});
});
