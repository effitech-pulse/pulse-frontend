import { apiClient } from './client';
import type { AuditEntry } from './types';

export const auditApi = {
  list: (limit = 200) =>
    apiClient.get<AuditEntry[]>('/api/v1/audit', { params: { limit } }).then((r) => r.data),
};
