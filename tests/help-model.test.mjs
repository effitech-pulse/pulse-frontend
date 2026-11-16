import test from 'node:test';
import assert from 'node:assert/strict';
import {routeAccess} from '../src/auth/authorization.ts';
const fixture=[{id:'user-guide',title:'Руководство',description:'Описание',updatedAt:'2026-11-08',articles:[{id:'first',title:'Первое',summary:'Кратко',keywords:['архив'],sections:[{heading:'Расчёт',paragraphs:['Сохранённый результат'],steps:['Выберите период'],bullets:['Нулевой дебит допустим'],links:[{label:'Карточка',to:'/structure'}]}]},{id:'second',title:'Другое',summary:'Другое',keywords:[],sections:[]}]}];
test('help admits authenticated readers without granting data routes',()=>{
 const p={authenticated:true,access_model:'rbac_v1',permission_keys:[],role:'viewer'};
 for(const path of ['/help','/help/user-guide','/help/user-guide/first'])assert.equal(routeAccess(p,path),true);
 assert.equal(routeAccess(null,'/help'),false);assert.equal(routeAccess(p,'/structure'),false);assert.equal(routeAccess(p,'/helpful'),false);
});
test('search covers complete article text, normalizes Russian and keeps stable article order',async()=>{
 const {searchHelp}=await import('../src/lib/help.ts');
 for(const q of [' СОХРАНЕННЫЙ   результат ','период','нулевой','архив','карточка','расчет'])assert.deepEqual(searchHelp(fixture,q).map(r=>r.article.id),['first']);
 assert.deepEqual(searchHelp(fixture,'  '),[]);assert.deepEqual(searchHelp(fixture,'нет совпадений'),[]);
});
test('lookup distinguishes guide overview and unknown article without substituting the first article',async()=>{
 const {resolveHelp}=await import('../src/lib/help.ts');
 assert.equal(resolveHelp(fixture).kind,'index');assert.equal(resolveHelp(fixture,'user-guide').kind,'guide');
 assert.equal(resolveHelp(fixture,'user-guide','first').article.id,'first');
 for(const args of [['missing'],['user-guide','missing'],['missing','first']])assert.equal(resolveHelp(fixture,...args).kind,'not-found');
});
