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
test('access management route admits roles-only and groups-only readers independently',()=>{
 assert.equal(routeAccess(modern(['roles.read']),'/system/access'),true);
 assert.equal(routeAccess(modern(['groups.read']),'/system/access'),true);
 assert.equal(routeAccess(modern([]),'/system/access'),false);
});
test('FULL proves organization or unrestricted legacy and both funds, independently of management keys',async()=>{
 const {fullApplicationScope,canFull,canGrantPermission}=await import('../src/auth/authorization.ts');
 const p={...modern(['audit.read','roles.read','roles.manage','access.manage_global','telemetry.read']),organization_scope:{kind:'organization',ngdu_id:null,department_id:null},scope:{funds:['operational','presentation'],ngdus:[0],departments:[-1]}};
 assert.equal(fullApplicationScope(p),true);assert.equal(canFull(p,'audit.read'),true);
 assert.equal(fullApplicationScope({...p,scope:{...p.scope,funds:['operational']}}),false);
 assert.equal(fullApplicationScope({...p,organization_scope:{kind:'department',ngdu_id:'0',department_id:'-1'}}),false);
 assert.equal(fullApplicationScope({...p,organization_scope:null,scope:{...p.scope,ngdus:null,departments:null}}),true);
 assert.equal(fullApplicationScope({...p,organization_scope:null,scope:{...p.scope,ngdus:[],departments:null}}),false);
 assert.equal(canGrantPermission(p,'telemetry.read'),true);assert.equal(can(p,'telemetry.read'),false);assert.equal(canGrantPermission(p,'wells.read'),false);
 assert.equal(routeAccess({...p,permission_keys:['references.read','references.create']},'/structure'),true);
 assert.equal(routeAccess({...p,organization_scope:{kind:'department',ngdu_id:'0',department_id:'-1'}},'/audit'),false);
});
test('private boundary ignores graph/display refresh but changes for real modern identity/model/epoch',async()=>{
 const {privateBoundary}=await import('../src/lib/privateEpoch.ts');const p={...modern(['users.read']),access_id:'9',authz_epoch:'1',graph_revision:'1',name:'Name'};const state={mode:'local',principal:p};
 assert.equal(privateBoundary(state),privateBoundary({...state,principal:{...p,name:'Other',graph_revision:'2',access_revision:'4'}}));
 for(const patch of [{access_id:'10'},{access_model:'legacy'},{authz_epoch:'2'}])assert.notEqual(privateBoundary(state),privateBoundary({...state,principal:{...p,...patch}}));
 assert.notEqual(privateBoundary(state),privateBoundary({mode:'local',principal:null}));
});
