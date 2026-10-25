import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadDependency} from './load-dependency.mjs';
const view=JSON.parse(readFileSync(new URL('./fixtures/daily-flow/steady-1001.json',import.meta.url)));
test('exact string well ID, dates, dataset version and view identity reach server; Blob bypasses JSON transform',async()=>{
 const calls=[];const well='9007199254740993';const data={...view,well_id:well};
 const api=loadDependency('@/api/dailyFlow',new URL('../src/api/dailyFlow.ts',import.meta.url).pathname,{'./client':{apiClient:{get:async(url,opts)=>{calls.push({url,opts});return {data:url.endsWith('/export')?new Blob(['xlsx']):data};}}}});
 const signal=new AbortController().signal;const query={start_date:data.start_date,end_date:data.end_date,dataset_version:data.dataset_version};
 assert.deepEqual(await api.readDailyFlow(well,query,signal),data);const blob=await api.exportDailyFlow(data,signal);
 assert.ok(blob instanceof Blob);assert.equal(calls[0].url,`/api/v1/wells/${well}/daily-flow`);assert.equal(calls[1].url,`/api/v1/wells/${well}/daily-flow/export`);
 assert.deepEqual(calls[1].opts.params,{...query,view_id:data.view_id});assert.equal(calls[1].opts.signal,signal);assert.equal(calls[1].opts.responseType,'blob');assert.equal(calls[1].opts.transformResponse[0](blob),blob);assert.equal('rows' in calls[1].opts.params,false);
});
