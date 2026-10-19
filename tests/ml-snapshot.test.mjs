import test from 'node:test';
import assert from 'node:assert/strict';
import { mlRows, mlHistory, mlOutcomeRow, mlSnapshotNotice, mlScopedRows } from '../src/lib/mlSnapshot.ts';

const result = {
 model_name: null, model_version: null, model_saved_at: null,
 channels_used: 0, features_total: 0, features_unavailable: 0, windows_running: 0,
 windows_above_watch: 0, windows_above_alert: 0, peak_risk: 0, peak_window_end: '2026-01-01',
 latest_risk: 0, n_windows: 1, span_days: 0, verdict: 'norm',
 timeline: [{window_end:'2026-01-01',risk:0,watch_fired:false}], contributions: [],
};
const outcome = (status, extra = {}) => ({app_well_id:42,status,reason_code:status,result:null,bounds:null,resolution:'',...extra});
const envelope = (outcomes, extra = {}) => ({profile:'cohort',count:outcomes.length,running:false,cohort_version:'v1',snapshot_id:null,run_id:null,as_of:null,outcomes,coverage:{member_count:outcomes.length,visible_count:outcomes.length,scored_count:0,archived_count:0,inactive_count:0,insufficient_count:outcomes.length,error_count:0},provenance_status:'historical_unknown',evaluation_status:'no_scored_members',...extra});

test('cohort keeps Pulse ID and nullable unscored risk rather than research ID or normal',()=>{
 for (const status of ['archived','inactive','insufficient','error']) {
  const row=mlRows(envelope([outcome(status)]))[0];
  assert.equal(row.app_well_id,42); assert.equal(row.well_id,null);
  assert.equal(row.risk,null); assert.equal(row.alert,null); assert.equal(row.data_ok,null);
  assert.equal(row.windows_total,null); assert.equal(row.status,status);
  assert.equal(mlHistory(outcome(status)),null);
 }
});
test('zero risk and false fired survive; verdict decides tier and raw scale is not a risk threshold',()=>{
 const scored=outcome('scored',{result:{...result,verdict:'alert',decision_rule:{watch:{scale:'raw',threshold:-1},high_enabled:false}},run_id:17,snapshot_id:'stored'});
 const row=mlOutcomeRow(scored);
 assert.equal(row.risk,0); assert.equal(row.alert,true); assert.equal(row.tier,'alert');
 assert.equal(row.windows_fired,0); assert.equal(row.well_id,null);
 assert.equal(row.data_ok,null); assert.deepEqual(row.contributions,[]);
 assert.equal(row.run_id,17); assert.equal(row.snapshot_id,'stored');
 const history=mlHistory(scored);
 assert.equal(history.threshold,null); assert.equal(history.high_threshold,null);
 assert.deepEqual(history.points,[{window_end:'2026-01-01',risk:0,fired:false}]);
});
test('history remains empty without a timeline, never synthesizes a zero chart',()=>{
 assert.deepEqual(mlHistory(outcome('scored',{result:{...result,timeline:[]}})).points,[]);
 assert.equal(mlOutcomeRow(outcome('scored',{result:null})).risk,null);
});
test('research response retains research IDs, zero risk, false flags and thresholds',()=>{
 const well={well_id:99,app_well_id:42,risk:0,alert:false,data_ok:false};
 const row=mlRows({profile:'research',count:1,wells:[well],alert_threshold:0,high_threshold:0,running:false})[0];
 assert.equal(row.well_id,99);assert.equal(row.risk,0);assert.equal(row.alert,false);assert.equal(row.data_ok,false);assert.equal(row.explanation_window_kind,'latest');
 const history={well_id:99,threshold:0,high_threshold:0,points:[{window_end:'x',risk:0,fired:false}]};
 assert.equal(mlHistory(history),history);
});
test('snapshot notices distinguish never evaluated, no scored, partial provenance and previous result while running',()=>{
 assert.match(mlSnapshotNotice(envelope([outcome('insufficient',{reason_code:'not_evaluated'})])),/ещё не/);
 assert.match(mlSnapshotNotice(envelope([],{snapshot_id:'s',run_id:17,as_of:'2026-01-01'})),/без оценок/);
 assert.match(mlSnapshotNotice(envelope([],{snapshot_id:'s',run_id:17,running:true,provenance_status:'partial'})),/предыдущ/);
 assert.match(mlSnapshotNotice(envelope([],{snapshot_id:'s',run_id:17,provenance_status:'historical_unknown'})),/неизвестно/);
});
test('cohort full membership is not silently removed by legacy active operational fund assumptions',()=>{
 const rows=mlRows(envelope([outcome('archived',{metadata:{id:42,fund_type:'presentation',active:false}}),outcome('inactive',{app_well_id:43,metadata:{id:43,fund_type:'presentation',active:false}})]));
 assert.equal(mlScopedRows(rows,[],{ngdu:undefined,department:undefined,search:''},true).length,2);
 assert.equal(mlScopedRows(rows,[],{ngdu:1,search:''},true).length,0);
});

