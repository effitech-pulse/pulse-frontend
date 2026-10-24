import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {loadDependency} from './load-dependency.mjs';
test('Preview source options use complete authorized AFTER metadata including off-page and draft references, without lookups',()=>{
 let captured;const here=new URL('../src/components/access/AccessPreview.tsx',import.meta.url).pathname;
 const {AccessPreview}=loadDependency('@/components/access/AccessPreview',here,{'@/components/common/PulseTable':{PulseTable:props=>{captured=props;return React.createElement('div');}},'@/auth/AuthProvider':{useAuth:()=>({can:()=>false})},'@/api/access':{managementApi:{userFilterOptions:()=>{throw Error('No users permission lookup');}}}});
 const options={source_role_ids:[{value:'9007199254740993',label:'Роль вне первой страницы'}],source_group_ids:[{value:'-1',label:'Новая группа'}]};const preview={graph_revision:'1',actor_epoch:'1',fingerprint:'x',assigned_users:0,changed_users:0,disabled_users:0,self_affected:false,items:[],next_cursor:null,table_filter_options:options};
 renderToStaticMarkup(React.createElement(AccessPreview,{preview,loading:false,search:'',onSearch:()=>{},onNext:()=>{},onBack:()=>{},hasBack:false,catalog:[],userChange:false}));
 const roles=captured.schema.fields.find(f=>f.key==='source_role_ids'),groups=captured.schema.fields.find(f=>f.key==='source_group_ids');
 assert.deepEqual(roles.options,options.source_role_ids);assert.deepEqual(groups.options,options.source_group_ids);assert.equal(roles.loadOptions,undefined);assert.equal(groups.loadOptions,undefined);assert.match(roles.label,/после/);assert.match(groups.label,/после/);
});
