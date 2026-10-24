import {LocalEntityTable} from '@/components/common/LocalEntityTable';
import { Alert, Card, Col, Descriptions, Empty, Row, Tabs } from 'antd';
import dayjs from 'dayjs';
import { RiskHistoryChart } from '@/components/ml/RiskHistoryChart';
import { useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDepartments, useWell, useWellComplications } from '@/hooks/useWells';
import { wellsApi } from '@/api/wells';
import { useQuery } from '@tanstack/react-query';
import { PageSpin } from '@/components/common/PageSpin';
import { formatSnapshotTime } from '@/lib/displayTime';
import { IncidentsTab } from '@/components/wells/IncidentsTab';
import { mlRiskRow, mlHistory, cohortStatusLabel } from '@/lib/mlSnapshot';
import { mlApi } from '@/api/ml';
import { ExplainBars } from '@/components/ml/ExplainBars';
import { ManualChecks } from '@/components/telemetry/ManualChecks';
import {WellHistoryPanel} from '@/components/wells/WellHistoryPanel';
import {useAuth} from '@/auth/AuthProvider';
import {validPulseId} from '@/lib/fileJobs';
import { TelemetryWorkspace } from '@/components/telemetry/TelemetryWorkspace';

export function WellDetailPage() {
  const { wellId: wellIdParam } = useParams();
  const exactWellId=wellIdParam&&validPulseId(wellIdParam)?wellIdParam:'';
  const wellId=exactWellId?(BigInt(exactWellId)<=BigInt(Number.MAX_SAFE_INTEGER)?Number(exactWellId):exactWellId):0;
  const [search] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTab = search.get('tab');
  const activeTab = ['telemetry', 'checks', 'failures', 'history', 'details'].includes(requestedTab ?? '') ? requestedTab! : 'overview';

  const selectedRun=Number(search.get('run_id')) || undefined;
  const well = useWell(wellId);
  const {can}=useAuth();
  const complications = useWellComplications(wellId);
  const classification = useQuery({
    queryKey: ['well', wellId, 'classification'],
    queryFn: () => wellsApi.classification(wellId),
    enabled: can('risks.read') && Number(wellId) > 0,
  });

  const mlRisk = useQuery({
    queryKey: ['well-risk', wellId, selectedRun],
    queryFn: () => mlApi.byAppWell(wellId, selectedRun),
    enabled: can('risks.read') && Number(wellId) > 0,
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
    enabled: can('risks.read') && Number(wellId) > 0 && !!mlRisk.data && !('status' in mlRisk.data),
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
    <div className="pulse-well-page pulse-stack">
      {well.data?.archived_at&&<Alert type="warning" showIcon message="Скважина в архиве" description={`Скрыта из оперативного фонда с ${new Date(well.data.archived_at).toLocaleString('ru',{timeZone:'Europe/Moscow'})} МСК. Телеметрия, проверки и заключения доступны. Для изменения карточки сначала восстановите скважину.`} />}
      <Card className="pulse-well-heading">
        <div className="pulse-toolbar">
          <div><h1>Скважина · ID Pulse {exactWellId}</h1>
            <PageSpin loading={well.isLoading} error={well.error}>
              <p>№ скважины <span className="sensitive">{well.data?.well_number ?? '—'}</span><span aria-hidden="true"> · </span>НГДУ <span className="sensitive">{well.data?.ngdu ?? '—'}</span><span aria-hidden="true"> · </span>{well.data ? (well.data.active ? 'Активна' : 'Неактивна') : 'Статус не передан'}</p>
            </PageSpin>
          </div>
          {can('integrations.read') && !!well.data && !well.data.archived_at && <Link to={`/integrations?tab=wells&well=${wellId}`}>Связи с источниками</Link>}
        </div>
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
            disabled:!can('risks.read'),
            label: 'Риски',
            children: (
              <div className="pulse-stack pulse-risk-panels">
                <Card className="pulse-risk-card"><h2>{`Риск отказа (ML · ${risk?.model_name ?? 'сохранённый результат'})`}</h2>
                  {risk?.snapshot_id && <p className="pulse-result-meta" title={risk.as_of ?? undefined}>Сохранённый расчёт № {risk.run_id ?? '—'} · данные по {risk.as_of ? formatSnapshotTime(risk.as_of) : 'неизвестной дате'}</p>}
                  <PageSpin loading={mlRisk.isLoading} error={mlRisk.error}>
                  {!risk || risk.risk === null ? (
                    <span style={{ color: 'var(--pulse-muted)' }}>
                      {risk ? `${cohortStatusLabel(risk)}${risk.reason_code ? ` · ${risk.reason_code}` : ''}` : 'Сохранённой оценки риска нет.'}
                    </span>
                  ) : (
                    <Row gutter={24} align="middle">
                      <Col xs={24} md={7}>
                        <div className="pulse-risk-value">
                          <strong>{(risk.risk * 100).toFixed(1)}%</strong>
                          <span>{cohortStatusLabel(risk)} · окно от {risk.window_end ? dayjs(risk.window_end).format('DD.MM.YYYY') : '—'}</span>
                        </div>
                      </Col>
                      <Col xs={24} md={17}>
                        <ExplainBars wellId={risk.well_id} topN={5} contributions={risk.contributions} windowKind={risk.explanation_window_kind} windowEnd={risk.explanation_window_end} />
                      </Col>
                    </Row>
                  )}
                  {risk?.snapshot_id && <p className="pulse-result-provenance">{risk.provenance_status === 'historical_unknown' ? 'Происхождение исторического результата неизвестно.' : 'Происхождение результата подтверждено частично.'}</p>}
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
          { key: 'telemetry', disabled:!can('telemetry.read'), label: 'Телеметрия', children: can('telemetry.read') && well.data ? <TelemetryWorkspace key={wellId} wellId={String(wellId)} /> : <PageSpin loading={well.isLoading} error={well.error}><span /></PageSpin> },
          { key: 'checks', disabled:!can('checks.read')&&!can('filechecks.read'), label: 'Проверки', children: <ManualChecks key={exactWellId} wellId={exactWellId} periodEnabled={Number(wellId)>0} /> },
          { key: 'failures', disabled:!can('incidents.read'), label: 'Отказы', children: <IncidentsTab wellId={wellId} /> },
          { key: 'history', disabled:!can('wells.history.read'), label: 'История', children: <WellHistoryPanel wellId={wellId} /> },
          { key: 'details', label: 'Сведения', children: (
            <div className="pulse-stack">
              <Card title="Паспорт скважины">
                <PageSpin loading={well.isLoading} error={well.error}>
                  <Descriptions className="pulse-passport" size="small" column={1} colon={false}>
                    <Descriptions.Item label="ID Pulse">{exactWellId}</Descriptions.Item>
                    <Descriptions.Item label="№ скважины"><span className="sensitive">{well.data?.well_number ?? '—'}</span></Descriptions.Item>
                    <Descriptions.Item label="НГДУ"><span className="sensitive">{well.data?.ngdu}</span></Descriptions.Item>
                    <Descriptions.Item label="Цех">{deptLabel(well.data?.department)}</Descriptions.Item>
                    <Descriptions.Item label="Активна">
                      {well.data ? (well.data.active ? 'Да' : 'Нет') : '—'}
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
                      <LocalEntityTable tableKey={`complications-${wellId}`} fields={[
 {key:'code',label:'Код',kind:'text',read:r=>r.code},{key:'name',label:'Название',kind:'text',read:r=>r.name},{key:'category',label:'Категория',kind:'enum',read:r=>r.category}]} defaultSort={[{field:'code',direction:'asc'}]}
                        rowKey="id"
                        columns={[
                          { title: 'Код', dataIndex: 'code', key: 'code' },
                          { title: 'Название', dataIndex: 'name', key: 'name' },
                          { title: 'Категория', dataIndex: 'category', key: 'category' },
                        ]}
                        dataSource={complications.data ?? []}
                        size="small"
                        pagination={false}
                        locale={{ emptyText: <span className="pulse-muted">Нет данных</span> }}
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
