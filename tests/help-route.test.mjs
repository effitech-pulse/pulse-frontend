import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {loadDependency} from './load-dependency.mjs';
const parent=new URL('../src/index.ts',import.meta.url).pathname;
function nodes(tree){const out=[];React.Children.forEach(tree,n=>{if(React.isValidElement(n))out.push(n,...nodes(n.props.children));});return out;}
test('help chunk failure offers honest reload and loading has a readable status',()=>{
 const {HelpRoute,HelpErrorBoundary}=loadDependency('@/components/help/HelpRoute',parent);
 const boundary=new HelpErrorBoundary({children:'article'});assert.equal(boundary.render(),'article');boundary.state=HelpErrorBoundary.getDerivedStateFromError(new Error('chunk failed'));
 const tree=boundary.render();assert.ok(nodes(tree).some(n=>n.props.children==='Не удалось открыть справку'));
 const old=globalThis.window;let reloads=0;globalThis.window={location:{reload:()=>reloads++}};try{nodes(tree).find(n=>n.type==='button').props.onClick();assert.equal(reloads,1);}finally{globalThis.window=old;}
 const route=HelpRoute(),fallback=nodes(route).find(n=>n.type===React.Suspense).props.fallback;assert.ok(nodes(fallback).some(n=>n.props.children==='Загрузка справки…'));
});
