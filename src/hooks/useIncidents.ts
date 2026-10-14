import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { incidentsApi } from '@/api/incidents';
import { toApiError } from '@/api/client';
import type { IncidentCreate } from '@/api/types';

export const useIncidents = (wellId: number) =>
  useQuery({
    queryKey: ['incidents', wellId],
    queryFn: () => incidentsApi.listForWell(wellId),
    enabled: wellId > 0,
  });

export const useCreateIncident = (wellId: number) => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (data: IncidentCreate) => incidentsApi.create(wellId, data),
    onSuccess: () => {
      message.success('Отказ добавлен');
      qc.invalidateQueries({ queryKey: ['incidents', wellId] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useDeleteIncident = (wellId: number) => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (id: number) => incidentsApi.remove(id),
    onSuccess: () => {
      message.success('Отказ удалён');
      qc.invalidateQueries({ queryKey: ['incidents', wellId] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

