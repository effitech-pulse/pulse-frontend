import {loadDependency} from './load-dependency.mjs';
import {legacyAuth} from './auth-fixture.mjs';
import * as authorization from '../src/auth/authorization.ts';
import * as fileJobs from '../src/lib/fileJobs.ts';
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
const antd = require('antd');
const { createMemoryRouter, RouterProvider } = require('react-router-dom');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const snapshot = await import('../src/lib/mlSnapshot.ts');
const displayTime = await import('../src/lib/displayTime.ts');
function load(relative, boundaries = {}, transform = source => source) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const js = ts.transpileModule(transform(readFileSync(filename, 'utf8')), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => id==='@/auth/authorization'?authorization:id==='@/auth/AuthProvider'&&!Object.hasOwn(boundaries,id)?{useAuth:()=>legacyAuth()}:Object.hasOwn(boundaries, id) ? boundaries[id] : loadDependency(id,filename,boundaries);
  mod._compile(js, filename); return mod.exports;
}
const { toApiError } = load('../src/api/client.ts', {}, s => s.replaceAll('import.meta.env', '({})'));
const { PageSpin } = load('../src/components/common/PageSpin.tsx', { '@/api/client': { toApiError } });
const validId = 'Request_0123456789';
function httpError(headers, data = { code: 'forbidden', message: 'Нет доступа', request_id: 'business-stable', http_request_id: 'UntrustedBody_123456' }) {
  return { isAxiosError: true, message: 'Request failed', response: { status: 403, headers, data } };
}

test('axios error preserves response data and uses only a validated response header as HTTP attempt ID', () => {
  const error = httpError({ 'x-request-id': validId });
  const result = toApiError(error);
  assert.equal(result.http_request_id, validId);
  assert.equal(result.request_id, 'business-stable');
  assert.equal(error.response.data.http_request_id, 'UntrustedBody_123456');
  assert.notEqual(result, error.response.data, 'normalisation must not mutate the cached response');
  for (const header of ['X-Request-ID', 'x-request-id']) assert.equal(toApiError(httpError({ [header]: validId })).http_request_id, validId);
});
test('invalid, combined, duplicate, oversized or missing IDs and network errors do not invent correlation', () => {
  for (const value of [undefined, '', 'short', 'a'.repeat(65), 'a'.repeat(16) + '\n', 'a'.repeat(16) + '\r\nInjected', 'a'.repeat(16) + ', ' + 'b'.repeat(16), ['a'.repeat(16)], 123]) {
    assert.equal(toApiError(httpError({ 'x-request-id': value })).http_request_id, undefined, String(value));
  }
  assert.equal(toApiError(httpError({ 'x-request-id': validId, 'X-Request-ID': 'Another_0123456789' })).http_request_id, undefined);
  assert.equal(toApiError({ isAxiosError: true, message: 'Network Error' }).http_request_id, undefined);
  for (const length of [16, 64]) assert.equal(toApiError(httpError({ 'x-request-id': 'a'.repeat(length) })).http_request_id, 'a'.repeat(length));
  assert.equal(toApiError(httpError({ 'x-request-id': validId }, { detail: 'Сервис недоступен' })).http_request_id, validId);
  assert.equal(toApiError(httpError(new (require('axios').AxiosHeaders)({ 'X-Request-ID': validId }))).http_request_id, validId);
});
test('real PageSpin separates message from support ID and omits invalid/absent IDs', () => {
  const render = error => renderToStaticMarkup(React.createElement(PageSpin, { loading: false, error }, 'content'));
  const html = render(httpError({ 'x-request-id': validId }));
  assert.match(html, /Нет доступа/); assert.match(html, /Код обращения:/); assert.ok(html.includes(validId));
  assert.doesNotMatch(html, /business-stable|UntrustedBody/);
  assert.doesNotMatch(render(httpError({})), /Код обращения:/);
});

