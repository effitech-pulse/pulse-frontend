import { Button, Card, Col, Empty, Modal, Progress, Row, Statistic, Table, Tag, Tooltip } from 'antd';
import { PlayCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Column, Pie } from '@ant-design/charts';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mlApi, type MlWell } from '@/api/ml';
import { incidentsApi } from '@/api/incidents';
import { useMlRun } from '@/hooks/useMlRun';
import { failureTypeRu } from '@/lib/labels';
import { useWells } from '@/hooks/useWells';
import { PageSpin } from '@/components/common/PageSpin';
import { ExplainBars } from '@/components/ml/ExplainBars';

/** Трактовка дрейфа данных для интерфейса (пороги PSI 0.10 / 0.25). */
const DRIFT_UI: Record<string, { label: string; color: string }> = {
  stable: { label: 'в норме', color: 'green' },
  moderate: { label: 'умеренный дрейф', color: 'orange' },
  severe: { label: 'существенный дрейф', color: 'red' },
  unknown: { label: 'не оценён', color: 'default' },
};

/**
 * Состояние модели: нужно ли переобучение. «Есть основания» — сильный дрейф
 * либо просевшая точность по обратной связи технологов; «наблюдаем» —
 * косвенные поводы (возраст модели, мало размеченных тревог).
 */
const HEALTH_UI: Record<string, { label: string; color: string }> = {
  none: { label: 'модель актуальна', color: 'green' },
  watch: { label: 'модель: наблюдаем', color: 'default' },
  due: { label: 'модель: пора переобучать', color: 'red' },
};

/**
 * Столбцы гистограммы — ярусы, а не корзины по риску последнего окна.
 * Ярус ставится правилом «не менее K сработавших окон за историю», поэтому
 * счёт по значению риска расходился бы со счётчиком тревог рядом на этом же
 * экране: скважина может быть в тревоге при умеренном текущем риске и
 * наоборот.
 */
const TIER_BUCKETS = [
  { label: 'норма', tier: null, color: '#8c8c8c' },
  { label: 'наблюдение', tier: 'watch', color: '#c98a1f' },
  { label: 'тревога', tier: 'alert', color: '#d64545' },
] as const;

