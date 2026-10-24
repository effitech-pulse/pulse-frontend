import test from 'node:test';
import assert from 'node:assert/strict';
import { userChange, validateUserChange, createDraft, updateDraft, acceptPreview, previewTicket, applyReceipt, rejectApply } from '../src/lib/accessDraft.ts';
import { routeAccess } from '../src/auth/authorization.ts';
const profile={revision:'17',job_title:'Инженер',workplace:{organization:null,division:'Цех',department:null},manager_id:'9007199254740993'};
const account={access_id:'23',access_revision:'4',login:'worker',name:'Работник',active:true,role_ids:['1','2'],group_ids:['8'],profile};
test('managed user draft preserves profile revision and manager outside visible selection',()=>{
 const c=userChange(account,{name:'Новое имя'}).user;
 assert.deepEqual(c.profile,profile);assert.equal(c.revision,'4');
 assert.notEqual(c.profile,account.profile);assert.notEqual(c.profile.workplace,profile.workplace);
});
test('older server absence stays unsupported and explicit null profile is rejected',()=>{
 const {profile:_,...old}=account; assert.equal(Object.hasOwn(userChange(old,{}).user,'profile'),false);
 assert.throws(()=>validateUserChange({...userChange(old,{}).user,profile:null},''),/профил/i);
});
test('profile fields normalize independently and validate Unicode length and self manager',()=>{
 const c=userChange(account,{profile:{...profile,job_title:'  Технолог  ',workplace:{organization:' ',division:null,department:'Отдел'}}}).user;
 assert.equal(c.profile.job_title,'Технолог');assert.deepEqual(c.profile.workplace,{organization:null,division:null,department:'Отдел'});
 assert.doesNotThrow(()=>validateUserChange({...c,profile:{...profile,job_title:'я'.repeat(200)}},''));
 assert.throws(()=>validateUserChange({...c,profile:{...profile,job_title:'я'.repeat(201)}},''),e=>e.field==='job_title');
 assert.throws(()=>validateUserChange({...c,profile:{...profile,manager_id:'23'}},''),e=>e.field==='manager_id');
});
test('profile-only draft change and 422 preserve metadata and invalidate receipt',()=>{
 const response={graph_revision:'5',actor_epoch:'0',fingerprint:'abc',items:[],next_cursor:null,session_effect:'none',profile_change:null};
 let d=createDraft(userChange(account,{}),1);d=acceptPreview(d,response,previewTicket(d),1);
 d=updateDraft(d,userChange(account,{profile:{...profile,job_title:'Начальник'}}));assert.throws(()=>applyReceipt(d,1));
 d=rejectApply(d,422);assert.equal(d.change.user.profile.job_title,'Начальник');assert.equal(d.preview,null);
});
test('directory allows authenticated local zero permissions and keeps management closed',()=>{
 const local={authenticated:true,mechanism:'session',account_id:23,access_model:'rbac_v1',permission_keys:[],role:'viewer'};
 assert.equal(routeAccess(local,'/people'),true);assert.equal(routeAccess(local,'/people/23'),true);
 assert.equal(routeAccess(local,'/system/access/users/23/edit'),false);
 assert.equal(routeAccess({...local,authenticated:false},'/people'),false);
 assert.equal(routeAccess({...local,mechanism:'shared-key'},'/people'),false);
});
test('incomplete profile objects cannot silently clear fields or lose manager selection',()=>{
 const u=userChange(account,{}).user;
 for(const patch of [{manager_id:undefined},{revision:undefined},{workplace:{organization:null,division:null}},{job_title:undefined}]) {
  assert.throws(()=>validateUserChange({...u,profile:{...profile,...patch}},''),e=>e.name==='AccessFieldError');
 }
});
