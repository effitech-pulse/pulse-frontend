import {useAuth} from '@/auth/AuthProvider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { incidentsApi } from '@/api/incidents';
import { toApiError } from '@/api/client';
import type { IncidentCreate } from '@/api/types';

export const useIncidents = (wellId: number) =>
  useQuery({
    queryKey: ['incidents', wellId],
    queryFn: () => incidentsApi.listForWell(wellId),
    enabled: useAuth().can('incidents.read') && wellId > 0,
  });

export const useCreateIncident = (wellId: number) => {
  const {can}=useAuth();
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (data: IncidentCreate) => {if(!can('incidents.create'))throw new Error('Недостаточно прав');return incidentsApi.create(wellId, data);},
    onSuccess: () => {
      message.success('Отказ добавлен');
      qc.invalidateQueries({ queryKey: ['incidents', wellId] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useDeleteIncident = (wellId: number) => {
  const {can}=useAuth();
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (id: number) => {if(!can('incidents.delete'))throw new Error('Недостаточно прав');return incidentsApi.remove(id);},
    onSuccess: () => {
      message.success('Отказ удалён');
      qc.invalidateQueries({ queryKey: ['incidents', wellId] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

