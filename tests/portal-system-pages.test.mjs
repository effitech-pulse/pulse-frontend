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
  mod.require = id => id.endsWith('.css') ? {} : Object.hasOwn(boundaries, id) ? boundaries[id] : require(id);
  mod._compile(code, filename);
  return mod.exports;
}
function render(Component, cache, props) {
  return renderToStaticMarkup(React.createElement(App, null, React.createElement(QueryClientProvider, {client: cache}, React.createElement(MemoryRouter, null, React.createElement(Component, props)))));
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
const account = (id, name, active) => ({id, name, login:`person${id}`,active,role:'viewer',revision:2,scope:{funds:['presentation'],ngdus:[1],departments:[]}});
function accountsHtml(status='active') {
  const {AccountsPage} = load('../src/pages/AccountsPage.tsx', {
    react: {...React, useState: initial=>React.useState(initial==='active'?status:initial)},
    '@/api/access': {accessApi:{users:()=>Promise.resolve([])},roleLabels:{admin:'Администратор',viewer:'Наблюдатель',technologist:'Технолог'}},
    '@/auth/AuthProvider': {useAuth:()=>({mode:'local',principal:{account_id:11}})},
    '@/api/client': {toApiError:e=>e},
    '@/hooks/useWells': {useNgdus:()=>({data:[]}),useDepartments:()=>({data:[]})},
    '@/lib/accountInput': {accountInputFromDraft:()=>{throw Error('No writes while rendering');}},
  });
  const cache = client();cache.setQueryData(['accounts'],[account(11,'Артём Ветров',true),account(1,'Прежний пользователь',false)]);
  return render(AccountsPage,cache);
}
test('System defaults to active new names and keeps inactive accounts out of that view',()=>{
  const html=accountsHtml();assert.match(html,/>Система</);assert.match(html,/Артём Ветров/);assert.doesNotMatch(html,/Прежний пользователь/);assert.match(html,/Статус пользователей/);assert.match(html,/Добавить пользователя/);
});
test('System disabled and all filters preserve access to historical account authors',()=>{
  const disabled=accountsHtml('disabled');assert.match(disabled,/Прежний пользователь/);assert.doesNotMatch(disabled,/Артём Ветров/);
  const all=accountsHtml('all');assert.match(all,/Прежний пользователь/);assert.match(all,/Артём Ветров/);
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
