import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDependency} from './load-dependency.mjs';
const here=new URL('../src/components/common/PulseTable.tsx',import.meta.url).pathname;
const jsx=(type,props)=>({type,props});
const hooks={useMemo:fn=>fn(),useEffect:()=>{},useRef:()=>({current:null}),useState:initial=>[typeof initial==='function'?initial():initial,()=>{}]};
const antd={theme:{useToken:()=>({token:{}})}};
for(const name of ['Alert','Button','Checkbox','Empty','Input','Pagination','Popover','Space','Table','Tooltip'])antd[name]=()=>null;
const {PulseTable}=loadDependency('@/components/common/PulseTable',here,{react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},antd});
function nodes(value,result=[]){if(!value||typeof value!=='object')return result;if(Array.isArray(value)){for(const v of value)nodes(v,result);return result;}if(value.props){result.push(value);nodes(value.props.children,result);}return result;}
const query={version:1,filters:[{field:'name',op:'contains',value:'A'}],sort:[{field:'name',direction:'desc'}]};
const base={mode:'local',schema:{fields:[{key:'name',label:'Имя',kind:'text',read:r=>r.name}],rowId:r=>r.id,defaultSort:[]},rows:[],query,pagination:{page:3,pageSize:25,onPageChange:()=>{}},onQueryChange:()=>{}};
function rendered(props={}){const tree=PulseTable({...base,columns:[{key:'name',title:'Имя'}],...props});return {tree,columns:nodes(tree).find(n=>n.type===antd.Table).props.columns};}
function actions(columns){return nodes(columns.at(-1).children[0].title).filter(n=>n.type===antd.Button);}
test('three stable actions occupy only the second header row, reuse explicit last service column and preserve body controls',()=>{
 const body=()=> 'OPEN';const {tree,columns}=rendered({columns:[{key:'name',title:'Имя'},{key:'actions',title:'Действия',width:96,render:body}]});
 assert.equal(rendered({columns:[{key:'name',title:'Имя'},{key:'actions',title:'Действия',width:'8%'}]}).columns.at(-1).width,120);
 assert.equal(columns.length,2);assert.equal(columns.at(-1).children[0].render,body);assert.ok(columns.at(-1).width>=120);
 assert.deepEqual(actions(columns).map(n=>n.props['aria-label']),['Обновить','Сбросить сортировку','Сбросить фильтры']);
 assert.equal(nodes(columns.at(-1).title).filter(n=>n.type===antd.Button).length,0);
 assert.equal(nodes(tree).filter(n=>n.type===antd.Button&&n.props.children==='Сбросить фильтры').length,0);
 for(const cols of [[{key:'name',title:'Имя'}],[{key:'name',title:'Имя'},{key:'plain',title:''}],[{key:'actions',title:'Действия'},{key:'name',title:'Имя'}],[{key:'name',title:'Имя'},{key:'actions',title:'Действия',sortKey:'name'}],[{key:'name',title:'Имя'},{key:'actions',title:'Действия',filterKeys:['name']}]]){
  const result=rendered({columns:cols}).columns;assert.equal(result.length,cols.length+1);assert.equal(result.at(-1).fixed,undefined);assert.equal(result.at(-1).children[0].render({}),null);assert.equal(actions(result).length,3);
 }
});
test('query reset actions notify the controlled owner once without a separate page callback; refresh guards stay independent',()=>{
 let refreshed=0;const changes=[],pages=[];const props={onQueryChange:q=>changes.push(q),onRefresh:()=>refreshed++,pagination:{...base.pagination,onPageChange:(...p)=>pages.push(p)}};
 let buttons=actions(rendered({...props,loading:true,refreshing:true}).columns);
 assert.equal(buttons[0].props.disabled,true);assert.equal(buttons[1].props.disabled,false);assert.equal(buttons[2].props.disabled,false);
 buttons[1].props.onClick();buttons[2].props.onClick();assert.deepEqual(changes,[{...query,sort:[]},{...query,filters:[]}]);assert.deepEqual(pages,[],'query owner resets pagination atomically; PulseTable must not emit a second state change');
 buttons=actions(rendered(props).columns);buttons[0].props.onClick();assert.equal(refreshed,1);assert.equal(changes.length,2);
 for(const extra of [{onRefresh:undefined},{refreshDisabled:true},{refreshing:true}])assert.equal(actions(rendered({...props,...extra}).columns)[0].props.disabled,true);
 buttons=actions(rendered({query:{version:1,filters:[],sort:[]}}).columns);assert.deepEqual(buttons.map(n=>n.props.disabled),[true,true,true]);
});
test('server refresh and retry never bypass enabled/private access and use cursor reset before refetch',()=>{
 const hookfile=new URL('../src/hooks/useServerTable.ts',import.meta.url).pathname;let reads=0,resets=0,enabled=true,blocked=false,cursors=[];
 const state={query,cursors,revision:undefined,resetCursor:()=>resets++,back:()=>{},next:()=>{}};
 const {useServerTable}=loadDependency('@/hooks/useServerTable',hookfile,{react:hooks,'@/auth/AuthProvider':{useAuth:()=>({privateBlocked:blocked,privateEpoch:'e',capturePrivate:()=>({current:()=>true})})},'@tanstack/react-query':{useQuery:()=>({refetch:()=>reads++,isFetching:false}),useQueryClient:()=>({invalidateQueries:()=>Promise.resolve()})},'./useTableState':{useTableState:()=>state}});
 const use=()=>useServerTable('test',[],async()=>({items:[],next_cursor:null}),enabled);
 use().refresh();assert.equal(reads,1);state.cursors=['c'];use().refresh();assert.equal(resets,1);assert.equal(reads,1);
 enabled=false;use().refresh();use().refetch();blocked=true;enabled=true;use().refresh();use().refetch();assert.equal(resets,1);assert.equal(reads,1);
});

