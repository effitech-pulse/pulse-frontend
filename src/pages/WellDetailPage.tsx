import { Alert, Card, Col, Descriptions, Empty, Progress, Row, Table, Tabs, Tag, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { RiskHistoryChart } from '@/components/ml/RiskHistoryChart';
import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDepartments, useWell, useWellComplications } from '@/hooks/useWells';
import { wellsApi } from '@/api/wells';
import { useQuery } from '@tanstack/react-query';
import { PageSpin } from '@/components/common/PageSpin';
import { StatusTag } from '@/components/common/StatusTag';
import { IncidentsTab } from '@/components/wells/IncidentsTab';
import { mlRiskRow, mlHistory, cohortStatusLabel } from '@/lib/mlSnapshot';
import { mlApi } from '@/api/ml';
import { ExplainBars } from '@/components/ml/ExplainBars';
import { useFund } from '@/theme/FundProvider';
import { ManualChecks } from '@/components/telemetry/ManualChecks';
import {WellHistoryPanel} from '@/components/wells/WellHistoryPanel';
import {useAuth} from '@/auth/AuthProvider';
import { TelemetryWorkspace } from '@/components/telemetry/TelemetryWorkspace';

export function WellDetailPage() {
  const { wellId: wellIdParam } = useParams();
  const wellId = Number(wellIdParam);
  const [search] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTab = search.get('tab');
  const activeTab = ['telemetry', 'checks', 'failures', 'history', 'details'].includes(requestedTab ?? '') ? requestedTab! : 'overview';

  const selectedRun=Number(search.get('run_id')) || undefined;
  const well = useWell(wellId);
  const {isAdmin}=useAuth();
  const {fund, setFund} = useFund();
  useEffect(() => { if (well.data && (well.data.fund_type ?? 'operational') !== fund) setFund(well.data.fund_type ?? 'operational'); }, [well.data, fund, setFund]);
  const complications = useWellComplications(wellId);
  const classification = useQuery({
    queryKey: ['well', wellId, 'classification'],
    queryFn: () => wellsApi.classification(wellId),
    enabled: wellId > 0,
  });

  const mlRisk = useQuery({
    queryKey: ['well-risk', wellId, selectedRun],
    queryFn: () => mlApi.byAppWell(wellId, selectedRun),
    enabled: wellId > 0,
    retry: false,
  });
  const departments = useDepartments();

  const deptLabel = (code: number | undefined): string => {
    if (code === undefined) return '—';
    const name = departments.data?.find((d) => d.id === code)?.name;
    return name ? `${name} (${code})` : String(code);
  };

  // История риска по окнам: ML-стек проекта считает риск для каждого окна,
  // и именно по числу сработавших окон ставится ярус скважины
  const riskHistory = useQuery({
    queryKey: ['ml-history', wellId, selectedRun],
    queryFn: () => mlApi.appHistory(wellId, 400, selectedRun),
    enabled: wellId > 0 && !!mlRisk.data && !('status' in mlRisk.data),
    retry: false,
  });
  const risk = mlRisk.data ? mlRiskRow(mlRisk.data) : null;
  // Cohort timeline and contributions come from the same immutable result as risk.
  const history = mlHistory(mlRisk.data && 'status' in mlRisk.data ? mlRisk.data : riskHistory.data);
  const riskPoints = useMemo(
    () =>
      (history?.points ?? []).map((p) => ({
        date: dayjs(p.window_end).format('DD.MM.YY'),
        risk: p.risk,
      })),
    [history],
  );

  return (
    <div className="pulse-well-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {well.data?.fund_type === 'presentation' && <Alert type="info" showIcon message="Показательный фонд" description="Синтетические обезличенные скважины. Реальная телеметрия не раскрывается в связи с NDA." />}
      {well.data?.archived_at&&<Alert type="warning" showIcon message="Скважина в архиве" description={`Скрыта из оперативного фонда с ${new Date(well.data.archived_at).toLocaleString('ru',{timeZone:'Europe/Moscow'})} МСК. Телеметрия, проверки и заключения доступны. Для изменения карточки сначала восстановите скважину.`} />}
      <Card
        title={`Скважина · ID Pulse ${wellId}`}
        extra={isAdmin && !well.data?.archived_at && <Link to={`/integrations?tab=wells&well=${wellId}`}>Связи с источниками</Link>}
      >
        <PageSpin loading={well.isLoading} error={well.error}>
          <Space wrap>
            <Typography.Text type="secondary">№ скважины <span className="sensitive">{well.data?.well_number ?? '—'}</span></Typography.Text>
            <Typography.Text type="secondary">НГДУ <span className="sensitive">{well.data?.ngdu ?? '—'}</span></Typography.Text>
            <StatusTag status={well.data?.active ? 'ok' : 'no_data'} />
          </Space>
        </PageSpin>
      </Card>

      <Tabs
        activeKey={activeTab}
        destroyInactiveTabPane={false}
        onChange={tab => {
          const next = new URLSearchParams(search);
          next.set('tab', tab);
          navigate({ pathname: location.pathname, search: next.toString(), hash: location.hash });
        }}
        items={[
          {
            key: 'overview',
            label: 'Риски',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card title={`Риск отказа (ML · ${risk?.model_name ?? 'сохранённый результат'})`}>
                  <PageSpin loading={mlRisk.isLoading} error={mlRisk.error}>
                  {!risk || risk.risk === null ? (
                    <span style={{ color: 'var(--pulse-muted)' }}>
                      {risk ? `${cohortStatusLabel(risk)}${risk.reason_code ? ` · ${risk.reason_code}` : ''}` : 'Сохранённой оценки риска нет.'}
                    </span>
                  ) : (
                    <Row gutter={24} align="middle">
                      <Col xs={24} md={7}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Tag
                            color={risk.tier === 'alert' ? '#d64545' : risk.tier === 'watch' ? '#c98a1f' : '#2e9e6b'}
                            style={{ fontSize: 16, padding: '4px 10px' }}
                          >
                            {(risk.risk * 100).toFixed(1)}%
                          </Tag>
                          <Progress
                            percent={risk.risk * 100}
                            showInfo={false}
                            strokeColor={risk.tier === 'alert' ? '#d64545' : risk.tier === 'watch' ? '#c98a1f' : '#2e9e6b'}
                            style={{ width: 120, margin: 0 }}
                          />
                        </div>
                        <div style={{ color: 'var(--pulse-muted)', fontSize: 12, marginTop: 6 }}>
                          {cohortStatusLabel(risk)} · окно от{' '}
                          {risk.window_end
                            ? dayjs(risk.window_end).format('DD.MM.YYYY')
                            : '—'}
                        </div>
                      </Col>
                      <Col xs={24} md={17}>
                        <ExplainBars wellId={risk.well_id} topN={5} contributions={risk.contributions} windowKind={risk.explanation_window_kind} windowEnd={risk.explanation_window_end} />
                      </Col>
                    </Row>
                  )}
                  {risk?.snapshot_id && <p>Сохранённый расчёт № {risk.run_id ?? '—'} · данные по {risk.as_of ?? 'неизвестной дате'}. {risk.provenance_status === 'historical_unknown' ? 'Происхождение исторического результата неизвестно.' : 'Происхождение результата подтверждено частично.'}</p>}
                  </PageSpin>
                </Card>
                <Card
                  title="Риск по окнам наблюдения"
                  extra={
                    history ? (
                      <span style={{ color: 'var(--pulse-muted)', fontSize: 12 }}>
                        сработало {history.windows_fired} окон из{' '}
                        {history.windows_total}
                        {history.threshold !== null ? ` · порог наблюдения ${(history.threshold * 100).toFixed(0)}%` : ' · порог решения не представлен в шкале риска'}
                        {history.high_threshold !== null ? ` · тревоги ${(history.high_threshold * 100).toFixed(0)}%` : ''}
                      </span>
                    ) : null
                  }
                >
                  {/* Основание яруса в явном виде: ярус ставится по числу окон,
                      где риск превысил порог, — здесь видно, какие именно это
                      окна и как риск набирался */}
                  <PageSpin loading={mlRisk.isLoading || riskHistory.isLoading} error={mlRisk.error || riskHistory.error}>
                    {/* график строится только с данными: пустой набор роняет
                        G2 ошибкой «Missing encode for x or y channel» и оставляет
                        пустую карточку вместо понятного сообщения */}
                    {riskPoints.length > 0 ? (
                      <RiskHistoryChart data={riskPoints} />
                    ) : (
                      <Empty description={risk?.risk === null ? cohortStatusLabel(risk) : 'История риска отсутствует'} />
                    )}
                  </PageSpin>
                </Card>
              </div>
            ),
          },
          { key: 'telemetry', label: 'Телеметрия', children: well.data ? <TelemetryWorkspace key={wellId} wellId={String(wellId)} /> : <PageSpin loading={well.isLoading} error={well.error}><span /></PageSpin> },
          { key: 'checks', label: 'Проверки', children: <ManualChecks key={wellId} wellId={String(wellId)} /> },
          { key: 'failures', label: 'Отказы', children: <IncidentsTab wellId={wellId} /> },
          { key: 'history', label: 'История', children: <WellHistoryPanel wellId={wellId} /> },
          { key: 'details', label: 'Сведения', children: (
            <div className="pulse-stack">
              <Card title="Паспорт скважины">
                <PageSpin loading={well.isLoading} error={well.error}>
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                    <Descriptions.Item label="ID Pulse">{wellId}</Descriptions.Item>
                    <Descriptions.Item label="№ скважины"><span className="sensitive">{well.data?.well_number ?? '—'}</span></Descriptions.Item>
                    <Descriptions.Item label="НГДУ"><span className="sensitive">{well.data?.ngdu}</span></Descriptions.Item>
                    <Descriptions.Item label="Цех">{deptLabel(well.data?.department)}</Descriptions.Item>
                    <Descriptions.Item label="Активна">
                      <StatusTag status={well.data?.active ? 'ok' : 'no_data'} />
                    </Descriptions.Item>
                    <Descriptions.Item label="Ответственный">{well.data?.responsible??'Не назначен'}</Descriptions.Item>
                    <Descriptions.Item label="Версия карточки">{well.data?.revision??'—'}</Descriptions.Item>
                    <Descriptions.Item label="Классификация осложнений">
                      <PageSpin loading={classification.isLoading} error={classification.error}>{classification.data?.classification ?? '—'}</PageSpin>
                    </Descriptions.Item>
                  </Descriptions>
                </PageSpin>
              </Card>
              <Row gutter={16}>
                <Col xs={24}>
                  <Card title="Осложнения">
                    <PageSpin loading={complications.isLoading} error={complications.error}>
                      <Table
                        rowKey="id"
                        columns={[
                          { title: 'Код', dataIndex: 'code', key: 'code' },
                          { title: 'Название', dataIndex: 'name', key: 'name' },
                          { title: 'Категория', dataIndex: 'category', key: 'category' },
                        ]}
                        dataSource={complications.data ?? []}
                        size="small"
                        pagination={false}
                        scroll={{ x: 560 }}
                      />
                    </PageSpin>
                  </Card>
                </Col>
              </Row>
            </div>
          ) },
        ]}
      />
    </div>
  );
}
