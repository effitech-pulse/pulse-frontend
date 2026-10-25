import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDependency} from './load-dependency.mjs';

function nodes(value,result=[]){if(!value||typeof value!=='object')return result;if(Array.isArray(value)){for(const item of value)nodes(item,result);return result;}if(value.props){result.push(value);nodes(value.props.children,result);}return result;}
function consumer(name){
 const slots=[];let index;
 const hooks={useEffect:()=>{},useRef:initial=>({current:initial}),useState:initial=>{const slot=index++;if(!Object.hasOwn(slots,slot))slots[slot]=typeof initial==='function'?initial():initial;return [slots[slot],next=>{slots[slot]=typeof next==='function'?next(slots[slot]):next;}];}};
 const jsx=(type,props)=>({type,props});
 const here=new URL(`../src/components/equipment/EquipmentPassport${name}.tsx`,import.meta.url).pathname;
 const exports=loadDependency(`@/components/equipment/EquipmentPassport${name}`,here,{react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'@/auth/AuthProvider':{useAuth:()=>({can:()=>false,privateBlocked:false})},'@tanstack/react-query':{useQuery:()=>({data:[]})}});
 const props=name==='Preview'?{preview:{expires_at:'2099-01-01',issues:[],diff:[],commands:{rows:Array.from({length:60},(_,i)=>({row_key:String(i+1),well_id:String(1001+i),slot:'pump',action:'update'}))},changed_count:0},busy:false}: {canImport:true,issues:Array.from({length:60},(_,i)=>({row_key:String(i+1),field:'model',code:'invalid',message:'Ошибка'})),selected:[]};
 const render=()=>{index=0;return nodes(exports[`EquipmentPassport${name}`](props)).find(node=>node.props.mode==='local').props;};
 return {render};
}
for(const name of ['Preview','Import'])test(`${name} owns query resets from page2 while preserving pageSize and the independent axis`,()=>{
 const run=consumer(name);assert.equal(run.render().rows.length,60);const field=name==='Preview'?'well_id':'row_key';
 const filtered={version:1,sort:[],filters:[{field,op:'contains',value:'1'}]};
 const sorted={...filtered,sort:[{field,direction:'desc'}]};
 for(const next of [sorted,{...sorted,filters:[]},{...sorted,sort:[]}]){
  run.render().pagination.onPageChange(2,10);assert.equal(run.render().pagination.page,2);
  run.render().onQueryChange(next);
  const table=run.render();assert.equal(table.pagination.page,1);assert.equal(table.pagination.pageSize,10);assert.deepEqual(table.query,next);
 }
});
