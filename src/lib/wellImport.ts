/** Импорт скважин из Excel: парсинг книги, авто-сопоставление колонок, валидация.

Восстановлен по контракту использования в WellImportModal (модуль не был
закоммичен в исходной ветке). Формат по умолчанию — колонки манифеста:
NGDU, WELL_NUMBER, ARMITS_ID, UNITEK_ID, CEX (цех). */
import * as XLSX from 'xlsx';
import type { WellCreate } from '@/api/types';

export type CanonicalKey = 'ngdu' | 'well_number' | 'armits_id' | 'unitek_id' | 'department';

export interface CanonicalField {
  key: CanonicalKey;
  label: string;
  required: boolean;
}

export const CANONICAL_FIELDS: CanonicalField[] = [
  { key: 'ngdu', label: 'НГДУ', required: true },
  { key: 'well_number', label: '№ скважины', required: false },
  { key: 'armits_id', label: 'ARMITS ID', required: true },
  { key: 'unitek_id', label: 'UNITEK ID', required: true },
  { key: 'department', label: 'Цех', required: true },
];

/** canonical key -> имя колонки файла (undefined = не сопоставлено). */
export type ColumnMapping = Partial<Record<CanonicalKey, string | undefined>>;

export interface ParsedSheet {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface PreviewRow {
  key: string;
  ngdu: string;
  well_number: string;
  armits_id: string;
  unitek_id: string;
  department: string;
  errors: string[];
}

/** Синонимы заголовков для авто-сопоставления (без регистра/пробелов). */
const SYNONYMS: Record<CanonicalKey, string[]> = {
  ngdu: ['ngdu', 'нгду'],
  well_number: ['well_number', 'wellnumber', 'скважина', 'номерскважины', 'well'],
  armits_id: ['armits_id', 'armitsid', 'армитс'],
  unitek_id: ['unitek_id', 'unitekid', 'юнитек'],
  department: ['cex', 'цех', 'department', 'cdng', 'цднг'],
};

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');

export function parseWorkbook(buf: ArrayBuffer): ParsedSheet {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
    defval: '',
  });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { columns, rows };
}

export function autoMap(columns: string[]): ColumnMapping {
  const m: ColumnMapping = {};
  for (const f of CANONICAL_FIELDS) {
    const hit = columns.find((c) =>
      SYNONYMS[f.key].some((syn) => norm(c) === syn || norm(c).includes(syn)),
    );
    if (hit) m[f.key] = hit;
  }
  return m;
}

const INT_FIELDS: CanonicalKey[] = ['ngdu', 'armits_id', 'unitek_id', 'department'];

/** true, если значение поля невалидно (для подсветки ячейки). */
export function fieldInvalid(field: CanonicalKey, value: string): boolean {
  const required = CANONICAL_FIELDS.find((f) => f.key === field)?.required ?? false;
  const v = value.trim();
  if (!v) return required;
  if (INT_FIELDS.includes(field)) return !/^\d+$/.test(v);
  return false;
}

/** Список полей с ошибками (метки для тега «нет: …»). */
export function validateRow(row: PreviewRow): string[] {
  return CANONICAL_FIELDS.filter((f) => fieldInvalid(f.key, row[f.key])).map((f) => f.label);
}

export function buildPreview(parsed: ParsedSheet, mapping: ColumnMapping): PreviewRow[] {
  return parsed.rows.map((raw, i) => {
    const pick = (key: CanonicalKey): string => {
      const col = mapping[key];
      if (!col) return '';
      const v = raw[col];
      return v == null ? '' : String(v).trim();
    };
    const row: PreviewRow = {
      key: `row-${i}`,
      ngdu: pick('ngdu'),
      well_number: pick('well_number'),
      armits_id: pick('armits_id'),
      unitek_id: pick('unitek_id'),
      department: pick('department'),
      errors: [],
    };
    row.errors = validateRow(row);
    return row;
  });
}

/** Только валидные строки -> payload для POST /wells/bulk. */
export function toPayload(rows: PreviewRow[]): WellCreate[] {
  return rows
    .filter((r) => r.errors.length === 0)
    .map((r) => ({
      ngdu: Number(r.ngdu),
      armits_id: Number(r.armits_id),
      unitek_id: Number(r.unitek_id),
      department: Number(r.department),
      ...(r.well_number ? { well_number: r.well_number } : {}),
    }));
}
