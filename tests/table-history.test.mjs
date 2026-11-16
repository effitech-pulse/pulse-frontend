import test from 'node:test';
import assert from 'node:assert/strict';
import * as state from '../src/lib/tableState.ts';
const fields=[{key:'owner',label:'Owner',kind:'enum',read:r=>r.owner}];
const query={version:1,sort:[{field:'owner',direction:'desc'}],filters:[{field:'owner',op:'in',values:[null,false,0,'0']}]};
const selection={query,page:8,pageSize:50,cursors:['private'],revision:'secret'};
test('legacy import is atomic across delayed tables, preserves context and explicit link wins',()=>{
 assert.equal(typeof state.importTableLocation,'function');
 const location={pathname:'/ml-risk',search:'?run_id=42&table.alerts='+encodeURIComponent(JSON.stringify(selection))+'&table.nested='+encodeURIComponent(JSON.stringify({...selection,page:3})),hash:'#details',state:{draft:'keep'}};
 const imported=state.importTableLocation(location,'actor');
 assert.equal(imported.search,'?run_id=42');assert.equal(imported.hash,'#details');assert.equal(imported.state.draft,'keep');
 assert.deepEqual(state.readHistoryTableState(imported.state,'alerts',fields,'actor'),selection);
 assert.equal(state.readHistoryTableState(imported.state,'nested',fields,'actor').page,3);
 assert.equal(state.readHistoryTableState(imported.state,'alerts',fields,'other').page,1);
 const again=state.importTableLocation({...imported,search:location.search},'actor');
 assert.equal(state.readHistoryTableState(again.state,'alerts',fields,'actor').page,8);
});
test('history mutations retain other tables, draft, hash and route context; share starts on first page',()=>{
 assert.equal(typeof state.updateTableLocation,'function');
 const base={pathname:'/ml-risk',search:'?run_id=42&model=all',hash:'#details',state:{draft:{dirty:true}}};
 const one=state.updateTableLocation(base,'alerts',selection,'actor');
 const two=state.updateTableLocation(one,'nested',{...selection,page:2},'actor');
 assert.equal(two.search,base.search);assert.equal(two.hash,'#details');assert.deepEqual(two.state.draft,{dirty:true});
 assert.equal(state.readHistoryTableState(two.state,'alerts',fields,'actor').page,8);
 const url=new URL(state.tableSelectionLink('https://pulse.test',two,'alerts',selection,fields));
 assert.equal(url.searchParams.get('run_id'),'42');assert.equal(url.hash,'#details');
 assert.deepEqual(JSON.parse(url.searchParams.get('table.alerts')),{query,page:1,pageSize:50,cursors:[]});
 assert.equal(url.searchParams.has('table.nested'),false);
});

import {loadDependency} from './load-dependency.mjs';
function harness(location){
 const effects=[],entries=[location],navigator={};let index=0,valid=true;
 const auth={mode:'legacy',principal:{account_id:'a',authenticated:true,role:'admin',scope:'all'},privateEpoch:1,privateBlocked:false,capturePrivate:()=>({current:()=>valid})};
 const navigate=(target,options)=>{const next={...target,state:options.state,key:String(entries.length)};if(options.replace)entries[index]=next;else{entries.splice(index+1);entries.push(next);index++;}};
 const {useTableState}=loadDependency('@/hooks/useTableState',new URL('../src/hooks/useTableState.ts',import.meta.url).pathname,{react:{useContext:()=>({navigator}),useEffect:fn=>effects.push(fn)},'react-router-dom':{UNSAFE_NavigationContext:{},useLocation:()=>entries[index],useNavigate:()=>navigate},'../auth/AuthProvider':{useAuth:()=>auth}});
 return {get location(){return entries[index];},get count(){return entries.length;},render:key=>useTableState(key,fields),flush:()=>effects.splice(0).forEach(fn=>fn()),back:()=>index--,forward:()=>index++,invalidate:()=>{valid=false;auth.privateEpoch++;}};
}
test('real hook cleans by replace, pushes selection history, restores Back/Forward and rejects old callbacks',()=>{
 const h=harness({pathname:'/wells',search:'?context=x&table.one='+encodeURIComponent(JSON.stringify(selection))+'&table.two='+encodeURIComponent(JSON.stringify(selection)),hash:'#tab',state:{draft:1},key:'initial'});
 const one=h.render('one'),two=h.render('two');h.flush();
 assert.equal(h.count,1);assert.equal(h.location.search,'?context=x');
 one.setPage(4,50);two.setQuery({...query,sort:[]});
 assert.equal(h.count,3);assert.equal(h.render('one').page,4);assert.equal(h.render('two').query.sort.length,0);
 h.back();assert.equal(h.render('two').query.sort.length,1);assert.equal(h.render('one').page,4);
 h.back();assert.equal(h.render('one').page,8);h.forward();assert.equal(h.render('one').page,4);
 const stale=h.render('one');h.invalidate();stale.setPage(99,20);assert.equal(h.count,3);
 assert.equal(h.render('one').page,1);
});

test('stable navigator does not reuse a pending destination after Back',async()=>{
 const h=harness({pathname:'/wells',search:'',hash:'',state:null,key:'initial'});
 h.render('one').setQuery(query);await Promise.resolve();h.back();
 assert.equal(h.render('one').query.filters.length,0);
 h.render('one').setPage(2,20);assert.equal(h.render('one').query.filters.length,0);
});
test('run switch resets page/cursor in one navigation while retaining the clean selection',()=>{
 const h=harness({pathname:'/ml-risk',search:'?run_id=7',hash:'#context',state:null,key:'initial'});
 h.render('one').setQuery(query);h.render('one').setPage(8,50);h.render('one').next('server-token','r1');
 const before=h.count;h.render('one').resetForSearch(new URLSearchParams('run_id=42'));
 assert.equal(h.count,before+1);assert.equal(h.location.search,'?run_id=42');assert.equal(h.location.hash,'#context');
 const table=h.render('one');assert.deepEqual(table.query,query);assert.equal(table.page,1);assert.equal(table.pageSize,50);assert.deepEqual(table.cursors,[]);assert.equal(table.revision,undefined);
});
test('deferred legacy state is validated by its owning schema, including false/null/zero',()=>{
 const location={pathname:'/wells',search:'?table.later='+encodeURIComponent(JSON.stringify({query:{version:1,filters:[{field:'owner',op:'in',values:[null,false,0]},{field:'unknown',op:'contains',value:'bad'}],sort:[{field:'unknown',direction:'asc'},{field:'owner',direction:'desc'}]},page:-1,pageSize:999,cursors:[false,'ok']})),hash:'',state:null};
 const imported=state.importTableLocation(location,'actor');const table=state.readHistoryTableState(imported.state,'later',fields,'actor');
 assert.deepEqual(table.query.filters,[{field:'owner',op:'in',values:[null,false,0]}]);assert.deepEqual(table.query.sort,[{field:'owner',direction:'desc'}]);assert.equal(table.page,1);assert.equal(table.pageSize,100);assert.deepEqual(table.cursors,['ok']);
});
