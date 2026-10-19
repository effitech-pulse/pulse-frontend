import type { Mapping, Measurement } from '../api/integrations';

export const channels = [
  { key: 'F_out', label: 'Частота', unit: 'Гц', group: 'Электрика' },
  { key: 'Ia', label: 'Ток фазы A', unit: 'А', group: 'Электрика' },
  { key: 'Ib', label: 'Ток фазы B', unit: 'А', group: 'Электрика' },
  { key: 'Ic', label: 'Ток фазы C', unit: 'А', group: 'Электрика' },
  { key: 'Ped_load', label: 'Загрузка ПЭД', unit: '%', group: 'Электрика' },
  { key: 'CosF', label: 'cos φ', unit: '', group: 'Электрика' },
  { key: 'R_izol', label: 'Сопротивление изоляции', unit: 'МОм', group: 'Электрика' },
  { key: 'Pump_intake_pressure_kgs', label: 'Давление на приёме', unit: 'кгс/см²', group: 'Давления' },
  { key: 'Annulus_pressure', label: 'Затрубное давление', unit: 'кгс/см²', group: 'Давления' },
  { key: 'Motor_winding_temperature', label: 'Температура обмотки ПЭД', unit: '°C', group: 'Температуры' },
  ...['X', 'Y', 'Z'].map(axis => ({ key: `Vibration_${axis}`, label: `Вибрация ${axis}`, unit: 'ед. источника', group: 'Вибрации' })),
  { key: 'Flowrate for current day', label: 'Суточный дебит', unit: 'м³/сут', group: 'Дебит' },
];
export const defaultMappings: Mapping[] = ['F_out', 'Ia', 'Ib', 'Ic', 'Motor_winding_temperature', 'Pump_intake_pressure_kgs', 'R_izol'].map(parameter => ({ field: `values.${parameter}`, parameter, unit: channels.find(c => c.key === parameter)?.unit ?? '', scale: 1, offset: 0, missing: parameter === 'R_izol' ? '9999' : '', is_set: false }));

/** Путь без выполнения выражений; собственные ключи защищают от prototype traversal. */
export function atPath(value: unknown, path: string): unknown {
  return path.split('.').filter(Boolean).reduce<unknown>((v, key) => v !== null && typeof v === 'object' && Object.hasOwn(v, key) ? (v as Record<string, unknown>)[key] : undefined, value);
}
export function cleanNumber(value: unknown, parameter: string, missing = ''): number | null {
  if (value == null || (typeof value === 'string' && value.trim() === '') || typeof value === 'boolean') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  if (!Number.isFinite(n)) return null;
  const markers = missing.split(/[;,\s]+/).filter(Boolean).map(Number);
  if ((parameter === 'R_izol' && Math.abs(n - 9999) <= 1e-6) || (parameter.startsWith('energy_Input_energy_reactive_total_') && [9999, 999.9].some(m => Math.abs(n - m) <= 1e-6)) || markers.some(m => Math.abs(n - m) <= 1e-6)) return null;
  return n;
}
export function mapRecords(records: unknown[], mappings: Mapping[], wellField: string, timeField: string, timezone = '+03:00') {
  const points: Measurement[] = []; const errors: string[] = [];
  records.forEach((record, index) => {
    const well = atPath(record, wellField), rawTime = atPath(record, timeField);
    let ts = rawTime instanceof Date ? rawTime.toISOString() : String(rawTime ?? '').trim();
    if (ts && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(ts)) ts = ts.replace(' ', 'T') + timezone;
    const date = new Date(ts);
    if ((typeof well !== 'string' && typeof well !== 'number' && typeof well !== 'bigint') || (typeof well === 'number' && !Number.isSafeInteger(well)) || String(well).trim() === '' || !Number.isFinite(date.getTime())) { errors.push(`Строка ${index + 1}: нужен точный ID скважины (большие ID — текстом) и корректное время`); return; }
    const values: Measurement['values'] = {};
    for (const m of mappings.filter(m => !m.is_set)) {
      if (!m.parameter || Object.hasOwn(values, m.parameter) || !Number.isFinite(m.scale) || !Number.isFinite(m.offset)) { errors.push(`Строка ${index + 1}: некорректное сопоставление`); return; }
      const n = cleanNumber(atPath(record, m.field), m.parameter, m.missing);
      values[m.parameter] = n === null ? null : n * m.scale + m.offset;
    }
    if (!Object.keys(values).length) { errors.push(`Строка ${index + 1}: нет измеряемых параметров`); return; }
    points.push({ well_id: String(well), timestamp: date.toISOString(), values });
  });
  return { points: points.sort((a, b) => a.timestamp.localeCompare(b.timestamp)), errors };
}
export function normalizedValue(value: number | null, base: number | null): number | null {
  return value === null || base === null || base === 0 ? null : (value - base) / Math.abs(base) * 100;
}
/** Общая временная область не растягивает короткий период до длины длинного. */
export function alignComparison(a: Measurement[], b: Measurement[], mode: string, periods?: [[string, string], [string, string]]): [Measurement[], Measurement[]] {
  if (!a.length || !b.length) return [a, b];
  const ranges = periods ?? [[a[0].timestamp, a[a.length - 1].timestamp], [b[0].timestamp, b[b.length - 1].timestamp]];
  const span = Math.max(...ranges.map(([start, end]) => Date.parse(end) - Date.parse(start)));
  const pad = (ps: Measurement[], index: number) => {
    const first = mode === 'calendar' ? ranges.map(r => r[0]).sort()[0] : ranges[index][0];
    const last = mode === 'calendar' ? ranges.map(r => r[1]).sort().at(-1)! : new Date(Date.parse(first) + span).toISOString();
    return [...(ps[0].timestamp > first ? [{ well_id: ps[0].well_id, timestamp: first, values: {} }] : []), ...ps, ...(ps[ps.length - 1].timestamp < last ? [{ well_id: ps[0].well_id, timestamp: last, values: {} }] : [])];
  };
  return [pad(a, 0), pad(b, 1)];
}
/** При повторном импорте значения не перезаписываются молча. */
export function mergeMeasurements(current: Measurement[], incoming: Measurement[]) {
  const byKey = new Map(current.map(p => [`${p.well_id}\0${p.timestamp}`, p])); let conflicts = 0;
  for (const p of incoming) { const key = `${p.well_id}\0${p.timestamp}`; if (byKey.has(key)) conflicts++; else byKey.set(key, p); }
  return { points: [...byKey.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)), conflicts };
}
