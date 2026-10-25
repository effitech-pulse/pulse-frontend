import * as organizationTree from '../src/lib/organizationTree.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as draft from '../src/lib/accessDraft.ts';
test('session notice follows server effect instead of assuming every profile change revokes',()=>{
 assert.equal(typeof draft.sessionEffectMessage,'function');
 assert.match(draft.sessionEffectMessage('none'),/сохран/iu);
 assert.doesNotMatch(draft.sessionEffectMessage('none'),/войти снова|завершены|завершит/iu);
 assert.match(draft.sessionEffectMessage('revoke_on_apply'),/заверш/iu);
 assert.match(draft.sessionEffectMessage('revoked'),/заверш/iu);
 assert.doesNotMatch(draft.sessionEffectMessage(undefined),/завершены/iu);
});
test('canonical editor URLs preserve list search but do not embed draft or password',()=>{
 assert.equal(typeof draft.userEditorLocation,'function');
 assert.equal(draft.userEditorLocation(null,new URLSearchParams('tab=users&search=Anna&entity=users&id=new')), '/system/access/users/new?tab=users&search=Anna');
 assert.equal(draft.userEditorLocation('9007199254740993',new URLSearchParams('tab=roles&search=Anna&copy=1')), '/system/access/users/9007199254740993/edit?tab=users&search=Anna');
});
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,boundaries){const filename=fileURLToPath(new URL(file,import.meta.url));const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>boundaries[id]??require(id);mod._compile(code,filename);return mod.exports;}
test('router registers direct create/edit reload targets and independent safe directory targets',()=>{
 const {router}=load('../src/router.tsx',{'@/components/layout/AppLayout':{AppLayout:()=>null},'react-router-dom':{...require('react-router-dom'),createBrowserRouter:routes=>routes}});
 const children=router[0].children;
 for(const expected of ['system/access','system/access/users/new','system/access/users/:id/edit','people','people/:id']) assert.ok(children.some(r=>r.path===expected),expected);
 assert.equal(children.find(r=>r.path==='accounts').element.props.to,'/system/access?tab=users');
});
test('directory transport only uses safe endpoints and passes literal search plus cursor filters',async()=>{
 const calls=[];const {peopleApi}=load('../src/api/people.ts',{'../lib/organizationTree':organizationTree,'./client':{apiClient:{get:async(url,config)=>{calls.push({url,config});return {data:{items:[],next_cursor:null}};}}}});
 await peopleApi.list({search:'%_ Цех',include_inactive:true,limit:25,cursor:'opaque'});await peopleApi.get('9007199254740993');
 assert.deepEqual(calls,[{url:'/api/v1/people',config:{params:{search:'%_ Цех',include_inactive:true,limit:25,cursor:'opaque'}}},{url:'/api/v1/people/9007199254740993',config:undefined}]);
});
test('actual server 422 manager envelopes map to field without guessing generic profile validation',()=>{
 assert.equal(typeof draft.serverUserFieldError,'function');
 const user={id:'23',profile:{manager_id:'24'}};
 for(const message of ['Цикл руководителей недопустим','Руководитель не найден']) {
  const error=draft.serverUserFieldError(422,{code:'validation_error',message},user);
  assert.ok(error instanceof draft.AccessFieldError);assert.equal(error.field,'manager_id');assert.equal(error.message,message);
 }
 assert.equal(draft.serverUserFieldError(422,{code:'validation_error',message:'Некорректный профиль сотрудника'},user),null);
 assert.equal(draft.serverUserFieldError(422,{code:'validation_error',message:'Цикл руководителей недопустим: другая ошибка'},user),null);
 assert.equal(draft.serverUserFieldError(409,{code:'conflict',message:'Руководитель не найден'},user),null);
 const self=draft.serverUserFieldError(422,{code:'validation_error',message:'Некорректный профиль сотрудника'},{...user,profile:{manager_id:'23'}});assert.equal(self.field,'manager_id');
 let d=draft.createDraft({user},0);d=draft.rejectApply(d,422);assert.equal(d.change.user.profile.manager_id,'24');assert.equal(d.preview,null);
});
test('route heading focus runs once for a route, waits for its heading and never steals input focus on rerender',()=>{
 assert.equal(typeof draft.focusRouteHeading,'function');
 let focused='input';let calls=0;
 const heading={focus:()=>{focused='heading';calls++;}};
 let key=draft.focusRouteHeading('new',null,undefined);assert.equal(key,undefined);
 key=draft.focusRouteHeading('new',heading,key);assert.equal(focused,'heading');assert.equal(calls,1);
 focused='input';key=draft.focusRouteHeading('new',heading,key);assert.equal(focused,'input');assert.equal(calls,1);
 key=draft.focusRouteHeading('edit:23',heading,key);assert.equal(calls,2);
 key=draft.focusRouteHeading('profile:23',heading,key);assert.equal(calls,3);
});
test('own profile URL prefers canonical access ID and only falls back to a positive safe numeric legacy ID',()=>{
 const {ownProfileLocation}=load('../src/components/layout/WorkspaceMenu.tsx',{'@/auth/AuthProvider':{useAuth:()=>({})},'@/api/access':{},'@/lib/mlSnapshot':{},'@/api/ml':{},'@/api/integrations':{},'@/api/client':{}});
 assert.equal(typeof ownProfileLocation,'function');
 assert.equal(ownProfileLocation({access_id:'9007199254740993',account_id:9007199254740992}),'/people/9007199254740993');
 assert.equal(ownProfileLocation({account_id:23}),'/people/23');
 for(const account_id of [0,-1,1.2,9007199254740992,null,undefined])assert.equal(ownProfileLocation({account_id}),null);
 assert.equal(ownProfileLocation({access_id:'not-an-id',account_id:23}),null);
 assert.equal(ownProfileLocation({access_id:9007199254740992,account_id:23}),null);
});
