import { apiClient } from './client';
import type { Incident, IncidentCreate, IncidentStats } from './types';

const V1 = '/api/v1';

export const incidentsApi = {
  listForWell: (wellId: number) =>
    apiClient.get<Incident[]>(`${V1}/wells/${wellId}/incidents`).then((r) => r.data),
  create: (wellId: number, data: IncidentCreate) =>
    apiClient.post<Incident>(`${V1}/wells/${wellId}/incidents`, data).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`${V1}/incidents/${id}`).then((r) => r.data),
  stats: () => apiClient.get<IncidentStats>(`${V1}/incidents/stats`).then((r) => r.data),
};
