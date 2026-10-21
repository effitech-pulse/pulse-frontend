import * as XLSX from 'xlsx';

/** Ограничивает серверный Excel строками текущей оценки, сохраняя ID Pulse. */
export function filterWellWorkbook(bytes: ArrayBuffer, visibleIDs: readonly number[]): ArrayBuffer {
  const workbook = XLSX.read(bytes, { type: 'array' });
  if (workbook.SheetNames.length !== 1 || workbook.SheetNames[0] !== 'wells') {
    throw new Error('В выгрузке отсутствует единственный лист реестра wells');
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.wells, { header: 1, defval: null });
  const header = rows[0] ?? [];
  const identity = header.indexOf('PULSE_ID');
  if (identity < 0 || header.lastIndexOf('PULSE_ID') !== identity) {
    throw new Error('В выгрузке отсутствует однозначная колонка PULSE_ID');
  }
  const allowed = new Set(visibleIDs);
  const selected = rows.slice(1).filter(row => {
    const raw = row[identity];
    const id = typeof raw === 'number' ? raw : typeof raw === 'string' && /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
    return Number.isSafeInteger(id) && id > 0 && allowed.has(id);
  });
  workbook.Sheets.wells = XLSX.utils.aoa_to_sheet([header, ...selected]);
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}