test('snapshot envelope binds every row to stored run and preserves captured lifecycle metadata',()=>{
 const rows=mlRows(envelope([outcome('scored',{run_id:99,result,metadata:{id:42,ngdu:0,department:0,unitek_id:0,active:false,archived_at:null,fund_type:'operational'}})],{run_id:17,snapshot_id:'stored',as_of:'2026-01-01'}));
 assert.equal(rows[0].run_id,17); assert.equal(rows[0].snapshot_id,'stored');
 assert.equal(rows[0].metadata.active,false); assert.equal(rows[0].unitek_id,0);
 assert.equal(rows[0].risk,0); assert.equal(rows[0].alert,false);
 assert.equal(mlScopedRows(rows,[],{ngdu:0,department:0,search:'',sort:'id_asc'},true).length,1);
});
test('calibrated threshold zero is preserved and disabled high threshold stays unknown',()=>{
 const history=mlHistory(outcome('scored',{result:{...result,decision_rule:{watch:{scale:'calibrated',threshold:0},high_enabled:false,high:{scale:'calibrated',threshold:0}}}}));
 assert.equal(history.threshold,0); assert.equal(history.high_threshold,null);
});
test('cohort filters preserve requested ID ordering across inactive and archived members',()=>{
 const rows=mlRows(envelope([outcome('archived',{app_well_id:42}),outcome('inactive',{app_well_id:43})]));
 assert.deepEqual(mlScopedRows(rows,[],{search:'',sort:'id_desc'},true).map(r=>r.app_well_id),[43,42]);
});

test('failed newer run warns that the visible snapshot is the previous saved result',()=>{
 assert.match(mlSnapshotNotice(envelope([],{snapshot_id:'s',run_id:17}),{id:18,status:'error'}),/ошибкой.*предыдущий/);
});

test('real cohort alert IDs and processing states survive for queue and review instead of Pulse-ID fallback',()=>{
 for (const status of ['new','acknowledged','false_positive','confirmed','inconclusive']) {
  const row=mlOutcomeRow(outcome('scored',{result:{...result,verdict:'alert'},alert_id:99,alert_status:status}));
  assert.equal(row.alert_id,99); assert.equal(row.alert_status,status);
  assert.notEqual(row.alert_id,row.app_well_id);
 }
 const absent=mlOutcomeRow(outcome('scored',{result:{...result,verdict:'alert'},alert_id:null,alert_status:null}));
 assert.equal(absent.alert_id,null); assert.equal(absent.alert_status,null);
});
test('selected old run preserves its own mutable alert overlay and no-scored never gains fabricated alert',()=>{
 const old=mlRows(envelope([outcome('scored',{result:{...result,verdict:'watch'},alert_id:71,alert_status:'acknowledged'})],{run_id:17,snapshot_id:'old'}))[0];
 const current=mlRows(envelope([outcome('scored',{result:{...result,verdict:'alert'},alert_id:99,alert_status:'new'})],{run_id:18,snapshot_id:'new'}))[0];
 assert.equal(old.alert_id,71); assert.equal(old.alert_status,'acknowledged'); assert.equal(old.run_id,17);
 assert.equal(current.alert_id,99); assert.equal(current.run_id,18);
 for (const status of ['archived','inactive','insufficient','error']) {
  const row=mlOutcomeRow(outcome(status));assert.equal(row.alert_id,null);assert.equal(row.alert_status,null);
 }
});
test('cohort explanation binds to raw-score peak separately from latest risk window',()=>{
 const row=mlOutcomeRow(outcome('scored',{result:{...result,latest_risk:.2,peak_window_end:'2026-01-01T00:00:00Z',timeline:[{window_end:'2026-01-01T00:00:00Z',risk:.9},{window_end:'2026-01-02T00:00:00Z',risk:.2}]}}));
 assert.equal(row.window_end,'2026-01-02T00:00:00Z'); assert.equal(row.risk,.2);
 assert.equal(row.explanation_window_kind,'peak'); assert.equal(row.explanation_window_end,'2026-01-01T00:00:00Z');
 const old=mlOutcomeRow(outcome('scored',{result:{...result,peak_window_end:''}}));
 assert.equal(old.explanation_window_kind,'unknown'); assert.equal(old.explanation_window_end,null);
});
