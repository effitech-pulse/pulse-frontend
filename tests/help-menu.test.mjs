import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {loadDependency} from './load-dependency.mjs';
const parent=new URL('../src/index.ts',import.meta.url).pathname;
function nodes(tree){const out=[];React.Children.forEach(tree,n=>{if(React.isValidElement(n))out.push(n,...nodes(n.props.children));});return out;}
function menu(props){const {HelpMenu}=loadDependency('@/components/help/HelpMenu',parent,{react:{...React,useState:()=>[false,()=>{}],useRef:()=>({current:null})},antd:{Dropdown:'Dropdown',Button:'Button',Tooltip:'Tooltip'}});return HelpMenu(props);}
test('one documentation entry remains reachable when optional feedback and policy actions are unavailable',()=>{
 const tree=menu({feedbackEnabled:false}),dropdown=nodes(tree).find(n=>n.type==='Dropdown'),items=dropdown.props.menu.items.filter(i=>i.type!=='divider');
 assert.deepEqual(items.map(i=>({label:i.label.props.children,to:i.label.props.to})),[{label:'Документация',to:'/help'}]);
 const trigger=nodes(tree).find(n=>n.type==='Button');assert.equal(trigger.props['aria-label'],'Справка');assert.equal(trigger.props.children,undefined);
});
test('enabled feedback and policy call their own callbacks; disabled feedback never appears',()=>{
 let feedback=0,policy=0;
 const props={onFeedback:()=>feedback++,onPolicy:()=>policy++,feedbackEnabled:true};
 const items=nodes(menu(props)).find(n=>n.type==='Dropdown').props.menu.items;
 items.find(i=>i.key==='feedback').onClick();items.find(i=>i.key==='policy').onClick();assert.equal(feedback,1);assert.equal(policy,1);
 assert.ok(!nodes(menu({...props,feedbackEnabled:false})).find(n=>n.type==='Dropdown').props.menu.items.some(i=>i.key==='feedback'));
});
