import test from 'node:test';
import assert from 'node:assert/strict';
import * as chart from '../src/lib/organizationChart.ts';
import {flattenOrganizationTree} from '../src/lib/organizationTree.ts';
const data={complete:true,employee_count:3,organizations:[{key:'o',value:'Организация',employee_count:3,divisions:[{key:'d',value:'Подразделение',employee_count:3,departments:[{key:'a',value:'Отдел',employee_count:2,employees:[{id:'1',name:'Первый',job_title:null,active:true},{id:'2',name:'Второй',job_title:null,active:true}]},{key:'b',value:'Отдел',employee_count:1,employees:[{id:'3',name:'Третий',job_title:null,active:true}]}]}]}]};
test('initial chart expands exactly the first existing path and lays parent over first child column',()=>{
 const initial=chart.initialChartExpansion(data);assert.deepEqual([...initial],['o','d','a']);const rows=flattenOrganizationTree(data,new Set(['o','d','a','b']));const layout=chart.layoutOrganizationChart(rows,new Map());const by=new Map(layout.cards.map(c=>[c.key,c]));
 assert.equal(by.get('o').y,16);assert.equal(by.get('employee:1').y,418);assert.equal(by.get('o').x,by.get('d').x);assert.equal(by.get('d').x,by.get('a').x);assert.equal(by.get('a').x,by.get('employee:1').x);assert.equal(by.get('employee:1').x,by.get('employee:2').x);assert.equal(by.get('b').x-by.get('a').x,352);assert.ok(by.get('employee:2').y>by.get('employee:1').y+by.get('employee:1').height);
 assert.ok(layout.edges.every(e=>e.parent!=='employee:1'&&e.parent!=='employee:2'));assert.ok(layout.edges.some(e=>e.parent==='a'&&e.kind==='rail'));
});
test('measured long cards push later levels and employees without overlapping neighboring subtrees',()=>{
 const rows=flattenOrganizationTree(data,new Set(['o','d','a','b']));const layout=chart.layoutOrganizationChart(rows,new Map([['o',440],['a',320],['employee:1',600]]));const by=new Map(layout.cards.map(c=>[c.key,c]));assert.equal(by.get('d').y,by.get('o').y+464);assert.ok(by.get('employee:1').y>=by.get('a').y+344);assert.equal(by.get('employee:2').y,by.get('employee:1').y+624);
 for(let i=0;i<layout.cards.length;i++)for(let j=i+1;j<layout.cards.length;j++){const a=layout.cards[i],b=layout.cards[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
});
test('2D culling clips crossing edges even when endpoints are outside and pins only one active card',()=>{
 const clipped=chart.clipChartSegment({x1:-100,y1:50,x2:900,y2:50},{x:0,y:0,width:320,height:100});assert.deepEqual(clipped,{x1:0,y1:50,x2:320,y2:50});assert.equal(chart.clipChartSegment({x1:0,y1:300,x2:500,y2:300},{x:0,y:0,width:320,height:100}),null);
 const roots=Array.from({length:5000},(_,i)=>({key:`r${i}`,parent:null,depth:0,position:i+1,siblings:5000,label:'Org',empty:false,count:1,level:'Организация'}));const layout=chart.layoutOrganizationChart(roots,new Map());const view=chart.chartWindow(layout,{x:0,y:0,width:640,height:520},'r4999');assert.ok(view.cards.length<10);assert.ok(view.cards.some(c=>c.key==='r4999'));assert.equal(layout.cards.length,5000);
});
test('5000 employee column grows vertically and complete 20000 logical-node forest remains reachable with bounded windows',()=>{
 const big=structuredClone(data);const org=big.organizations[0],div=org.divisions[0],dept=div.departments[0];big.employee_count=org.employee_count=div.employee_count=dept.employee_count=5000;div.departments=[dept];dept.employees=Array.from({length:5000},(_,i)=>({id:String(i+1),name:'Ш'.repeat(200),job_title:'Д'.repeat(200),active:true}));const rows=flattenOrganizationTree(big,new Set(['o','d','a']));const layout=chart.layoutOrganizationChart(rows,new Map());assert.equal(layout.cards.length,5003);assert.ok(layout.width<600);assert.ok(layout.height>500000);const last=layout.cards.at(-1);const view=chart.chartWindow(layout,{x:last.x,y:last.y,width:640,height:520},last.key);assert.ok(view.cards.length<20);assert.ok(view.edges.length<30);
 const forest=Array.from({length:5000},(_,i)=>({key:`o${i}`,value:null,employee_count:1,divisions:[{key:`d${i}`,value:null,employee_count:1,departments:[{key:`p${i}`,value:null,employee_count:1,employees:[{id:String(i+1),name:'Name',job_title:null,active:true}]}]}]}));const full={complete:true,employee_count:5000,organizations:forest};const expanded=new Set(forest.flatMap(o=>[o.key,o.divisions[0].key,o.divisions[0].departments[0].key]));const all=chart.layoutOrganizationChart(flattenOrganizationTree(full,expanded),new Map());assert.equal(all.cards.length,20000);for(const zoom of [.5,1,2]){const window=chart.chartWindow(all,{x:0,y:0,width:1280/zoom,height:640/zoom},'employee:5000');assert.ok(window.cards.length<50);assert.ok(window.edges.length<75);}
});
test('camera uses world-space anchor through zoom and remeasurement without fit-all',()=>{
 assert.deepEqual(chart.zoomChartScroll({x:240,y:120},{width:640,height:520},1,1.5),{x:520,y:310});
 assert.deepEqual(chart.anchorChartScroll({x:64,y:300},{x:64,y:900},{x:0,y:200},.5),{x:0,y:500});
 const target={x:416,y:1400,width:248,height:600};const camera=chart.revealChartCard(target,{x:0,y:0,width:320,height:520},1);assert.equal(camera.y,1400);assert.ok(camera.x<=target.x&&camera.x+320>target.x);
 const centered=chart.centerChartCard({x:416,y:1400,width:248,height:88},{width:640,height:520},1);assert.deepEqual(centered,{x:220,y:1184});
});
test('zoom clamps camera to scaled logical bounds and reveals active card at every step',()=>{
 const viewport={width:950,height:640},bounds={width:376,height:410},active={x:64,y:284,width:248,height:110};let scroll={x:0,y:0},previous=1;
 for(const zoom of [1.25,1.5,1.75,2]){scroll=chart.zoomChartCamera(scroll,viewport,previous,zoom,bounds,active);assert.equal(scroll.x,0,'world narrower than viewport cannot grow horizontal camera');assert.ok(scroll.y<=Math.max(0,bounds.height*zoom-viewport.height));assert.ok(active.x*zoom>=scroll.x&&((active.x+active.width)*zoom<=scroll.x+viewport.width));assert.ok(active.y*zoom>=scroll.y&&(active.y+active.height)*zoom<=scroll.y+viewport.height);previous=zoom;}
});
