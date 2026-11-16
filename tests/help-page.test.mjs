import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {loadDependency} from './load-dependency.mjs';
const parent=new URL('../src/index.ts',import.meta.url).pathname;
function nodes(tree){const out=[];React.Children.forEach(tree,n=>{if(React.isValidElement(n))out.push(n,...nodes(n.props.children));});return out;}
function harness(params={},permissions=[],host={}){
 let index=0,focused=0;const slots=[],effects=[];
 const {HelpPage}=loadDependency('@/pages/HelpPage',parent,{react:{...React,useState:initial=>{const i=index++;slots[i]??={value:initial};return[slots[i].value,v=>{slots[i].value=v;}];},useRef:()=>({current:{focus(){focused++;}}}),useEffect:fn=>{effects.push(fn);}},'@/theme/ThemeProvider':{useTheme:()=>({dark:false,toggle(){}})},'@/auth/AuthProvider':{useAuth:()=>({principal:{authenticated:true,access_model:'rbac_v1',permission_keys:permissions,role:'viewer'}})},'react-router-dom':{Link:'Link',useParams:()=>params,useLocation:()=>({pathname:'/help',key:'one'}),useOutletContext:()=>host},antd:{Input:'Input',Button:'Button'}});
 return {render:()=>{index=0;effects.length=0;return HelpPage();},effects,get focused(){return focused;}};
}
test('unknown article is not silently replaced by first article',()=>{
 const h=harness({guideId:'user-guide',articleId:'missing'}),tree=h.render();assert.ok(nodes(tree).some(n=>n.type==='h1'&&n.props.children==='Статья не найдена'));
 assert.ok(nodes(tree).some(n=>n.props.to==='/help'));
});
test('reader filters application CTAs by routeAccess and focuses article heading on navigation',()=>{
 const h=harness({guideId:'user-guide',articleId:'getting-started'}),tree=h.render();
 assert.ok(!nodes(tree).some(n=>n.props.to==='/structure'));h.effects.forEach(fn=>fn());assert.equal(h.focused,1);
});
test('search is in memory, searches body, and clearing restores the guide view',()=>{
 const h=harness(),input=()=>nodes(h.render()).find(n=>n.type==='Input');
 input().props.onChange({target:{value:'9999'}});const results=h.render();
 assert.ok(nodes(results).some(n=>n.type==='Link'&&n.props.to?.startsWith('/help/user-guide/')));
 input().props.onChange({target:{value:'несуществующаяфразабезрезультатов'}});
 assert.ok(nodes(h.render()).some(n=>n.props.children==='Ничего не найдено'));
 input().props.onChange({target:{value:''}});assert.ok(nodes(h.render()).some(n=>n.type==='nav'&&n.props['aria-label']==='Бизнес-процессы'));
});

test('copy article link omits private search/query and reports clipboard failure honestly',async()=>{
 const oldWindow=globalThis.window,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');let copied;
 globalThis.window={location:{origin:'https://pulse.test',search:'?private=secret'}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>{copied=value;}}}});
 try{const h=harness({guideId:'user-guide',articleId:'getting-started'});let button=nodes(h.render()).find(n=>n.props['aria-label']==='Скопировать ссылку на статью');await button.props.onClick();assert.equal(copied,'https://pulse.test/help/user-guide/getting-started');
 navigator.clipboard.writeText=async()=>{throw new Error('denied');};await nodes(h.render()).find(n=>n.props['aria-label']==='Скопировать ссылку на статью').props.onClick();assert.ok(nodes(h.render()).some(n=>n.props.children==='Не удалось скопировать. Скопируйте адрес статьи из строки браузера.'));
 }finally{globalThis.window=oldWindow;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}
});

