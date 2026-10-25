import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {loadDependency} from './load-dependency.mjs';
const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/daily-flow/${name}.json`,import.meta.url)));
const parent=new URL('../src/components/telemetry/DailyFlowPanel.tsx',import.meta.url).pathname;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(){
 let cursor=0,state=[],effects=[],pending=[],privateCurrent=true;const reads=[],exports=[],downloads=[];
 const hooks={...React,useState(initial){const i=cursor++;if(!state[i])state[i]={value:typeof initial==='function'?initial():initial};return [state[i].value,x=>{state[i].value=typeof x==='function'?x(state[i].value):x;}];},useRef(initial){const i=cursor++;return state[i]??(state[i]={current:initial});},useEffect(fn,deps){const i=cursor++;const old=effects[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j]))){pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});}}};
 const boundaries={react:hooks,'@/auth/AuthProvider':{useAuth:()=>({privateEpoch:1,privateBlocked:false,can:()=>true,capturePrivate:()=>({current:()=>privateCurrent})})},'@/api/dailyFlow':{readDailyFlow:(...args)=>{const d=deferred();reads.push({args,...d});return d.promise;},exportDailyFlow:(...args)=>{const d=deferred();exports.push({args,...d});return d.promise;}},'@/api/client':{toApiError:e=>({message:e.message??'failure'})}};
 const lib=loadDependency('@/lib/dailyFlow',parent,boundaries);boundaries['@/lib/dailyFlow']={...lib,downloadDailyBlob:(...args)=>{if(args[2]()){downloads.push(args);return true;}return false;}};
 const {DailyFlowPanel}=loadDependency('@/components/telemetry/DailyFlowPanel',parent,boundaries);
 let props={wellId:'1004',period:30,active:true,onPeriod:()=>{},onParameters:()=>{}};
 const render=()=>{cursor=0;const tree=DailyFlowPanel(props);const q=pending;pending=[];q.forEach(f=>f());return tree;};
 const html=()=>renderToStaticMarkup(render());
 const find=(tree,label)=>{if(!tree||typeof tree!=='object')return null;if(tree.props?.['data-action']===label)return tree;for(const c of React.Children.toArray([tree.props?.children,tree.props?.action])){const found=find(c,label);if(found)return found;}return null;};
 return {reads,exports,downloads,render,html,act:label=>{const found=find(render(),label);assert.ok(found,label);return found.props.onClick();},change:next=>{props={...props,...next};return render();},invalidate:()=>privateCurrent=false,dispose:()=>effects.forEach(e=>e?.cleanup?.())};
}
const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
test('real panel preserves end_date null and all chronological rows; 409 waits for explicit refresh',async()=>{
 const h=harness();h.render();h.reads[0].resolve(fixture('gaps-1004'));await flush();let html=h.html();assert.match(html,/Предыдущий день не подставляется/);assert.match(html,/24.10.2026/);assert.equal((html.match(/data-daily-date=/g)??[]).length,30);
 const exportRun=h.act('export');h.exports[0].reject({response:{status:409}});await exportRun;html=h.html();assert.match(html,/Данные изменились/);assert.equal(h.reads.length,1);assert.equal(h.downloads.length,0);
 h.act('refresh');h.render();assert.equal(h.reads.length,2);h.dispose();
});
test('old well read cannot restore numbers; denied clears daily data only',async()=>{
 const h=harness();h.render();h.change({wellId:'1001'});h.reads[0].resolve(fixture('gaps-1004'));await flush();assert.doesNotMatch(h.html(),/data-daily-date=/);
 h.reads[1].reject({response:{status:403}});await flush();assert.match(h.html(),/Суточный дебит недоступен/);assert.doesNotMatch(h.html(),/Тестовые данные|data-daily-date=/);h.dispose();
});
test('late export after period change, private epoch invalidation or unmount never downloads',async()=>{
 for(const boundary of ['period','private','unmount']){const h=harness();h.render();h.reads[0].resolve(fixture('gaps-1004'));await flush();const run=h.act('export');if(boundary==='period')h.change({period:7});if(boundary==='private')h.invalidate();if(boundary==='unmount')h.dispose();h.exports[0].resolve(new Blob(['xlsx']));await run;assert.equal(h.downloads.length,0,boundary);h.dispose();}
});
test('loaded all-null view retains 30 rows and no graph paths; export remains available',async()=>{
 const h=harness();h.change({wellId:'1001'});h.reads[0].resolve(fixture('all-null'));await flush();const html=h.html();assert.match(html,/Нет суточных значений/);assert.equal((html.match(/data-daily-date=/g)??[]).length,30);assert.doesNotMatch(html,/data-daily-series=/);h.dispose();
});
test('off and read failures remain distinct; no synthetic fallback for 401/404/503',async()=>{
 const off=harness();off.render();off.reads[0].resolve(fixture('disabled'));await flush();assert.match(off.html(),/Суточный режим выключен/);assert.doesNotMatch(off.html(),/data-daily-date=/);off.dispose();
 for(const status of [401,404,503]){const h=harness();h.render();h.reads[0].reject({response:{status},message:'Service unavailable'});await flush();const html=h.html();assert.doesNotMatch(html,/data-daily-date=|Тестовые данные/);if(status===404)assert.match(html,/Суточный дебит недоступен/);if(status===503)assert.match(html,/Не удалось загрузить/);h.dispose();}
});
test('429 retries exact displayed view; leaving mode aborts export and permits a new attempt',async()=>{
 const h=harness();h.render();h.reads[0].resolve(fixture('gaps-1004'));await flush();let run=h.act('export');h.exports[0].reject({response:{status:429}});await run;assert.match(h.html(),/Excel не удалось скачать/);assert.equal(h.reads.length,1);
 run=h.act('export');h.change({active:false});h.exports[1].resolve(new Blob(['old']));await run;assert.equal(h.downloads.length,0);h.change({active:true});
 run=h.act('export');assert.deepEqual(h.exports[2].args[0],h.exports[0].args[0]);h.exports[2].resolve(new Blob(['new']));await run;assert.equal(h.downloads.length,1);assert.match(h.html(),/Файл скачан/);h.dispose();
});
test('409 cannot be bypassed by browser period change; only explicit refresh reads latest',async()=>{
 const h=harness();h.render();h.reads[0].resolve(fixture('gaps-1004'));await flush();const run=h.act('export');h.exports[0].reject({response:{status:409}});await run;h.change({period:7});h.render();assert.equal(h.reads.length,1);assert.match(h.html(),/Данные изменились/);h.act('refresh');h.render();assert.equal(h.reads.length,2);assert.deepEqual(h.reads[1].args[1],{});h.dispose();
});
test('requested preset is read from fixed available end date; previous result is hidden immediately',async()=>{
 const h=harness();h.render();h.reads[0].resolve(fixture('gaps-1004'));await flush();const tree=h.change({period:7});assert.doesNotMatch(renderToStaticMarkup(tree),/data-daily-date=/);assert.deepEqual(h.reads[1].args[1],{start_date:'2026-10-18',end_date:'2026-10-24'});h.dispose();
});
test('mode navigation changes scoped keys, keeps hash and foreign query, and preserves seven-tab host',()=>{
 const navigation=[];const {TelemetryWorkspace}=loadDependency('@/components/telemetry/TelemetryWorkspace',new URL('../src/components/telemetry/TelemetryWorkspace.tsx',import.meta.url).pathname,{
  'react-router-dom':{useSearchParams:()=>[new URLSearchParams('tab=telemetry&x=1&x=2&event=saved')],useLocation:()=>({pathname:'/wells/9007199254740993',hash:'#saved-section'}),useNavigate:()=>value=>navigation.push(value),Link:()=>null},
 });
 const tree=TelemetryWorkspace({wellId:'9007199254740993'});const mode=React.Children.toArray(tree.props.children)[0].props.children;mode.props.onChange('daily');
 assert.equal(navigation[0].pathname,'/wells/9007199254740993');assert.equal(navigation[0].hash,'#saved-section');const query=new URLSearchParams(navigation[0].search);assert.deepEqual(query.getAll('x'),['1','2']);assert.equal(query.get('tab'),'telemetry');assert.equal(query.get('event'),'saved');assert.equal(query.get('daily_mode'),'daily');
});
test('chart keys expose exact daily values including reasons and Escape removes cursor',()=>{
 let cursor=0,states=[];const hooks={...React,useEffect:()=>{},useRef:initial=>({current:initial}),useState(initial){const i=cursor++;if(!states[i])states[i]={value:initial};return [states[i].value,x=>states[i].value=typeof x==='function'?x(states[i].value):x];}};
 const {DailyFlowChart}=loadDependency('@/components/telemetry/DailyFlowChart',parent,{react:hooks});
 const render=()=>{cursor=0;return DailyFlowChart({view:fixture('gaps-1004')});};const region=tree=>React.Children.toArray(tree.props.children).find(x=>x.props.className==='daily-chart');
 const press=key=>region(render()).props.onKeyDown({key,preventDefault:()=>{}});
 press('End');let html=renderToStaticMarkup(render());assert.match(html,/24.10.2026 · Факт: —/);assert.match(html,/Нет факта/);press('Home');html=renderToStaticMarkup(render());assert.match(html,/25.09.2026 · Факт: —/);press('Escape');assert.doesNotMatch(renderToStaticMarkup(render()),/24.10.2026 · Факт:/);
});
