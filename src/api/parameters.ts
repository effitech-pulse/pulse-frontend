import { apiClient } from './client';
import type { Parameter } from './types';

export const parametersApi = {
  list: () => apiClient.get<Parameter[]>('/api/v1/parameters').then((r) => r.data),
};
