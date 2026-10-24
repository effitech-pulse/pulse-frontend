import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(root+'/package.json');
const ts=require('typescript');
const draftModule=await import(root+'/src/lib/accessDraft.ts');
const revealModule=await import(root+'/src/lib/revealAccessField.ts');
async function recoveryScenario(found){
let routeID='new';const navigations=[];let writes=0;
const store=[];let pointer=0;let effects=[];let confirm;
const hooks={
 useState(initial){const i=pointer++;if(!store[i])store[i]={value:typeof initial==='function'?initial():initial};return [store[i].value,v=>{store[i].value=typeof v==='function'?v(store[i].value):v;}];},
 useRef(initial){const i=pointer++;if(!store[i])store[i]={value:{current:initial}};return store[i].value;},
 useEffect(fn,deps){const i=pointer++;if(!store[i]||!deps||deps.some((v,n)=>!Object.is(v,store[i].deps?.[n]))){store[i]={deps};effects.push(fn);}},
};
const profile={revision:'7',job_title:'Инженер',workplace:{organization:'Организация',division:null,department:null},manager_id:null};
const saved={access_id:'23',access_revision:'9',login:'created',name:'Created employee',active:true,role_ids:['1'],group_ids:['8'],profile};
const reads=[];
const managementApi={permissions:async()=>[],preview:async()=>({graph_revision:'1',actor_epoch:'1',fingerprint:'p',assigned_users:0,changed_users:0,disabled_users:0,self_affected:false,items:[],next_cursor:null,session_effect:'none'}),apply:async()=>{writes++;throw new Error('Lost response after commit');},users:async()=>({items:found?[saved]:[],next_cursor:null,graph_revision:'1'}),user:async id=>{reads.push(id);return saved;}};
const antd={App:{useApp:()=>({message:{info(){},success(){}},modal:{confirm:config=>{confirm=config;}}})},Alert:'Alert',Button:'Button',Drawer:'Drawer',Skeleton:'Skeleton',Space:'Space'};
const params=new URLSearchParams('tab=users&search=Created');
function UserAccessDrawer(){}
const boundaries={
 'react':hooks,'antd':antd,'@ant-design/icons':{LoadingOutlined:'LoadingOutlined'},
 '@tanstack/react-query':{useQuery:()=>({data:[],isPending:false,isError:false}),useQueryClient:()=>({})},
 'react-router-dom':{useNavigate:()=>url=>{navigations.push(url);routeID=url.match(/users\/([^/]+)\/edit/)?.[1]??routeID;},useSearchParams:()=>[params,()=>{}],useBlocker:()=>({state:'unblocked'})},
 '@/api/access':{managementApi},'@/auth/AuthProvider':{useAuth:()=>({mode:'local',principal:{access_model:'rbac_v1',graph_revision:'1'},privateEpoch:0,privateBlocked:false,can:()=>true,capturePrivate:()=>({current:()=>true}),refreshSession:async()=>{}})},
 '@/api/client':{toApiError:e=>({message:e.message})},'@/lib/accessDraft':draftModule,'@/lib/revealAccessField':revealModule,
 '@/components/access/UsersPanel':{UsersPanel:'UsersPanel',AccessError:'AccessError'},
 '@/components/access/GroupsPanel':{GroupsPanel:'GroupsPanel'},'@/components/access/RolesPanel':{RolesPanel:'RolesPanel'},
 '@/components/access/UserAccessDrawer':{UserAccessDrawer},'@/components/access/GroupEditor':{GroupEditor:'GroupEditor'},
 '@/components/access/RoleEditor':{RoleEditor:'RoleEditor'},'@/components/access/AccessPreview':{AccessPreview:'AccessPreview'},
 '@/lib/rolePrivileges':{RoleFormError:class extends Error{}},
};
const filename=root+'/src/pages/AccountsPage.tsx';
const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>id.endsWith('.css')?{}:boundaries[id]??require(id);mod._compile(code,filename);
globalThis.document={getElementById:()=>null,activeElement:null};globalThis.window={addEventListener(){},removeEventListener(){}};
let tree;
async function render(){pointer=0;effects=[];tree=mod.exports.AccountsPage({userEditorID:routeID});const queue=effects;effects=[];for(const effect of queue)effect();await Promise.resolve();await Promise.resolve();}
function nodes(value,out=[]){if(!value||typeof value!=='object')return out;if(Array.isArray(value)){value.forEach(v=>nodes(v,out));return out;}if(value.props){out.push(value);nodes(value.props.children,out);}return out;}
function button(label){return nodes(tree).find(n=>n.type==='Button'&&(n.props['aria-label']===label||n.props.children===label));}
function drawer(){return nodes(tree).find(n=>n.type===UserAccessDrawer);}
await render();await render();
drawer().props.onChange({name:'Created employee',login:'created',organization:{kind:'organization',ngdu_id:null,department_id:null},profile:{...profile,revision:'0'}});
await render();drawer().props.onPassword('review-only-password');await render();
await button('Проверить изменения').props.onClick();await Promise.resolve();await render();
assert.ok(button('Применить изменения'));
await button('Применить изменения').props.onClick();await Promise.resolve();await render();
assert.ok(button('Перечитать сохранённые данные'));
await button('Перечитать сохранённые данные').props.onClick();await Promise.resolve();await Promise.resolve();await render();
if(!found){
 assert.deepEqual(reads,[]);assert.equal(button('Загрузить серверную версию'),undefined);assert.ok(button('Начать новую операцию создания'));
 button('К редактированию').props.onClick();await render();assert.equal(drawer().props.password,'review-only-password');
 button('Начать новую операцию создания').props.onClick();assert.ok(confirm);assert.equal(drawer().props.password,'review-only-password');
 confirm.onOk();await render();assert.equal(drawer().props.password,'');assert.equal(drawer().props.value.id,null);assert.equal(drawer().props.value.name,'Created employee');assert.equal(writes,1);assert.deepEqual(navigations,[]);return;
}
assert.deepEqual(reads,['23']);
assert.ok(button('Загрузить серверную версию'));
button('К редактированию').props.onClick();await render();assert.equal(drawer().props.password,'review-only-password');assert.equal(drawer().props.value.id,null);assert.equal(drawer().props.value.name,'Created employee');
button('Загрузить серверную версию').props.onClick();assert.ok(confirm);
confirm.onOk();await render();await render();
assert.equal(drawer().props.value.id,'23');assert.equal(drawer().props.value.name,'Created employee');assert.equal(drawer().props.value.login,'created');assert.equal(drawer().props.value.revision,'9');assert.equal(drawer().props.value.profile.revision,'7');assert.equal(drawer().props.password,'');assert.deepEqual(navigations,['/system/access/users/23/edit?tab=users&search=Created']);assert.equal(writes,1);assert.deepEqual(drawer().props.value.role_ids,['1']);assert.deepEqual(drawer().props.value.group_ids,['8']);
}
test('confirmed found-create readback opens its canonical edit route with committed revisions without replay',()=>recoveryScenario(true));
test('absent create readback offers an explicit new operation and preserves draft until confirmation',()=>recoveryScenario(false));
