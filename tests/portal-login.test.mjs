import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require=createRequire(import.meta.url), antd=require('antd');
function loadLogin(dark=false) {
 const filename=fileURLToPath(new URL('../src/auth/LoginPage.tsx',import.meta.url));
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 let finish;
 const Form=Object.assign(props=>{finish=props.onFinish;return React.createElement(antd.Form,props);},antd.Form);
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>id.endsWith('.css')?{}:id==='@/theme/ThemeProvider'?{useTheme:()=>({dark,toggle:()=>{}})}:id==='antd'?{...antd,Form}:require(id);mod._compile(code,filename);
 return {Component:mod.exports.LoginPage,getFinish:()=>finish};
}
function render(login,props={}){return renderToStaticMarkup(React.createElement(antd.App,null,React.createElement(login.Component,{mode:'local',error:'',busy:false,onLogin:()=>{},onRetry:()=>{},...props})));}
test('login renders the split Figma screen with real username/password contract',()=>{
 const login=loadLogin(),html=render(login);assert.match(html,/Вход в систему/);assert.match(html,/Предиктивная диагностика УЭЦН/);assert.match(html,/pulse-login-product/);assert.doesNotMatch(html,/ant-card|type="email"/);assert.match(html,/autoComplete="username"/);assert.match(html,/autoComplete="current-password"/);assert.match(html,/label[^>]*>Логин</);assert.match(html,/Забыли пароль/);assert.match(html,/Запросить доступ/);
});
test('login forwards credentials once through its existing supplied callback',async()=>{
 const login=loadLogin();const calls=[];render(login,{onLogin:async values=>{calls.push(values);}});const credentials={login:'someone.user',password:'literal secret 123'};await login.getFinish()(credentials);assert.deepEqual(calls,[credentials]);
});
test('legacy connection failure keeps retry and never invents a local login',()=>{
 const login=loadLogin(),html=render(login,{mode:undefined,error:'Сервис недоступен'});assert.match(html,/Повторить подключение/);assert.doesNotMatch(html,/name="login"|name="password"/);assert.match(html,/Сервис недоступен/);
});
test('login error is visible and escaped, busy state announces progress',()=>{
 const login=loadLogin();const html=render(login,{error:'<script>unsafe</script>',busy:true});assert.match(html,/&lt;script&gt;unsafe&lt;\/script&gt;/);assert.match(html,/ant-btn-loading/);assert.match(html,/aria-busy="true"/);
});
test('both themes use the exact local Figma assets at their authored dimensions',()=>{
 for(const dark of [false,true]){const html=render(loadLogin(dark));assert.match(html,new RegExp(`/figma/login/pulse-${dark?'dark':'light'}\\.svg`));assert.match(html,new RegExp(`/figma/login/${dark?'sun':'moon'}\\.svg`));assert.match(html,/width="48" height="48"/);assert.match(html,/width="18" height="18"/);}
});
