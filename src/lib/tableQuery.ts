/** Общая сериализуемая модель условий таблицы. undefined из read нормализуется в null. */
export type Scalar = string | number | boolean | null;
export type TableSort = {field: string; direction: 'asc' | 'desc'};
export type TableFilter = {field: string; op: 'contains'; value: string}
  | {field: string; op: 'in'; values: Scalar[]}
  | {field: string; op: 'range' | 'overlap'; from?: string | number; to?: string | number};
export interface TableQuery {version: 1; filters: TableFilter[]; sort: TableSort[]}
export interface FieldOption {label: string; value: Scalar}
export interface FieldSchema<T> {
  key: string; label: string; kind: 'text' | 'pulseId' | 'enum' | 'boolean' | 'number' | 'datetime' | 'date';
  read: (row: T) => Scalar | undefined; readEnd?: (row: T) => Scalar | undefined;
  loadOptions?: (search:string,cursor:string|undefined,signal:AbortSignal)=>Promise<{items:FieldOption[];next_cursor:string|null}>;
  options?: FieldOption[]; unit?: string; timezone?: string;
}
export interface TableSchema<T> {fields: FieldSchema<T>[]; defaultSort: TableSort[]; rowId: (row: T) => string}
export const createEmptyTableQuery = (): TableQuery => ({version: 1, filters: [], sort: []});
export const resetFilters = (query: TableQuery): TableQuery => ({...query, filters: []});
export const resetSort = (query: TableQuery): TableQuery => ({...query, sort: []});
export function cycleSort(query: TableQuery, field: string): TableQuery {
  const active = query.sort.find(sort => sort.field === field);
  return {...query, sort: !active ? [...query.sort, {field, direction: 'asc'}]
    : active.direction === 'asc' ? query.sort.map(sort => sort.field === field ? {...sort, direction: 'desc'} : sort)
    : query.sort.filter(sort => sort.field !== field)};
}
// Общая с SQL COLLATE C политика: Unicode codepoint, без locale/natural sort.
function ordinal(a: string, b: string): number {
  const left = Array.from(a), right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const diff = left[i].codePointAt(0)! - right[i].codePointAt(0)!;
    if (diff) return diff;
  }
  return left.length - right.length;
}
const foldText = (value: string) => value.replace(/[A-ZА-ЯЁӘӨҮҖҢҺ]/g, char => char.toLowerCase());
function validDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function comparable<T>(field: FieldSchema<T>, value: Scalar | undefined): string | number | bigint | null {
  if (value == null || (value === '' && field.kind !== 'text' && field.kind !== 'enum') || (typeof value === 'number' && !Number.isFinite(value))) return null;
  switch (field.kind) {
    case 'pulseId': {
      if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
      const id = String(value);
      return /^[1-9]\d*$/.test(id) && BigInt(id) <= 9223372036854775807n ? BigInt(id) : null;
    }
    case 'number': return typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+$/.test(value) ? BigInt(value) : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : null;
    case 'boolean': return typeof value === 'boolean' ? Number(value) : null;
    case 'datetime': {
      // Не присваиваем часовую зону наивным серверным меткам.
      if (typeof value !== 'string' || !validDate(value.slice(0, 10))) return null;
      if (field.timezone === 'unspecified') {
        const civil = /^(\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d)(?:\.(\d{1,9}))?$/.exec(value);
        return civil ? `${civil[1]}.${(civil[3] ?? '').padEnd(9, '0')}` : null;
      }
      const parts = /^(\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)(?:\.(\d{1,9}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.exec(value);
      if (!parts) return null;
      const time = Date.parse(`${parts[1]}${parts[3]}`);
      return Number.isFinite(time) ? BigInt(time) * 1000000n + BigInt((parts[2] ?? '').padEnd(9, '0')) : null;
    }
    case 'date': return typeof value === 'string' && validDate(value) ? value : null;
    default: return foldText(String(value));
  }
}
function compare(a: string | number | bigint, b: string | number | bigint): number {
  return typeof a === 'string' && typeof b === 'string' ? ordinal(a, b) : a < b ? -1 : a > b ? 1 : 0;
}
export function validateTableFilter<T>(field: FieldSchema<T>, filter: TableFilter): boolean {
  if (filter.op === 'contains') {
    if (field.kind !== 'pulseId' || !filter.value) return true;
    return /^[1-9]\d*$/.test(filter.value) && BigInt(filter.value) <= 9223372036854775807n;
  }
  if (filter.op === 'in') return true;
  if(field.kind==='datetime'&&[filter.from,filter.to].some(value=>{const fraction=typeof value==='string'?/\.(\d+)(?:Z|[+-]\d{2}:\d{2})?$/.exec(value)?.[1]:undefined;return fraction&&/[1-9]/.test(fraction.slice(6));}))return false;
  const from = filter.from === undefined ? undefined : comparable(field, filter.from);
  const to = filter.to === undefined ? undefined : comparable(field, filter.to);
  return from !== null && to !== null && (from === undefined || to === undefined || compare(from, to) <= 0);
}
export function applyTableQuery<T>(rows: readonly T[], schema: TableSchema<T>, query: TableQuery): T[] {
  const fields = new Map(schema.fields.map(field => [field.key, field]));
  const filtered = rows.filter(row => query.filters.every(filter => {
    const field = fields.get(filter.field);
    if (!field || !validateTableFilter(field, filter)) return false;
    const read = field.read(row) ?? null;
    const raw = field.kind === 'pulseId' && comparable(field, read) === null ? null : read;
    if (filter.op === 'contains') return raw !== null && foldText(String(raw ?? '')).includes(foldText(filter.value));
    if (filter.op === 'in') return filter.values.length === 0 || filter.values.some(value => value === raw);
    const value = comparable(field, raw);
    if (filter.from === undefined && filter.to === undefined) return true;
    if (value === null) return false;
    const from = filter.from === undefined ? null : comparable(field, filter.from);
    const to = filter.to === undefined ? null : comparable(field, filter.to);
    const end = filter.op === 'overlap' ? comparable(field, field.readEnd?.(row)) : value;
    return (from === null || (end !== null && compare(end, from) >= 0)) && (to === null || compare(value, to) <= 0);
  }));
  const sort = query.sort.length ? query.sort : schema.defaultSort;
  return filtered.sort((a, b) => {
    for (const key of sort) {
      const field = fields.get(key.field); if (!field) continue;
      const av = comparable(field, field.read(a)), bv = comparable(field, field.read(b));
      if (av === null && bv === null) continue;
      if (av === null) return 1; if (bv === null) return -1;
      const order = compare(av, bv); if (order) return key.direction === 'asc' ? order : -order;
    }
    const aId = schema.rowId(a), bId = schema.rowId(b);
    return /^\d+$/.test(aId) && /^\d+$/.test(bId) ? compare(BigInt(aId), BigInt(bId)) : ordinal(aId, bId);
  });
}
/** Числовой ввод превращается в точную десятичную строку, без float64 округления. */
export function parseTableNumberBound(value:string):string|undefined {
 if(!value)return undefined;
 const match=/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(value);
 if(!match||value.length>120)throw new Error('Некорректная граница');
 const whole=match[2]??'0',fraction=match[3]??match[4]??'',exponent=Number(match[5]??0);
 if(!Number.isInteger(exponent)||Math.abs(exponent)>120)throw new Error('Некорректная граница');
 const digits=whole+fraction,point=whole.length+exponent;
 const integer=(point<=0?'0':digits.slice(0,point).padEnd(point,'0')).replace(/^0+(?=\d)/,'');
 const decimal=(point<0?'0'.repeat(-point)+digits:digits.slice(point)).replace(/0+$/,'');
 const result=integer+(decimal?'.'+decimal:'');
 if(result.length>120)throw new Error('Слишком длинная граница');
 return match[1]==='-'&&/[1-9]/.test(result)?'-'+result:result;
}
