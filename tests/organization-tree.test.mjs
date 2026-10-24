import test from 'node:test';
import assert from 'node:assert/strict';
import * as tree from '../src/lib/organizationTree.ts';
import * as chart from '../src/lib/organizationChart.ts';
export const snapshot={complete:true,employee_count:2,organizations:[{key:'org-null',value:null,employee_count:1,divisions:[{key:'div-null',value:null,employee_count:1,departments:[{key:'dept-null',value:'Не указано',employee_count:1,employees:[{id:'9007199254740993',name:'Коллега',job_title:null,active:false}]}]}]},{key:'org-text',value:'Организация не указана',employee_count:1,divisions:[{key:'div-text',value:'Цех',employee_count:1,departments:[{key:'dept-text',value:'Не указано',employee_count:1,employees:[{id:'2',name:'Другой коллега',job_title:'Технолог',active:true}]}]}]}]};
test('complete tree validates counts, typed arrays and exact positive string identities without merging null paths',()=>{
 const data=tree.parseOrganizationTree(snapshot);assert.equal(data.complete,true);assert.equal(data.organizations[0].value,null);assert.equal(data.organizations[1].value,'Организация не указана');assert.equal(data.organizations[0].divisions[0].departments[0].employees[0].id,'9007199254740993');
 for(const broken of [{...snapshot,complete:false},{...snapshot,employee_count:3},{...snapshot,organizations:undefined}])assert.throws(()=>tree.parseOrganizationTree(broken));
 const bad=structuredClone(snapshot);bad.organizations[0].divisions[0].departments[0].employees[0].id=9007199254740992;assert.throws(()=>tree.parseOrganizationTree(bad));
 const duplicate=structuredClone(snapshot);duplicate.organizations[1].divisions[0].departments[0].employees[0].id='9007199254740993';assert.throws(()=>tree.parseOrganizationTree(duplicate));
});
test('initial organizations stay collapsed; expanding exact server keys preserves levels, ordering and safe leaves',()=>{
 const data=tree.parseOrganizationTree(snapshot);const closed=tree.flattenOrganizationTree(data,new Set());assert.equal(closed.length,2);assert.equal(closed[0].empty,true);assert.equal(closed[1].empty,false);
 const rows=tree.flattenOrganizationTree(data,new Set(['org-null','div-null','dept-null']));assert.deepEqual(rows.map(r=>r.depth),[0,1,2,3,0]);assert.equal(rows[3].employee.id,'9007199254740993');assert.equal(rows[2].key,'dept-null');assert.equal(rows[4].key,'org-text');
});
test('only fixed endpoint unsupported statuses fall back; size and timeout503 remain specific errors',()=>{
 for(const status of [404,405,501])assert.equal(tree.organizationTreeError(status),'unsupported');
 for(const status of [400,500,0])assert.equal(tree.organizationTreeError(status),'error');
 assert.equal(tree.organizationTreeError(503,{code:'external_service_error',message:'organization_tree_too_large'}),'too_large');assert.equal(tree.organizationTreeError(503,{code:'external_service_error',message:'organization_tree_timeout'}),'timeout');assert.equal(tree.organizationTreeError(403),'forbidden');
});
test('variable-height window stays bounded, respects measured long rows and retains one focused offscreen item',()=>{
 assert.equal(typeof tree.organizationTreeWindow,'function');
 const rows=Array.from({length:5000},(_,i)=>({key:`row-${i}`}));const heights=new Map([['row-0',500],['row-1',200]]);
 const window=tree.organizationTreeWindow(rows,heights,710,520,'row-4999');
 assert.equal(window.offsets[1],500);assert.equal(window.offsets[2],700);assert.ok(window.indices.length<45);assert.ok(window.indices.includes(4999));assert.ok(window.indices.includes(2));assert.equal(window.total,300580);
});
test('keyboard navigation expands only requested branches, goes to parent and never auto-expands search results',()=>{
 assert.equal(typeof tree.organizationTreeKey,'function');let expanded=new Set();let rows=tree.flattenOrganizationTree(tree.parseOrganizationTree(snapshot),expanded);
 let next=tree.organizationTreeKey(rows,expanded,'org-null','ArrowRight');assert.deepEqual([...next.expanded],['org-null']);assert.equal(next.active,'org-null');
 expanded=next.expanded;rows=tree.flattenOrganizationTree(tree.parseOrganizationTree(snapshot),expanded);next=tree.organizationTreeKey(rows,expanded,'org-null','ArrowRight');assert.equal(next.active,'div-null');
 next=tree.organizationTreeKey(rows,expanded,'div-null','ArrowLeft');assert.equal(next.active,'org-null');next=tree.organizationTreeKey(rows,expanded,'org-null','ArrowLeft');assert.equal(next.expanded.size,0);
});
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const animationFrames=new Map();let nextFrame=0;globalThis.requestAnimationFrame=fn=>{const id=++nextFrame;animationFrames.set(id,fn);return id;};globalThis.cancelAnimationFrame=id=>animationFrames.delete(id);function flushAnimationFrames(){const frames=[...animationFrames.values()];animationFrames.clear();for(const frame of frames)frame();}
function load(file,boundaries={}){const filename=fileURLToPath(new URL(file,import.meta.url));const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>id.endsWith('.css')?{}:id==='@/lib/organizationChart'?chart:id==='@/lib/organizationTree'||id==='../lib/organizationTree'?tree:boundaries[id]??require(id);mod._compile(code,filename);return mod.exports;}
test('organization transport is one complete fixed-endpoint request with filters and cancellation, never list cursors',async()=>{
 const calls=[];const {peopleApi}=load('../src/api/people.ts',{'./client':{apiClient:{get:async(url,config)=>{calls.push({url,config});return{data:snapshot};}}}});const controller=new AbortController();const data=await peopleApi.organizationTree({search:'%_ Цех',include_inactive:true},controller.signal);assert.equal(data.complete,true);assert.deepEqual(calls,[{url:'/api/v1/people/organization/tree',config:{params:{search:'%_ Цех',include_inactive:true},signal:controller.signal}}]);
});
test('real chart initial markup has first connected path, native profile link, null distinction and bounded root DOM',()=>{
 const {OrganizationTree}=load('../src/components/people/OrganizationTree.tsx');const {MemoryRouter}=require('react-router-dom');
 const render=data=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(OrganizationTree,{data})));
 const html=render(tree.parseOrganizationTree(snapshot));assert.match(html,/В текущей выборке: 2 сотрудника/);assert.equal((html.match(/aria-expanded="true"/g)??[]).length,3);assert.match(html,/Не заполнено/);assert.match(html,/href="\/people\/9007199254740993"/);assert.match(html,/<svg/);assert.match(html,/По центру/);assert.doesNotMatch(html,/manager|login|scope/);
 const large={complete:true,employee_count:5000,organizations:Array.from({length:5000},(_,i)=>({key:`root-${i}`,value:`Организация${i}`,employee_count:1,divisions:[{key:`division-${i}`,value:null,employee_count:1,departments:[{key:`department-${i}`,value:null,employee_count:1,employees:[{id:String(i+1),name:'Коллега',job_title:null,active:true}]}]}]}))};const markup=render(tree.parseOrganizationTree(large));assert.ok((markup.match(/role="treeitem"/g)??[]).length<45);assert.match(markup,/5000 сотрудников/);
});
test('PeoplePage switches read seams with shared filters, resets list cursor and suppresses stale tree on errors/private block',async()=>{
 const state=[];let pointer=0,queries=[],reads=[],blocked=false,epoch=1,error=null;
 const react={useState(initial){const i=pointer++;if(!state[i])state[i]={value:typeof initial==='function'?initial():initial};return[state[i].value,v=>{state[i].value=typeof v==='function'?v(state[i].value):v;}];}};
 const principal={authenticated:true,mechanism:'session',account_id:23,access_model:'rbac_v1',permission_keys:[]};
 const boundaries={'react':react,'antd':{Alert:'Alert',Button:'Button',Card:'Card',Checkbox:'Checkbox',Empty:'Empty',Input:'Input',Skeleton:'Skeleton',Space:'Space'},'@tanstack/react-query':{useQuery:options=>{const structure=options.queryKey[1]==='organization-tree';const value={isPending:false,isFetching:false,isError:structure&&!!error,error:structure?error:null,data:structure?snapshot:{items:[],next_cursor:'cursor-next'}};queries.push({options,value});return value;}},'@/api/people':{peopleApi:{list:async q=>{reads.push(['list',q]);return{items:[],next_cursor:null};},organizationTree:async q=>{reads.push(['structure',q]);return snapshot;}}},'@/auth/AuthProvider':{useAuth:()=>({principal,privateEpoch:epoch,privateBlocked:blocked})},'@/auth/authorization':{routeAccess:()=>true},'@/components/access/UsersPanel':{AccessError:'AccessError'},'@/components/people/OrganizationTree':{OrganizationTree:'Tree'}};
 const {PeoplePage}=load('../src/pages/PeoplePage.tsx',boundaries);
 function render(){pointer=0;queries=[];return PeoplePage();}
 function nodes(value,out=[]){if(!value||typeof value!=='object')return out;if(Array.isArray(value)){for(const v of value)nodes(v,out);}else if(value.props){out.push(value);nodes(value.props.children,out);}return out;}
 let view=render();assert.deepEqual(queries.map(q=>q.options.enabled),[true,false]);
 const next=nodes(view).find(n=>n.type==='Button'&&n.props.children==='Далее');next.props.onClick();view=render();assert.equal(queries[0].options.queryKey.at(-1),'cursor-next');
 nodes(view).find(n=>n.type==='Input').props.onChange({target:{value:'  %_ Цех  '}});nodes(view).find(n=>n.type==='Checkbox').props.onChange({target:{checked:true}});view=render();nodes(view).find(n=>n.type==='Button'&&n.props.children==='Структура').props.onClick();view=render();assert.deepEqual(queries.map(q=>q.options.enabled),[false,true]);assert.deepEqual(queries[1].options.queryKey,['people','organization-tree',1,'%_ Цех',true]);await queries[1].options.queryFn({signal:new AbortController().signal});assert.deepEqual(reads,[['structure',{search:'%_ Цех',include_inactive:true}]]);
 for(const status of [404,400,503,403]){error={isAxiosError:true,response:{status,data:{code:'external_service_error',message:'organization_tree_too_large'}}};view=render();const stateNode=nodes(view).find(n=>typeof n.type==='function'&&n.props.query===queries[1].value);const result=stateNode.type(stateNode.props);assert.equal(result.type,'Alert');assert.equal(nodes(result).some(n=>n.type==='Tree'),false);if(status===404)assert.match(result.props.message,/этой версии/);if(status===400)assert.match(result.props.message,/Не удалось/);}
 error=null;nodes(view).find(n=>n.type==='Button'&&n.props.children==='Список').props.onClick();view=render();assert.equal(queries[0].options.queryKey.at(-1),undefined);assert.equal(nodes(view).find(n=>n.type==='Input').props.value,'  %_ Цех  ');assert.equal(nodes(view).find(n=>n.type==='Checkbox').props.checked,true);
 blocked=true;epoch=2;view=render();assert.deepEqual(queries.map(q=>q.options.enabled),[false,false]);assert.equal(view.type,'Alert');assert.equal(reads.length,1);
});
test('malformed branch identity or descendant counts cannot enter the tree; additive account fields are excluded',()=>{
 const duplicate=structuredClone(snapshot);duplicate.organizations[1].key='org-null';assert.throws(()=>tree.parseOrganizationTree(duplicate));
 const count=structuredClone(snapshot);count.organizations[0].divisions[0].employee_count=2;assert.throws(()=>tree.parseOrganizationTree(count));
 const collision=structuredClone(snapshot);collision.organizations[0].key='employee:2';assert.throws(()=>tree.parseOrganizationTree(collision));
 const extra=structuredClone(snapshot);extra.organizations[0].divisions[0].departments[0].employees[0].login='PRIVATE';extra.scope={ngdus:[123]};const safe=tree.parseOrganizationTree(extra);assert.doesNotMatch(JSON.stringify(safe),/PRIVATE|ngdus|scope|login/);
});
test('initial viewport observer cannot erase a child row measurement after layout',()=>{
 const states=[];let cursor=0,effects=[],callbacks=[];
 const react={useState(initial){const i=cursor++;if(!states[i])states[i]={value:typeof initial==='function'?initial():initial};return[states[i].value,v=>{states[i].value=typeof v==='function'?v(states[i].value):v;}];},useRef(initial){const i=cursor++;if(!states[i])states[i]={value:{current:initial}};return states[i].value;},useMemo:fn=>fn(),useCallback:fn=>fn,useLayoutEffect(fn,deps){const i=cursor++;if(!states[i]||deps.some((v,n)=>!Object.is(v,states[i].deps?.[n]))){states[i]={deps};effects.push(fn);}}};
 const oldObserver=globalThis.ResizeObserver;globalThis.ResizeObserver=class{constructor(fn){callbacks.push(fn);}observe(){}disconnect(){}};
 const {OrganizationTree}=load('../src/components/people/OrganizationTree.tsx',{'react':react});const data=tree.parseOrganizationTree(snapshot);
 function nodes(value,out=[]){if(!value||typeof value!=='object')return out;if(Array.isArray(value)){for(const v of value)nodes(v,out);}else if(value.props){out.push(value);nodes(value.props.children,out);}return out;}
 function render(){flushAnimationFrames();cursor=0;effects=[];return OrganizationTree({data});}
 try{let rendered=render();const viewport=nodes(rendered).find(n=>n.props.role==='tree');viewport.ref.current={clientHeight:620,clientWidth:400,scrollTop:0,scrollLeft:0};for(const effect of effects)effect();const row=nodes(rendered).find(n=>n.props.card?.key==='org-null');row.props.measure('org-null',500);callbacks[0]();rendered=render();assert.equal(nodes(rendered).find(n=>n.props.card?.key==='org-null').props.card.height,500);}finally{globalThis.ResizeObserver=oldObserver;}
});
test('far keyboard focus follows later row measurements and resize until explicit manual scrolling',()=>{
 const states=[];let cursor=0,effects=[];const react={useState(initial){const i=cursor++;if(!states[i])states[i]={value:typeof initial==='function'?initial():initial};return[states[i].value,v=>{states[i].value=typeof v==='function'?v(states[i].value):v;}];},useRef(initial){const i=cursor++;if(!states[i])states[i]={value:{current:initial}};return states[i].value;},useMemo:fn=>fn(),useCallback:fn=>fn,useLayoutEffect(fn,deps){const i=cursor++;if(!states[i]||deps.some((v,n)=>!Object.is(v,states[i].deps?.[n]))){states[i]={deps};effects.push(fn);}}};
 const previous=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 const {OrganizationTree}=load('../src/components/people/OrganizationTree.tsx',{'react':react});const data=structuredClone(snapshot);data.organizations=data.organizations.slice(0,1);data.employee_count=320;const org=data.organizations[0],div=org.divisions[0],dept=div.departments[0];org.employee_count=div.employee_count=dept.employee_count=320;dept.employees=Array.from({length:320},(_,i)=>({id:String(i+1),name:'Ш'.repeat(112),job_title:'Д'.repeat(200),active:true}));
 const host={clientHeight:520,clientWidth:320,scrollTop:0,scrollLeft:0};let focused=null;
 function nodes(value,out=[]){if(!value||typeof value!=='object')return out;if(Array.isArray(value)){for(const v of value)nodes(v,out);}else if(value.props){out.push(value);nodes(value.props.children,out);}return out;}
 function render(){flushAnimationFrames();cursor=0;effects=[];const result=OrganizationTree({data});const all=nodes(result);all.find(n=>n.props.role==='tree').ref.current=host;for(const row of all.filter(n=>n.props.card)){const control=row.props.children;control.ref({focus(){focused=row.props.card.key;}});}for(const effect of effects)effect();return result;}
 try{let result=render();
 nodes(result).find(n=>n.props.card?.key==='dept-null').props.children.props.onKeyDown({key:'End',preventDefault(){}});result=render();assert.equal(focused,'employee:320');
 for(const height of [404,560]){for(const row of nodes(result).filter(n=>n.props.card?.row.employee))row.props.measure(row.props.card.key,height);result=render();const last=nodes(result).find(n=>n.props.card?.key==='employee:320');assert.ok(last.props.card.y>=host.scrollTop&&last.props.card.y<host.scrollTop+host.clientHeight,'End target must intersect viewport after delayed measurement/width change');assert.ok(nodes(result).filter(n=>n.props.card).length<45);}
 const viewport=nodes(result).find(n=>n.props.role==='tree');viewport.props.onWheel?.();host.scrollTop=0;viewport.props.onScroll({currentTarget:host});result=render();for(const row of nodes(result).filter(n=>n.props.card?.row.employee))row.props.measure(row.props.card.key,600);render();assert.equal(host.scrollTop,0,'manual wheel cancels keyboard anchoring');
 let last=nodes(result).find(n=>n.props.card?.key==='employee:320');last.props.children.props.onKeyDown({key:'ArrowUp',preventDefault(){}});result=render();assert.equal(focused,'employee:319');last=nodes(result).find(n=>n.props.card?.key==='employee:319');last.props.children.props.onKeyDown({key:'ArrowDown',preventDefault(){}});result=render();assert.equal(focused,'employee:320');
 nodes(result).find(n=>n.props.children==='По центру').props.onClick();result=render();assert.equal(nodes(result).find(n=>n.props.className==='organization-chart-world').props.style.transform,'scale(1)');assert.equal(focused,'employee:320');assert.equal(nodes(result).filter(n=>n.props.role==='treeitem'&&n.props.tabIndex===0).length,1);
 for(let i=0;i<2;i++){nodes(result).find(n=>n.props['aria-label']==='Уменьшить масштаб').props.onClick();result=render();}assert.equal(nodes(result).find(n=>n.props.className==='organization-chart-world').props.style.transform,'scale(0.5)');assert.equal(nodes(result).find(n=>n.props['aria-label']==='Уменьшить масштаб').props.disabled,true);
 const child=nodes(result).find(n=>n.props.card?.key==='employee:320');cursor=states.length;effects=[];const measured=child.type(child.props);measured.ref.current={getBoundingClientRect:()=>({height:280})};for(const effect of effects)effect();result=render();assert.equal(nodes(result).find(n=>n.props.card?.key==='employee:320').props.card.height,560,'physical measurement must be converted to world units at50%');

 }finally{globalThis.ResizeObserver=previous;}
});
test('End on320 long cards settles bounded mount-measure-camera updates without maximum update depth',()=>{
 const states=[];let cursor=0,effects=[],dirty=false,focused=null;const same=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={useState(initial){const i=cursor++;if(!states[i])states[i]={value:typeof initial==='function'?initial():initial};return[states[i].value,v=>{const next=typeof v==='function'?v(states[i].value):v;if(!Object.is(next,states[i].value)){states[i].value=next;dirty=true;}}];},useRef(initial){const i=cursor++;if(!states[i])states[i]={value:{current:initial}};return states[i].value;},useMemo(fn,deps){const i=cursor++;if(!states[i]||!same(deps,states[i].deps))states[i]={value:fn(),deps};return states[i].value;},useCallback(fn,deps){return this.useMemo(fn,deps);},useLayoutEffect(fn,deps){const i=cursor++;if(!states[i]||!same(deps,states[i].deps)){states[i]={deps};effects.push(fn);}}};
 // Destructured React hook calls do not retain an object receiver.
 react.useCallback=(fn,deps)=>react.useMemo(()=>fn,deps);
 const previous=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 const {OrganizationTree}=load('../src/components/people/OrganizationTree.tsx',{'react':react});const data=structuredClone(snapshot);data.organizations=data.organizations.slice(0,1);data.employee_count=320;const org=data.organizations[0],div=org.divisions[0],dept=div.departments[0];org.employee_count=div.employee_count=dept.employee_count=320;dept.employees=Array.from({length:320},(_,i)=>({id:String(i+1),name:'Ш'.repeat(112),job_title:'Д'.repeat(200),active:true}));
 const host={clientHeight:640,clientWidth:950,scrollTop:0,scrollLeft:0};let mounted=new Map(),result,maxDOM=0;
 function nodes(value,out=[]){if(!value||typeof value!=='object')return out;if(Array.isArray(value)){for(const v of value)nodes(v,out);}else if(value.props){out.push(value);nodes(value.props.children,out);}return out;}
 function settle(){let passes=0;do{assert.ok(++passes<50,`measurement/focus must settle before React update-depth limit; mounted=${mounted.size}`);dirty=false;cursor=0;effects=[];result=OrganizationTree({data});const all=nodes(result),rows=all.filter(n=>n.props.card);maxDOM=Math.max(maxDOM,rows.length);all.find(n=>n.props.role==='tree').ref.current=host;const next=new Map();for(const node of rows){const key=node.props.card.key,old=mounted.get(key),control=node.props.children;const element=old??{focus(){if(focused!==key){focused=key;control.props.onFocus();}}};next.set(key,element);control.ref(element);if(!old)node.props.measure(key,node.props.card.row.employee?340:110);}mounted=next;for(const effect of effects)effect();flushAnimationFrames();}while(dirty);return passes;}
 try{settle();nodes(result).find(n=>n.props.role==='treeitem').props.onKeyDown({key:'End',preventDefault(){}});settle();assert.equal(focused,'employee:320');const last=nodes(result).find(n=>n.props.card?.key==='employee:320').props.card;assert.ok(last.y>=host.scrollTop&&last.y<host.scrollTop+host.clientHeight);assert.ok(maxDOM<25);}finally{globalThis.ResizeObserver=previous;}
});

