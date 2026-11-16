import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {loadDependency} from './load-dependency.mjs';
const parent=new URL('../src/index.ts',import.meta.url).pathname;
function nodes(tree){const out=[];React.Children.forEach(tree,n=>{if(React.isValidElement(n))out.push(n,...nodes(n.props.children));});return out;}
function layout(){const {AppLayout}=loadDependency('@/components/layout/AppLayout',parent,{react:{...React,useState:v=>[typeof v==='function'?v():v,()=>{}],useRef:v=>({current:v}),useEffect(){}},antd:{Button:'Button',Layout:Object.assign(()=>null,{Sider:'Sider',Header:'Header',Content:'Content'}),Menu:'Menu',Space:'Space',Spin:'Spin',Tooltip:'Tooltip',Result:'Result'},'react-router-dom':{Link:'Link',Outlet:'Outlet',useLocation:()=>({pathname:'/help/user-guide/getting-started',search:'',key:'help'})},'@/auth/AuthProvider':{useAuth:()=>({principal:{authenticated:true,access_model:'rbac_v1',permission_keys:['wells.read'],role:'viewer'},mode:'local',capturePrivate(){}})},'@/theme/ThemeProvider':{useTheme:()=>({dark:false,toggle(){}})},'./WorkspaceMenu':{WorkspaceProfile:'Profile'},'@/hooks/useNotifications':{NotificationsPrivateContext:React.createContext({}),useNotifications:()=>({boundary:1,controller:{},count:0})},'@/components/notifications/NotificationsPanel':{NotificationBell:'Bell',NotificationsPanel:'NotificationsPanel',NotificationNavigation:React.createContext({}),actionID:()=>''}});return nodes(AppLayout());}
test('canonical host hides unregistered runtime sections despite broad wells permission',()=>{
 const tree=layout(),predicate=tree.find(n=>n.type==='Outlet').props.context?.helpRouteEnabled;
 assert.equal(typeof predicate,'function');
 for(const path of ['/work','/work/team','/users','/product/usage','/calculation-runs','/operating-reports','/notifications'])assert.equal(predicate(path),false,path);
 assert.equal(predicate('/structure'),true);assert.equal(predicate('/integrations'),false);
 assert.ok(!tree.some(n=>n.props.className==='app-breadcrumb'));
 assert.ok(tree.find(n=>n.type==='Outlet').props.context.helpActions);
 assert.ok(!tree.some(n=>n.props.className==='pulse-app'));
});
