import type {MlDisplayWell, MlRun} from '../api/ml';
import type {Well} from '../api/types';
import type {TableQuery} from './tableQuery';
import {cohortStatusLabel} from './mlSnapshot.ts';

export const normalizeResponsible = (value: string | null | undefined): string | null => value?.trim() || null;
export const availableAlertRuns = (runs: MlRun[]): MlRun[] => runs.filter(run => run.status === 'done' && !!run.snapshot_id);
/** Смена контекста сохраняет условия, но сбрасывает пагинацию этого набора. */
export function selectAlertRun(params: URLSearchParams, runId: number | undefined): URLSearchParams {
  const next = new URLSearchParams(params);
  if (runId === undefined) next.delete('run_id'); else next.set('run_id', String(runId));
  try {
    const state = JSON.parse(next.get('table.alerts') ?? 'null');
    if (state?.query?.version === 1) next.set('table.alerts', JSON.stringify({...state, page: 1, cursors: [], revision: undefined}));
  } catch { next.delete('table.alerts'); }
  return next;
}
const processing: Record<string, string> = {new:'Новая', acknowledged:'В работе', confirmed:'Подтверждена', false_positive:'Ложная', inconclusive:'Нужны данные'};
export async function createAlertWorkbook(rows: readonly MlDisplayWell[], context: {runId?: number | null; query: TableQuery; exportedAt: string; asOf?: string | null; metadata: (row: MlDisplayWell) => Well | undefined}) {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  const data: (string | number | null)[][] = [['Расчёт','ID Pulse','Номер скважины','НГДУ','Цех','Оценка','Риск','Обработка','Основание','Конец окна','Ответственный']];
  rows.forEach(row => {
    const metadata = context.metadata(row);
    data.push([row.run_id ?? context.runId ?? null, row.app_well_id == null ? null : String(row.app_well_id), metadata?.well_number == null ? null : String(metadata.well_number), metadata?.ngdu ?? null, metadata?.department ?? null,
      cohortStatusLabel(row), row.risk,
      row.alert_id == null ? 'Нет записи обработки' : processing[row.alert_status ?? ''] ?? 'Статус не передан',
      row.rule_findings.join(' · ') || (row.risk === null ? row.reason_code ?? 'Нет оценки' : `${row.windows_fired ?? '—'} из ${row.windows_total ?? '—'} окон сработало`), row.window_end, normalizeResponsible(metadata?.responsible)]);
  });
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), 'Тревоги');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Параметр','Значение'], ['Расчёт',context.runId ?? 'Последний доступный'],
    ['Дата выгрузки (МСК)',new Date(context.exportedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})],
    ['Дата снимка',context.asOf ?? 'Не передана'], ['Строк',rows.length],
    ['Фильтры',JSON.stringify(context.query.filters)], ['Сортировка',JSON.stringify(context.query.sort)],
    ['Семантика','Оценка и metadata сохранённого снимка; alert_status — текущая обработка на момент загрузки. Ответственный — паспорт скважины.'],
    ['Риск','Доля от 0 до 1; пустое значение означает отсутствие оценки. Время окна передано с исходным часовым поясом.'],
  ]), 'Контекст');
  return book;
}
