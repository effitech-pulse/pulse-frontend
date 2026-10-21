import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const displayTime=await import('../src/lib/displayTime.ts');
function render(result){
 const filename=fileURLToPath(new URL('../src/pages/UploadCheckPage.tsx',import.meta.url));
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 let stateIndex=0;
 const boundaries={'@/hooks/useFileJobs':{useFileCapabilities:()=>({enabled:false,isLoading:false})},'@/components/telemetry/FileJobUpload':{FileJobUpload:()=>null},react:{...React,useState:initial=>{stateIndex++;return [stateIndex===3?result:initial,()=>{}];}},'@ant-design/charts':{Line:()=>React.createElement('div',{'data-risk-chart':true})},'@/auth/AuthProvider':{useAuth:()=>({isAdmin:true})},'@/api/client':{apiClient:{},toApiError:error=>error},'@/lib/displayTime':displayTime,'@/components/ml/RiskHistoryChart':{RiskHistoryChart:()=>React.createElement('div',{'data-risk-chart':true})},'@/components/ml/ExplainBars':{ExplainBars:()=>React.createElement('div',{'data-explanation':true})}};
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>Object.hasOwn(boundaries,id)?boundaries[id]:require(id);mod._compile(code,filename);
 const Component=mod.exports.FileCheckResult??mod.exports.UploadCheckPage;
 return renderToStaticMarkup(React.createElement(Component,{result}));
}
const base={filename:'zero.csv',verdict:'insufficient',span_days:30,n_windows:0,windows_running:0,channels_used:0,windows_above_watch:0,windows_above_alert:0,latest_risk:0,peak_risk:0,peak_window_end:'',timeline:[],contributions:[]};
test('insufficient file result cannot become zero risk, normal status, chart or SHAP',()=>{
 const html=render(base);assert.match(html,/недостаточно/i);assert.doesNotMatch(html,/Пиковый риск|Риск в конце периода|data-risk-chart|data-explanation/);
 assert.match(html,/текущем сеансе/);
});
test('scored file result preserves literal zero and never claims automatic saved result',()=>{
 const html=render({...base,verdict:'norm',n_windows:2,windows_running:2,features_total:0,features_unavailable:0,timeline:[{window_end:'2026-10-01T00:00:00Z',risk:0}]});
 assert.match(html,/0\.0/);assert.match(html,/data-risk-chart/);assert.match(html,/0 из 0/);assert.doesNotMatch(html,/Результат сохранён|Скачать отчёт/);
});
