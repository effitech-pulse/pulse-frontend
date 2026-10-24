import {legacyAuth} from './auth-fixture.mjs';
import {loadDependency} from './load-dependency.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Writable} from 'node:stream';
import ts from 'typescript';
import React from 'react';
import {renderToPipeableStream,renderToStaticMarkup} from 'react-dom/server';
import * as routerLib from 'react-router-dom';
import {PrivateEpoch} from '../src/lib/privateEpoch.ts';
import * as logic from '../src/lib/events.ts';
const require=createRequire(import.meta.url);
const {QueryClient,QueryClientProvider,InfiniteQueryObserver}=require('@tanstack/react-query');
const root=fileURLToPath(new URL('../src/',import.meta.url));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/events-examples.json',import.meta.url)));
const epoch=new PrivateEpoch();
const auth={...legacyAuth(),capturePrivate:()=>epoch.capture()};auth.canAny=(...sets)=>sets.some(set=>set.every(key=>legacyAuth(auth.principal.role).can(key)));
let legacyCalls=0,legacyLocation;
// React's server renderer cannot run layout effects. Keep that known warning
// counted, while forwarding all other diagnostics (including hook-order errors).
const originalError=console.error;let ssrWarnings=0;
test.before(()=>{console.error=(message,...args)=>{
 if(String(message).startsWith('Warning: useLayoutEffect does nothing on the server')){ssrWarnings++;return;}
 originalError(message,...args);
};});
test.after(()=>{console.error=originalError;if(ssrWarnings)console.info(`# Expected SSR-only layout-effect warnings: ${ssrWarnings}; DOM effects remain a browser QA gate.`);});
function harness(url){
 const cache=new Map();
 const boundaries={
  '@/auth/AuthProvider':{useAuth:()=>auth},
  '@/pages/WellDetailPage':{WellDetailPage:()=>{legacyCalls++;legacyLocation=routerLib.useLocation();return React.createElement('div',{'data-legacy':'yes'},'Legacy well');}},
  '@/components/layout/AppLayout':{AppLayout:()=>React.createElement(routerLib.Outlet)},
 };
 function load(filename){
  if(cache.has(filename))return cache.get(filename).exports;
  const source=readFileSync(filename,'utf8').replaceAll('import.meta.env','({})');
  const code=ts.transpileModule(source,{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,mod);
  mod.require=id=>{
   if(Object.hasOwn(boundaries,id))return boundaries[id];
   if(id==='react-router-dom'&&filename.endsWith('/router.tsx'))return {...routerLib,createBrowserRouter:routes=>routerLib.createMemoryRouter(routes,{initialEntries:[url]})};
   if(id.endsWith('.css'))return {};
   if(id.startsWith('@/')||id.startsWith('.')){
    const base=id.startsWith('@/')?path.join(root,id.slice(2)):path.resolve(path.dirname(filename),id);
    const found=[base,base+'.ts',base+'.tsx'].find(candidate=>existsSync(candidate));
    if(found)return load(found);
   }
   return require(id);
  };
  mod._compile(code,filename);return mod.exports;
 }
 return {load:relative=>load(path.join(root,relative))};
}
function queryClient(){return new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity,staleTime:Infinity,retryOnMount:false}}});}
function putDetail(client,data,id=data.event.event_id){client.setQueryData(logic.eventQueryKey('detail',auth.privateEpoch,id),data);}
const tableListKey=()=>['events',auth.privateEpoch,'table',{version:1,sort:[],filters:[]},undefined,undefined];
function putList(client,data,filters={}){client.setQueryData(logic.eventQueryKey('list',auth.privateEpoch,logic.buildEventsURL(filters)),{pages:[data],pageParams:[undefined]});client.setQueryData(tableListKey(),data);}
function stream(element){return new Promise((resolve,reject)=>{let html='';const out=new Writable({write(chunk,_encoding,done){html+=chunk.toString();done();}});out.on('finish',()=>resolve(html.replaceAll('<!-- -->','')));out.on('error',reject);const rendering=renderToPipeableStream(element,{onAllReady(){rendering.pipe(out);},onError:reject});});}
async function renderRoute(url,client=queryClient()){
 const h=harness(url);const {router}=h.load('router.tsx');
 try{return await stream(React.createElement(QueryClientProvider,{client},React.createElement(routerLib.RouterProvider,{router})));}finally{router.dispose();}
}
const body=fixture.responses.details.map(item=>item.response.body);
test('production routes render same exact saved body for event and well mode before legacy hooks',async()=>{
 for(const data of body){
  const client=queryClient();putDetail(client,data);legacyCalls=0;
  const html=await renderRoute(logic.buildEventURL(data.event.event_id,'spa'),client);
  const tab=data.detail.kind==='check'||data.detail.kind==='review'&&data.detail.review_kind==='check'?'checks':'history';
  const wellHTML=await renderRoute(logic.buildWellEventURL(data.event.well.id,data.event.event_id,tab),client);
  assert.match(html,/На момент события/);assert.match(wellHTML,/На момент события/);
  assert.equal(legacyCalls,0);assert.match(html,/9223372036854775807/);assert.match(wellHTML,/Закрыть основание/);
  if(data.detail.kind==='review'){assert.ok(html.includes(data.detail.revision));assert.ok(wellHTML.includes(data.detail.comment));}
  if(data.detail.kind==='check'){assert.ok(html.includes('q1_исторический/Период 01?x=0 +%#'));assert.match(html,/Недостаточно данных/);assert.match(html,/Автор неизвестен/);assert.match(html,/Сохранённых окон нет/);}
  client.clear();
 }
});
test('mismatch and invalid event URL show unavailable without private header or infinite loading',async()=>{
 const data=body[0],client=queryClient();putDetail(client,data);legacyCalls=0;
 for(const url of [`/wells/1?event=${data.event.event_id}`, '/events/bad-id','/wells/9223372036854775807?event=']){
  const html=await renderRoute(url,client);assert.match(html,/Событие недоступно/);assert.doesNotMatch(html,/Текущая карточка|Загрузка события|q1_исторический/);
 }
 assert.equal(legacyCalls,0);client.clear();
});
test('ordinary well route preserves existing tab check run_id and fragment',async()=>{
 legacyCalls=0;const url='/wells/101?tab=checks&check=q1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&run_id=32#source';
 assert.match(await renderRoute(url),/Legacy well/);assert.equal(legacyCalls,1);assert.equal(legacyLocation.search,'?tab=checks&check=q1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&run_id=32');assert.equal(legacyLocation.hash,'#source');
});
test('well exact close link removes only event and preserves other query and hash',async()=>{
 const data=body[2],client=queryClient();putDetail(client,data);
 const html=await renderRoute(`/wells/${data.event.well.id}?tab=history&check=opaque&run_id=32&event=${data.event.event_id}&x=keep#source`,client);
 assert.match(html,/href="\/wells\/9223372036854775807\?tab=history&amp;check=opaque&amp;run_id=32&amp;x=keep#source"/);client.clear();
});
test('saved result renders all typed metrics, timeline false/null/zero and provenance, excludes unknown extras',async()=>{
 const data=structuredClone(fixture.responses.manual_variants[0].response.body);data.detail.result.untrusted='RAW_SECRET';data.detail.result.filename='FILE_SECRET';
 const client=queryClient();putDetail(client,data);const html=await renderRoute(logic.buildEventURL(data.event.event_id,'spa'),client);
 for(const text of ['Частота','Нет','0','fixture-snapshot','synthetic-fixture-runtime','fixture-policy','raw_score','Не указано'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/RAW_SECRET|FILE_SECRET|Сохранить заключение|Последний расчёт/);client.clear();
});
test('list cards retain source order, default25 controls and loaded count without total or raw detail',async()=>{
 const page=structuredClone(fixture.responses.list_all_types.body);page.items[0].comment='PRIVATE_COMMENT';
 const client=queryClient();putList(client,page);const html=await renderRoute('/events',client);
 assert.match(html,/История событий/);assert.match(html,/Фильтр: Тип события/);assert.match(html,/Тип события/);assert.match(html,/Открыть событие/);assert.match(html,/не полный аудит/);
 assert.ok(html.indexOf('Скважина восстановлена')<html.indexOf('Скважина архивирована'));assert.doesNotMatch(html,/PRIVATE_COMMENT|Всего событий|Всего 6/);client.clear();
});
test('list empty, loading and detail HTTP errors render honest feedback',async()=>{
 let client=queryClient();putList(client,fixture.responses.list_empty.body);assert.match(await renderRoute('/events',client),/Нет данных/);client.clear();
 client=queryClient();assert.match(await renderRoute('/events',client),/История событий/);client.clear();
 for(const [status,bodyError,expected] of [[503,{code:'external_service_error'},'Событие временно недоступно'],[404,{code:'not_found'},'Событие недоступно'],[403,{code:'forbidden'},'Нет доступа к истории событий'],[401,{code:'unauthorized'},'Войдите, чтобы продолжить']]){
  client=queryClient();const data=body[0];const key=logic.eventQueryKey('detail',auth.privateEpoch,data.event.event_id);
  client.getQueryCache().build(client,{queryKey:key}).setState({status:'error',fetchStatus:'idle',error:{isAxiosError:true,response:{status,data:bodyError}}});
  const html=await renderRoute(logic.buildEventURL(data.event.event_id,'spa'),client);assert.ok(html.includes(expected),expected);assert.doesNotMatch(html,/Текущая карточка/);client.clear();
 }
});
test('GET API and actual infinite query preserve continuation on503 and retry identical cursor',async()=>{
 const h=harness('/events'),{eventsApi}=h.load('api/events.ts'),{apiClient}=h.load('api/client.ts');
 const calls=[];let fail=true;apiClient.defaults.adapter=async config=>{
  calls.push({method:config.method,url:config.url,signal:config.signal});
  if(config.url.includes('cursor=')&&fail){fail=false;throw {isAxiosError:true,response:{status:503,data:{code:'external_service_error'}}};}
  const data=config.url.includes('cursor=')?fixture.responses.list_empty.body:fixture.responses.list_continuation_example.body;
  return {data,status:200,statusText:'OK',headers:{},config};
 };
 const client=queryClient();const observer=new InfiniteQueryObserver(client,{queryKey:['integration-events'],queryFn:({pageParam,signal})=>eventsApi.list({},pageParam,signal),initialPageParam:undefined,getNextPageParam:page=>page.has_more?page.next_cursor:undefined,retry:false});
 const unsubscribe=observer.subscribe(()=>{});await observer.refetch();const before=observer.getCurrentResult().data.pages[0];
 await observer.fetchNextPage();assert.equal(observer.getCurrentResult().isFetchNextPageError,true);assert.equal(observer.getCurrentResult().data.pages[0],before);
 await observer.fetchNextPage();assert.equal(observer.getCurrentResult().data.pages.length,2);assert.equal(calls[1].url,calls[2].url);assert.ok(calls.every(call=>call.method==='get'&&call.signal));unsubscribe();client.clear();
});
test('all read roles have events navigation while technical audit remains admin only',()=>{
 for(const role of ['viewer','technologist','admin']){
  auth.principal.role=role;auth.isAdmin=role==='admin';auth.canOperate=role!=='viewer';
  // Render the real layout, replacing only unrelated popup providers.
  const filename=path.join(root,'components/layout/AppLayout.tsx');
  const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod.require=id=>id==='@/auth/AuthProvider'?{useAuth:()=>auth}:id==='@/theme/ThemeProvider'?{useTheme:()=>({dark:false,toggle(){}})}:id==='./WorkspaceMenu'?{WorkspaceProfile:()=>null,WorkspaceEvents:()=>null}:loadDependency(id,filename,{ '@/auth/AuthProvider':{useAuth:()=>auth} });mod._compile(source,filename);
  const html=renderToStaticMarkup(React.createElement(routerLib.MemoryRouter,{initialEntries:['/events']},React.createElement(mod.exports.AppLayout)));
  assert.match(html,/href="\/events"/);assert.equal(html.includes('href="/audit"'),role==='admin');if(role==='admin')assert.match(html,/Технический журнал/);
 }
 auth.principal.role='viewer';auth.isAdmin=false;auth.canOperate=false;
});

test('server list denial removes cached event links without displaying raw error payload',async()=>{
 for(const status of [401,403,404]){const client=queryClient();putList(client,fixture.responses.list_continuation_example.body);client.getQueryCache().find({queryKey:tableListKey(),exact:true}).setState({status:'error',fetchStatus:'idle',error:{isAxiosError:true,response:{status,data:{code:status===401?'unauthorized':'forbidden',message:'SQL_SECRET'}}}});const html=await renderRoute('/events',client);assert.doesNotMatch(html,/Открыть событие|SQL_SECRET/);client.clear();}
});
test('epoch change never renders prior cached details or event links',async()=>{
 const client=queryClient();putList(client,fixture.responses.list_all_types.body);putDetail(client,body[0]);auth.privateEpoch=1;
 try{
  const list=await renderRoute('/events',client),detail=await renderRoute(logic.buildEventURL(body[0].event.event_id,'spa'),client);
  assert.doesNotMatch(list,/Открыть событие/);assert.doesNotMatch(detail,/Текущая карточка|q1_исторический/);
 }finally{auth.privateEpoch=0;client.clear();}
});

test('pending server page keeps current rows and disables continuation to prevent duplicate requests',async()=>{
 const client=queryClient();putList(client,fixture.responses.list_continuation_example.body);client.getQueryCache().find({queryKey:tableListKey(),exact:true}).setState({status:'success',fetchStatus:'fetching'});const html=await renderRoute('/events',client);assert.match(html,/Открыть событие/);assert.match(html,/disabled/);client.clear();
});
test('terminal append focus snapshot selects only a newly appended available link and respects ownership/session',()=>{
 const {EventAppendFocusBoundary}=harness('/events').load('pages/EventsPage.tsx');
 assert.equal(typeof EventAppendFocusBoundary,'function');
 const priorDocument=globalThis.document,priorAnchor=globalThis.HTMLAnchorElement;
 try{
  function scenario({outside=false,child=false,missing=false,staleBefore=false,staleAfter=false,movedAfter=false,terminal=true,beforeCount=2}={}){
   const session=new PrivateEpoch();
   const doc={activeElement:null,body:null,getElementById:id=>nodes.get(id)??null};const nodes=new Map();
   class FocusNode {
    constructor(name,parent=null){this.name=name;this.parent=parent;this.isConnected=true;}
    contains(node){return node===this||node?.parent===this;}
    focus(){doc.activeElement=this;}
   }
   class Anchor extends FocusNode {hasAttribute(name){return name==='href';}}
   globalThis.HTMLAnchorElement=Anchor;globalThis.document=doc;
   doc.body=new FocusNode('BODY');const button=new FocusNode('load-more'),heading=new FocusNode('heading'),other=new FocusNode('other'),spinner=new FocusNode('spinner',button);
   const link=new Anchor('first-new-link');if(!missing)nodes.set(`event-${body[2].event.event_id}`,link);
   // An earlier still-available event must never become the terminal target.
   nodes.set(`event-${body[0].event.event_id}`,new Anchor('old-link'));
   doc.activeElement=outside?other:child?spinner:button;
   const props={items:body.map(data=>data.event),beforeCount,terminal,ticket:session.capture(),buttonRef:{current:button},headingRef:{current:heading},children:null};
   const boundary=new EventAppendFocusBoundary(props);if(staleBefore)session.invalidate();
   const snapshot=boundary.getSnapshotBeforeUpdate(props);
   if(snapshot){button.isConnected=false;doc.activeElement=movedAfter?other:doc.body;if(staleAfter)session.invalidate();}
   boundary.componentDidUpdate(props,{},snapshot);
   return doc.activeElement.name;
  }
  assert.equal(scenario(),'first-new-link');assert.equal(scenario({child:true}),'first-new-link');
  assert.equal(scenario({missing:true}),'heading');assert.equal(scenario({outside:true}),'other');
  assert.equal(scenario({movedAfter:true}),'other');assert.equal(scenario({terminal:false}),'load-more');
  assert.equal(scenario({beforeCount:null}),'load-more');assert.equal(scenario({staleBefore:true}),'load-more');assert.equal(scenario({staleAfter:true}),'BODY');
 }finally{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;if(priorAnchor===undefined)delete globalThis.HTMLAnchorElement;else globalThis.HTMLAnchorElement=priorAnchor;}
});
test('ordinary event list exposes shared two-row filter and sort controls',async()=>{
 const client=queryClient();putList(client,fixture.responses.list_continuation_example.body);const html=await renderRoute('/events',client);assert.match(html,/Фильтры: ID Pulse, № скважины/);assert.match(html,/Тип события\. Без сортировки/);assert.match(html,/Далее/);client.clear();
});
test('explicit F3 retry transfers owned focus before removal, but never steals changed or stale-session focus',()=>{
 const {focusEventRetry,EventFeedback}=harness('/events').load('components/events/EventDetailView.tsx');
 assert.equal(typeof focusEventRetry,'function');
 const prior=globalThis.document;
 try{
  const session=new PrivateEpoch();const source={contains:node=>node===source||node?.parent===source};
  const heading={focus(){document.activeElement=heading;}};const elsewhere={};const child={parent:source};
  globalThis.document={activeElement:source};
  // Exercise the actual shared feedback click adapter, not a mock call count.
  const tree=EventFeedback({error:{isAxiosError:true,response:{status:503}},onRetry:button=>focusEventRetry(button,heading,session.capture())});
  const retry=React.Children.toArray(tree.props.children).find(element=>element.props?.onClick);
  assert.ok(retry);retry.props.onClick({currentTarget:source});assert.equal(document.activeElement,heading);
  document.activeElement=child;focusEventRetry(source,heading,session.capture());assert.equal(document.activeElement,heading);
  document.activeElement=elsewhere;focusEventRetry(source,heading,session.capture());assert.equal(document.activeElement,elsewhere);
  const old=session.capture();session.invalidate();document.activeElement=source;focusEventRetry(source,heading,old);assert.equal(document.activeElement,source);
 }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
