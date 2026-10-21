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
function chartOptions(dark) {
  let options;
  const filename = fileURLToPath(new URL('../src/components/ml/RiskHistoryChart.tsx', import.meta.url));
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const boundaries = { '@ant-design/charts': { Line: props => { options = props; return null; } }, '@/theme/ThemeProvider': { useTheme: () => ({ dark }) } };
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => Object.hasOwn(boundaries, id) ? boundaries[id] : require(id); mod._compile(code, filename);
  const data = [{ date: '01.10', risk: 0 }, { date: '02.10', risk: null }, { date: '03.10', risk: .092 }, { date: '04.10', risk: 1 }];
  renderToStaticMarkup(React.createElement(mod.exports.RiskHistoryChart, { data }));
  return { options, data };
}
for (const dark of [false, true]) test(`risk axes show full percent range and sparse dates in ${dark ? 'dark' : 'light'} theme`, () => {
  const { options, data } = chartOptions(dark);
  assert.equal(options.data, data, 'chart must receive actual zero/null/score points unchanged');
  assert.deepEqual(options.scale.y.domain, [0, 1]);
  assert.equal(options.scale.y.nice, false);
  assert.equal(options.axis.y.labelFormatter(0), '0%');
  assert.equal(options.axis.y.labelFormatter(.25), '25%');
  assert.equal(options.axis.y.labelFormatter(1), '100%');
  assert.equal(options.axis.x.tickCount, 4);
  assert.equal(options.axis.x.labelAutoRotate, false);
  const dates = Array.from({length:60}, (_, i) => i);
  assert.deepEqual(dates.filter(options.axis.x.tickFilter), [0,20,39,59]);
  assert.deepEqual(options.connectNulls, { connect: false });
  assert.equal(options.height, 240);
});
