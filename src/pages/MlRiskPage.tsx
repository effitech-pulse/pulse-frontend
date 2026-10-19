import {useAuth} from '@/auth/AuthProvider';
import { PresentationOverview } from '@/components/telemetry/PresentationOverview';
import { useWells } from '@/hooks/useWells';
import { useFund } from '@/theme/FundProvider';
import { Alert, Button, Card, Col, Modal, Progress, Row, Segmented, Statistic, Table, Tag, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useFundFilters } from '@/theme/FundFilters';
import { mlRows, mlScopedRows, mlSnapshotNotice, cohortStatusLabel, mlAlertReviewPath } from '@/lib/mlSnapshot';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mlApi, type MlDisplayWell } from '@/api/ml';
import { toApiError } from '@/api/client';
import { PageSpin } from '@/components/common/PageSpin';
import { ExplainBars } from '@/components/ml/ExplainBars';
import { useMlRun } from '@/hooks/useMlRun';
import dayjs from 'dayjs';
import { ReviewPanel } from '@/components/telemetry/ReviewPanel';
import { FAILURE_TYPE_RU } from '@/lib/labels';

const ALERT_STATUS_RU = {
  new: { label: 'новая', color: 'red' },
  confirmed: { label: 'подтверждена', color: 'orange' },
  inconclusive: { label: 'нужны данные', color: 'gold' },
  acknowledged: { label: 'в работе', color: 'blue' },
  false_positive: { label: 'ложная', color: 'default' },
} as const;

function riskColor(risk: number, threshold: number, high = 1.0): string {
  if (risk >= high) return '#d64545';
  if (risk >= threshold) return '#c98a1f';
  return '#8c8c8c';
}

