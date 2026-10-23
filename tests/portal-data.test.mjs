import {legacyAuth} from './auth-fixture.mjs';
import * as authorization from '../src/auth/authorization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import axios from 'axios';

const require = createRequire(import.meta.url);
function load(relative, boundaries) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const js = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => id==='@/auth/authorization'?authorization:id==='@/auth/AuthProvider'&&!Object.hasOwn(boundaries,id)?{useAuth:()=>legacyAuth()}:Object.hasOwn(boundaries, id) ? boundaries[id] : require(id);
  mod._compile(js, filename);
  return mod.exports;
}

const filters = { search: '001', sort: 'id_desc', ngdu: 0, department: -900 };
test('portal list and export send the same filters without a legacy fund restriction', async () => {
  const requests = [];
  const apiClient = axios.create({ adapter: async config => {
    requests.push(new URL(axios.getUri(config), 'http://portal'));
    return { data: [], status: 200, statusText: 'OK', headers: {}, config };
  } });
  const { wellsApi } = load('../src/api/wells.ts', { './client': { apiClient } });
  await wellsApi.list(false, filters, 'archived');
  await wellsApi.exportXlsx(filters, false, 'archived');
  for (const url of requests) {
    assert.equal(url.searchParams.has('fund'), false);
    assert.equal(url.searchParams.get('archive'), 'archived');
    assert.equal(url.searchParams.get('active_only'), 'false');
    for (const [key, value] of Object.entries(filters)) assert.equal(url.searchParams.get(key), String(value));
  }
  assert.equal(requests[1].searchParams.get('identity'), 'pulse');
});

test('incident statistics use the same server-scoped selection and preserve code zero', async () => {
  let url;
  const apiClient = axios.create({ adapter: async config => {
    url = new URL(axios.getUri(config), 'http://portal');
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  } });
  const { incidentsApi } = load('../src/api/incidents.ts', { './client': { apiClient } });
  await incidentsApi.stats(filters);
  assert.equal(url.searchParams.has('fund'), false);
  assert.equal(url.searchParams.get('ngdu'), '0');
  assert.equal(url.searchParams.get('search'), '001');
});

test('well query preserves all server-authorized members irrespective of historical fund_type', async () => {
  const members = [{ id: 1, fund_type: 'operational' }, { id: 2, fund_type: 'presentation' }];
  const requests = [];
  const { useWells } = load('../src/hooks/useWells.ts', {
    '@tanstack/react-query': { useQuery: options => options },
    '@/api/wells': { wellsApi: { list: async (...args) => { requests.push(args); return members; } } },
    '@/api/client': {},
    '@/theme/FundFilters': { useFundFilters: () => ({ filters }) },
    '@/theme/FundProvider': { useFund: () => ({ fund: 'presentation' }) },
  });
  const query = useWells(false, true, 'all');
  assert.deepEqual(await query.queryFn(), members);
  assert.deepEqual(requests, [[false, filters, 'all']]);
  // The client cannot recreate members filtered out by the server's role/scope.
  members.splice(0, 2);
  assert.deepEqual(await query.queryFn(), []);
});

test('account edits preserve server funds even when the form has no scope fields', async () => {
  const { accountInputFromDraft } = await import('../src/lib/accountInput.ts');
  const existing = { scope: { funds: ['operational'], ngdus: null, departments: null } };
  const draft = { login: 'reader', name: 'Reader', role: 'viewer', active: false,
    revision: 0, ngduMode: 'all', departmentMode: 'all' };
  const input = accountInputFromDraft(draft, existing);
  assert.deepEqual(input.scope, { funds: ['operational'], ngdus: null, departments: null });
  assert.equal(input.active, false);
  assert.equal(input.revision, 0);
  assert.notEqual(input.scope.funds, existing.scope.funds);
  assert.equal('password' in input, false);
});

test('new accounts target the Connector selection and retain empty and zero-valued scope restrictions', async () => {
  const { accountInputFromDraft } = await import('../src/lib/accountInput.ts');
  const input = accountInputFromDraft({ login: 'reader', name: 'Reader', role: 'viewer',
    active: true, revision: 0, ngduMode: 'selected', departmentMode: 'selected',
    scope: { ngdus: [], departments: [0] } });
  assert.deepEqual(input.scope, { funds: ['presentation'], ngdus: [], departments: [0] });
});

test('reserved Connector catalog label is current while IDs and other names remain unchanged', async () => {
  const references = [{id:-900,name:'Показательный фонд'},{id:0,name:'НГДУ 0'},{id:7,name:'Северное НГДУ'}];
  const apiClient = axios.create({adapter:async config=>({data:references,status:200,statusText:'OK',headers:{},config})});
  const {ngduApi} = load('../src/api/wells.ts', {'./client':{apiClient}});
  const displayed = await ngduApi.list();
  assert.deepEqual(displayed,[{id:-900,name:'Pulse Connector'},references[1],references[2]]);
  assert.equal(references[0].name,'Показательный фонд');
});