test('mounted long card measurements yield before parent layout updates and flush as one frame batch',()=>{
 const states=[];let cursor=0,writes=0;const mountEffects=[];const react={useState(initial){const i=cursor++;if(!states[i])states[i]={value:typeof initial==='function'?initial():initial};return[states[i].value,v=>{writes++;states[i].value=typeof v==='function'?v(states[i].value):v;}];},useRef(initial){const i=cursor++;if(!states[i])states[i]={value:{current:initial}};return states[i].value;},useMemo:fn=>fn(),useCallback:fn=>fn,useLayoutEffect(fn){mountEffects.push(fn);}};
 const {OrganizationTree}=load('../src/components/people/OrganizationTree.tsx',{'react':react});function nodes(value,out=[]){if(!value||typeof value!=='object')return out;if(Array.isArray(value)){for(const v of value)nodes(v,out);}else if(value.props){out.push(value);nodes(value.props.children,out);}return out;}
 flushAnimationFrames();cursor=0;let result=OrganizationTree({data:snapshot});const cards=nodes(result).filter(n=>n.props.card);cards[0].props.measure(cards[0].props.card.key,340);cards[1].props.measure(cards[1].props.card.key,410);assert.equal(writes,0,'child layout measurement must not synchronously re-enter parent updates');flushAnimationFrames();assert.equal(writes,1,'all mounted measurements are applied together');cursor=0;result=OrganizationTree({data:snapshot});assert.equal(nodes(result).find(n=>n.props.card?.key===cards[0].props.card.key).props.card.height,340);const cleanup=mountEffects[0]();writes=0;cards[0].props.measure(cards[0].props.card.key,500);cleanup();cards[0].props.measure(cards[0].props.card.key,600);flushAnimationFrames();assert.equal(writes,1,'cleanup/setup cycle must release the cancelled frame so new measurements can schedule');
});
