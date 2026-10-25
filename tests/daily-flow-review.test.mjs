import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import * as Ant from 'antd';
import dayjs from 'dayjs';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadDependency} from './load-dependency.mjs';
const parent=new URL('../src/components/telemetry/TelemetryWorkspace.tsx',import.meta.url).pathname;
function nodes(tree){const result=[];React.Children.forEach(tree,node=>{if(React.isValidElement(node)){result.push(node);result.push(...nodes(node.props.children));}});return result;}

// Executes the actual ordinary workspace/import functions with persistent hook
// frames and their effects. This source harness is not React DOM/browser proof.
function ordinaryHarness(){
 let mode='parameters',frame,cursor=0,queries=[];let ordinary,imported;
 const empty=()=>({state:[],effects:[],pending:[]});
 const hooks={...React,useMemo:fn=>fn(),useState(initial){const i=cursor++;if(!frame.state[i])frame.state[i]={value:typeof initial==='function'?initial():initial};const slot=frame.state[i];return [slot.value,value=>slot.value=typeof value==='function'?value(slot.value):value];},useRef(initial){const i=cursor++;return frame.state[i]??(frame.state[i]={current:initial});},useEffect(fn,deps){const owner=frame,i=cursor++,old=owner.effects[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j])))owner.pending.push(()=>{old?.cleanup?.();owner.effects[i]={deps,cleanup:fn()};});}};
 const invoke=(component,props,owner)=>{frame=owner;cursor=0;const tree=component(props);const effects=owner.pending.splice(0);effects.forEach(fn=>fn());return tree;};
 const {TelemetryWorkspace}=loadDependency('@/components/telemetry/TelemetryWorkspace',parent,{
  react:hooks,antd:{...Ant,App:{useApp:()=>({message:{success(){},error(){}}})}},
  'react-router-dom':{useSearchParams:()=>[new URLSearchParams(`tab=telemetry&daily_mode=${mode}`)],useLocation:()=>({pathname:'/wells/1004',hash:''}),useNavigate:()=>()=>{},Link:()=>null},
  '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}}),useQuery:options=>{queries.push(options);return {data:undefined};}},
 });
 function render(){queries=[];const root=TelemetryWorkspace({wellId:'1004'});const p=nodes(root).find(node=>node.type?.name==='ParametersWorkspace');if(!p){ordinary=undefined;imported=undefined;return {root,param:null,importTree:null,queries};}
  ordinary??=empty();const param=invoke(p.type,p.props,ordinary);const modal=nodes(param).find(node=>node.props.title==='Импорт телеметрии');
  const importElement=modal?.props.children;if(modal?.props.open||imported&&!modal?.props.destroyOnClose){imported??=empty();}else imported=undefined;
  const importTree=imported?invoke(importElement.type,importElement.props,imported):null;
  return {root,param,modal,importTree,queries};
 }
 return {render,mode:value=>{mode=value;return render();},settle:()=>{render();return render();}};
}
test('FE-R1 ordinary compare period/channels/zoom and import draft survive daily and history return',()=>{
 const h=ordinaryHarness();h.settle();let snapshot=h.render();
 const get=(predicate)=>{const found=nodes(h.render().param).find(predicate);assert.ok(found);return found;};
 get(n=>n.props['aria-label']==='Вид телеметрии').props.onChange('compare');h.settle();
 const ranges=nodes(h.render().param).filter(n=>n.type===Ant.DatePicker.RangePicker);
 ranges[0].props.onChange([dayjs('2026-08-01'),dayjs('2026-08-31')]);ranges.at(-1).props.onChange([dayjs('2026-07-01'),dayjs('2026-07-31')]);h.settle();
 get(n=>n.type===Ant.Checkbox.Group).props.onChange(['Ia','F_out']);h.settle();get(n=>n.props['aria-label']==='Временной интервал графика').props.onChange([200,800]);
 get(n=>n.props.menu?.items?.some(x=>x.key==='import')).props.menu.onClick({key:'import'});snapshot=h.settle();assert.ok(snapshot.importTree);
 nodes(snapshot.importTree).find(n=>n.props['aria-label']==='Кодировка CSV').props.onChange('windows-1251');
 nodes(snapshot.importTree).find(n=>n.props['aria-label']==='Разделитель CSV').props.onChange(';');
 const assertPreserved=()=>{const s=h.render();assert.ok(s.param,'ordinary workspace must retain its mounted instance');const list=nodes(s.param);assert.equal(list.find(n=>n.props['aria-label']==='Вид телеметрии').props.value,'compare');const range=list.filter(n=>n.type===Ant.DatePicker.RangePicker);assert.equal(range[0].props.value[0].format('YYYY-MM-DD'),'2026-08-01');assert.equal(range.at(-1).props.value[0].format('YYYY-MM-DD'),'2026-07-01');assert.deepEqual(list.find(n=>n.type===Ant.Checkbox.Group).props.value,['Ia','F_out']);assert.deepEqual(list.find(n=>n.props['aria-label']==='Временной интервал графика').props.value,[200,800]);assert.ok(s.importTree);assert.equal(nodes(s.importTree).find(n=>n.props['aria-label']==='Кодировка CSV').props.value,'windows-1251');assert.equal(nodes(s.importTree).find(n=>n.props['aria-label']==='Разделитель CSV').props.value,';');return s;};
 h.mode('daily');snapshot=assertPreserved();assert.ok(nodes(snapshot.root).some(n=>n.props.hidden===true),'inactive ordinary subtree must be hidden');assert.ok(snapshot.queries.every(q=>q.enabled===false));assert.equal(snapshot.modal.props.open,false);
 h.mode('parameters');assertPreserved();
 // The same URL state changes are used by browser back/forward.
 h.mode('daily');h.mode('parameters');snapshot=assertPreserved();assert.equal(snapshot.modal.props.open,true);
});
test('FE-R2 real Ant SSR exposes named radio groups and native checked radio labels',()=>{
 const {DailyChoice}=loadDependency('@/components/telemetry/DailyFlowPanel',parent);
 for(const [label,value,options] of [['Режим телеметрии','daily',[{value:'parameters',label:'Параметры'},{value:'daily',label:'Суточный дебит'}]],['Период суточного дебита',30,[{value:7,label:'7 дней'},{value:30,label:'30 дней'},{value:90,label:'90 дней'}]]]){
  const html=renderToStaticMarkup(React.createElement(DailyChoice,{label,value,options,onChange:()=>{}}));
  assert.ok([...html.matchAll(/<[^>]+>/g)].some(([tag])=>/role="radiogroup"/.test(tag)&&tag.includes(`aria-label="${label}"`)),`missing semantic group: ${label}`);
  assert.equal((html.match(/type="radio"/g)??[]).length,options.length);assert.equal((html.match(/checked=""/g)??[]).length,1);for(const option of options)assert.ok(html.includes(option.label));
 }
});
