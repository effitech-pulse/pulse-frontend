import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {eventVerdictCopy,eventActorCopy,eventErrorState,selectEventDetail} from '../src/lib/events.ts';
const f=JSON.parse(readFileSync(new URL('./fixtures/events-examples.json',import.meta.url)));
test('all six details retain saved source/revision and max ID; q1 historical ID is opaque',()=>{
 assert.equal(f.responses.details.length,6);
 for(const item of f.responses.details){const data=item.response.body;assert.equal(selectEventDetail(data,'9223372036854775807'),data);assert.equal(selectEventDetail(data,'1'),null);assert.equal(data.event.occurred_at.slice(-8),'.123456Z');}
 const saved=selectEventDetail(f.responses.details[0].response.body);assert.equal(saved.detail.check.id,'q1_исторический/Период 01?x=0 +%#');assert.equal(saved.event.actor.kind,'unknown');assert.equal(eventActorCopy(saved.event.actor),'Автор неизвестен');
 const review=f.responses.details[2].response.body;assert.equal(selectEventDetail(review).detail.revision,'9223372036854775807');
});
test('saved result retains null false zero and unknown verdict is never norm',()=>{
 const normal=f.responses.manual_variants[0].response.body;const result=selectEventDetail(normal).detail.result;
 assert.equal(result.timeline[0].raw_score,null);assert.equal(result.timeline[0].watch_fired,false);assert.equal(result.latest_risk,0);assert.equal(result.decision_rule.watch.k_windows,'1');
 assert.equal(eventVerdictCopy('insufficient'),'Недостаточно данных');assert.equal(eventVerdictCopy('future_saved_verdict'),'Результат не распознан');assert.equal(eventVerdictCopy(null),'Результат не указан');
 assert.equal(eventActorCopy({kind:'shared',name:'Общий API-ключ',id:'shared',authenticated:false}),'Общий доступ');
});
test('actual API status/code/detail determines safe error states, never server message',()=>{
 const expected=['unauthorized','unavailable','unavailable','invalid','restart','retry','retry'];
 f.responses.errors.forEach((e,i)=>assert.equal(eventErrorState(e.response.status,e.response.body),expected[i]));
 assert.equal(eventErrorState(422,{code:'validation_error',detail:'cursor_restart_required',message:'SQL private'}),'restart');
});

test('closed DTOs accept frozen details and initial-review null timestamp, reject lossy or extra fields',async()=>{
 const ts=(await import('typescript')).default;
 const path=(await import('node:path')).default;
 const virtual=path.resolve('tests/events-wire-check.ts');
 const details=[...f.responses.details,...f.responses.manual_variants].map(item=>item.response.body);
 const initialReview=structuredClone(f.responses.details[1].response.body);
 initialReview.event.target.revision='1';
 initialReview.event.event_id='e1.'+Buffer.from(JSON.stringify(['review_event','check',initialReview.event.target.id,'1'])).toString('base64url');
 initialReview.detail.revision='1';
 initialReview.detail.before={revision:'0',status:'new',owner:'',conclusion:'',updated_at:null};
 initialReview.detail.after.revision='1';
 assert.equal(selectEventDetail(initialReview).detail.before.updated_at,null);
 const source=`import type {EventPage,EventDetailResponse,EventReviewSnapshot,EventSavedResult,EventWellSnapshot} from '../src/api/events.ts';
 const pages = ${JSON.stringify([f.responses.list_all_types.body,f.responses.list_continuation_example.body,f.responses.list_empty.body])} satisfies EventPage[];
 const details = ${JSON.stringify(details)} satisfies EventDetailResponse[];
 const initialReview = ${JSON.stringify(initialReview)} satisfies EventDetailResponse;
 // @ts-expect-error nullable timestamp remains mandatory
 const missingTimestamp: EventReviewSnapshot = {revision:'0',status:'new',owner:'',conclusion:''};
 // @ts-expect-error F3 int64 IDs never numbers
 const badWell: EventDetailResponse['event']['well'] = {id:9223372036854775807,well_number:null,active:false,archived_at:null};
 // @ts-expect-error summaries never expose saved comments
 const badSummary: EventDetailResponse['event'] = {...details[0].event,comment:'private'};
 // @ts-expect-error has_more is a mandatory wire field
 const badPage: EventPage = {items:[],next_cursor:null};
 // @ts-expect-error saved risk is a mandatory nonnullable float in backend F3 DTO
 const badRisk: EventSavedResult['latest_risk'] = null;
 // @ts-expect-error well NGDU is a mandatory signed decimal string
 const badNGDU: EventWellSnapshot['ngdu'] = null;
 void badRisk; void badNGDU; void initialReview; void missingTimestamp; void pages; void details; void badWell; void badSummary; void badPage;`;
 const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
 const host=ts.createCompilerHost(parsed.options);const oldRead=host.readFile.bind(host),oldExists=host.fileExists.bind(host);
 host.fileExists=name=>name===virtual||oldExists(name);host.readFile=name=>name===virtual?source:oldRead(name);
 const program=ts.createProgram([virtual,...parsed.fileNames],{...parsed.options,noUnusedLocals:false,noUnusedParameters:false},host);
 const errors=ts.getPreEmitDiagnostics(program);assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:name=>name,getNewLine:()=> '\n'}));
});
