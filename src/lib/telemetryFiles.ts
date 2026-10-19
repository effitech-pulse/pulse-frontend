import type { Measurement } from '../api/integrations';
import { downloadBlob } from './download.ts';

export async function readTelemetryFile(file: File, encoding = 'utf-8', separator = ','): Promise<Record<string, unknown>[]> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Файл больше 20 МБ');
  const buffer = await file.arrayBuffer(); let rows: Record<string, unknown>[];
  if (/\.parquet$/i.test(file.name)) {
    const { parquetReadObjects, parquetMetadataAsync } = await import('hyparquet');
    const { compressors } = await import('hyparquet-compressors');
    const meta = await parquetMetadataAsync(buffer);
    if (meta.num_rows > 100000n) throw new Error('Для просмотра допускается до 100 000 строк');
    rows = await parquetReadObjects({ file: buffer, compressors });
  } else if (/\.(csv|xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import('xlsx');
    const book = /\.csv$/i.test(file.name) ? XLSX.read(new TextDecoder(encoding).decode(buffer), { type: 'string', raw: true, FS: separator }) : XLSX.read(buffer, { type: 'array', cellDates: true });
    rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: null });
  } else throw new Error('Поддерживаются Excel, CSV и Parquet');
  if (!rows.length || rows.length > 100000) throw new Error('Нужен непустой файл не более 100 000 строк');
  return rows;
}

export async function exportTelemetry(points: Measurement[], keys: string[], format: 'csv' | 'xlsx' | 'parquet', periods?: string[]) {
  const rows = points.map((p, i) => ({ well_id: p.well_id, timestamp: p.timestamp, ...(periods ? { period: periods[i] } : {}), ...Object.fromEntries(keys.map(k => [k, p.values[k] ?? null])), quality: p.quality ?? '' }));
  if (!rows.length) throw new Error('В выбранном периоде нет данных');
  const name = `telemetry_${new Date().toISOString().slice(0, 10)}.${format}`;
  if (format === 'parquet') {
    const { parquetWriteBuffer } = await import('hyparquet-writer');
    const columnData = Object.keys(rows[0]).map(key => ({ name: key, type: (keys.includes(key) ? 'DOUBLE' : 'STRING') as 'DOUBLE' | 'STRING', data: rows.map(r => (r as Record<string, unknown>)[key]) }));
    downloadBlob(new Blob([parquetWriteBuffer({ columnData })]), name);
  } else {
    const XLSX = await import('xlsx');
    // Строковые идентификаторы не превращаются в формулы при открытии CSV.
    const safe = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^[=+@-]/.test(v) ? `'${v}` : v])));
    const sheet = XLSX.utils.json_to_sheet(safe);
    if (format === 'csv') downloadBlob(new Blob(['\uFEFF', XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8' }), name);
    else { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Телеметрия'); downloadBlob(new Blob([XLSX.write(book, { type: 'array', bookType: 'xlsx' })]), name); }
  }
}