export function MlRiskPage() { const {fund} = useFund(); const ml=useQuery({queryKey:['ml-wells'],queryFn:()=>mlApi.wells(false)}); if(ml.isLoading)return <PageSpin loading><span /></PageSpin>; if(ml.isError)return <PageSpin loading={false} error={ml.error}><span /></PageSpin>; return fund === 'presentation' && ml.data?.profile !== 'cohort' ? <PresentationOverview /> : <OperationalMlRiskPage />; }
function OperationalMlRiskPage() {
 const {isAdmin}=useAuth();
 const {filters}=useFundFilters();
 const [search]=useSearchParams();
 const selectedRun=Number(search.get('run_id')) || undefined;
  const [filter, setFilter] = useState<'all' | 'alerts'>('all');
  const [explainWell, setExplainWell] = useState<MlDisplayWell | null>(null);

  const wellsQ = useQuery({
    queryKey: selectedRun ? ['ml-snapshot',selectedRun] : ['ml-wells'],
    queryFn: () => selectedRun ? mlApi.snapshot(selectedRun) : mlApi.wells(false),
  });
  const metricsQ = useQuery({ queryKey: ['ml-metrics'], queryFn: mlApi.metrics,enabled:isAdmin && !!wellsQ.data && wellsQ.data.profile !== 'cohort' });
  const { running, lastRun, start } = useMlRun();

  const cohort = wellsQ.data?.profile === 'cohort';
  const threshold = wellsQ.data && wellsQ.data.profile !== 'cohort' ? wellsQ.data.alert_threshold : null;
  const highThreshold = wellsQ.data && wellsQ.data.profile !== 'cohort' ? wellsQ.data.high_threshold : null;
  const registry = useWells();
  const wells = mlScopedRows(mlRows(wellsQ.data), registry.data ?? [], filters, cohort);
  const notice = mlSnapshotNotice(wellsQ.data, lastRun);
  const alerts = useMemo(() => wells.filter((w) => w.tier === 'alert'), [wells]);
  const watches = useMemo(() => wells.filter((w) => w.tier === 'watch'), [wells]);
  const reviewPath = explainWell ? mlAlertReviewPath(explainWell) : null;
  const shown =
    filter === 'alerts' ? wells.filter((w) => w.tier !== null) : wells;

  const stage1 = cohort ? undefined : metricsQ.data?.models.find((m) => m.name.startsWith('stage1'));
  const report = stage1?.metrics.report;
  const perWell = stage1?.calibration?.per_well;

  const columns: ColumnsType<MlDisplayWell> = [
    {
      title: 'Скважина',
      dataIndex: 'app_well_id',
      key: 'app_well_id',
      width: 110,
      render: (id: number, r) =>
        r.app_well_id != null ? (
          <Link to={`/wells/${r.app_well_id}${r.run_id != null ? `?run_id=${r.run_id}` : ''}`} onClick={(e) => e.stopPropagation()}>
            <b>{id}</b>
          </Link>
        ) : (
          <span>Не сопоставлена</span>
        ),
    },
    { title: 'НГДУ', dataIndex: 'oilfield', key: 'oilfield', width: 110,
      render: (v: string | null) => <span className="sensitive">{v}</span> },
    {
      title: 'Риск отказа',
      dataIndex: 'risk',
      key: 'risk',
      sorter: (a, b) => (a.risk ?? -1) - (b.risk ?? -1),
      defaultSortOrder: cohort ? undefined : 'descend',
      render: (risk: number | null, r) => risk === null ? <Tag>{cohortStatusLabel(r)}</Tag> : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
          <Tag color={cohort ? (r.tier === 'alert' ? '#d64545' : r.tier === 'watch' ? '#c98a1f' : '#8c8c8c') : riskColor(risk, threshold!, highThreshold!)} style={{ minWidth: 64, textAlign: 'center' }}>
            {(risk * 100).toFixed(1)}%
          </Tag>
          <Progress
            percent={risk * 100}
            size="small"
            showInfo={false}
            strokeColor={cohort ? (r.tier === 'alert' ? '#d64545' : r.tier === 'watch' ? '#c98a1f' : '#8c8c8c') : riskColor(risk, threshold!, highThreshold!)}
            style={{ width: 70, margin: 0 }}
          />
          {r.data_ok === false && (
            <Tooltip title="Связь с установкой терялась — текущий риск посчитан по неполному ряду">
              <Tag color="default" style={{ cursor: 'help' }}>нет связи</Tag>
            </Tooltip>
          )}
          {r.tier && (
            <Tooltip
              title={
                `Ярус сохранён моделью для этого запуска. ` +
                `${r.windows_fired ?? '—'} из ${r.windows_total ?? '—'} окон сработало по правилу решения.`
              }
            >
              <Tag color={r.tier === 'alert' ? '#d64545' : '#c98a1f'} style={{ cursor: 'help' }}>
                {r.tier === 'alert' ? 'тревога' : 'наблюдение'} · {r.windows_fired} окон
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Статус тревоги',
      key: 'alert_status',
      width: 190,
      render: (_: unknown, r) => {
        if (r.alert_id == null || !r.alert_status) return null;
        const st = ALERT_STATUS_RU[r.alert_status];
        return (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tag color={st.color}>{st.label}</Tag>
            <Button size="small" onClick={() => setExplainWell(r)}>Обработка</Button>
          </div>
        );
      },
    },
    {
      title: 'Последнее окно',
      dataIndex: 'window_end',
      key: 'window_end',
      width: 140,
      render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY') : '—'),
    },
    {
      title: 'Исход по КРС (постфактум)',
      key: 'true',
      render: (_: unknown, r) =>
        r.true_failure_type_name ? (
          <span>
            {FAILURE_TYPE_RU[r.true_failure_type_name] ?? r.true_failure_type_name}
            {r.true_failure_at ? ` · ${dayjs(r.true_failure_at).format('DD.MM.YYYY')}` : ''}
          </span>
        ) : (
          <Tag>{cohort ? 'Нет зарегистрированного исхода' : 'норма'}</Tag>
        ),
    },
  ];

  if (wellsQ.isLoading)
    return (
      <PageSpin loading>
        <span />
      </PageSpin>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Скважин с оценкой" value={wells.filter(w => w.risk !== null).length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={highThreshold === null ? 'Тревога · сохранённый ярус' : `Тревога (порог ${(highThreshold * 100).toFixed(0)}%)`}
              value={alerts.length}
              valueStyle={{ color: '#d64545' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={threshold === null ? 'Наблюдение · сохранённый ярус' : `Наблюдение (порог ${(threshold * 100).toFixed(0)}%)`}
              value={watches.length}
              valueStyle={{ color: '#c98a1f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Recall по скважинам (CV)"
              value={
                perWell
                  ? Math.round(perWell.recall * 100)
                  : report
                    ? Math.round((report.class_recall['1'] ?? 0) * 100)
                    : '—'
              }
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={
                <Tooltip
                  title={
                    'Измерено на выборке проекта, где отказали 41% скважин. ' +
                    'В действующем фонде отказы реже (около 13% за квартал), ' +
                    'поэтому ожидаемая точность ниже: ~46% для яруса «тревога» ' +
                    'и ~34% для «наблюдения». Полнота от состава фонда не зависит.'
                  }
                >
                  <span style={{ borderBottom: '1px dashed #bfbfbf', cursor: 'help' }}>
                    Precision на выборке (41% отказных)
                  </span>
                </Tooltip>
              }
              value={
                perWell
                  ? Math.round(perWell.precision * 100)
                  : report
                    ? Math.round((report.class_precision['1'] ?? 0) * 100)
                    : '—'
              }
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Card
        className="pulse-responsive-card"
        title={cohort ? 'Риск отказа по скважинам · сохранённый результат' : `Риск отказа по скважинам · модель ${stage1?.name ?? '—'}`}
        extra={
          <div className="pulse-ml-actions">
            {!cohort && lastRun && (
              <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                прогон {dayjs(lastRun.started_at).format('DD.MM HH:mm')} (
                {lastRun.trigger === 'scheduled' ? 'авто' : 'вручную'})
              </span>
            )}
            <Segmented
              value={filter}
              onChange={(v) => setFilter(v as 'all' | 'alerts')}
              options={[
                { label: 'Все', value: 'all' },
                { label: `Тревога+наблюдение (${alerts.length + watches.length})`, value: 'alerts' },
              ]}
            />
            <Button
              disabled={!isAdmin}
              icon={<PlayCircleOutlined />}
              loading={running || wellsQ.data?.running || start.isPending}
              onClick={() => start.mutate()}
            >
              {running ? 'Идёт прогон...' : 'Прогнать'}
            </Button>
          </div>
        }
      >
        {notice && <Alert type="info" message={notice} style={{marginBottom:16}} />}
        {wellsQ.isError ? (
          <div style={{ color: '#c98a1f' }}>
            {toApiError(wellsQ.error).message}
          </div>
        ) : (
          <Table
            rowKey={w => w.app_well_id ?? w.well_id!}
            size="middle"
            scroll={{x:1050}}
            columns={columns}
            dataSource={shown}
            pagination={{ pageSize: 15, showTotal: (t) => `Всего: ${t}` }}
            onRow={(r) => ({ onClick: () => setExplainWell(r), style: { cursor: 'pointer' } })}
          />
        )}
      </Card>

      <Modal
        open={explainWell !== null}
        onCancel={() => setExplainWell(null)}
        footer={
          explainWell?.app_well_id ? (
            <Link to={`/wells/${explainWell.app_well_id}${explainWell.run_id != null ? `?run_id=${explainWell.run_id}` : ''}`}>
              <Button type="primary">Открыть карточку скважины</Button>
            </Link>
          ) : null
        }
        width={620}
        title={
          explainWell
            ? `${explainWell.app_well_id != null ? `Скважина · ID Pulse ${explainWell.app_well_id}` : 'Скважина не сопоставлена'} · ${explainWell.risk === null ? cohortStatusLabel(explainWell) : `риск ${(explainWell.risk * 100).toFixed(1)}% — почему?`}`
            : ''
        }
      >
        {explainWell && (
          <>
            {reviewPath !== null && <ReviewPanel key={reviewPath} path={reviewPath} />}
            {/* Стадия 0: сработавшие правила — основания рядом с вкладом
                признаков. Технолог должен видеть не только «что подняло риск»,
                но и «какое правило сработало» */}
            {explainWell.rule_findings.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {explainWell.rule_findings.map((r) => (
                  <Tag key={r} color="#8c6d1f" style={{ marginBottom: 4 }}>
                    {r}
                  </Tag>
                ))}
              </div>
            )}
            {explainWell.data_ok === false && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 14 }}
                message="Последнее окно неполное: связь с установкой терялась"
                description={
                  'Текущий риск посчитан по неполному ряду и может быть занижен. ' +
                  'Ярус скважины при этом остаётся: он опирается на всю историю ' +
                  'наблюдения, а не на последнее окно.'
                }
              />
            )}
            {explainWell.risk === null ? <Alert type="info" message={cohortStatusLabel(explainWell)} description={explainWell.reason_code} /> : <ExplainBars wellId={explainWell.well_id} contributions={explainWell.contributions} windowKind={explainWell.explanation_window_kind} windowEnd={explainWell.explanation_window_end} />}
          </>
        )}
      </Modal>
    </div>
  );
}
