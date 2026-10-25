import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDailyFlow, dailyRange, dailyNumber, dailyDate, lastDailyRow, dailySettings, dailySearch, dailySegments, DailyRequestScope, downloadDailyBlob} from '../src/lib/dailyFlow.ts';
const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/daily-flow/${name}.json`,import.meta.url)));
test('all authoritative fixtures validate without recalculating server values',()=>{
 for(const name of ['steady-1001','decline-1002','zero-1003','gaps-1004','zero-expected-1005','all-null']) {const v=fixture(name);assert.deepEqual(validateDailyFlow(v,v.well_id),v);}
 assert.deepEqual(validateDailyFlow(fixture('disabled'),'1001'),{enabled:false,reason:'disabled'});
 const v=fixture('gaps-1004');assert.equal(lastDailyRow(v).date,v.end_date);assert.equal(lastDailyRow(v).actual,null);
 const zero=fixture('zero-expected-1005');assert.ok(zero.rows.some(r=>r.expected===0&&r.delta_percent===null));
 assert.equal(dailyNumber(0),'0,00');assert.equal(dailyNumber(-10,true),'-10,00');assert.equal(dailyNumber(5,true),'+5,00');assert.equal(dailyNumber(null),'—');
});
test('ISO calendar presets and dates do not depend on timezone or today',()=>{
 for(const [days,start] of [[7,'2026-10-18'],[30,'2026-09-25'],[90,'2026-07-27']])assert.deepEqual(dailyRange('2026-10-24',days),{start_date:start,end_date:'2026-10-24'});
 assert.equal(dailyDate('2026-10-24'),'24.10.2026');
});
test('bounded DTO guards reject empty rows, unknown states and foreign query identities',()=>{
 const v=fixture('steady-1001');
 for(const bad of [{...v,rows:[]},{...v,well_id:1001},{...v,rows:v.rows.map((r,i)=>i===0?{...r,comparison_status:'unknown'}:r)},{...v,rows:v.rows.slice().reverse()}])assert.throws(()=>validateDailyFlow(bad,'1001'));
 assert.throws(()=>validateDailyFlow(v,'1002'));assert.throws(()=>validateDailyFlow(v,'1001',{start_date:'2026-10-18',end_date:v.end_date}));
 const x=structuredClone(v);x.rows[0].delta=123;assert.equal(validateDailyFlow(x,'1001').rows[0].delta,123,'display server delta, never recompute');
});
test('scoped URL keys preserve foreign parameters and unknown presets default',()=>{
 const original=new URLSearchParams('tab=telemetry&event=abc&x=1&x=2&daily_period=13');assert.deepEqual(dailySettings(original),{mode:'parameters',period:30});
 const next=dailySearch(original,{mode:'daily',period:7});assert.deepEqual(next.getAll('x'),['1','2']);assert.equal(next.get('event'),'abc');assert.equal(next.get('tab'),'telemetry');assert.deepEqual(dailySettings(next),{mode:'daily',period:7});
});
test('graph splits null gaps and retains isolated points and zero',()=>{
 assert.deepEqual(dailySegments([{actual:0},{actual:null},{actual:5},{actual:6}], 'actual'),[[{index:0,value:0}],[{index:2,value:5},{index:3,value:6}]]);
 const v=fixture('all-null');assert.deepEqual(dailySegments(v.rows,'actual'),[]);assert.equal(v.coverage.paired_days,0);
});
test('late read/export tickets fail after replacement, scope change or disposal',async()=>{
 let privateCurrent=true;const scope=new DailyRequestScope();const old=scope.start(()=>privateCurrent);const late=Promise.resolve('old');const next=scope.start(()=>privateCurrent);
 assert.equal(old.current(),false);assert.equal(old.signal.aborted,true);assert.equal(next.current(),true);privateCurrent=false;assert.equal(next.current(),false);
 assert.equal(await late,'old');scope.dispose();assert.equal(next.signal.aborted,true);
});
test('download never starts for old scope and revokes URL on successful click and thrown click',()=>{
 let clicks=0,revokes=0;const env={create:()=> 'blob:test',revoke:()=>revokes++,click:()=>clicks++};
 assert.equal(downloadDailyBlob(new Blob(['x']),'test.xlsx',()=>false,env),false);assert.equal(clicks,0);
 assert.equal(downloadDailyBlob(new Blob(['x']),'test.xlsx',()=>true,env),true);assert.equal(clicks,1);assert.equal(revokes,1);
 assert.throws(()=>downloadDailyBlob(new Blob(['x']),'test.xlsx',()=>true,{...env,click:()=>{throw Error('click')}}));assert.equal(revokes,2);
});
