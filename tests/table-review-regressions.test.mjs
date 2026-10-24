import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDependency} from './load-dependency.mjs';
import * as draft from '../src/lib/accessDraft.ts';

function nodes(value,result=[]){if(!value||typeof value!=='object')return result;if(Array.isArray(value)){for(const item of value)nodes(item,result);return result;}if(value.props){result.push(value);nodes(value.props.children,result);}return result;}
test('FE01 inline enum and range Escape close the actual compound owner and restore its trigger',()=>{
 for(const kind of ['enum','number','datetime']){
  let instance='table';const updates=[];let focused=0;
  const hooks={useMemo:fn=>fn(),useEffect:()=>{},useRef:()=>({current:undefined}),useState:initial=>{const owner=instance;return [typeof initial==='function'?initial():initial,value=>updates.push({owner,value})];}};
  const jsx=(type,props)=>({type,props});const antd={theme:{useToken:()=>({token:{}})}};for(const name of ['Alert','Button','Checkbox','Empty','Input','Pagination','Popover','Space','Table'])antd[name]=()=>null;
  const here=new URL('../src/components/common/PulseTable.tsx',import.meta.url).pathname;
  const {PulseTable}=loadDependency('@/components/common/PulseTable',here,{react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},antd});
  const fields=[{key:'first',label:'Первая группа',kind,options:kind==='enum'?[{value:'x',label:'X'}]:undefined,read:r=>r.first},{key:'second',label:'Вторая группа',kind:'text',read:r=>r.second}];
  const tree=PulseTable({schema:{fields,defaultSort:[],rowId:r=>r.id},columns:[{key:'compound',title:'Составная',filterKeys:['first','second'],sortKey:'first'}],query:{version:1,sort:[],filters:[]},onQueryChange:()=>{},mode:'local',rows:[],pagination:{page:1,pageSize:20,onPageChange:()=>{}}});
  const table=nodes(tree).find(node=>node.type===antd.Table),column=table.props.columns[0];
  const ownerElement=nodes(column.children[0].title).find(node=>typeof node.type==='function');instance='owner';const ownerTree=ownerElement.type(ownerElement.props);
  const popover=nodes(ownerTree).find(node=>node.type===antd.Popover);const trigger=nodes(popover.props.children).find(node=>node.type==='button');trigger.props.ref.current={focus:()=>focused++};
  const fieldElement=nodes(popover.props.content).find(node=>typeof node.type==='function'&&node.props.field?.key==='first');instance='inline';const content=fieldElement.type(fieldElement.props);
  content.props.onKeyDown({key:'Escape',stopPropagation(){}});
  assert.ok(updates.some(update=>update.owner==='owner'&&update.value===false),`${kind}: the owning Popover must close`);assert.equal(focused,1,`${kind}: focus returns to compound trigger`);
 }
});

test('FE02 table-only group navigation preserves dirty and pending owner; real exits still block',()=>{
 const current={pathname:'/system/access',search:'?tab=groups&entity=groups&id=32&copy=0',hash:'#editor'};
 const withTable=key=>({...current,search:current.search+'&'+new URLSearchParams({[key]:JSON.stringify({query:{version:1,sort:[{field:'name',direction:'asc'}],filters:[]},cursors:['next']})})});
 const snapshot=structuredClone(current);
 for(const pending of [false,true])for(const mode of ['members','candidates'])assert.equal(draft.blockAccessLocationNavigation(true,pending,current,withTable(`table.group-members-32-${mode}`),'32'),false);
 assert.deepEqual(current,snapshot);
 for(const next of [{...current,pathname:'/people'},{...current,search:'?tab=groups'},{...current,search:'?tab=groups&entity=groups&id=33&copy=0'},{...current,search:'?tab=roles&entity=roles&id=32&copy=0'},{...current,search:'?tab=groups&entity=groups&id=32&copy=1'},withTable('table.group-members-33-members'),withTable('table.users'),{...withTable('table.group-members-32-members'),hash:'#other'}])assert.equal(draft.blockAccessLocationNavigation(true,false,current,next,'32'),true);
 assert.equal(draft.blockAccessLocationNavigation(false,true,current,{...current,pathname:'/people'},'32'),true);
 assert.equal(draft.blockAccessLocationNavigation(false,false,current,{...current,pathname:'/people'},'32'),false);
 const fresh={pathname:'/system/access',search:'?tab=groups&entity=groups&id=new',hash:''};assert.equal(draft.blockAccessLocationNavigation(true,false,fresh,{...fresh,search:fresh.search+'&table.group-members-new-candidates=%7B%7D'},null),false);
 assert.equal(draft.blockAccessLocationNavigation(true,false,current,withTable('table.group-members-32-members'),undefined),true);
});

test('FE03 organization filter options use bounded users.read facets with exact codes and cursor, never assignment catalogue',async()=>{
 const calls=[];const items=[{value:'-900',label:'ID -900'},{value:'0',label:'ID 0'},{value:'9007199254740993',label:'ID 9007199254740993'}];
 const here=new URL('../src/components/access/tableFields.ts',import.meta.url).pathname;
 const {accountFields}=loadDependency('@/components/access/tableFields',here,{'@/api/access':{managementApi:{orgOptions:async()=>{throw new Error('users.scope.assign forbidden');},userFilterOptions:async(field,search,cursor,signal)=>{calls.push({field,search,cursor,signal});return {items,next_cursor:'next',graph_revision:'7'};}}}});
 for(const nameColumn of ['Пользователь','Участник'])for(const key of ['ngdu_id','department_id']){
  const signal=new AbortController().signal;const optionField=accountFields(nameColumn).find(field=>field.key===key);assert.equal(optionField.read({organization_scope:null}),null);const page=await optionField.loadOptions('ID','current',signal);assert.equal(page.items,items);assert.equal(page.next_cursor,'next');assert.deepEqual(calls.at(-1),{field:key,search:'ID',cursor:'current',signal});
 }
});
