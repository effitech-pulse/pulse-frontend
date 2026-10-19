import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTelemetry, readTelemetryFile } from '../src/lib/telemetryFiles.ts';

test('CSV, Excel и Parquet проходят экспорт и обратное чтение с нулями и пропусками', async () => {
  const points = [
    { well_id: '9223372036854775807', timestamp: '2025-01-01T00:00:00.000Z', values: { F_out: 0, R_izol: null } },
    { well_id: '9223372036854775807', timestamp: '2025-01-01T01:00:00.000Z', values: { F_out: 50, R_izol: 400 } },
  ];
  let blob;
  const original = URL.createObjectURL;
  URL.createObjectURL = b => { blob = b; return 'blob:test'; };
  globalThis.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  try {
    for (const format of ['csv', 'xlsx', 'parquet']) {
      await exportTelemetry(points, ['F_out', 'R_izol'], format);
      const rows = await readTelemetryFile(new File([blob], `test.${format}`));
      assert.equal(rows.length, 2, format);
      assert.equal(String(rows[0].well_id), points[0].well_id, format);
      assert.equal(Number(rows[0].F_out), 0, format);
      assert.ok(rows[0].R_izol == null || rows[0].R_izol === '', format);
      assert.equal(Number(rows[1].F_out), 50, format);
    }
  } finally { URL.createObjectURL = original; delete globalThis.document; }
});
