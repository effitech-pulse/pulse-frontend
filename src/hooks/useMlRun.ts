import {useAuth} from '@/auth/AuthProvider';
import { App } from 'antd';
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mlApi, type AlertStatus } from '@/api/ml';
import { toApiError } from '@/api/client';

/** Фоновый прогон модели: запуск, поллинг статуса, обновление данных по завершении. */
export const useMlRun = (profile?:'research'|'cohort') => {
  const {can}=useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const runsQ = useQuery({
    enabled:profile!==undefined&&can(profile==='cohort'?'cohort.runs.read':'runs.read'),
    queryKey: ['ml-runs'],
    queryFn: () => mlApi.runs(10),
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
    refetchIntervalInBackground: true,
  });
  const running = runsQ.data?.running ?? false;
  const lastRun = runsQ.data?.runs.find((r) => r.status !== 'running') ?? null;

  // Прогон завершился (running true -> false) — перечитать скоринг.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) {
      const done = runsQ.data?.runs[0];
      if (done?.status === 'done') {
        (done.wells_scored === 0 ? message.warning : message.success)(
          done.wells_scored === 0 ? 'Расчёт завершён без оценок риска' : `Прогон завершён: ${done.wells_scored ?? '—'} скважин с оценкой, тревог: ${done.alerts_count ?? '—'}`,
        );
      } else if (done?.status === 'error') {
        message.error(`Прогон завершился ошибкой: ${done.error ?? 'см. журнал бэкенда'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['ml-wells'] });
      queryClient.invalidateQueries({ queryKey: ['ml-explain'] });
      queryClient.invalidateQueries({ queryKey: ['ml-by-unitek'] });
      queryClient.invalidateQueries({ queryKey: ['well-risk'] });
      queryClient.invalidateQueries({ queryKey: ['ml-history'] });
    }
    wasRunning.current = running;
  }, [running, runsQ.data, message, queryClient]);

  const start = useMutation({
    mutationFn: async () => {if(!can('runs.start'))throw new Error('Недостаточно прав');return mlApi.refresh();},
    onSuccess: () => {
      message.info('Прогон запущен — идёт в фоне');
      runsQ.refetch();
      queryClient.invalidateQueries({ queryKey: ['ml-wells'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });

  return { running, lastRun, runs: runsQ.data?.runs ?? [], start };
};

/** Смена статуса тревоги технологом (принято в работу / ложная). */
export const useAlertStatus = () => {
  const {can}=useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, status }: { alertId: number; status: AlertStatus }) =>
      {if(!can('alerts.review'))throw new Error('Недостаточно прав');return mlApi.setAlertStatus(alertId, status);},
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ml-wells'] }),
    onError: (e) => message.error(toApiError(e).message),
  });
};
