import { apiClient } from './client';
import type {
  Complication,
  Department,
  Ngdu,
  Prediction,
  RunArchiveEvent,
  Well,
  WellClassification,
  WellCreate,
  WellImportResult,
  WellUpdate,
} from './types';

const V1 = '/api/v1';

export const wellsApi = {
  list: (activeOnly = true) =>
    apiClient.get<Well[]>(`${V1}/wells`, { params: { active_only: activeOnly } }).then((r) => r.data),
  get: (wellId: number) => apiClient.get<Well>(`${V1}/wells/${wellId}`).then((r) => r.data),
  update: (wellId: number, data: WellUpdate) =>
    apiClient.patch<Well>(`${V1}/wells/${wellId}`, data).then((r) => r.data),
  remove: (wellId: number) => apiClient.delete(`${V1}/wells/${wellId}`).then((r) => r.data),
  importXlsx: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<WellImportResult>(`${V1}/wells/import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  create: (well: WellCreate) =>
    apiClient.post<Well>(`${V1}/wells`, well).then((r) => r.data),
  createBulk: (wells: WellCreate[]) =>
    apiClient.post<WellImportResult>(`${V1}/wells/bulk`, wells).then((r) => r.data),
  exportXlsx: () =>
    apiClient.get(`${V1}/wells/export`, { responseType: 'blob' }).then((r) => r.data as Blob),
  predictions: (wellId: number, limit = 100) =>
    apiClient
      .get<Prediction[]>(`${V1}/wells/${wellId}/predictions`, { params: { limit } })
      .then((r) => r.data),
  predictionsExport: (wellId: number) =>
    apiClient
      .get(`${V1}/wells/${wellId}/predictions/export`, { responseType: 'blob' })
      .then((r) => r.data as Blob),
  complications: (wellId: number) =>
    apiClient.get<Complication[]>(`${V1}/wells/${wellId}/complications`).then((r) => r.data),
  classification: (wellId: number) =>
    apiClient.get<WellClassification>(`${V1}/wells/${wellId}/classification`).then((r) => r.data),
};

export const departmentsApi = {
  list: () => apiClient.get<Department[]>(`${V1}/departments`).then((r) => r.data),
  create: (dep: { id: number; name: string }) =>
    apiClient.post<Department>(`${V1}/departments`, dep).then((r) => r.data),
  update: (id: number, name: string) =>
    apiClient.put<Department>(`${V1}/departments/${id}`, { name }).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`${V1}/departments/${id}`).then((r) => r.data),
};

export const ngduApi = {
  list: () => apiClient.get<Ngdu[]>(`${V1}/ngdu`).then((r) => r.data),
  create: (item: { id: number; name: string }) =>
    apiClient.post<Ngdu>(`${V1}/ngdu`, item).then((r) => r.data),
  update: (id: number, name: string) =>
    apiClient.put<Ngdu>(`${V1}/ngdu/${id}`, { name }).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`${V1}/ngdu/${id}`).then((r) => r.data),
};

export const runsApi = {
  list: (params: { dag_id?: string; well_id?: number; status_type?: string; limit?: number }) =>
    apiClient.get<RunArchiveEvent[]>(`${V1}/runs`, { params }).then((r) => r.data),
  forRun: (dagId: string, runId: string) =>
    apiClient.get<RunArchiveEvent[]>(`${V1}/runs/${dagId}/${runId}`).then((r) => r.data),
  exportXlsx: () =>
    apiClient.get(`${V1}/runs/export`, { responseType: 'blob' }).then((r) => r.data as Blob),
};
