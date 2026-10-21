import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),antd=require('antd');
function setup(post,isAdmin=true){
 let beforeUpload,stateIndex=0;const changes=[[],[],[]];
 function Upload(props){beforeUpload=props.beforeUpload;return React.createElement(antd.Upload,props);}
 Upload.Dragger=props=>React.createElement(antd.Upload.Dragger,props);
 const filename=fileURLToPath(new URL('../src/pages/UploadCheckPage.tsx',import.meta.url));
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const boundaries={'@/hooks/useFileJobs':{useFileCapabilities:()=>({enabled:false,isLoading:false})},'@/components/telemetry/FileJobUpload':{FileJobUpload:()=>null},react:{...React,useState:initial=>{const index=stateIndex++;return[initial,value=>changes[index].push(value)];}},antd:{...antd,Upload},'@/auth/AuthProvider':{useAuth:()=>({isAdmin})},'@/api/client':{apiClient:{post},toApiError:error=>({message:error.message,http_request_id:'Request_0123456789'})},'@/lib/displayTime':{formatSnapshotTime:value=>value},'@/components/ml/RiskHistoryChart':{RiskHistoryChart:()=>null},'@/components/ml/ExplainBars':{ExplainBars:()=>null}};
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=id=>Object.hasOwn(boundaries,id)?boundaries[id]:require(id);mod._compile(code,filename);
 renderToStaticMarkup(React.createElement(mod.exports.UploadCheckPage));return{beforeUpload,changes};
}
test('new upload clears previous result before real multipart boundary and concurrent submit is ignored',async()=>{
 const calls=[];let resolve;
 const {beforeUpload,changes}=setup((...args)=>{calls.push(args);return new Promise(done=>{resolve=done;});});
 const file=new File(['ts,F_out\n2026-10-01,0'],'zero.csv',{type:'text/csv'});
 assert.equal(beforeUpload(file),false);assert.deepEqual(changes[2],[null]);assert.equal(calls.length,1);
 assert.equal(calls[0][0],'/api/v1/ml/upload');assert.equal(calls[0][1].get('file').name,'zero.csv');
 beforeUpload(file);assert.equal(calls.length,1);
 const result={filename:'zero.csv'};resolve({data:result});await new Promise(done=>setImmediate(done));
 assert.equal(changes[2].at(-1),result);assert.equal(changes[0].at(-1),false);
});
test('transport error clears old result and preserves safe error ID; retry is available',async()=>{
 const {beforeUpload,changes}=setup(()=>Promise.reject(new Error('Нет данных')));
 beforeUpload(new File(['x'],'input.csv'));await new Promise(done=>setImmediate(done));
 assert.deepEqual(changes[2],[null]);assert.equal(changes[1].at(-1).message,'Нет данных');
 assert.equal(changes[1].at(-1).http_request_id,'Request_0123456789');assert.equal(changes[0].at(-1),false);
});
test('50MiB and extension validation plus admin restriction stop HTTP upload',()=>{
 let calls=0;const {beforeUpload,changes}=setup(()=>{calls++;return Promise.resolve({data:{}});});
 beforeUpload({name:'too-big.csv',size:50*1024*1024+1});beforeUpload({name:'data.exe',size:1});
 assert.equal(calls,0);assert.equal(changes[2].length,2);
 const restricted=setup(()=>{calls++;return Promise.resolve({data:{}});},false);
 restricted.beforeUpload({name:'input.csv',size:1});assert.equal(calls,0);
});
