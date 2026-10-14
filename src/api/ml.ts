import { apiClient } from './client';

const V1 = '/api/v1';

// --- ML-контур (Стадия 1): риск отказа + метрики моделей --------------------

export type AlertStatus = 'new' | 'acknowledged' | 'false_positive';

export interface MlWell {
  well_id: number;
  unitek_id: number | null;
  app_well_id: number | null;
  alert_id: number | null;
  alert_status: AlertStatus | null;
  tier: 'alert' | 'watch' | null;
  oilfield: string | null;
  risk: number;
  alert: boolean;
  /** сколько окон истории превысили порог — по этому правилу и ставится ярус */
  windows_fired: number;
  /** всего окон наблюдения у скважины */
  windows_total: number;
  /** достоверно ли последнее окно (не было потери связи) */
  data_ok: boolean;
  /** сработавшие правила Стадии 0 — основания рядом с вкладом признаков */
  rule_findings: string[];
  window_end: string | null;
  true_failure_type: number | null;
  true_failure_type_name: string | null;
  true_failure_at: string | null;
}

export interface MlWellsResponse {
  count: number;
  alert_threshold: number;
  high_threshold: number;
  running: boolean;
  wells: MlWell[];
}

export type DriftVerdict = 'stable' | 'moderate' | 'severe' | 'unknown';

export interface MlRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'done' | 'error';
  trigger: 'manual' | 'scheduled';
  wells_scored: number | null;
  alerts_count: number | null;
  error: string | null;
  /** дрейф данных относительно обучающей выборки (PSI по признакам) */
  drift_verdict: DriftVerdict | null;
  drift_psi_max: number | null;
  drift_top: string | null;
}

export interface MlRunsResponse {
  running: boolean;
  runs: MlRun[];
}

/** Состояние боевой модели: нужно ли переобучение и на каком основании. */
export interface MlHealth {
  urgency: 'none' | 'watch' | 'due';
  needed: boolean;
  reasons: string[];
  drift_verdict: DriftVerdict | null;
  alerts_reviewed: number;
  alerts_false: number;
  false_alert_rate: number | null;
  model_age_days: number | null;
}

/** Риск по всем окнам наблюдения скважины — основание её яруса. */
export interface MlRiskHistory {
  well_id: number;
  threshold: number;
  high_threshold: number;
  windows_total: number;
  windows_fired: number;
  points: { window_end: string; risk: number; fired: boolean }[];
}

export interface MlModelReport {
  class_recall: Record<string, number>;
  class_precision: Record<string, number>;
  macro_f1: number;
  fpr: number;
  support: Record<string, number>;
  n: number;
}

export interface MlCalibration {
  method: string;
  brier_before: number;
  brier_after: number;
  ece_before: number;
  ece_after: number;
  calibrated_threshold: number;
  per_well?: { recall: number; precision: number; k_windows: number };
}

export interface MlSavedModel {
  name: string;
  engine: string;
  classes: number[];
  calibration?: MlCalibration;
  metrics: {
    mode?: string;
    n_splits?: number;
    n_features?: number;
    n_oof_windows?: number;
    report?: MlModelReport;
  };
  config: Record<string, unknown>;
  saved_at: string;
}

export interface MlContribution {
  feature: string;
  label: string;
  value: number;
  shap: number;
}

export interface MlExplainResponse {
  well_id: number;
  contributions: MlContribution[];
}

export const mlApi = {
  wells: (alertOnly = false) =>
    apiClient
      .get<MlWellsResponse>(`${V1}/ml/wells`, { params: { alert_only: alertOnly } })
      .then((r) => r.data),
  refresh: () =>
    apiClient.post<{ started: boolean }>(`${V1}/ml/wells/refresh`).then((r) => r.data),
  runs: (limit = 20) =>
    apiClient.get<MlRunsResponse>(`${V1}/ml/runs`, { params: { limit } }).then((r) => r.data),
  health: () => apiClient.get<MlHealth>(`${V1}/ml/health`).then((r) => r.data),
  history: (wellId: number, limit = 400) =>
    apiClient
      .get<MlRiskHistory>(`${V1}/ml/wells/${wellId}/history`, { params: { limit } })
      .then((r) => r.data),
  setAlertStatus: (alertId: number, status: AlertStatus) =>
    apiClient
      .patch<{ id: number; status: AlertStatus }>(`${V1}/ml/alerts/${alertId}`, { status })
      .then((r) => r.data),
  metrics: () =>
    apiClient.get<{ models: MlSavedModel[] }>(`${V1}/ml/metrics`).then((r) => r.data),
  byUnitek: (unitekId: number) =>
    apiClient.get<MlWell>(`${V1}/ml/wells/by-unitek/${unitekId}`).then((r) => r.data),
  explain: (wellId: number, topN = 6) =>
    apiClient
      .get<MlExplainResponse>(`${V1}/ml/wells/${wellId}/explain`, { params: { top_n: topN } })
      .then((r) => r.data),
};
