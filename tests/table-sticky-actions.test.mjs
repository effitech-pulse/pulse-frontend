import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDependency} from './load-dependency.mjs';
const here=new URL('../src/components/common/PulseTable.tsx',import.meta.url).pathname;
const jsx=(type,props)=>({type,props});
function nodes(value,result=[]){if(!value||typeof value!=='object')return result;if(Array.isArray(value)){for(const item of value)nodes(item,result);return result;}if(value.props){result.push(value);nodes(value.props.children,result);}return result;}
function harness(){
 let index=0;const values=[],effects=[];
 const react={useMemo:fn=>fn(),useRef:initial=>{const slot=index++;return values[slot]??(values[slot]={current:initial});},useState:initial=>{const slot=index++;if(!(slot in values))values[slot]=typeof initial==='function'?initial():initial;return [values[slot],next=>values[slot]=typeof next==='function'?next(values[slot]):next];},useEffect:effect=>effects.push(effect)};
 const antd={theme:{useToken:()=>({token:{}})}};for(const name of ['Alert','Button','Checkbox','Empty','Input','Pagination','Popover','Space','Table','Tooltip'])antd[name]=()=>null;
 const {PulseTable}=loadDependency('@/components/common/PulseTable',here,{react,'react/jsx-runtime':{jsx,jsxs:jsx},antd});
 const render=props=>{index=0;const tree=PulseTable(props);return {tree,columns:nodes(tree).find(node=>node.type===antd.Table).props.columns};};
 return {render,effects};
}
const base={mode:'local',rows:[{id:'1',name:'A'}],schema:{fields:[{key:'name',label:'Имя',kind:'text',read:r=>r.name}],defaultSort:[],rowId:r=>r.id},query:{version:1,filters:[],sort:[]},onQueryChange:()=>{},pagination:{page:1,pageSize:25,onPageChange:()=>{}}};
test('only final filter leaf is sticky, caller header attributes/events compose, body and wide service width stay intact',()=>{
 for(const key of ['actions','membership']){
  let clicked=0,received;const body=()=> 'row control';
  const columns=[{key:'name',title:'Имя'},{key,title:'Действие',width:180,render:body,onHeaderCell:column=>{received=column;return {className:'caller-header',style:{padding:7},'data-owner':'caller',onClick:()=>clicked++};}}];
  const result=harness().render({...base,columns});const last=result.columns.at(-1),leaf=last.children[0],header=leaf.onHeaderCell(leaf);
  assert.equal(received,leaf);assert.match(header.className,/caller-header/);assert.match(header.className,/pulse-table-actions-sticky/);assert.deepEqual(header.style,{padding:7});assert.equal(header['data-owner'],'caller');header.onClick();assert.equal(clicked,1);
  assert.equal(last.width,180);assert.equal(last.fixed,undefined);assert.equal(leaf.fixed,undefined);assert.equal(leaf.render,body);assert.doesNotMatch(last.onHeaderCell(last).className??'',/pulse-table-actions-sticky/);
  assert.equal(nodes(leaf.title).filter(n=>n.props.className==='pulse-table-filter-actions').length,1);
  assert.equal(columns[1].onHeaderCell(columns[1]).className,'caller-header');
 }
 const result=harness().render({...base,columns:[{key:'name',title:'Имя'}]});assert.match(result.columns.at(-1).children[0].onHeaderCell({}).className,/pulse-table-actions-sticky/);assert.equal(result.columns.at(-1).children[0].render({}),null);
});
test('local container resize releases left fixation below480 and restores it at480 without changing fields or row controls; observer cleans up',()=>{
 const previous=globalThis.ResizeObserver;let callback,observed,disconnected=0;
 globalThis.ResizeObserver=class{constructor(cb){callback=cb;}observe(target){observed=target;}disconnect(){disconnected++;}};
 try{
  const run=harness();const columns=[{key:'name',title:'Имя',fixed:'left',width:190},{key:'metadata',title:'Метаданные',fixed:true,width:150},{key:'actions',title:'Действие',width:170,render:()=> 'OPEN'}];
  const props={...base,columns};let result=run.render(props);const element={getBoundingClientRect:()=>({width:600})};assert.ok(result.tree.props.ref,'measure the table itself');result.tree.props.ref.current=element;
  const cleanups=run.effects.map(effect=>effect()).filter(fn=>typeof fn==='function');assert.equal(observed,element);
  callback([{target:element,contentRect:{width:479}}]);result=run.render(props);
  for(const column of result.columns.slice(0,2)){assert.equal(column.fixed,undefined);assert.equal(column.children[0].fixed,undefined);}
  assert.equal(result.columns[0].width,190);assert.equal(result.columns.at(-1).width,170);assert.equal(result.columns.at(-1).children[0].render,columns.at(-1).render);assert.match(result.columns.at(-1).children[0].onHeaderCell({}).className,/pulse-table-actions-sticky/);
  callback([{target:element,contentRect:{width:480}}]);result=run.render(props);assert.equal(result.columns[0].fixed,'left');assert.equal(result.columns[0].children[0].fixed,'left');assert.equal(result.columns[1].fixed,true);assert.equal(result.columns[1].children[0].fixed,true);
  assert.equal(columns[0].fixed,'left');assert.equal(columns[1].fixed,true);for(const cleanup of cleanups)cleanup();assert.equal(disconnected,1);
 }finally{globalThis.ResizeObserver=previous;}
});
test('focused filters scroll into the unobscured area measured from real sticky service geometry; actions, body and visible fields do not move',()=>{
 const {tree}=harness().render({...base,columns:[{key:'name',title:'Имя'}]});assert.equal(typeof tree.props.onFocusCapture,'function');
 for(const serviceWidth of [120,170,180]){
  let scroll=0;const port={getBoundingClientRect:()=>({left:277,right:1227}),querySelector:()=>sticky,querySelectorAll:()=>[],get scrollLeft(){return scroll;},set scrollLeft(value){scroll=value;}};
  const sticky={getBoundingClientRect:()=>({left:1227-serviceWidth,right:1227}),contains:()=>false};
  const target={closest:selector=>selector==='.pulse-table-filter-cell'?{}:selector==='.ant-table-cell-fix-left'?null:port,getBoundingClientRect:()=>({left:1118.734-scroll,right:1238.734-scroll,width:120})};
  tree.props.onFocusCapture({target});const rect=target.getBoundingClientRect();assert.ok(scroll>0);assert.ok(rect.right<=sticky.getBoundingClientRect().left-4);assert.ok(rect.left>=281);
  const previous=scroll;tree.props.onFocusCapture({target});assert.equal(scroll,previous,'already visible input must not jitter');
 }
 let scroll=300;const leftCell={getBoundingClientRect:()=>({right:190})};const sticky={getBoundingClientRect:()=>({left:360}),contains:()=>false};const port={getBoundingClientRect:()=>({left:0,right:480}),querySelector:()=>sticky,querySelectorAll:()=>[leftCell],get scrollLeft(){return scroll;},set scrollLeft(value){scroll=value;}};
 const target={closest:selector=>selector==='.pulse-table-filter-cell'?{}:selector==='.ant-table-cell-fix-left'?null:port,getBoundingClientRect:()=>({left:150,right:270,width:120})};tree.props.onFocusCapture({target});assert.ok(scroll<300,'reverse focus accounts for the existing wide left pinned column');
 for(const kind of ['body','actions','fixed-left']){scroll=300;sticky.contains=()=>kind==='actions';target.closest=selector=>selector==='.pulse-table-filter-cell'?(kind==='body'?null:{}):selector==='.ant-table-cell-fix-left'?(kind==='fixed-left'?leftCell:null):port;tree.props.onFocusCapture({target});assert.equal(scroll,300,kind);}
});
