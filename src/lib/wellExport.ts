import * as XLSX from 'xlsx';

/** Ограничивает серверный Excel строками текущей оценки, сохраняя ID Pulse. */
export function filterWellWorkbook(bytes: ArrayBuffer, visibleIDs: readonly (number|string)[]): ArrayBuffer {
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
  const normalize=(raw:unknown):string|null=>{
    if(typeof raw==='number'&&(!Number.isSafeInteger(raw)||raw<=0))return null;
    const id=String(raw);return /^[1-9]\d*$/.test(id)&&BigInt(id)<=9223372036854775807n?id:null;
  };
  const byId=new Map(rows.slice(1).flatMap(row=>{const id=normalize(row[identity]);return id?[[id,row] as const]:[];}));
  const selected=visibleIDs.flatMap(value=>{const id=normalize(value);const row=id?byId.get(id):undefined;return row?[row]:[];});
  workbook.Sheets.wells = XLSX.utils.aoa_to_sheet([header, ...selected]);
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}
