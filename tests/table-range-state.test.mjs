import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDependency} from './load-dependency.mjs';

function nodes(value,result=[]){
 if(!value||typeof value!=='object')return result;
 if(Array.isArray(value)){for(const child of value)nodes(child,result);return result;}
 if(value.props){result.push(value);nodes(value.props.children,result);}return result;
}

// Stateful component boundary harness: preserve hook slots and effect dependencies
// across prop changes. Ant controls are inspected via their public value/handlers.
function harness(field,filter){
 let current,index,effects,query={version:1,sort:[{field:'other',direction:'asc'}],filters:[filter,{field:'other',op:'contains',value:'keep'}]};
 const instances=new Map();
 const hooks={
  useMemo:fn=>fn(),
  useRef:initial=>{const slot=index++;return current.slots[slot]??(current.slots[slot]={current:initial});},
  useState:initial=>{const owner=current,slot=index++;if(!Object.hasOwn(owner.slots,slot))owner.slots[slot]=typeof initial==='function'?initial():initial;
   return [owner.slots[slot],next=>{const value=typeof next==='function'?next(owner.slots[slot]):next;if(!Object.is(value,owner.slots[slot])){owner.slots[slot]=value;owner.dirty=true;}}];},
  useEffect:(effect,deps)=>{const slot=index++,previous=current.slots[slot];if(!previous||!deps||deps.some((value,i)=>!Object.is(value,previous[i]))){current.slots[slot]=deps;effects.push(effect);}},
 };
 const jsx=(type,props)=>({type,props});const antd={theme:{useToken:()=>({token:{}})}};
 for(const name of ['Alert','Button','Checkbox','Empty','Input','Pagination','Popover','Space','Table','Tooltip'])antd[name]=()=>null;
 const here=new URL('../src/components/common/PulseTable.tsx',import.meta.url).pathname;
 const {PulseTable}=loadDependency('@/components/common/PulseTable',here,{react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},antd});
 function render(id,component,props){
  const owner=instances.get(id)??{slots:[],dirty:false};instances.set(id,owner);
  let tree;
  do{current=owner;index=0;effects=[];owner.dirty=false;tree=component(props);for(const effect of effects)effect();}while(owner.dirty);
  return tree;
 }
 function view(){
  const fields=[field,{key:'note',kind:'text',label:'Примечание',read:r=>r.note},{key:'other',kind:'text',label:'Другая колонка',read:r=>r.other}];
  const table=render('table',PulseTable,{mode:'local',rows:[],schema:{fields,defaultSort:[],rowId:r=>r.id},columns:[{key:'compound',title:'Составная',filterKeys:[field.key,'note']},{key:'other',title:'Другая колонка'}],query,onQueryChange:next=>{query=next;},pagination:{page:1,pageSize:20,onPageChange:()=>{}}});
  const columns=nodes(table).find(node=>node.type===antd.Table).props.columns;
  const ownerElement=nodes(columns[0].children[0].title).find(node=>node.props.fields);
  const owner=render('compound',ownerElement.type,ownerElement.props);
  const popover=nodes(owner).find(node=>node.type===antd.Popover);
  const fieldElement=nodes(popover.props.content).find(node=>node.props.inline&&node.props.field?.key===field.key);
  const content=render('range',fieldElement.type,fieldElement.props);
  const inputs=nodes(content).filter(node=>node.type===antd.Input);
  return {
   values:inputs.map(node=>node.props.value),
   edit:(bound,value)=>inputs[bound].props.onChange({target:{value}}),
   apply:()=>nodes(content).find(node=>node.type===antd.Button&&node.props.children==='Применить').props.onClick(),
   reset:()=>nodes(columns.at(-1).children[0].title).find(node=>node.props['aria-label']==='Сбросить фильтры').props.onClick(),
   clearCompound:()=>nodes(owner).find(node=>node.props.className==='pulse-table-filter-clear').props.onClick(),
  };
 }
 return {view,get query(){return query;},setQuery:next=>{query=next;}};
}

