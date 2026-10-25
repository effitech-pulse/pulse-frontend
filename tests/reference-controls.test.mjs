import {loadDependency} from './load-dependency.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function renderPanel(name) {
 const filename = fileURLToPath(new URL(`../src/components/structure/${name}Panel.tsx`, import.meta.url));
 const boundaries = {
  '@/auth/AuthProvider': { useAuth: () => ({ can: () => true, canFull: () => true, privateBlocked:false }) },
  '@/hooks/useWells': { useNgdus: () => ({data:[{id:0,name:'Справочник'}]}), useDepartments: () => ({data:[{id:0,name:'Справочник'}]}), useDeleteNgdu: () => ({}), useDeleteDepartment: () => ({}) },
  '@/components/common/PageSpin': {PageSpin: ({children}) => children},
  '@/components/structure/NgduModal': {NgduModal: () => null},
  '@/components/departments/DepartmentModal': {DepartmentModal: () => null},
 };
 const code = ts.transpileModule(readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod = new Module(filename); mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename)); mod.require=id=>boundaries[id]??loadDependency(id,filename,boundaries); mod._compile(code,filename);
 return renderToStaticMarkup(React.createElement(require('react-router-dom').MemoryRouter,null,React.createElement(mod.exports[`${name}Panel`])));
}
for (const [panel,entity] of [['Ngdu','НГДУ'],['Departments','цех']]) test(`${panel} edit/delete buttons have contextual Russian names and decorative icons`,()=>{
 const html=renderPanel(panel);
 assert(html.includes(`aria-label="Редактировать ${entity} «Справочник» (0)"`));
 assert(html.includes(`aria-label="Удалить ${entity} «Справочник» (0)"`));
 assert.match(html,/aria-hidden="true"/);
});
