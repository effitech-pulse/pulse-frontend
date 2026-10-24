import test from 'node:test';import assert from 'node:assert/strict';
import {readTableState,writeTableState} from '../src/lib/tableState.ts';
const fields=[{key:'name',kind:'text',label:'Имя',read:r=>r.name}];
test('URL ordered query and page survive reload while preserving other tables and selected snapshot',()=>{
 const original=new URLSearchParams('tab=checks&run=7&check=q1_abc');
 const state={query:{version:1,filters:[{field:'name',op:'contains',value:'А'}],sort:[{field:'name',direction:'desc'}]},page:3,pageSize:20,cursors:['opaque']};
 const encoded=writeTableState(original,'wells',state);assert.equal(encoded.get('run'),'7');assert.equal(encoded.get('check'),'q1_abc');assert.deepEqual(readTableState(encoded,'wells',fields),state);assert.equal(original.has('table.wells'),false);
});
test('unknown query versions and fields cannot execute saved conditions',()=>{
 const p=new URLSearchParams();p.set('table.x',JSON.stringify({query:{version:2,sort:[],filters:[]}}));assert.deepEqual(readTableState(p,'x',fields).query,{version:1,sort:[],filters:[]});
 p.set('table.x',JSON.stringify({query:{version:1,sort:[{field:'bad',direction:'asc'},{field:'name',direction:'desc'},{field:'name',direction:'asc'}],filters:[{field:'bad',op:'contains',value:'x'}]},page:0,pageSize:100000}));
 const value=readTableState(p,'x',fields);assert.deepEqual(value.query.sort,[{field:'name',direction:'desc'}]);assert.equal(value.query.filters.length,0);assert.equal(value.page,1);assert.equal(value.pageSize,100);
});