test('local refresh delegates the owned read without changing query/page; private, disabled and busy guards suppress it',()=>{
 const file=new URL('../src/components/common/LocalEntityTable.tsx',import.meta.url).pathname;let blocked=false,reads=0;const state={query,page:3,pageSize:25,setQuery:()=>{throw Error('refresh must preserve query');},setPage:()=>{throw Error('refresh must preserve page');}};
 const {LocalEntityTable}=loadDependency('@/components/common/LocalEntityTable',file,{'@/auth/AuthProvider':{useAuth:()=>({privateBlocked:blocked})},'../../hooks/useTableState':{useTableState:()=>state},'./PulseTable':{PulseTable:()=>null},'react/jsx-runtime':{jsx,jsxs:jsx}});
 const props={tableKey:'owned',fields:base.schema.fields,columns:[{key:'name',title:'Имя'}],onRefresh:()=>reads++};
 LocalEntityTable(props).props.onRefresh();assert.equal(reads,1);
 blocked=true;const privateTable=LocalEntityTable(props);assert.equal(privateTable.props.refreshDisabled,true);privateTable.props.onRefresh();
 blocked=false;LocalEntityTable({...props,refreshDisabled:true}).props.onRefresh();LocalEntityTable({...props,refreshing:true}).props.onRefresh();assert.equal(reads,1);assert.equal(LocalEntityTable({...props,onRefresh:undefined}).props.onRefresh,undefined);
});

test('cursor refresh rereads a fresh first-page cache with real QueryClient/QueryObserver while preserving exact query scope',async()=>{
 const {QueryClient,QueryObserver}=await import('@tanstack/react-query');
 for(const key of ['group-members-32-members','events']){
  const client=new QueryClient({defaultOptions:{queries:{staleTime:30000,gcTime:Infinity,retry:false}}});
  let observer;let requests=[];let subscription;
  const state={query,cursors:[],revision:undefined,resetCursor(){this.cursors=[];this.revision=undefined;},back:()=>{},next(cursor,revision){this.cursors.push(cursor);this.revision=revision;}};
  const queryHooks={useQuery(options){if(!observer){observer=new QueryObserver(client,options);subscription=observer.subscribe(()=>{});}else observer.setOptions(options);return observer.getCurrentResult();},useQueryClient:()=>client};
  const file=new URL('../src/hooks/useServerTable.ts',import.meta.url).pathname;
  const {useServerTable}=loadDependency('@/hooks/useServerTable',file,{react:hooks,'@/auth/AuthProvider':{useAuth:()=>({privateBlocked:false,privateEpoch:'epoch-A',capturePrivate:()=>({current:()=>true})})},'@tanstack/react-query':queryHooks,'./useTableState':{useTableState:()=>state}});
  const read=async(request)=>{requests.push(structuredClone(request));return {items:[{id:request.cursor?'PAGE2':`FIRST-${requests.filter(r=>!r.cursor).length}`}],next_cursor:'page2',graph_revision:'7'};};
  const render=()=>useServerTable(key,base.schema.fields,read);
  const settled=async()=>{if(!observer.getCurrentResult().isFetching)return;await new Promise(resolve=>{const off=observer.subscribe(result=>{if(!result.isFetching){off();resolve();}});});};
  try{
   render();await settled();assert.equal(render().data.items[0].id,'FIRST-1');
   state.next('page2','7');render();await settled();assert.equal(render().data.items[0].id,'PAGE2');
   const untouchedKeys=[['table','other-parent','epoch-A',query,undefined,undefined],['table',key,'epoch-B',query,undefined,undefined],['table',key,'epoch-A',{...query,sort:[]},undefined,undefined]];
   for(const cacheKey of untouchedKeys)client.setQueryData(cacheKey,{items:[],next_cursor:null});
   render().refresh();render();await settled();
   assert.deepEqual(requests.map(r=>r.cursor??'FIRST'),['FIRST','page2','FIRST']);assert.equal(render().data.items[0].id,'FIRST-2');
   assert.deepEqual(requests.map(r=>r.query),[query,query,query]);assert.deepEqual(requests.map(r=>r.graph_revision),[undefined,'7',undefined]);assert.deepEqual(state.cursors,[]);
   for(const cacheKey of untouchedKeys)assert.equal(client.getQueryState(cacheKey).isInvalidated,false);
  }finally{subscription?.();observer?.destroy();client.clear();}
 }
});
