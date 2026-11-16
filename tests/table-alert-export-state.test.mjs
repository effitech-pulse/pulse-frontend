import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDependency} from './load-dependency.mjs';
import {legacyAuth} from './auth-fixture.mjs';
const query={version:1,sort:[],filters:[]};
function nodes(tree){return [tree,...(Array.isArray(tree?.props?.children)?tree.props.children:[tree?.props?.children]).filter(x=>x&&typeof x==='object').flatMap(nodes)];}
test('changing clean history selection invalidates an in-flight alert workbook before download',async()=>{
 let finish;const workbook=new Promise(resolve=>finish=resolve),downloads=[];
 const slots=[];let cursor=0;const hooks={useEffect:()=>{},useMemo:fn=>fn(),useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=v];},useRef:initial=>{const i=cursor++;return slots[i]??(slots[i]={current:initial});}};
 const jsx=(type,props)=>({type,props});const antd={App:{useApp:()=>({message:{error:()=>{}}})}};for(const key of ['Alert','Button','Card','Collapse','Descriptions','Dropdown','Modal','Select','Space','Tag','Typography'])antd[key]=()=>null;
 const row={app_well_id:7,well_id:7,risk:.5,alert:true,tier:'alert',rule_findings:[],window_end:null};
 const data={profile:'research',wells:[row]};let tableQuery=query;
 const boundaries={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},antd,'react-router-dom':{Link:()=>null,useSearchParams:()=>[new URLSearchParams('model=all')]},'@/auth/AuthProvider':{useAuth:()=>legacyAuth('admin')},
  '@/hooks/useTableState':{useTableState:()=>({query:tableQuery,page:1,pageSize:20,cursors:[],selectionLink:()=>'',resetForSearch:()=>{}})},
  '@tanstack/react-query':{useQuery:options=>({data:options.queryKey[0]==='ml-wells'?data:undefined,dataUpdatedAt:1,isFetching:false})},
  '@/hooks/useWells':{useWells:()=>({data:[],dataUpdatedAt:1,isFetching:false})},'@/hooks/useMlRun':{useMlRun:()=>({start:{},running:false,lastRun:null})},
  '@/components/common/LocalEntityTable':{LocalEntityTable:()=>null},'@/lib/alertExport':{availableAlertRuns:()=>[],normalizeResponsible:value=>value??null,selectAlertRun:()=>{},createAlertWorkbook:()=>workbook},xlsx:{writeFile:(...args)=>downloads.push(args)},
 };
 const {MlRiskPage}=loadDependency('@/pages/MlRiskPage',new URL('../src/pages/MlRiskPage.tsx',import.meta.url).pathname,boundaries);
 const render=()=>{cursor=0;return MlRiskPage();};
 const controls=nodes(render()).find(n=>n.props?.renderControls).props.renderControls({rows:[row],query});
 const pending=nodes(controls).find(n=>n.props?.children==='Экспорт в Excel').props.onClick();
 tableQuery={...query,filters:[{field:'id',op:'contains',value:'other'}]};render();finish({});
 await pending;await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(downloads,[]);
});
