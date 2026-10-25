import test from 'node:test';import assert from 'node:assert/strict';
import {guardTablePage} from '../src/lib/tableTransport.ts';
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
test('late full table response cannot enter a replaced private epoch or aborted query',async()=>{
 for(const mode of ['epoch','abort']){const pending=deferred();let current=true;const controller=new AbortController();const work=guardTablePage({current:()=>current},()=>pending.promise,controller.signal);
 if(mode==='epoch')current=false;else controller.abort();pending.resolve({items:[{id:'PRIVATE'}],next_cursor:null});await assert.rejects(work,e=>e.name==='AbortError');}
});
test('current scope returns full typed page unchanged',async()=>{
 const page={items:[{id:'9223372036854775807',active:false,n:0}],next_cursor:'opaque'};assert.equal(await guardTablePage({current:()=>true},async()=>page,new AbortController().signal),page);
});
