import {readFileSync,existsSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import {legacyAuth} from './auth-fixture.mjs';
const src=fileURLToPath(new URL('../src/',import.meta.url));
const caches=new WeakMap();
const resolve=(id,parent)=>id.startsWith('@/')?path.join(src,id.slice(2)):id.startsWith('.')?path.resolve(path.dirname(parent),id):null;
export function loadDependency(id,parent,boundaries={}){
 if(id.endsWith('.css'))return {};
 if(Object.hasOwn(boundaries,id))return boundaries[id];
 const resolved=resolve(id,parent);if(!resolved)return createRequire(parent)(id);
 for(const [name,value] of Object.entries(boundaries))if(resolve(name,parent)===resolved)return value;
 if(resolved===path.join(src,'auth/AuthProvider'))return {useAuth:()=>legacyAuth('admin')};
 const filename=['','.ts','.tsx','.js'].map(ext=>resolved+ext).find(existsSync);if(!filename)return createRequire(parent)(id);
 let cache=caches.get(boundaries);if(!cache){cache=new Map();caches.set(boundaries,cache);}if(cache.has(filename))return cache.get(filename).exports;
 if(!/\.tsx?$/.test(filename))return createRequire(parent)(filename);
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,mod);
 mod.require=child=>loadDependency(child,filename,boundaries);
 const source=readFileSync(filename,'utf8').replaceAll('import.meta.env','({})');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 mod._compile(code,filename);return mod.exports;
}
