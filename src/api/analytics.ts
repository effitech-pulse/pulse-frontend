import { apiClient } from './client';
import type { AnalyticsStatus, EmbedUrl } from './types';

const V1 = '/api/v1';

export const analyticsApi = {
  status: () => apiClient.get<AnalyticsStatus>(`${V1}/analytics/status`).then((r) => r.data),
  embed: (dashboardId: number) =>
    apiClient
      .get<EmbedUrl>(`${V1}/analytics/dashboards/${dashboardId}/embed`)
      .then((r) => r.data),
};
