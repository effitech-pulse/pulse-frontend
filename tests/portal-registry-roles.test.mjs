import {loadDependency} from './load-dependency.mjs';
import {legacyAuth} from './auth-fixture.mjs';
import * as authorization from '../src/auth/authorization.ts';
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
const { MemoryRouter } = require('react-router-dom');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const { App } = require('antd');
function renderRegistry(role, management = false, registryError = null, assessment = 'all') {
  const filename = fileURLToPath(new URL('../src/pages/WellsPage.tsx', import.meta.url));
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const boundaries = {
    '@/auth/AuthProvider': { useAuth: () => legacyAuth(role) },
    '@/lib/wellExport': { filterWellWorkbook: () => { throw Error('Unexpected export'); } },
    '@/api/wells': { wellsApi: {} },
    '@/api/client': { toApiError: error => error },
    '@/api/ml': { mlApi: { wells: () => { throw Error('Unexpected API call'); } } },
    '@/lib/mlSnapshot': { mlRows: () => [], cohortStatusLabel: () => 'Без оценки' },
    '@/hooks/useWells': { useWells: () => ({ data: registryError ? undefined : [], isLoading: false, error: registryError }), useDepartments: () => ({ data: [] }), useNgdus: () => ({ data: [] }), useUpdateWell: () => ({ isPending: false }) },
    '@/theme/FundFilters': { useFundFilters: () => ({ filters: { search: '', sort: 'id_asc' } }) },
    '@/components/common/PageSpin': { PageSpin: ({ children }) => children },
    '@/components/wells/WellImportModal': { WellImportModal: () => null },
    '@/components/wells/AddWellModal': { AddWellModal: () => null },
  };
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => id==='@/auth/authorization'?authorization:id==='@/auth/AuthProvider'&&!Object.hasOwn(boundaries,id)?{useAuth:()=>legacyAuth()}:Object.hasOwn(boundaries, id) ? boundaries[id] : loadDependency(id,filename,boundaries);
  mod._compile(code, filename);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['ml-wells'], {});
  return renderToStaticMarkup(React.createElement(App, null, React.createElement(QueryClientProvider, { client }, React.createElement(MemoryRouter, null, React.createElement(mod.exports.WellsPage, { management, assessment })))));
}
for (const role of ['viewer', 'technologist', 'admin']) {
  test(`${role} retains archive, activity selection and export in monitoring`, () => {
    const html = renderRegistry(role);
    assert.match(html, /Фильтр: Архив/);
    assert.match(html, /Архив/);
    assert.match(html, /Экспорт в Excel/);
    assert.match(html, /Фильтры: Активность, Полнота окна/);
    assert.doesNotMatch(html, /Импорт из Excel|>Добавить</);
  });
}
test('admin management preserves create and import alongside read actions', () => {
  const html = renderRegistry('admin', true);
  assert.match(html, /Экспорт в Excel/);
  assert.match(html, /Импорт из Excel/);
  assert.match(html, />Добавить</);
});

test('assessment export remains disabled when the registry request failed after ML succeeded', () => {
  const html = renderRegistry('viewer', false, new Error('Registry unavailable'), 'alert');
  const label = html.indexOf('Экспорт в Excel');
  const start = html.lastIndexOf('<button', label);
  assert.ok(label > start && start >= 0);
  assert.match(html.slice(start, html.indexOf('>', start)), /disabled/);
});
