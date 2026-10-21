import type { MlDisplayWell } from '../api/ml';
export type AlertModelFilter = 'attention' | 'all' | 'alert' | 'watch' | 'normal' | 'unscored';
export type AlertProcessingFilter = 'all' | 'new' | 'acknowledged' | 'confirmed' | 'false_positive' | 'inconclusive' | 'unlinked';
/** Фильтры представления не пересчитывают риск и не меняют сохранённый ярус. */
export function filterMonitoringAlerts(rows: readonly MlDisplayWell[], model: AlertModelFilter, processing: AlertProcessingFilter): MlDisplayWell[] {
  return rows.filter(row => {
    const scored = row.risk !== null;
    const modelMatches = model === 'all' || (model === 'unscored' ? !scored : model === 'attention' ? scored && row.tier !== null : model === 'normal' ? scored && row.tier === null : scored && row.tier === model);
    const linked = row.alert_id != null && row.alert_status != null;
    const processingMatches = processing === 'all' || (processing === 'unlinked' ? !linked : linked && row.alert_status === processing);
    return modelMatches && processingMatches;
  });
}
