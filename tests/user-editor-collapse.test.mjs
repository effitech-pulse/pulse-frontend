import test from 'node:test';
import assert from 'node:assert/strict';
import {revealAccessField} from '../src/lib/revealAccessField.ts';
function fixture(id='access-field-workplace_department'){
 const events=[];
 function details(label,parentElement=null){let open=false;return {tagName:'DETAILS',parentElement,get open(){return open;},set open(value){open=value;events.push(`${label}:${value}`);}};}
 const outer=details('outer');const inner=details('inner',outer);const sibling=details('sibling');
 const target={id,parentElement:inner,disabled:true,focus(){assert.equal(outer.open,true);assert.equal(inner.open,true);events.push('focus');},scrollIntoView(options){assert.deepEqual(options,{block:'center'});events.push('scroll');}};
 return {target,outer,inner,sibling,events};
}
test('hidden access field reveals ancestor disclosures outside-in before focus and scroll',()=>{
 const {target,events,sibling}=fixture();revealAccessField(target);assert.deepEqual(events,['outer:true','inner:true','focus','scroll']);assert.equal(sibling.open,false);assert.equal(target.disabled,true);
});
test('summary can reveal the same error again after manual collapse, without opening another section',()=>{
 const {target,outer,inner,sibling,events}=fixture();revealAccessField(target);inner.open=false;events.length=0;revealAccessField(target);assert.deepEqual(events,['inner:true','focus','scroll']);assert.equal(outer.open,true);assert.equal(sibling.open,false);
});
test('all actual access field IDs use their own ancestors, including workplace and security department',()=>{
 for(const id of ['name','job_title','workplace_organization','workplace_division','workplace_department','manager_id','login','password','organization','ngdu','department']){const f=fixture(`access-field-${id}`);revealAccessField(f.target);assert.equal(f.inner.open,true,id);assert.equal(f.sibling.open,false,id);}
 assert.doesNotThrow(()=>revealAccessField(null));
});
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as accessDraft from '../src/lib/accessDraft.ts';
const require=createRequire(import.meta.url);
function editorHtml(){
 const {MemoryRouter}=require('react-router-dom');const {QueryClient,QueryClientProvider}=require('@tanstack/react-query');
 const boundaries={'@/api/access':{managementApi:{orgOptions:async()=>({ngdus:[],departments:[],pairs:[]})}},'@/api/people':{peopleApi:{}},'@/api/client':{toApiError:e=>e},'@/auth/AuthProvider':{useAuth:()=>({can:key=>key==='users.scope.assign',privateEpoch:0,privateBlocked:false})},'@/lib/accessDraft':accessDraft};
 const cache=new Map();
 function load(filename){if(cache.has(filename))return cache.get(filename);const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>{if(Object.hasOwn(boundaries,id))return boundaries[id];if(id.startsWith('.')){const file=path.resolve(path.dirname(filename),id);for(const ext of ['.tsx','.ts'])if(existsSync(file+ext))return load(file+ext);}return require(id);};mod._compile(code,filename);cache.set(filename,mod.exports);return mod.exports;}
 const {UserAccessDrawer}=load(fileURLToPath(new URL('../src/components/access/UserAccessDrawer.tsx',import.meta.url)));
 const value={id:'23',revision:'9',name:'Сотрудник',login:'private-login',active:true,role_ids:['11'],group_ids:['12'],reset_password:true,organization:{kind:'department',ngdu_id:'1',department_id:'2'},profile:{revision:'7',job_title:'Технолог',workplace:{organization:null,division:null,department:'Отдел'},manager_id:null}};
 const fail=()=>{throw Error('Disclosure must not mutate draft');};
 return renderToStaticMarkup(React.createElement(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},React.createElement(MemoryRouter,null,React.createElement(UserAccessDrawer,{value,account:null,password:'private-memory-password',onChange:fail,onPassword:fail,onDepartmentPending:fail,onClose:fail,catalog:[]}))));
}
test('actual editor renders three default-open independent native sections with mounted fields and one disclosure target each',()=>{
 const html=editorHtml();const details=[...html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)];assert.equal(details.length,3);
 for(const [index,label] of ['Сотрудник','Учётная запись','Доступ'].entries()){
  const [,attrs,body]=details[index];assert.match(attrs,/\bopen=""/);assert.doesNotMatch(attrs,/\bname=/);
  const summary=body.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)?.[1];assert.ok(summary);assert.match(summary,new RegExp(label));assert.match(summary,/Скрыть/);assert.match(summary,/Отобразить/);assert.doesNotMatch(summary,/<button\b|<a\b|<input\b|<select\b/);
 }
 assert.match(details[0][2],/id="access-field-workplace_department"/);assert.match(details[1][2],/value="private-memory-password"/);assert.match(details[2][2],/Роли и группы/);assert.match(details[2][2],/id="access-field-department"/);assert.doesNotMatch(details[2][2],/id="access-field-workplace_department"/);assert.equal((html.match(/>Сотрудник<\/h2>/g)??[]).length,1);
});
