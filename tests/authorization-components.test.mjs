import {loadDependency} from './load-dependency.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import {can,canFull} from '../src/auth/authorization.ts';
const require=createRequire(import.meta.url);
function load(relative,permissions,patch={}){
 const principal={authenticated:true,access_model:'rbac_v1',role:'admin',permission_keys:permissions,...patch};
 const options=[];
 const boundaries={
 '@/auth/AuthProvider':{useAuth:()=>({principal,can:(...keys)=>can(principal,...keys),canFull:(...keys)=>canFull(principal,...keys)})},
 '@tanstack/react-query':{useQuery:q=>{options.push(q);return q;},useQueryClient:()=>({}),useMutation:()=>({})},
 react:{useEffect:()=>{},useRef:value=>({current:value})},antd:{App:{useApp:()=>({message:{}})}},'@/api/ml':{mlApi:{}},
 '@/api/wells':{wellsApi:{},departmentsApi:{},ngduApi:{},runsApi:{}},
 '@/api/incidents':{incidentsApi:{}},'@/api/analytics':{analyticsApi:{}},'@/api/audit':{auditApi:{}},'@/api/parameters':{parametersApi:{}},
 '@/api/client':{},'@/theme/FundFilters':{useFundFilters:()=>({filters:{}})},
 };
 const filename=fileURLToPath(new URL(relative,import.meta.url));const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>boundaries[id]??loadDependency(id,filename,boundaries);mod._compile(code,filename);return {...mod.exports,options};
}
test('well-only principal never launches risks, complications, references or runs requests',()=>{
 const hooks=load('../src/hooks/useWells.ts',['wells.read']);
 hooks.useWells();hooks.useWell(1);hooks.useWellPredictions(1);hooks.useWellComplications(1);hooks.useDepartments();hooks.useNgdus();hooks.useRecentRuns();
 assert.deepEqual(hooks.options.map(q=>q.enabled),[true,true,false,false,false,false,false]);
});
test('empty modern account (even admin label) disables all product query hooks',()=>{
 for(const [file,method,args] of [['useAnalytics','useAnalyticsStatus',[]],['useAnalytics','useEmbedUrl',[1]],['useIncidents','useIncidents',[1]],['useAudit','useAudit',[]],['useParameters','useParameters',[]]]){
  const hooks=load(`../src/hooks/${file}.ts`,[]);hooks[method](...args);assert.equal(hooks.options[0].enabled,false,method);
 }
});

test('ML run polling checks the active server profile before querying',()=>{
 const research=load('../src/hooks/useMlRun.ts',['runs.read']);
 research.useMlRun('research');research.useMlRun('cohort');research.useMlRun();
 assert.deepEqual(research.options.map(q=>q.enabled),[true,false,false]);
 const cohort=load('../src/hooks/useMlRun.ts',['wells.read','risks.read','cohort.runs.read']);
 cohort.useMlRun('cohort');cohort.useMlRun('research');
 assert.deepEqual(cohort.options.map(q=>q.enabled),[true,false]);
});
test('FULL hooks do not probe audit/embed with limited data scope and keep normal analytics status readable',()=>{
 const local={scope:{funds:['operational','presentation'],ngdus:null,departments:null},organization_scope:{kind:'department',ngdu_id:'0',department_id:'-1'}};
 const audit=load('../src/hooks/useAudit.ts',['audit.read'],local);audit.useAudit();assert.equal(audit.options[0].enabled,false);
 const analytics=load('../src/hooks/useAnalytics.ts',['analytics.read'],local);analytics.useAnalyticsStatus();analytics.useEmbedUrl(1);assert.deepEqual(analytics.options.map(q=>q.enabled),[true,false]);
 const global=load('../src/hooks/useAudit.ts',['audit.read'],{...local,organization_scope:{kind:'organization',ngdu_id:null,department_id:null}});global.useAudit();assert.equal(global.options[0].enabled,true);
});
