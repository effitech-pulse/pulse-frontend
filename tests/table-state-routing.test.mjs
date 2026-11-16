import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {loadDependency} from './load-dependency.mjs';
import {blockAccessLocationNavigation} from '../src/lib/accessDraft.ts';

const here=new URL('../src/hooks/useTableState.ts',import.meta.url).pathname;
const {useTableState}=loadDependency('@/hooks/useTableState',here,{});
const fields=[{key:'name',kind:'text',label:'Имя',read:row=>row.name}];
const query={version:1,filters:[{field:'name',op:'contains',value:'Анна'}],sort:[{field:'name',direction:'desc'}]};

// SSR runs the real hook and router. Only layout effects run eagerly to activate
// useNavigate's mounted guard; this harness does not claim DOM/e2e coverage.
async function withTable(url,key,run){
 const previous=React.useLayoutEffect,previousEffect=React.useEffect;const effects=[];React.useEffect=effect=>{effects.push(effect);};
 React.useLayoutEffect=effect=>{effect();};
 let table;
 function Probe(){table=useTableState(key,fields);return null;}
 const router=createMemoryRouter([{path:'*',element:React.createElement(Probe)}],{
  initialEntries:[{pathname:url.pathname,search:url.search,hash:url.hash,state:{returnTo:'/people',origin:'audit'}}],
 });
 const render=()=>{renderToStaticMarkup(React.createElement(RouterProvider,{router}));const key=router.state.location.key;effects.splice(0).forEach(effect=>effect());if(router.state.location.key!==key)return render();return table;};
 try{await run({router,render});}finally{router.dispose();React.useLayoutEffect=previous;React.useEffect=previousEffect;}
}

test('every table mutation preserves path, hash, history state and unrelated query values',async()=>{
 const url=new URL('https://pulse.test/structure?run_id=7&check=q1_abc&tag=a&tag=b&table.other=opaque#saved-anchor');
 await withTable(url,'probe',async({router,render})=>{
  const mutations=[state=>state.setQuery(query),state=>state.setPage(3,50),state=>state.next('cursor-1','revision-1'),state=>state.back(),state=>state.resetCursor()];
  for(const mutate of mutations){
   await mutate(render());
   const location=router.state.location,params=new URLSearchParams(location.search);
   assert.equal(location.pathname,'/structure');
   assert.equal(location.hash,'#saved-anchor');
   assert.equal(location.state.returnTo,'/people');assert.equal(location.state.origin,'audit');
   assert.equal(params.get('run_id'),'7');assert.equal(params.get('check'),'q1_abc');
   assert.deepEqual(params.getAll('tag'),['a','b']);assert.equal(params.has('table.other'),false);assert.equal(location.state['pulse.tables.v1'].tables.other,null);
   assert.deepEqual(render().query,query);
  }
 });
});

test('table changes push entries and Back/Forward restore independent query and paging state',async()=>{
 await withTable(new URL('https://pulse.test/wells/42?tab=checks&run=7#result'),'checks',async({router,render})=>{
  await render().setQuery(query);
  const sorted=router.state.location;
  assert.equal(router.state.historyAction,'PUSH');
  await render().setPage(4,50);
  assert.equal(render().page,4);assert.equal(render().pageSize,50);
  await router.navigate(-1);
  assert.equal(router.state.location.key,sorted.key);assert.deepEqual(render().query,query);assert.equal(render().page,1);
  await router.navigate(-1);
  assert.equal(router.state.location.search,'?tab=checks&run=7');assert.deepEqual(render().query,{version:1,filters:[],sort:[]});
  await router.navigate(1);
  assert.equal(router.state.location.key,sorted.key);assert.deepEqual(render().query,query);
  assert.equal(router.state.location.hash,'#result');
 });
});

test('dirty group editor accepts its table query with hash intact and still blocks leaving the editor',async()=>{
 await withTable(new URL('https://pulse.test/system/access?entity=groups&id=7#members'),'group-members-7-members',async({router,render})=>{
  router.getBlocker('draft',({currentLocation,nextLocation})=>blockAccessLocationNavigation(true,false,currentLocation,nextLocation,'7'));
  await render().setQuery(query);
  assert.notEqual(router.state.blockers.get('draft')?.state,'blocked');
  assert.deepEqual(render().query,query);assert.equal(router.state.location.hash,'#members');
  await router.navigate('/system/access?entity=groups&id=8#members');
  assert.equal(router.state.blockers.get('draft')?.state,'blocked');
  assert.equal(new URLSearchParams(router.state.location.search).get('id'),'7');
  router.state.blockers.get('draft').reset();
  await router.navigate('/people');
  assert.equal(router.state.blockers.get('draft')?.state,'blocked');
 });
});
test('Back followed by paging uses restored selection rather than the pending destination',async()=>{
 await withTable(new URL('https://pulse.test/wells?run_id=7'),'probe',async({router,render})=>{
  await render().setQuery(query);render();await router.navigate(-1);
  assert.equal(render().query.filters.length,0);
  await render().setPage(3,50);
  assert.equal(render().query.filters.length,0);assert.equal(render().page,3);
 });
});
test('a cancelled table navigation cannot leak its pending query into the next action',async()=>{
 await withTable(new URL('https://pulse.test/wells'),'probe',async({router,render})=>{
  router.getBlocker('reject',()=>true);await render().setQuery(query);
  assert.equal(router.state.blockers.get('reject').state,'blocked');router.state.blockers.get('reject').reset();router.deleteBlocker('reject');
  await render().setPage(2,20);assert.equal(render().query.filters.length,0);assert.equal(render().page,2);
 });
});
