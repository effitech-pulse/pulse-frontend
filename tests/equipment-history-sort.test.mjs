import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {loadDependency} from './load-dependency.mjs';

async function history(url,run){
 const previous=React.useLayoutEffect;
 // Activate real router navigation in SSR, as in table-state-routing.test.mjs.
 React.useLayoutEffect=effect=>{effect();};
 let queryOptions,tableProps;
 const requests=[];
 const page={items:[{id:'12'},{id:'11'}],next_cursor:null};
 const pass=({children})=>children??null;
 const antd={theme:{useToken:()=>({token:{}})},Card:pass,Space:pass,Button:pass,
  Table:props=>{tableProps=props;return null;},Alert:pass,Empty:pass,Input:pass,Pagination:pass,Popover:pass,Tooltip:pass,Checkbox:pass};
 const here=new URL('../src/components/equipment/EquipmentPassportHistory.tsx',import.meta.url).pathname;
 const {EquipmentPassportHistory}=loadDependency('@/components/equipment/EquipmentPassportHistory',here,{
  antd,
  '@/auth/AuthProvider':{useAuth:()=>({can:()=>true,privateEpoch:'audit',privateBlocked:false,capturePrivate:()=>({current:()=>true})})},
  '@tanstack/react-query':{useQueryClient:()=>({}),useQuery:options=>{queryOptions=options;return {data:page,isError:false,isFetching:false};}},
  '@/api/equipmentPassports':{readEquipmentPassportHistory:async(wellId,request)=>{requests.push({wellId,...request});return page;}},
 });
 const router=createMemoryRouter([{path:'/wells/:wellId',element:React.createElement(EquipmentPassportHistory,{wellId:'1001',canUpdate:false,canExport:false,busy:false,onBack:()=>{},onExport:()=>{},onEdit:()=>{},onFailure:()=>{}})}],{initialEntries:[url]});
 const render=()=>{renderToStaticMarkup(React.createElement(RouterProvider,{router}));return tableProps;};
 const read=()=>queryOptions.queryFn({signal:new AbortController().signal});
 try{await run({render,read,requests,router});}finally{router.dispose();React.useLayoutEffect=previous;}
}

test('fresh equipment history keeps server source order without a selected sort and cycles ascending, descending, none',async()=>{
 await history('/wells/1001?tab=equipment#history',async({render,read,requests,router})=>{
  let table=render();
  assert.match(table.columns[0].title.props['aria-label'],/Без сортировки$/);
  assert.equal(table.columns[0].onHeaderCell()['aria-sort'],undefined);
  assert.deepEqual(table.dataSource.map(row=>row.id),['12','11'],'server order is preserved');
  await read();assert.deepEqual(requests.at(-1).query.sort,[]);
  for(const [direction,label] of [['asc','ascending'],['desc','descending'],[null,undefined]]){
   table.columns[0].title.props.onClick();table=render();
   assert.equal(table.columns[0].onHeaderCell()['aria-sort'],label);
   await read();assert.deepEqual(requests.at(-1).query.sort,direction?[{field:'recorded_at',direction}]:[]);
   assert.equal(requests.at(-1).wellId,'1001');
   assert.equal(new URLSearchParams(router.state.location.search).get('tab'),'equipment');
   assert.equal(router.state.location.hash,'#history');
  }
  assert.match(table.columns[0].title.props['aria-label'],/Без сортировки$/);
  assert.deepEqual(table.dataSource.map(row=>row.id),['12','11']);
 });
});

test('equipment history still restores explicitly saved descending sort',async()=>{
 const params=new URLSearchParams({tab:'equipment','table.equipmenthistory-1001':JSON.stringify({query:{version:1,filters:[],sort:[{field:'recorded_at',direction:'desc'}]}})});
 await history(`/wells/1001?${params}`,async({render,read,requests})=>{
  const table=render();assert.equal(table.columns[0].onHeaderCell()['aria-sort'],'descending');
  await read();assert.deepEqual(requests.at(-1).query.sort,[{field:'recorded_at',direction:'desc'}]);
 });
});
