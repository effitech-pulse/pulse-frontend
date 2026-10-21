import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSnapshotTime } from '../src/lib/displayTime.ts';
test('snapshot UI converts explicit UTC to Moscow without changing raw input', () => {
  const raw = '2026-10-20T21:37:37.074131297Z';
  assert.equal(formatSnapshotTime(raw), '21.10.2026 00:37 МСК');
  assert.equal(raw, '2026-10-20T21:37:37.074131297Z');
  assert.equal(formatSnapshotTime('2026-10-21T00:37:37+03:00'), '21.10.2026 00:37 МСК');
});
test('date-only, missing, invalid and unzoned time are not given invented instants', () => {
  assert.equal(formatSnapshotTime('2026-10-20'), '20.10.2026');
  assert.equal(formatSnapshotTime('2026-10-20T21:37:37'), '20.10.2026 21:37');
  assert.equal(formatSnapshotTime('2026-10-21T00:37:37.073115'), '21.10.2026 00:37');
  assert.equal(formatSnapshotTime('2026-99-99T21:37:37'), '2026-99-99T21:37:37');
  assert.equal(formatSnapshotTime('not-a-dateZ'), 'not-a-dateZ');
  assert.equal(formatSnapshotTime(null), '—');
});
