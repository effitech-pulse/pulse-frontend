import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {loadDependency} from './load-dependency.mjs';

test('registry management toggle retains selections, unrelated context and hash',async()=>{
 let toggle;const previous=React.useLayoutEffect;React.useLayoutEffect=effect=>effect();
 const pass=({children})=>children??null;
 const Component=loadDependency('@/pages/StructurePage',new URL('../src/pages/StructurePage.tsx',import.meta.url).pathname,{antd:{Button:props=>{toggle=props;return null;},Card:pass,Tabs:()=>null},'@/pages/WellsPage':{WellsPage:()=>null},'@/components/structure/NgduPanel':{NgduPanel:()=>null},'@/components/structure/DepartmentsPanel':{DepartmentsPanel:()=>null}}).StructurePage;
 const state={draft:'keep','pulse.tables.v1':{owner:'actor',tables:{'wells-monitor':{page:4}}}};
 const router=createMemoryRouter([{path:'*',element:React.createElement(Component)}],{initialEntries:[{pathname:'/structure',search:'?assessment=alert',hash:'#anchor',state}]});
 try{
  renderToStaticMarkup(React.createElement(RouterProvider,{router}));toggle.onClick();
  assert.deepEqual(router.state.location.state,state);assert.equal(router.state.location.hash,'#anchor');assert.equal(router.state.location.search,'?assessment=alert&view=manage');
 }finally{router.dispose();React.useLayoutEffect=previous;}
});

for(const kind of ['ManualChecks','FileJobsHistory'])test(`${kind} open and close preserve both checks table states and route hash`,async()=>{
 const previous=React.useLayoutEffect;React.useLayoutEffect=effect=>effect();let open,close;
 const pass=({children})=>children??null;const antd={Button:props=>{open=props.onClick;return null;},Drawer:props=>{close=props.onClose;return null;},Typography:{Text:pass},Descriptions:{Item:pass},Alert:pass,Card:pass,Empty:pass,Space:pass,Table:pass,Tag:pass};
 const boundaries={antd,'@tanstack/react-query':{useQuery:()=>({})},'@/hooks/useFileJobs':{useFileCapabilities:()=>({enabled:true}),usePrivateFileRequest:()=>()=>{},useFileJobStatus:()=>({})},'@/components/common/ServerEntityTable':{ServerEntityTable:props=>props.columns[0].render('2026-10-30T00:00:00Z',{id:'0123456789abcdef0123456789abcdef',state:'succeeded',check_id:'q1_0123456789abcdef0123456789abcdef'})},'./TelemetryChart':{TelemetryChart:()=>null},'./ReviewPanel':{ReviewPanel:()=>null},'./FileJobResult':{SavedFileCheckResult:()=>null}};
 if(kind==='ManualChecks')boundaries['./FileJobs']={FileJobsHistory:()=>null};
 const file=kind==='ManualChecks'?'ManualChecks':'FileJobs';
 const Component=loadDependency(`@/components/telemetry/${file}`,new URL(`../src/components/telemetry/${file}.tsx`,import.meta.url).pathname,boundaries)[kind];
 const state={draft:'keep','pulse.tables.v1':{owner:'actor',tables:{'manual-checks-7':{page:2,cursors:['period']},'file-jobs-7':{page:3,cursors:['file']}}}};
 const router=createMemoryRouter([{path:'*',element:React.createElement(Component,{wellId:'7'})}],{initialEntries:[{pathname:'/wells/7',search:'?tab=checks&run_id=42',hash:'#saved',state}]});
 const render=()=>renderToStaticMarkup(React.createElement(RouterProvider,{router}));
 try{render();open();assert.deepEqual(router.state.location.state,state);assert.equal(router.state.location.hash,'#saved');assert.equal(new URLSearchParams(router.state.location.search).get('check'),kind==='ManualChecks'?'0123456789abcdef0123456789abcdef':'q1_0123456789abcdef0123456789abcdef');render();close();assert.deepEqual(router.state.location.state,state);assert.equal(router.state.location.hash,'#saved');assert.equal(new URLSearchParams(router.state.location.search).has('check'),false);}
 finally{router.dispose();React.useLayoutEffect=previous;}
});