const fixtures=[
 {name:'number',field:{kind:'number'},from:7,to:12,shown:['7','12']},
 {name:'zero and exact integer',field:{kind:'number'},from:0,to:'9007199254740993',shown:['0','9007199254740993']},
 {name:'date',field:{kind:'date'},from:'2026-10-24',to:'2026-10-25',shown:['2026-10-24','2026-10-25']},
 {name:'zoned datetime',field:{kind:'datetime'},from:'2026-10-24T08:09:10.123456-04:00',to:'2026-10-25T08:09:10.654321Z',shown:['2026-10-24T15:09:10.123','2026-10-25T11:09:10.654']},
 {name:'unspecified datetime',field:{kind:'datetime',timezone:'unspecified'},from:'2026-10-24T08:09:10.123456',to:'2026-10-25T08:09:10.654321',shown:['2026-10-24T08:09:10.123456','2026-10-25T08:09:10.654321']},
 {name:'overlap',field:{kind:'datetime',timezone:'unspecified',readEnd:row=>row.end},from:'2026-10-24T08:09:10.123456',to:'2026-10-25T08:09:10.654321',shown:['2026-10-24T08:09:10.123456','2026-10-25T08:09:10.654321']},
];
function setup(fixture,bounds='both'){
 const field={key:'range',label:'Интервал',read:row=>row.value,...fixture.field};
 const filter={field:'range',op:field.readEnd?'overlap':'range',...(bounds!=='upper'?{from:fixture.from}:{}),...(bounds!=='lower'?{to:fixture.to}:{})};
 return {run:harness(field,filter),filter};
}

for(const reset of ['reset','clearCompound'])test(`${reset} clears applied compound bounds without reapplying stale values`,()=>{
 for(const fixture of fixtures)for(const bounds of ['both','lower','upper']){
  const {run}=setup(fixture,bounds),expected=[bounds==='upper'?'':fixture.shown[0],bounds==='lower'?'':fixture.shown[1]];
  assert.deepEqual(run.view().values,expected,`${fixture.name}/${bounds}: initial`);
  run.view()[reset]();
  assert.equal(run.query.filters.some(filter=>filter.field==='range'),false);
  assert.deepEqual(run.view().values,['',''],`${fixture.name}/${bounds}: cleared`);
  run.view().apply();assert.equal(run.query.filters.some(filter=>filter.field==='range'),false,`${fixture.name}/${bounds}: empty apply`);
  assert.deepEqual(run.query.sort,[{field:'other',direction:'asc'}]);
  assert.equal(run.query.filters.some(filter=>filter.field==='other'),reset==='clearCompound');
 }
});

test('equivalent applied range reconstructed by sibling filter edit preserves uncommitted input',()=>{
 const {run}=setup(fixtures[0]);
 run.view().edit(0,'8');run.view().edit(1,'13');
 run.setQuery({...structuredClone(run.query),filters:[...structuredClone(run.query.filters),{field:'note',op:'contains',value:'edited sibling'}]});
 assert.deepEqual(run.view().values,['8','13']);
 run.view().apply();
 assert.deepEqual(run.query.filters.find(filter=>filter.field==='range'),{field:'range',op:'range',from:'8',to:'13'});
 assert.equal(run.query.filters.find(filter=>filter.field==='note').value,'edited sibling');
 run.setQuery({...run.query,filters:[{field:'range',op:'range',from:9,to:14}]});
 assert.deepEqual(run.view().values,['9','14'],'a changed applied range still synchronizes');
});

test('unchanged inline bounds retain exact numeric precision, datetime timezone and microseconds on apply',()=>{
 for(const fixture of fixtures)for(const bounds of ['both','lower','upper']){
  const {run,filter}=setup(fixture,bounds);
  run.view().apply();
  const applied=run.query.filters.find(filter=>filter.field==='range');
  assert.deepEqual(applied,{...filter,from:filter.from,to:filter.to},`${fixture.name}/${bounds}`);
 }
});
