import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {loadDependency} from './load-dependency.mjs';

const empty={version:1,filters:[],sort:[]};
const filtered={...empty,filters:[{field:'name',op:'contains',value:'Name'}]};
const ordered={...filtered,sort:[{field:'name',direction:'desc'}]};
const rows=Array.from({length:60},(_,i)=>({id:String(i+1),name:`Name ${i+1}`}));
async function localHistory(url,run,mode='local'){
 const previous=React.useLayoutEffect,previousEffect=React.useEffect;const effects=[];React.useEffect=effect=>{effects.push(effect);};React.useLayoutEffect=effect=>{effect();};
 let table,pagination,input;const buttons=new Map();
 const pass=({children})=>children??null;
 const antd={theme:{useToken:()=>({token:{}})},Alert:pass,Empty:pass,Space:pass,Tooltip:pass,Popover:pass,Checkbox:pass,
  Input:props=>{input=props;return null;},Button:props=>{buttons.set(props['aria-label'],props);return null;},
  Pagination:props=>{pagination=props;return null;},
  Table:props=>{table=props;return React.createElement(React.Fragment,null,...props.columns.map(column=>React.createElement(React.Fragment,{key:column.key},column.children?.[0].title)));},
 };
 const name=mode==='local'?'LocalEntityTable':'ServerEntityTable';
 const here=new URL(`../src/components/common/${name}.tsx`,import.meta.url).pathname;
 const Component=loadDependency(`@/components/common/${name}`,here,{antd,'@/auth/AuthProvider':{useAuth:()=>({privateBlocked:false,privateEpoch:'audit',capturePrivate:()=>({current:()=>true})})},'@tanstack/react-query':{useQueryClient:()=>({}),useQuery:()=>({data:{items:rows,next_cursor:null},isError:false,isFetching:false})}})[name];
 const router=createMemoryRouter([{path:'/previous',element:null},{path:'/list',element:React.createElement(Component,{read:async()=>({items:rows,next_cursor:null}),tableKey:'local',fields:[{key:'name',kind:'text',label:'Имя',read:row=>row.name}],columns:[{key:'name',title:'Имя'}],dataSource:rows})}],{
  initialEntries:['/previous',{pathname:'/list',search:url.search,hash:'#anchor',state:{owner:'audit'}}],initialIndex:1,
 });
 const pushes=[];let lastKey=router.state.location.key;
 const off=router.subscribe(state=>{if(state.location.key!==lastKey){lastKey=state.location.key;if(state.historyAction==='PUSH')pushes.push(state.location);}});
 const render=()=>{renderToStaticMarkup(React.createElement(RouterProvider,{router}));const key=router.state.location.key;effects.splice(0).forEach(effect=>effect());if(router.state.location.key!==key)return render();return {table,pagination,input,buttons};};
 try{await run({router,render,pushes});}finally{off();router.dispose();React.useLayoutEffect=previous;React.useEffect=previousEffect;}
}
const actions=[
 {name:'sort',before:empty,after:{...empty,sort:[{field:'name',direction:'asc'}]},click:view=>view.table.columns[0].title.props.onClick()},
 {name:'filter',before:{...empty,sort:[{field:'name',direction:'desc'}]},after:ordered,click:view=>view.input.onChange({target:{value:'Name'}})},
 {name:'reset filters',before:ordered,after:{...empty,sort:[{field:'name',direction:'desc'}]},click:view=>view.buttons.get('Сбросить фильтры').onClick()},
 {name:'reset sort',before:ordered,after:filtered,click:view=>view.buttons.get('Сбросить сортировку').onClick()},
];
for(const action of actions)test(`local ${action.name} from page2 updates query/page in one history entry and Back restores exact prior state`,async()=>{
 const params=new URLSearchParams({tab:'saved','table.other':'opaque','table.local':JSON.stringify({query:action.before,page:2,pageSize:10,cursors:['old'],revision:'7'})});
 await localHistory(new URL(`https://pulse.test/list?${params}`),async({router,render,pushes})=>{
  assert.equal(render().pagination.current,2);const before=router.state.location;
  action.click(render());
  const after=router.state.location,view=render();
  assert.equal(pushes.length,1,'query and page reset must be a single navigation');
  const state=after.state['pulse.tables.v1'].tables.local;
  assert.deepEqual(state.query,action.after);assert.equal(state.page,1);assert.equal(state.pageSize,10);assert.deepEqual(state.cursors,[]);assert.equal(state.revision,undefined);
  assert.equal(view.pagination.current,1);assert.equal(view.pagination.pageSize,10);
  assert.equal(new URLSearchParams(after.search).get('tab'),'saved');assert.equal(new URLSearchParams(after.search).has('table.other'),false);assert.equal(after.state['pulse.tables.v1'].tables.other,null);assert.equal(after.hash,'#anchor');assert.equal(after.state.owner,'audit');
  await router.navigate(-1);assert.equal(router.state.location.key,before.key);assert.equal(render().pagination.current,2);
  await router.navigate(-1);assert.equal(router.state.location.pathname,'/previous');
  await router.navigate(2);assert.equal(router.state.location.key,after.key);assert.equal(render().pagination.current,1);
 });
});

for(const mode of ['local','server'])test(`first ${mode} sort on a fresh route needs one Back to remove table state and a second to leave the list`,async()=>{
 await localHistory(new URL('https://pulse.test/list?tab=saved'),async({router,render,pushes})=>{
  const original=router.state.location;
  render().table.columns[0].title.props.onClick();assert.equal(pushes.length,1);
  await router.navigate(-1);assert.equal(router.state.location.key,original.key);assert.equal(router.state.location.search,'?tab=saved');assert.equal(router.state.location.hash,'#anchor');
  await router.navigate(-1);assert.equal(router.state.location.pathname,'/previous');
 },mode);
});
