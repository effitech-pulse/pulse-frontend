import { Card, Col, Descriptions, Empty, Progress, Row, Table, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import { Line } from '@ant-design/charts';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDepartments, useWell, useWellComplications } from '@/hooks/useWells';
import { wellsApi } from '@/api/wells';
import { useQuery } from '@tanstack/react-query';
import { PageSpin } from '@/components/common/PageSpin';
import { StatusTag } from '@/components/common/StatusTag';
import { IncidentsTab } from '@/components/wells/IncidentsTab';
import { mlApi } from '@/api/ml';
import { ExplainBars } from '@/components/ml/ExplainBars';

export function WellDetailPage() {
  const { wellId: wellIdParam } = useParams();
  const wellId = Number(wellIdParam);

  const well = useWell(wellId);
  const complications = useWellComplications(wellId);
  const classification = useQuery({
    queryKey: ['well', wellId, 'classification'],
    queryFn: () => wellsApi.classification(wellId),
    enabled: wellId > 0,
  });

  const mlRisk = useQuery({
    queryKey: ['ml-by-unitek', well.data?.unitek_id],
    queryFn: () => mlApi.byUnitek(well.data!.unitek_id),
    enabled: !!well.data?.unitek_id,
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
    queryKey: ['ml-history', wellId],
    queryFn: () => mlApi.history(wellId),
    enabled: wellId > 0,
    retry: false,
  });
  const riskPoints = useMemo(
    () =>
      (riskHistory.data?.points ?? []).map((p) => ({
        date: dayjs(p.window_end).format('DD.MM.YY'),
        risk: p.risk,
      })),
    [riskHistory.data],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card
        title={`Скважина #${wellId}`}
      >
        <PageSpin loading={well.isLoading} error={well.error}>
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
            {/* номер скважины и заводские идентификаторы — данные заказчика:
                в стелс-режиме (?blur) они размываются вместе с НГДУ, иначе
                попадают на скриншоты во внешних материалах */}
            <Descriptions.Item label="№ скважины">
              <span className="sensitive">{well.data?.well_number ?? '—'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Unitek ID">
              <span className="sensitive">{well.data?.unitek_id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Armits ID">
              <span className="sensitive">{well.data?.armits_id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="НГДУ"><span className="sensitive">{well.data?.ngdu}</span></Descriptions.Item>
            <Descriptions.Item label="Цех">{deptLabel(well.data?.department)}</Descriptions.Item>
            <Descriptions.Item label="Активна">
              <StatusTag status={well.data?.active ? 'ok' : 'no_data'} />
            </Descriptions.Item>
            <Descriptions.Item label="Классификация осложнений">
              {classification.data?.classification ?? '—'}
            </Descriptions.Item>
          </Descriptions>
        </PageSpin>
      </Card>

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: 'Обзор',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card title="Риск отказа (ML · stage1_binary_v1)">
                  {mlRisk.isError || !mlRisk.data ? (
                    <span style={{ color: '#8c8c8c' }}>
                      Скважина не найдена в ML-скоринге (нет телеметрии в кэше признаков).
                    </span>
                  ) : (
                    <Row gutter={24} align="middle">
                      <Col xs={24} md={7}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Tag
                            color={mlRisk.data.alert ? '#d64545' : '#2e9e6b'}
                            style={{ fontSize: 16, padding: '4px 10px' }}
                          >
                            {(mlRisk.data.risk * 100).toFixed(1)}%
                          </Tag>
                          <Progress
                            percent={mlRisk.data.risk * 100}
                            showInfo={false}
                            strokeColor={mlRisk.data.alert ? '#d64545' : '#2e9e6b'}
                            style={{ width: 120, margin: 0 }}
                          />
                        </div>
                        <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 6 }}>
                          {mlRisk.data.alert ? 'тревога' : 'норма'} · окно от{' '}
                          {mlRisk.data.window_end
                            ? dayjs(mlRisk.data.window_end).format('DD.MM.YYYY')
                            : '—'}
                        </div>
                      </Col>
                      <Col xs={24} md={17}>
                        <ExplainBars wellId={mlRisk.data.well_id} topN={5} />
                      </Col>
                    </Row>
                  )}
                </Card>
                <Card
                  title="Риск по окнам наблюдения"
                  extra={
                    riskHistory.data ? (
                      <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                        сработало {riskHistory.data.windows_fired} окон из{' '}
                        {riskHistory.data.windows_total} · порог наблюдения{' '}
                        {(riskHistory.data.threshold * 100).toFixed(0)}%, тревоги{' '}
                        {(riskHistory.data.high_threshold * 100).toFixed(0)}%
                      </span>
                    ) : null
                  }
                >
                  {/* Основание яруса в явном виде: ярус ставится по числу окон,
                      где риск превысил порог, — здесь видно, какие именно это
                      окна и как риск набирался */}
                  <PageSpin loading={riskHistory.isLoading} error={riskHistory.error}>
                    {/* график строится только с данными: пустой набор роняет
                        G2 ошибкой «Missing encode for x or y channel» и оставляет
                        пустую карточку вместо понятного сообщения */}
                    {riskPoints.length > 0 ? (
                      <Line data={riskPoints} xField="date" yField="risk" height={280} autoFit />
                    ) : (
                      <Empty description="Скважина ещё не проходила скоринг" />
                    )}
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
                        />
                      </PageSpin>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          { key: 'failures', label: 'Отказы', children: <IncidentsTab wellId={wellId} /> },
        ]}
      />
    </div>
  );
}
