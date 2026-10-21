import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),time=await import('../src/lib/displayTime.ts');
function render(data){
 const filename=fileURLToPath(new URL('../src/pages/AuditPage.tsx',import.meta.url));
 const js=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const boundaries={'@/hooks/useAudit':{useAudit:()=>({data,isLoading:false,refetch:()=>{},isFetching:false})},'@/components/common/PageSpin':{PageSpin:({children})=>children},'@/lib/displayTime':time};
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>Object.hasOwn(boundaries,id)?boundaries[id]:require(id);mod._compile(js,filename);
 return renderToStaticMarkup(React.createElement(mod.exports.AuditPage));
}
test('restricted empty HTTP audit never asserts that business actions did not occur',()=>{
 const html=render([]);assert.match(html,/Нет доступных записей/);assert.match(html,/записи журнала недоступны/);assert.match(html,/не является предметной историей/);assert.doesNotMatch(html,/действий не было|Подозрение подтверждено|Принята в работу/i);
});
test('real request identity, method, status and original timestamp stay visible',()=>{
 const html=render([{id:1,ts:'2026-10-20T21:37:37Z',actor:null,method:'PATCH',path:'/api/v1/wells/1001',status_code:409}]);
 assert.match(html,/PATCH/);assert.match(html,/409/);assert.match(html,/\/api\/v1\/wells\/1001/);assert.match(html,/2026-10-20T21:37:37Z/);assert.match(html,/21\.10\.2026 00:37 МСК/);
});
