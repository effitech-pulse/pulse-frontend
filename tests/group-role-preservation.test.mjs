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
function group(value){
 const filename=fileURLToPath(new URL('../src/components/access/GroupEditor.tsx',import.meta.url));
 const queries=[];
 const boundaries={
  '@/auth/AuthProvider':{useAuth:()=>({can:key=>key!=='roles.read',capturePrivate:()=>({current:()=>true})})},
  '@/api/access':{managementApi:{groupMembers:()=>{}}},
  '@/lib/accessDraft':{completeMembers:()=>[]},
  './FieldError':{fieldAttributes:()=>({}),FieldError:()=>null},
  './UsersPanel':{useAccessPage:(key,fn,enabled)=>{queries.push({key,enabled});return {data:{items:[]},search:'',setSearch:()=>{}};},PageControls:()=>null,AccessError:()=>null,organizationLabel:()=>'',AssignmentSelector:()=>React.createElement('div',{'data-role-picker':'present'})},
 };
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>boundaries[id]??require(id);mod._compile(code,filename);
 const html=renderToStaticMarkup(React.createElement(mod.exports.GroupEditor,{value,disabled:false,baselineReady:true,onBaseline:()=>{},onChange:()=>{}}));return {html,queries};
}
test('existing group without roles.read has no role picker and preserves opaque assigned IDs as readonly',()=>{const value={id:'8',revision:'2',name:'Group',description:'',role_ids:['0','-9','9007199254740993'],member_ids:['7'],delete:false};const snapshot=structuredClone(value);const {html,queries}=group(value);assert.doesNotMatch(html,/data-role-picker/);for(const id of value.role_ids)assert(html.includes(id));assert.deepEqual(value,snapshot);assert(!queries.some(q=>q.key.includes('roles')));});
test('new group has no assignment control and explicitly explains absent role assignment',()=>{const {html}=group({id:null,revision:'0',name:'New',description:'',role_ids:[],member_ids:[],delete:false});assert.doesNotMatch(html,/data-role-picker/);assert.match(html,/без ролей|не назначены/);});
