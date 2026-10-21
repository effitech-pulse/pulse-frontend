import { apiClient } from './client';

export type SourceKind = 'json_pull' | 'json_push' | 'clickhouse' | 'postgres' | 'mysql' | 'file';
export interface Mapping { field: string; parameter: string; unit: string; scale: number; offset: number; missing: string; is_set: boolean }
export interface Source {
  well_identity?: 'pulse' | 'unitek' | 'armits';
  id: string; name: string; kind: SourceKind; status: 'draft' | 'running' | 'paused' | 'error';
  interval_seconds: number; endpoint: string; table_name: string; records_path: string; well_field: string; time_field: string;
  mappings: Mapping[]; last_received: string | null; last_measured: string | null; error: string;
}
export interface SourceInput extends Omit<Source, 'id' | 'last_received' | 'last_measured' | 'error'> { secret?: string }
export interface Measurement { well_id: string; timestamp: string; values: Record<string, number | null>; quality?: string }
export interface CollectionLog { timestamp: string; source_id: string; accepted: number; duplicates: number; rejected: number; message: string }
export interface TelemetryScore { model_name: string | null; model_version: string | null; model_saved_at: string | null; channels_used: number; features_total: number; features_unavailable: number; windows_running: number; windows_above_watch: number; windows_above_alert: number; peak_risk: number; peak_window_end: string; timeline: {window_end: string; risk: number}[]; contributions: {value_source?: string | null; feature: string; label: string; value: number; shap: number}[]; verdict: 'alert' | 'watch' | 'norm' | 'insufficient'; latest_risk: number; n_windows: number; span_days: number }
export interface ManualCheck {
  id: string; well_id: number; request_id: string; start: string; end: string; created_at: string;
  input_sha256: string; points_count: number; resolution: string; result: TelemetryScore;
}
export const integrationsApi = {
  checks: async (well: string, before?: string) => (await apiClient.get<ManualCheck[]>(`/api/v1/wells/${encodeURIComponent(well)}/checks`, {params: {before}})).data,
  savedCheck: async (well: string, id: string) => (await apiClient.get<ManualCheck>(`/api/v1/wells/${encodeURIComponent(well)}/checks/${encodeURIComponent(id)}`)).data,
  createCheck: async (well: string, start: string, end: string, request_id: string) => (await apiClient.post<ManualCheck>(`/api/v1/wells/${encodeURIComponent(well)}/checks`, {start, end, request_id}, {timeout: 300000})).data,
  list: async () => (await apiClient.get<Source[]>('/api/v1/integrations')).data,
  save: async (input: SourceInput, id?: string) => (await apiClient.request<Source>({ method: id ? 'PUT' : 'POST', url: `/api/v1/integrations${id ? `/${encodeURIComponent(id)}` : ''}`, data: input })).data,
  check: async (input: SourceInput) => (await apiClient.post<{ records: unknown[]; message: string }>('/api/v1/integrations/check', input)).data,
  status: async (id: string, status: Source['status']) => (await apiClient.patch<Source>(`/api/v1/integrations/${encodeURIComponent(id)}/status`, { status })).data,
  collect: async (id: string) => (await apiClient.post<CollectionLog>(`/api/v1/integrations/${encodeURIComponent(id)}/collect`)).data,
  logs: async () => (await apiClient.get<CollectionLog[]>('/api/v1/integrations/logs')).data,
  bounds: (wellId: string) => apiClient.get<{start: string | null; end: string | null}>(`/api/v1/wells/${encodeURIComponent(wellId)}/telemetry/bounds`).then(r=>r.data),
  telemetry: async (well: string, start: string, end: string) => (await apiClient.get<{ points: Measurement[]; truncated: boolean; resolution?: string }>(`/api/v1/wells/${encodeURIComponent(well)}/telemetry`, { params: { start, end } })).data,
  ingest: async (points: Measurement[]) => (await apiClient.post<CollectionLog>('/api/v1/telemetry/import', { points })).data,
  score: async (well_id: string, start: string, end: string) => (await apiClient.post<TelemetryScore>(`/api/v1/wells/${encodeURIComponent(well_id)}/telemetry/score`, { start, end }, { timeout: 300000 })).data,
};
