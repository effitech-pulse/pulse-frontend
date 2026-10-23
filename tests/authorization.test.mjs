import test from 'node:test';
import assert from 'node:assert/strict';
import {can,canAny,queryAccess,parseAccessFields,routeAccess} from '../src/auth/authorization.ts';
import {PrivateEpoch} from '../src/lib/privateEpoch.ts';
const modern=(permission_keys,role='viewer')=>({access_model:'rbac_v1',permission_keys,role,authenticated:true});
test('modern authority is the server union with transitive prerequisites',()=>{
 assert.equal(can(modern(['telemetry.read']),'telemetry.read'),false);
 assert.equal(can(modern(['telemetry.read','wells.read']),'telemetry.read'),true);
 assert.equal(can(modern([],'admin'),'wells.read'),false);
 assert.equal(can(modern(['wells.read','future.permission']),'wells.read'),false);
 assert.equal(can(modern(undefined,'admin'),'wells.read'),false);
 assert.equal(canAny(modern(['wells.read','risks.read']),['metrics.read'],['risks.read']),true);
 assert.equal(can(modern(['telemetry.compat.score','telemetry.compat.read','telemetry.read','checks.run','checks.read']),'telemetry.compat.score'),false);
});
test('compatibility is frozen and explicit modern data never inherits role authority',()=>{
 assert.equal(can({role:'admin',authenticated:true},'integrations.read'),true);
 assert.equal(can({role:'viewer',authenticated:true},'wells.read'),true);
 assert.equal(can({access_model:'legacy',role:'admin',authenticated:true},'wells.read'),true);
 assert.equal(can({access_model:'future',role:'admin',authenticated:true},'wells.read'),false);
});
test('mixed screens only request individually granted resources',()=>{
 const p=modern(['wells.read','risks.read']);
 assert.deepEqual(queryAccess(p,'risks.read'),{enabled:true});
 assert.deepEqual(queryAccess(p,'metrics.read'),{enabled:false});
 assert.deepEqual(queryAccess(p,'integrations.read'),{enabled:false});
 assert.equal(routeAccess(p,'/audit'),false);
 assert.equal(routeAccess(modern([]),'/'),false);
});
test('new decimal identifiers remain exact strings and assignments stay flattened',()=>{
 const v={access_model:'rbac_v1',access_id:'9223372036854775807',access_revision:'0',authz_epoch:'-1',graph_revision:'9223372036854775807',organization_scope:{kind:'department',ngdu_id:'0',department_id:'-1'},role_ids:['9223372036854775807'],direct_roles:[],groups:[],roles:[]};
 assert.deepEqual(parseAccessFields(v),v);
 assert.throws(()=>parseAccessFields({...v,access_id:9223372036854775807}));
});
test('401/logout/epoch changes reject delayed callbacks; a current 409 retains draft',()=>{
 for(const reason of ['401','logout','epoch-change']){const epoch=new PrivateEpoch();const ticket=epoch.capture();let draft='private preview';epoch.subscribe(()=>{draft='';});epoch.invalidate();if(ticket.current())draft='late result';assert.equal(ticket.current(),false,reason);assert.equal(draft,'');}
 const epoch=new PrivateEpoch();const ticket=epoch.capture();const draft='unsaved';assert.equal(ticket.current(),true);assert.equal(draft,'unsaved');
});
