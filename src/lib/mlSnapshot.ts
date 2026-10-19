import type { CohortOutcome, MlDisplayWell, MlHistoryResponse, MlHistoryView, MlRiskResponse, MlWellsResponse } from '../api/ml';
import type { Well } from '../api/types';
import type { FundFilters } from './fundFilters';

export function mlOutcomeRow(outcome: CohortOutcome): MlDisplayWell {
  // A diagnostic result never becomes a prediction merely because its risk defaults to zero.
  const result = outcome.status === 'scored' && outcome.result?.verdict !== 'insufficient' ? outcome.result : null;
  return {
    well_id: null, app_well_id: outcome.app_well_id, unitek_id: outcome.metadata?.unitek_id ?? null,
    alert_id: outcome.alert_id ?? null, alert_status: outcome.alert_status ?? null, oilfield: outcome.metadata ? String(outcome.metadata.ngdu) : null,
    risk: result?.latest_risk ?? null, alert: result ? result.verdict === 'alert' : null,
    tier: result?.verdict === 'alert' ? 'alert' : result?.verdict === 'watch' ? 'watch' : null,
    windows_fired: result?.windows_above_watch ?? null, windows_total: result?.n_windows ?? null,
    // Upload does not report last-window data_ok. Unknown quality stays unknown.
    data_ok: null, rule_findings: [], window_end: result?.timeline?.at(-1)?.window_end ?? null,
    true_failure_type: null, true_failure_type_name: null, true_failure_at: null,
    status: outcome.status, reason_code: outcome.reason_code, contributions: result?.contributions ?? [],
    metadata: outcome.metadata, run_id: outcome.run_id, snapshot_id: outcome.snapshot_id,
    as_of: outcome.as_of, model_name: result?.model_name,
    provenance_status: result?.provenance?.provenance_status ?? 'historical_unknown',
    explanation_window_kind: result?.peak_window_end ? 'peak' : 'unknown',
    explanation_window_end: result?.peak_window_end || null,
  };
}

export function mlRiskRow(response: MlRiskResponse): MlDisplayWell {
  return 'status' in response ? mlOutcomeRow(response) : {...response, explanation_window_kind:'latest', explanation_window_end:response.window_end};
}

export function mlRows(response?: MlWellsResponse): MlDisplayWell[] {
  if (!response) return [];
  return response.profile === 'cohort'
    ? response.outcomes.map(outcome => mlOutcomeRow({...outcome, run_id:response.run_id, snapshot_id:response.snapshot_id, as_of:response.as_of}))
    : response.wells.map(mlRiskRow);
}

export function mlHistory(response?: MlHistoryResponse): MlHistoryView | null {
  if (!response) return null;
  if (!('status' in response)) return response;
  if (response.status !== 'scored' || !response.result || response.result.verdict === 'insufficient') return null;
  const result = response.result;
  const rule = result.decision_rule;
  return {
    // Raw decision thresholds must never be displayed as percentages of calibrated risk.
    threshold: rule?.watch.scale === 'calibrated' ? rule.watch.threshold : null,
    high_threshold: rule?.high_enabled && rule.high?.scale === 'calibrated' ? rule.high.threshold : null,
    windows_total: result.n_windows, windows_fired: result.windows_above_watch,
    points: (result.timeline ?? []).map(p => ({window_end:p.window_end, risk:p.risk, fired:p.watch_fired ?? null})),
  };
}

export const cohortStatusLabel = (row: MlDisplayWell): string => {
  if (row.reason_code === 'not_evaluated') return 'Расчёт ещё не выполнялся';
  if (row.status === 'archived') return 'В архиве · без оценки';
  if (row.status === 'inactive') return 'Неактивна · без оценки';
  if (row.status === 'error') return `Ошибка расчёта · ${row.reason_code ?? 'причина неизвестна'}`;
  if (row.status === 'insufficient' || row.risk === null) return 'Недостаточно данных · без оценки';
  return row.tier === 'alert' ? 'Тревога' : row.tier === 'watch' ? 'Наблюдение' : 'Норма';
};

export function mlSnapshotNotice(response?: MlWellsResponse, latestRun?: {id:number;status:string} | null): string | null {
  if (response?.profile !== 'cohort') return null;
  const parts: string[] = [];
  if (response.snapshot_id === null) parts.push('Расчёт ещё не выполнялся. Риск не оценён.');
  else {
    parts.push(`Сохранённый расчёт № ${response.run_id ?? '—'}${response.as_of ? ` · данные по ${response.as_of}` : ''}.`);
    if (response.running) parts.push('Выполняется новый расчёт; показан предыдущий сохранённый результат.');
    else if (latestRun?.status === 'error' && response.run_id !== null && latestRun.id > response.run_id) parts.push('Новый расчёт завершился ошибкой; показан предыдущий сохранённый результат.');
    if (response.evaluation_status === 'no_scored_members') parts.push('Расчёт завершён без оценок риска.');
  }
  if (response.snapshot_id !== null) parts.push(response.provenance_status === 'historical_unknown' ? 'Происхождение исторического результата неизвестно.' : 'Происхождение результата подтверждено частично.');
  return parts.join(' ');
}

/** Server already guards cohort membership. Legacy fund filtering must not hide cohort members. */
export function mlScopedRows(rows: MlDisplayWell[], registry: Well[], filters: FundFilters, cohort: boolean): MlDisplayWell[] {
  const byId = new Map(registry.map(w => [w.id,w]));
  const selected = rows.filter(row => {
    const well = row.metadata ?? (row.app_well_id != null ? byId.get(row.app_well_id) : undefined);
    if (!cohort) return !!well;
    if (filters.ngdu !== undefined && well?.ngdu !== filters.ngdu) return false;
    if (filters.department !== undefined && well?.department !== filters.department) return false;
    if (filters.search && !`${well?.well_number ?? ''} ${row.app_well_id}`.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase())) return false;
    return true;
  });
  if (!cohort) return selected;
  return selected.sort((a,b) => {
    const delta = filters.sort === 'name_asc' || filters.sort === 'name_desc'
      ? (a.metadata?.well_number ?? '').localeCompare(b.metadata?.well_number ?? '', 'ru', {numeric:true})
      : (a.app_well_id ?? 0) - (b.app_well_id ?? 0);
    return filters.sort === 'id_desc' || filters.sort === 'name_desc' ? -delta : delta;
  });
}

/** Only an actual new alert row enters the existing attention queue. */
export function mlNewAlerts(response?: MlWellsResponse): MlDisplayWell[] {
  return mlRows(response).filter(w => w.tier === 'alert' && w.alert_status === 'new' && w.alert_id != null && w.app_well_id != null);
}

export function mlAlertReviewPath(row: MlDisplayWell): string | null {
  return row.alert_id == null ? null : `/api/v1/ml/alerts/${row.alert_id}/review`;
}
