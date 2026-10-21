import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

function workbook(rows, header = ['PULSE_ID', 'WELL_NUMBER', 'NGDU', 'ACTIVE']) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...rows]), 'wells');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
}

test('assessment export retains selected Pulse IDs and literal zero/false/leading-zero values', async () => {
  const { filterWellWorkbook } = await import('../src/lib/wellExport.ts');
  const source = workbook([[1001, '001', 0, false], [1002, '002', 7, true], [1003, null, -900, false]]);
  const output = filterWellWorkbook(source, [1003, 1001]);
  const decoded = XLSX.read(output, { type: 'array' });
  assert.deepEqual(XLSX.utils.sheet_to_json(decoded.Sheets.wells, { header: 1, defval: null }), [
    ['PULSE_ID', 'WELL_NUMBER', 'NGDU', 'ACTIVE'],
    [1001, '001', 0, false], [1003, null, -900, false],
  ]);
});

test('empty assessment selection exports headers only and never falls back to all wells', async () => {
  const { filterWellWorkbook } = await import('../src/lib/wellExport.ts');
  const output = filterWellWorkbook(workbook([[1001, '001', 0, false]]), []);
  const decoded = XLSX.read(output, { type: 'array' });
  assert.deepEqual(XLSX.utils.sheet_to_json(decoded.Sheets.wells, { header: 1 }), [
    ['PULSE_ID', 'WELL_NUMBER', 'NGDU', 'ACTIVE'],
  ]);
});

test('export cannot substitute an external ID when the Pulse identity column is absent', async () => {
  const { filterWellWorkbook } = await import('../src/lib/wellExport.ts');
  assert.throws(() => filterWellWorkbook(workbook([[1001]], ['UNITEK_ID']), [1001]), /PULSE_ID/);
});