export function Dashboard() {
  const navigate = useNavigate();
  const [explainWell, setExplainWell] = useState<MlWell | null>(null);

  const wells = useWells();
  const mlWells = useQuery({ queryKey: ['ml-wells'], queryFn: () => mlApi.wells(false) });
  const stats = useQuery({ queryKey: ['incident-stats'], queryFn: incidentsApi.stats });
  const { running, lastRun, start } = useMlRun();
  // состояние модели пересчитывается после каждого прогона — обратная связь
  // технологов и дрейф меняются именно там
  const healthQ = useQuery({ queryKey: ['ml-health', lastRun?.id], queryFn: mlApi.health });
  const health = healthQ.data;

  const scored = mlWells.data?.wells ?? [];
  const threshold = mlWells.data?.alert_threshold ?? 0.7;
  const highThreshold = mlWells.data?.high_threshold ?? 1.0;
  const alerts = useMemo(() => scored.filter((w) => w.tier === 'alert'), [scored]);
  const watches = useMemo(() => scored.filter((w) => w.tier === 'watch'), [scored]);
  const meanRisk = scored.length
    ? scored.reduce((acc, w) => acc + w.risk, 0) / scored.length
    : null;

  const buckets = TIER_BUCKETS;
  const riskHist = useMemo(
    () =>
      buckets.map((b) => ({
        bucket: b.label,
        count: scored.filter((w) => w.tier === b.tier).length,
        color: b.color,
      })),
    [scored, buckets],
  );

  const byType = useMemo(
    () =>
      (stats.data?.by_type ?? []).map((t) => ({
        type: failureTypeRu(t.failure_type),
        value: t.count,
      })),
    [stats.data],
  );

  const byMonth = useMemo(
    () => (stats.data?.by_month ?? []).map((m) => ({ month: m.month, count: m.count })),
    [stats.data],
  );

  const top10 = useMemo(
    () => [...scored].sort((a, b) => b.risk - a.risk).slice(0, 10),
    [scored],
  );

  const riskColor = (risk: number) =>
    risk >= highThreshold ? '#d64545' : risk >= threshold ? '#c98a1f' : '#8c8c8c';

  const topColumns: ColumnsType<MlWell> = [
    { title: 'Скважина', dataIndex: 'well_id', key: 'well_id', width: 100,
      render: (id: number, r) =>
        r.app_well_id ? (
          <Link to={`/wells/${r.app_well_id}`} onClick={(e) => e.stopPropagation()}>
            <b>{id}</b>
          </Link>
        ) : (
          <b>{id}</b>
        ) },
    { title: 'НГДУ', dataIndex: 'oilfield', key: 'oilfield', width: 100,
      render: (v: string | null) => <span className="sensitive">{v}</span> },
    {
      title: 'Риск',
      dataIndex: 'risk',
      key: 'risk',
      render: (risk: number, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={riskColor(risk)} style={{ minWidth: 58, textAlign: 'center' }}>
            {(risk * 100).toFixed(1)}%
          </Tag>
          <Progress
            percent={risk * 100}
            size="small"
            showInfo={false}
            strokeColor={riskColor(risk)}
            style={{ width: 60, margin: 0 }}
          />
          {r.tier === 'alert' && <WarningOutlined style={{ color: '#d64545' }} />}
        </div>
      ),
    },
    { title: 'Окно', dataIndex: 'window_end', key: 'window_end', width: 110,
      render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY') : '—') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Прогон модели по фонду</div>
            <div style={{ color: '#8c8c8c', fontSize: 13 }}>
              Пересчитывает риск отказа по всем скважинам из кэша признаков (модель stage1_binary_v1).
              Автопрогон — ежедневно в 05:00.
            </div>
            {lastRun && (
              <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4 }}>
                Последний прогон: {dayjs(lastRun.started_at).format('DD.MM.YYYY HH:mm')} (
                {lastRun.trigger === 'scheduled' ? 'авто' : 'вручную'}) ·{' '}
                {lastRun.status === 'done'
                  ? `${lastRun.wells_scored} скважин, тревог: ${lastRun.alerts_count}`
                  : 'ошибка'}
                {lastRun.drift_verdict && lastRun.drift_verdict !== 'unknown' && (
                  <>
                    {' · '}
                    <Tooltip
                      title={
                        'Сравнение распределений признаков с обучающей выборкой (индекс PSI). ' +
                        'Существенный дрейф означает, что данные ушли от тех, на которых ' +
                        'училась модель, и её точность может падать.' +
                        (lastRun.drift_top ? ` Наибольший дрейф: ${lastRun.drift_top}.` : '')
                      }
                    >
                      <Tag
                        color={DRIFT_UI[lastRun.drift_verdict].color}
                        style={{ marginInlineEnd: 0, cursor: 'help' }}
                      >
                        данные: {DRIFT_UI[lastRun.drift_verdict].label}
                      </Tag>
                    </Tooltip>
                  </>
                )}
                {health && (
                  <>
                    {' · '}
                    <Tooltip
                      title={
                        (health.reasons.length
                          ? `Основания: ${health.reasons.join('; ')}.`
                          : 'Дрейфа нет, обратная связь технологов не показывает падения точности.') +
                        ' Решение принимается по дрейфу данных, доле ложных тревог' +
                        ' и возрасту модели.'
                      }
                    >
                      <Tag
                        color={HEALTH_UI[health.urgency].color}
                        style={{ marginInlineEnd: 0, cursor: 'help' }}
                      >
                        {HEALTH_UI[health.urgency].label}
                      </Tag>
                    </Tooltip>
                  </>
                )}
              </div>
            )}
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            loading={running || start.isPending}
            onClick={() => start.mutate()}
          >
            {running ? 'Идёт прогон...' : 'Прогнать по скважинам'}
          </Button>
        </div>
      </Card>

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <PageSpin loading={wells.isLoading} error={wells.error}>
              <Statistic title="Активные скважины" value={wells.data?.length ?? 0} />
            </PageSpin>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/ml-risk')}>
            <Statistic
              title={`Тревога / наблюдение (ML)`}
              value={mlWells.isSuccess ? alerts.length : '—'}
              suffix={mlWells.isSuccess ? `/ ${watches.length}` : undefined}
              valueStyle={{ color: '#d64545' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Средний риск по фонду"
              value={meanRisk !== null ? (meanRisk * 100).toFixed(1) : '—'}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Отказов в базе" value={stats.data?.total ?? '—'} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} align="stretch">
        <Col xs={24} md={12} style={{ display: 'flex' }}>
          <Card
            title={`Фонд по ярусам (пороги риска ${(threshold * 100).toFixed(0)}% / ${(highThreshold * 100).toFixed(0)}%)`}
            style={{ flex: 1 }}
          >
            <PageSpin loading={mlWells.isLoading} error={mlWells.error}>
              {scored.length ? (
                <Column
                  data={riskHist}
                  xField="bucket"
                  yField="count"
                  colorField="bucket"
                  scale={{ color: { range: buckets.map((b) => b.color) } }}
                  legend={false}
                  axis={{ x: { labelAutoRotate: false, labelAutoHide: false } }}
                  height={240}
                  autoFit
                />
              ) : (
                <Empty description="Скоринг пуст — нажмите «Прогнать по скважинам»" />
              )}
            </PageSpin>
          </Card>
        </Col>
        <Col xs={24} md={12} style={{ display: 'flex' }}>
          <Card title="Отказы по типам (история)" style={{ flex: 1 }}>
            <PageSpin loading={stats.isLoading} error={stats.error}>
              {byType.length ? (
                <Pie
                  data={byType}
                  angleField="value"
                  colorField="type"
                  innerRadius={0.55}
                  legend={{ color: { position: 'bottom', maxRows: 5 } }}
                  height={260}
                  autoFit
                />
              ) : (
                <Empty description="Нет отказов" />
              )}
            </PageSpin>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} align="stretch">
        <Col xs={24} md={12} style={{ display: 'flex' }}>
          <Card title="Отказы по месяцам" style={{ flex: 1 }}>
            <PageSpin loading={stats.isLoading} error={stats.error}>
              {byMonth.length ? (
                <Column data={byMonth} xField="month" yField="count" height={420} autoFit />
              ) : (
                <Empty description="Нет отказов" />
              )}
            </PageSpin>
          </Card>
        </Col>
        <Col xs={24} md={12} style={{ display: 'flex' }}>
          <Card
            title="Топ-10 скважин по риску"
            style={{ flex: 1 }}
            extra={<a onClick={() => navigate('/ml-risk')}>все →</a>}
          >
            <PageSpin loading={mlWells.isLoading} error={mlWells.error}>
              {top10.length ? (
                <Table
                  rowKey="well_id"
                  columns={topColumns}
                  dataSource={top10}
                  size="small"
                  pagination={false}
                  onRow={(r) => ({ onClick: () => setExplainWell(r), style: { cursor: 'pointer' } })}
                />
              ) : (
                <Empty description="Скоринг пуст" />
              )}
            </PageSpin>
          </Card>
        </Col>
      </Row>

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
        {explainWell && <ExplainBars wellId={explainWell.well_id} />}
      </Modal>
    </div>
  );
}
