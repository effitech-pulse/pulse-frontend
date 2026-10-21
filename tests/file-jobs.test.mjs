import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFileCheckLink, validPulseId, pollDelay, jobTerminal, parseLosslessJSON, StableFileSubmission, fileJobErrorCopy} from '../src/lib/fileJobs.ts';
test('dedicated check routing rejects malformed q1 links and retains exact int64 Pulse ID',()=>{
 assert.equal(validPulseId('9223372036854775807'),true);assert.equal(validPulseId('9223372036854775808'),false);
 assert.deepEqual(parseFileCheckLink('q1_'+'a'.repeat(32)),{kind:'file',id:'a'.repeat(32)});
 assert.deepEqual(parseFileCheckLink('q1_bad'),{kind:'invalid'});assert.deepEqual(parseFileCheckLink('b'.repeat(32)),{kind:'period',id:'b'.repeat(32)});
});
test('polling distinguishes retries and cancellation requests from terminal states',()=>{
 assert.equal(jobTerminal('cancel_requested'),false);assert.equal(jobTerminal('retry_wait'),false);assert.equal(jobTerminal('quarantined'),true);
 assert.equal(pollDelay('running',0,0),2000);assert.equal(pollDelay('running',61000,0),5000);assert.equal(pollDelay('running',0,9),30000);assert.equal(pollDelay('succeeded',0,0),false);
});
test('typed JSON retains null false zero and int64 without rewriting strings',()=>{
 const v=parseLosslessJSON('{"n":9223372036854775807,"zero":0,"flag":false,"optional":null,"s":"9223372036854775807","nested":{"x":-9223372036854775808}}');
 assert.equal(v.n,'9223372036854775807');assert.equal(v.zero,0);assert.equal(v.flag,false);assert.equal(v.optional,null);assert.equal(v.s,'9223372036854775807');assert.equal(v.nested.x,'-9223372036854775808');
});
test('same operation survives lost202 and blocks double click; changed draft cannot silently rekey',async()=>{
 const s=new StableFileSubmission();let count=0,keys=[];let release;
 const send=key=>{count++;keys.push(key);return new Promise((_,reject)=>{release=reject;});};
 const first=s.submit('commit',send);assert.equal(await s.submit('commit',send),undefined);release(new Error('lost202'));await assert.rejects(first);
 await s.submit('commit',async key=>{keys.push(key);return 'same-job';});assert.equal(keys[0],keys[1]);assert.equal(count,1);
 await assert.rejects(s.submit('different',async()=>''),/new_operation_required/);s.reset();await s.submit('different',async key=>{assert.notEqual(key,keys[0]);});
});
test('unknown server reason never leaks raw detail in copy',()=>{
 assert.equal(fileJobErrorCopy('SELECT secret from jobs'),'Проверка пока недоступна. Повторите позже.');assert.match(fileJobErrorCopy('result_not_ready'),/ещё не готов/);
});

test('session epochs suppress late responses even for same actor relogin and wipe subscribers',async()=>{
 const {PrivateEpoch}=await import('../src/lib/privateEpoch.ts');const epoch=new PrivateEpoch();const initial=epoch.capture();let wipes=0;epoch.subscribe(()=>wipes++);epoch.invalidate();assert.equal(initial.current(),false);assert.equal(wipes,1);assert.equal(epoch.capture().current(),true);
});
test('draft validates synthetic formats/caps and mapping preserves scale zero and set false',async()=>{
 const {validateFileDraft}=await import('../src/lib/fileJobDraft.ts');
 const spec={version:'file_input_v1',format:'csv',delimiter:',',sheet:'',header_row:1,time_column:'time',timestamp_layout:'rfc3339',timezone:'UTC',well_column:null,well_identity:'',mappings:[{field:'f',parameter:'F_out',scale:0,offset:0,unit:'',missing:'',is_set:false}]};
 assert.equal(validateFileDraft('9223372036854775807',{name:'x.csv',size:20971520},spec),null);
 assert.match(validateFileDraft('1',{name:'x.xls',size:1},spec),/CSV/);assert.match(validateFileDraft('1',{name:'x.csv',size:20971521},spec),/20/);
 assert.match(validateFileDraft('1',{name:'x.csv',size:1},{...spec,timezone:''}),/пояс/);
});
test('preview rejects over 100000 rows even when header is not first; valid zero remains literal',async()=>{
 const {previewFile}=await import('../src/lib/fileJobDraft.ts');const spec={format:'csv',delimiter:',',sheet:'',header_row:2};
 const tooMany=new File(['preamble\nt,v\n'+Array(100001).fill('2026-01-01,0').join('\n')],'a.csv');
 await assert.rejects(previewFile(tooMany,spec),/100 000/);
 const valid=await previewFile(new File(['preamble\nt,v\n2026-01-01,0'],'a.csv'),spec);assert.equal(valid.rows[0][1],'0');assert.equal(valid.total,1);
});
test('actual request_key_conflict explains preserved draft without exposing internal reason',()=>{assert.match(fileJobErrorCopy('request_key_conflict'),/настройки сохранены/);});
test('status ordering rejects older revision and terminal regression but permits quarantine cancellation',async()=>{
 const {canAdvanceFileJobStatus}=await import('../src/lib/fileJobs.ts');
 assert.equal(canAdvanceFileJobStatus({state:'succeeded',revision:3},{state:'running',revision:2}),false);
 assert.equal(canAdvanceFileJobStatus({state:'running',revision:3},{state:'queued',revision:2}),false);
 assert.equal(canAdvanceFileJobStatus({state:'succeeded',revision:3},{state:'running',revision:4}),false);
 assert.equal(canAdvanceFileJobStatus({state:'running',revision:3},{state:'queued',revision:3}),false);
 assert.equal(canAdvanceFileJobStatus({state:'quarantined',revision:3},{state:'cancelled',revision:4}),true);
});
test('preview parse identity changes only for byte-decoding and table-layout options',async()=>{
 const {previewParseKey}=await import('../src/lib/fileJobDraft.ts');const base={format:'csv',delimiter:',',sheet:'',header_row:1};const key=previewParseKey(base);
 for(const patch of [{format:'xlsx'},{delimiter:';'},{sheet:'Second'},{header_row:2}])assert.notEqual(previewParseKey({...base,...patch}),key);
 assert.equal(previewParseKey({...base,timezone:'UTC',mappings:[]}),key);
});
test('known job status reasons distinguish cancellation, terminal pin failure and server retry',()=>{
 assert.match(fileJobErrorCopy('cancelled'),/отменена/);assert.doesNotMatch(fileJobErrorCopy('cancelled'),/Повторите позже/);
 assert.match(fileJobErrorCopy('pinned_input_unavailable'),/закреплённые/);assert.doesNotMatch(fileJobErrorCopy('pinned_input_unavailable'),/Повторите позже/);
 assert.match(fileJobErrorCopy('execution_busy'),/серверного повтора/);
});
test('terminal job reason cannot promise server retry and normal cancellation adds no error copy',async()=>{
 const {fileJobStatusReason}=await import('../src/lib/fileJobs.ts');
 assert.equal(fileJobStatusReason('cancelled','cancelled'),null);
 assert.match(fileJobStatusReason('retry_wait','execution_busy'),/серверного повтора/);
 assert.doesNotMatch(fileJobStatusReason('failed','execution_busy'),/повтор|Повтор/);
 assert.match(fileJobStatusReason('failed','pinned_input_unavailable'),/закреплённые/);
 assert.doesNotMatch(fileJobStatusReason('failed','SQL secret details'),/SQL|secret|Повторите/);
});
