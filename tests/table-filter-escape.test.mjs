import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDependency} from './load-dependency.mjs';

function nodes(value,result=[]){if(!value||typeof value!=='object')return result;if(Array.isArray(value)){for(const child of value)nodes(child,result);return result;}if(value.props){result.push(value);nodes(value.props.children,result);}return result;}
function harness(kind,compound){
 let current,index,focused=0;
 const owners=new Map();
 const hooks={useMemo:fn=>fn(),useEffect:()=>{},useRef:initial=>{const slot=index++;return current[slot]??(current[slot]={current:initial});},useState:initial=>{const owner=current,slot=index++;if(!Object.hasOwn(owner,slot))owner[slot]=typeof initial==='function'?initial():initial;return [owner[slot],next=>{owner[slot]=typeof next==='function'?next(owner[slot]):next;}];}};
 const jsx=(type,props)=>({type,props});const antd={theme:{useToken:()=>({token:{}})}};
 for(const name of ['Alert','Button','Checkbox','Empty','Input','Pagination','Popover','Space','Table','Tooltip'])antd[name]=()=>null;
 const here=new URL('../src/components/common/PulseTable.tsx',import.meta.url).pathname;
 const {PulseTable}=loadDependency('@/components/common/PulseTable',here,{react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},antd});
 function render(id,component,props){current=owners.get(id)??[];owners.set(id,current);index=0;return component(props);}
 const fields=[{key:'first',kind,label:'Первая',read:r=>r.first},...(compound?[{key:'second',kind:'text',label:'Вторая',read:r=>r.second}]:[])];
 const tree=render('table',PulseTable,{mode:'local',rows:[],schema:{fields,defaultSort:[],rowId:r=>r.id},columns:[{key:'first',title:'Колонка',filterKeys:fields.map(field=>field.key)}],query:{version:1,filters:[],sort:[]},onQueryChange:()=>{},pagination:{page:1,pageSize:20,onPageChange:()=>{}}});
 const columns=nodes(tree).find(node=>node.type===antd.Table).props.columns;
 const ownerElement=nodes(columns[0].children[0].title).find(node=>node.props.fields);
 function view(){
  const ownerTree=render('owner',ownerElement.type,ownerElement.props);
  const fieldElement=compound?nodes(nodes(ownerTree).find(node=>node.type===antd.Popover).props.content).find(node=>node.props.inline):nodes(ownerTree).find(node=>node.props.field);
  const fieldTree=render('field',fieldElement.type,fieldElement.props);
  const popover=compound?nodes(ownerTree).find(node=>node.type===antd.Popover):nodes(fieldTree).find(node=>node.type===antd.Popover);
  const trigger=nodes(popover.props.children).find(node=>node.type==='button');
  trigger.props.ref.current={focus:()=>focused++};
  return {open:popover.props.open,setOpen:popover.props.onOpenChange,
   content:compound?fieldTree:popover.props.content,owner:compound?ownerTree:fieldTree,trigger};
 }
 return {view,get focused(){return focused;}};
}
function dispatch(handlers,key='Escape'){
 let stopped=false,parentEscapes=0;
 const event={key,stopPropagation(){stopped=true;}};
 for(const handler of handlers){if(stopped)break;handler?.(event);}
 if(!stopped&&key==='Escape')parentEscapes++;
 return {stopped,parentEscapes};
}

for(const kind of ['text','pulseId','enum','number','date','datetime'])test(`compound ${kind} Escape closes only the open filter, restores focus, then permits parent Escape`,()=>{
 const run=harness(kind,true);run.view().setOpen(true);
 let view=run.view();assert.equal(view.open,true);
 assert.deepEqual(dispatch([view.content.props.onKeyDown,view.owner.props.onKeyDown]),{stopped:true,parentEscapes:0});
 assert.equal(run.focused,1);view=run.view();assert.equal(view.open,false);
 assert.deepEqual(dispatch([view.owner.props.onKeyDown]),{stopped:false,parentEscapes:1});
 view.setOpen(true);view=run.view();
 assert.deepEqual(dispatch([view.owner.props.onKeyDown],'Enter'),{stopped:false,parentEscapes:0});assert.equal(run.view().open,true);
});

for(const kind of ['enum','number','date','datetime'])test(`single ${kind} Escape from popup or open trigger preserves parent dialog`,()=>{
 for(const target of ['content','trigger']){
  const run=harness(kind,false);run.view().setOpen(true);
  let view=run.view();assert.deepEqual(dispatch([view[target].props.onKeyDown]),{stopped:true,parentEscapes:0},target);
  assert.equal(run.focused,1);view=run.view();assert.equal(view.open,false);
  assert.deepEqual(dispatch([view.trigger.props.onKeyDown]),{stopped:false,parentEscapes:1});
 }
});