const defaultWell = { id: 42, well_number: '1042', ngdu: 7, department: 3, active: true, responsible: 'Не назначен', revision: 8 };
const defaultOutcome = { app_well_id: 42, status: 'scored', reason_code: 'evaluated', run_id: 17, snapshot_id: 'snapshot17', as_of: '2026-10-19', result: { verdict: 'watch', latest_risk: .12, n_windows: 2, windows_above_watch: 1, timeline: [], contributions: [{ feature: 'f0', value: 0, shap: 0, value_source: 'computed' }], peak_window_end: '2026-10-10' } };
function setup(url = '/wells/42', { well = defaultWell, outcome = defaultOutcome, error = null } = {}) {
  let tabs;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['well', 42, 'classification'], { classification: 'Классификация из паспорта' });
  const run = Number(new URL(url, 'http://test').searchParams.get('run_id')) || undefined;
  client.setQueryData(['well-risk', 42, run], outcome);
  let router;
  const unexpected = () => { throw Error('Unexpected API/ML recompute'); };
  const { WellDetailPage } = load('../src/pages/WellDetailPage.tsx', {
    '@/lib/fileJobs':fileJobs,
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => router.navigate },
    antd: { ...antd, Tabs: props => { if(props?.items) tabs = props; return React.createElement(antd.Tabs, props); } },
    '@/hooks/useWells': { useWell: () => ({ data: well, isLoading: false, error }), useDepartments: () => ({ data: [{ id: 3, name: 'Цех 3' }] }), useWellComplications: () => ({ data: [{ id: 1, code: 'C1', name: 'Осложнение из паспорта', category: 'Категория' }], isLoading: false }) },
    '@/lib/displayTime': displayTime,
    '@/api/wells': { wellsApi: { classification: unexpected } },
    '@/api/ml': { mlApi: { byAppWell: unexpected, appHistory: unexpected } },
    '@/lib/mlSnapshot': snapshot,
    '@/components/common/PageSpin': { PageSpin },
    '@/components/common/StatusTag': { StatusTag: () => React.createElement('span', null, 'Статус установки') },
    '@/components/ml/RiskHistoryChart': { RiskHistoryChart: () => React.createElement('span', null, 'Сохранённый график') },
    '@/components/ml/ExplainBars': { ExplainBars: props => React.createElement('span', null, `SHAP ${props.windowKind} ${props.windowEnd} ${props.contributions[0]?.value}`) },
    '@/components/wells/IncidentsTab': { IncidentsTab: () => React.createElement('span', null, 'Существующие отказы') },
    '@/components/wells/WellHistoryPanel': { WellHistoryPanel: () => React.createElement('span', null, 'Существующая история') },
    '@/components/telemetry/ManualChecks': { ManualChecks: () => React.createElement('span', null, 'Сохранённые проверки') },
    '@/components/telemetry/TelemetryWorkspace': { TelemetryWorkspace: () => React.createElement('span', null, 'Существующая телеметрия') },
    '@/auth/AuthProvider': { useAuth: () => legacyAuth() },
  });
  router = createMemoryRouter([{ path: '/wells/:wellId', element: React.createElement(WellDetailPage) }], { initialEntries: [url] });
  const render = () => renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(RouterProvider, { router })));
  const html = render();
  return { html, router, render, get tabs() { return tabs; } };
}
test('real well card exposes the seven approved tabs and legacy/default/unknown routes select Risks', () => {
  for (const key of [undefined, 'overview', 'unknown', 'constructor', 'telemetry', 'checks', 'failures', 'history', 'equipment', 'details']) {
    const view = setup(`/wells/42${key ? '?tab=' + key : ''}`);
    assert.ok(view.tabs,`Tabs must render for ${key}: ${view.html.slice(0,300)}`);
    assert.deepEqual(view.tabs.items.map(t => [t.key, t.label]), [['overview', 'Риски'], ['telemetry', 'Телеметрия'], ['checks', 'Проверки'], ['failures', 'Отказы'], ['history', 'История'], ['equipment', 'Оборудование'], ['details', 'Сведения']]);
    assert.equal(view.tabs.activeKey, ['telemetry', 'checks', 'failures', 'history', 'equipment', 'details'].includes(key) ? key : 'overview');
    assert.equal(view.tabs.destroyInactiveTabPane, false, 'visited forms retain their state');
  }
});
test('tab navigation pushes history and preserves immutable run/check/all query values and hash', async () => {
  const view = setup('/wells/42?tab=checks&run_id=17&check=saved17&extra=one&extra=two#evidence');
  view.tabs.onChange('details');
  assert.equal(view.router.state.historyAction, 'PUSH');
  const next = view.router.state.location;
  assert.equal(next.hash, '#evidence');
  assert.deepEqual([...new URLSearchParams(next.search)], [['tab', 'details'], ['run_id', '17'], ['check', 'saved17'], ['extra', 'one'], ['extra', 'two']]);
  await view.router.navigate(-1);
  assert.equal(view.router.state.location.search, '?tab=checks&run_id=17&check=saved17&extra=one&extra=two');
  await view.router.navigate(1); assert.equal(new URLSearchParams(view.router.state.location.search).get('tab'), 'details');
});
test('passport classification and complications move to Details while identity and persisted risk remain visible', () => {
  const risks = setup('/wells/42?run_id=17').html;
  assert.match(risks, /ID Pulse 42/); assert.match(risks, /1042/); assert.match(risks, /12\.0/);
  assert.match(risks, /Сохранённый расчёт № 17/); assert.match(risks, /SHAP peak 2026-10-10 0/);
  assert.doesNotMatch(risks, /Классификация из паспорта|Осложнение из паспорта|Версия карточки/);
  const details = setup('/wells/42?tab=details&run_id=17').html;
  for (const field of ['Паспорт скважины', 'ID Pulse', '№ скважины', 'НГДУ', 'Цех', 'Активна', 'Ответственный', 'Версия карточки', 'Классификация осложнений', 'Классификация из паспорта', 'Осложнение из паспорта']) assert.ok(details.includes(field), field);
  assert.doesNotMatch(details, /12\.0|SHAP peak/);
});
test('archived/inactive/insufficient/error/empty results never become a synthetic zero risk or SHAP', () => {
  for (const [status, label] of [['archived', 'В архиве · без оценки'], ['inactive', 'Неактивна · без оценки'], ['insufficient', 'Недостаточно данных · без оценки'], ['error', 'Ошибка расчёта']]) {
    const { html } = setup('/wells/42?run_id=17', { outcome: { ...defaultOutcome, status, result: null } });
    assert.ok(html.includes(label), status); assert.doesNotMatch(html, /0\.0%|SHAP peak|Сохранённый график/);
  }
  const archived = setup('/wells/42', { well: { ...defaultWell, archived_at: '2026-10-19T00:00:00Z' }, outcome: null }).html;
  assert.match(archived, /Скважина в архиве/); assert.match(archived, /Сохранённой оценки риска нет/);
});