test('unknown extra path remains not-found',()=>{
 const tree=harness({'*':'user-guide/getting-started/extra'}).render();assert.ok(nodes(tree).some(n=>n.type==='h1'&&n.props.children==='Статья не найдена'));
});
test('host must support app routes and routeAccess still denies missing permissions',()=>{
 const params={guideId:'user-guide',articleId:'getting-started'};
 assert.ok(!nodes(harness(params,['wells.read']).render()).some(n=>n.props.to==='/structure'));
 assert.ok(!nodes(harness(params,[],{helpRouteEnabled:()=>true}).render()).some(n=>n.props.to==='/structure'));
 assert.ok(nodes(harness(params,['wells.read'],{helpRouteEnabled:()=>true}).render()).some(n=>n.props.to==='/structure'));
});

test('clear search is a keyboard reachable explicit action',()=>{
 const h=harness();nodes(h.render()).find(n=>n.type==='Input').props.onChange({target:{value:'9999'}});
 const clear=nodes(h.render()).find(n=>n.type==='button'&&n.props['aria-label']==='Очистить поиск');assert.ok(clear);clear.props.onClick();assert.equal(nodes(h.render()).find(n=>n.type==='Input').props.value,'');
});

test('documentation shell keeps both guide groups beside every article',()=>{
 const tree=harness({guideId:'user-guide',articleId:'getting-started'}).render();
 assert.ok(nodes(tree).some(n=>n.type==='header'));
 const sidebar=nodes(tree).find(n=>n.type==='aside');assert.ok(sidebar);
 const navigation=nodes(sidebar).filter(n=>n.type==='nav');assert.equal(navigation.length,2);
 assert.equal(navigation.flatMap(nav=>nodes(nav).filter(n=>n.type==='Link')).length,21);
 assert.ok(nodes(sidebar).some(n=>n.props['aria-current']==='page'&&n.props.to==='/help/user-guide/getting-started'));
 assert.ok(nodes(tree).some(n=>n.type==='main'));
});
test('help home and guide overview read as one document with linked contents',()=>{
 for(const params of [{},{guideId:'business-guide'}]){
  const tree=harness(params).render(),articles=nodes(tree).filter(n=>n.type==='article');assert.equal(articles.length,1);
  assert.ok(nodes(articles[0]).some(n=>n.type==='h1'));
  assert.ok(nodes(articles[0]).some(n=>n.type==='Link'&&n.props.to?.startsWith('/help/')));
 }
});

test('documentation header preserves host-owned help actions',()=>{
 const tree=harness({},[],{helpActions:React.createElement('button',{'data-host-action':'help'},'Справка')}).render();
 const header=nodes(tree).find(n=>n.type==='header');assert.ok(header);assert.ok(nodes(header).some(n=>n.props['data-host-action']==='help'));
});

test('full body search filters grouped sidebar without navigating away from current article',()=>{
 const h=harness({guideId:'business-guide',articleId:'purpose-and-limits'});
 nodes(h.render()).find(n=>n.type==='Input').props.onChange({target:{value:'9999'}});
 const sidebar=nodes(h.render()).find(n=>n.type==='aside');assert.ok(sidebar);
 const links=nodes(sidebar).filter(n=>n.type==='Link'&&n.props.to?.split('/').length===4);
 assert.deepEqual(links.map(n=>n.props.to),['/help/user-guide/telemetry-and-quality']);
 nodes(h.render()).find(n=>n.type==='button'&&n.props['aria-label']==='Очистить поиск').props.onClick();
 assert.ok(nodes(h.render()).some(n=>n.type==='h1'&&n.props.children==='Назначение системы и границы применения'));
});

test('help entry and guide aliases show their real introduction article without redirect',()=>{
 for(const [params,title] of [[{},'Начало работы и доступ'],[{guideId:'user-guide'},'Начало работы и доступ'],[{guideId:'business-guide'},'Назначение системы и границы применения']]){
  const tree=harness(params).render();assert.ok(nodes(tree).some(n=>n.type==='h1'&&n.props.children===title));
  assert.ok(nodes(tree).some(n=>n.props['aria-label']==='Скопировать ссылку на статью'));
 }
});
