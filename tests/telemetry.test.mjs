import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanNumber, mapRecords, normalizedValue, mergeMeasurements, alignComparison } from '../src/lib/telemetry.ts';

test('маркеры очищаются по параметру; нули и 9999 в других каналах сохранены', () => {
  assert.equal(cleanNumber(0, 'F_out'), 0);
  assert.equal(cleanNumber(9999, 'R_izol'), null);
  assert.equal(cleanNumber(9999, 'Ia'), 9999);
  assert.equal(cleanNumber('  ', 'Ia'), null);
  assert.equal(cleanNumber(false, 'Ia'), null);
  assert.equal(cleanNumber('1,5', 'Ia'), 1.5);
});
test('преобразование после очистки; уставки исключены; идентификатор 0 допустим', () => {
  const rows = [{ well_id: 0, timestamp: '2026-10-15 10:00:00', insulation: 9999, f: 0, set: 7 }];
  const m = (field, parameter, extra = {}) => ({ field, parameter, unit: '', scale: 2, offset: 1, missing: '', is_set: false, ...extra });
  const r = mapRecords(rows, [m('insulation', 'R_izol'), m('f', 'F_out'), m('set', 'Annulus_pressure', { is_set: true })], 'well_id', 'timestamp');
  assert.equal(r.points[0].timestamp, '2026-10-15T07:00:00.000Z');
  assert.deepEqual(r.points[0].values, { R_izol: null, F_out: 1 });
  assert.equal(r.errors.length, 0);
});
test('повторный параметр, отсутствие скважины или времени отклоняются', () => {
  assert.equal(mapRecords([{}], [], 'well_id', 'timestamp').errors.length, 1);
  assert.equal(mapRecords([{well_id: 'a', timestamp: 'garbage'}], [], 'well_id', 'timestamp').points.length, 0);
});
test('относительное изменение не определено при нулевой базе', () => {
  assert.equal(normalizedValue(1, 0), null);
  assert.equal(normalizedValue(120, 100), 20);
  assert.equal(normalizedValue(null, 100), null);
});
test('импорт не перезаписывает совпадения молча', () => {
  const p = { well_id: 'a', timestamp: '2026-10-15T00:00:00Z', values: { F_out: 0 } };
  const result = mergeMeasurements([p], [{ ...p, values: { F_out: 50 } }]);
  assert.equal(result.conflicts, 1); assert.equal(result.points[0].values.F_out, 0);
});
test('сравнение не растягивает короткий период и не меняет время измерений', () => {
  const p = h => ({well_id:'a',timestamp:new Date(h*3600000).toISOString(),values:{Ia:30}});
  const a=[p(0),p(24)],b=[p(48),p(96)];
  const [x,y]=alignComparison(a,b,'elapsed');
  assert.equal(Date.parse(x.at(-1).timestamp)-Date.parse(x[0].timestamp),48*3600000);
  assert.equal(Date.parse(y.at(-1).timestamp)-Date.parse(y[0].timestamp),48*3600000);
  assert.equal(x[1].timestamp,a[1].timestamp);
  assert.deepEqual(x.at(-1).values,{});
  const [calendarA,calendarB]=alignComparison(a,b,'calendar');
  assert.equal(calendarA[0].timestamp,calendarB[0].timestamp);
  assert.equal(calendarA.at(-1).timestamp,calendarB.at(-1).timestamp);
});
