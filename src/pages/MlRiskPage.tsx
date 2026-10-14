import { Alert, Button, Card, Col, Modal, Progress, Row, Segmented, Statistic, Table, Tag, Tooltip } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mlApi, type MlWell } from '@/api/ml';
import { toApiError } from '@/api/client';
import { PageSpin } from '@/components/common/PageSpin';
import { ExplainBars } from '@/components/ml/ExplainBars';
import { useAlertStatus, useMlRun } from '@/hooks/useMlRun';
import dayjs from 'dayjs';
import { FAILURE_TYPE_RU } from '@/lib/labels';

const ALERT_STATUS_RU = {
  new: { label: 'новая', color: 'red' },
  acknowledged: { label: 'в работе', color: 'blue' },
  false_positive: { label: 'ложная', color: 'default' },
} as const;

function riskColor(risk: number, threshold: number, high = 1.0): string {
  if (risk >= high) return '#d64545';
  if (risk >= threshold) return '#c98a1f';
  return '#8c8c8c';
}

export function MlRiskPage() {
  const [filter, setFilter] = useState<'all' | 'alerts'>('all');
  const [explainWell, setExplainWell] = useState<MlWell | null>(null);

  const wellsQ = useQuery({
    queryKey: ['ml-wells'],
    queryFn: () => mlApi.wells(false),
  });
  const metricsQ = useQuery({ queryKey: ['ml-metrics'], queryFn: mlApi.metrics });
  const { running, lastRun, start } = useMlRun();
  const alertStatus = useAlertStatus();

  const threshold = wellsQ.data?.alert_threshold ?? 0.7;
  const highThreshold = wellsQ.data?.high_threshold ?? 1.0;
  const wells = wellsQ.data?.wells ?? [];
  const alerts = useMemo(() => wells.filter((w) => w.tier === 'alert'), [wells]);
  const watches = useMemo(() => wells.filter((w) => w.tier === 'watch'), [wells]);
  const shown =
    filter === 'alerts' ? wells.filter((w) => w.tier !== null) : wells;

  const stage1 = metricsQ.data?.models.find((m) => m.name.startsWith('stage1'));
  const report = stage1?.metrics.report;
  const perWell = stage1?.calibration?.per_well;

  const columns: ColumnsType<MlWell> = [
    {
      title: 'Скважина',
      dataIndex: 'well_id',
      key: 'well_id',
      width: 110,
      render: (id: number, r) =>
        r.app_well_id ? (
          <Link to={`/wells/${r.app_well_id}`} onClick={(e) => e.stopPropagation()}>
            <b>{id}</b>
          </Link>
        ) : (
          <b>{id}</b>
        ),
    },
    { title: 'НГДУ', dataIndex: 'oilfield', key: 'oilfield', width: 110,
      render: (v: string | null) => <span className="sensitive">{v}</span> },
    {
      title: 'Риск отказа',
      dataIndex: 'risk',
      key: 'risk',
      sorter: (a, b) => a.risk - b.risk,
      defaultSortOrder: 'descend',
      render: (risk: number, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
          <Tag color={riskColor(risk, threshold, highThreshold)} style={{ minWidth: 64, textAlign: 'center' }}>
            {(risk * 100).toFixed(1)}%
          </Tag>
          <Progress
            percent={risk * 100}
            size="small"
            showInfo={false}
            strokeColor={riskColor(risk, threshold, highThreshold)}
            style={{ width: 70, margin: 0 }}
          />
          {!r.data_ok && (
            <Tooltip title="Связь с установкой терялась — текущий риск посчитан по неполному ряду">
              <Tag color="default" style={{ cursor: 'help' }}>нет связи</Tag>
            </Tooltip>
          )}
          {r.tier && (
            <Tooltip
              title={
                `Ярус ставится не по одному окну, а по числу сработавших: ` +
                `${r.windows_fired} из ${r.windows_total} окон наблюдения превысили порог. ` +
                `На этом же правиле измерены заявленные полнота и точность.`
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
        if (!r.alert_id || !r.alert_status) return null;
        const st = ALERT_STATUS_RU[r.alert_status];
        return (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tag color={st.color}>{st.label}</Tag>
            {r.alert_status !== 'acknowledged' && (
              <Tooltip title="Принято в работу">
                <Button
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() =>
                    alertStatus.mutate({ alertId: r.alert_id!, status: 'acknowledged' })
                  }
                />
              </Tooltip>
            )}
            {r.alert_status !== 'false_positive' && (
              <Tooltip title="Ложная тревога">
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() =>
                    alertStatus.mutate({ alertId: r.alert_id!, status: 'false_positive' })
                  }
                />
              </Tooltip>
            )}
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
          <Tag>норма</Tag>
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
            <Statistic title="Скважин в скоринге" value={wells.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={`Тревога (порог ${(highThreshold * 100).toFixed(0)}%, точность ~80%)`}
              value={alerts.length}
              valueStyle={{ color: '#d64545' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={`Наблюдение (порог ${(threshold * 100).toFixed(0)}%)`}
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
        title={`Риск отказа по скважинам · модель ${stage1?.name ?? 'stage1_binary_v1'}`}
        extra={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {lastRun && (
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
              icon={<PlayCircleOutlined />}
              loading={running || start.isPending}
              onClick={() => start.mutate()}
            >
              {running ? 'Идёт прогон...' : 'Прогнать'}
            </Button>
          </div>
        }
      >
        {wellsQ.isError ? (
          <div style={{ color: '#c98a1f' }}>
            {toApiError(wellsQ.error).message} — вероятно, кэш признаков пересобирается.
          </div>
        ) : (
          <Table
            rowKey="well_id"
            size="middle"
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
            <Link to={`/wells/${explainWell.app_well_id}`}>
              <Button type="primary">Открыть карточку скважины</Button>
            </Link>
          ) : null
        }
        width={620}
        title={
          explainWell
            ? `Скважина ${explainWell.well_id} · риск ${(explainWell.risk * 100).toFixed(1)}% — почему?`
            : ''
        }
      >
        {explainWell && (
          <>
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
            {!explainWell.data_ok && (
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
            <ExplainBars wellId={explainWell.well_id} />
          </>
        )}
      </Modal>
    </div>
  );
}
