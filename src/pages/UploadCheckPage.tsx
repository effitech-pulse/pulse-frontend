import { Alert, Card, Col, Row, Statistic, Tag, Tooltip, Typography, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { apiClient, toApiError } from '@/api/client';
import type { MlContribution } from '@/api/ml';

interface UploadResult {
  filename: string;
  verdict: 'alert' | 'watch' | 'norm' | 'insufficient';
  /** окон, в которых установка работала хотя бы половину времени */
  windows_running?: number;
  n_windows: number;
  span_days: number;
  channels_used: number;
  /** сколько признаков модели не вычислимо из файла (заполнены медианами обучения) */
  features_total?: number;
  features_unavailable?: number;
  windows_above_watch: number;
  windows_above_alert: number;
  latest_risk: number;
  peak_risk: number;
  peak_window_end: string;
  timeline: { window_end: string; risk: number }[];
  contributions: MlContribution[];
}

const VERDICT_UI = {
  alert: { color: '#d64545', label: 'ТРЕВОГА — по оценке модели',
    hint: 'Модель выдала тревогу по выбранному периоду. Требуется заключение технолога.' },
  watch: { color: '#c98a1f', label: 'НАБЛЮДЕНИЕ — есть признаки риска',
    hint: 'Выполнено условие наблюдения по расчётным окнам. Стоит проверить параметры скважины.' },
  norm: { color: '#2e9e6b', label: 'НОРМА — по оценке модели',
    hint: 'Условие наблюдения модели за выбранный период не выполнено.' },
  insufficient: { color: '#8c8c8c', label: 'ДАННЫХ НЕДОСТАТОЧНО — оценка невозможна',
    hint: 'Недостаточно окон работы установки для оценки. Проверьте длительность периода, наличие каналов и интервалы простоя.' },
} as const;

export function UploadCheckPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const doUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await apiClient.post<UploadResult>('/api/v1/ml/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data);
    } catch (e) {
      setResult(null);
      setError(toApiError(e).message);
    } finally {
      setLoading(false);
    }
    return false;
  };

  // Демо-режим для скриншотов: /upload-check?demo — автозагрузка образца
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('demo')) {
      void fetch('/sample_fail.xlsx')
        .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
        .then((b) => doUpload(new File([b], 'скважина_Б_отказ_соль.xlsx')))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const v = result ? VERDICT_UI[result.verdict] : null;
  const maxAbs = result
    ? Math.max(...result.contributions.map((c) => Math.abs(c.shap)), 1e-9)
    : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Проверка файла телеметрии — будет ли отказ">
        <Upload.Dragger
          accept=".csv,.xlsx,.xls"
          multiple={false}
          showUploadList={false}
          disabled={loading}
          beforeUpload={(f) => {
            void doUpload(f as unknown as File);
            return false;
          }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">
            {loading ? 'Анализируем файл...' : 'Перетащите файл или нажмите для выбора'}
          </p>
          <p className="ant-upload-hint">
            CSV или XLSX, до 50 МБ, не меньше месяца данных (лучше два). Колонка времени <code>ts</code> +
            каналы телеметрии (канонические имена F_out, Pump_intake_pressure_kgs... или русские
            названия из выгрузки IRZ). Образцы: data/samples/.
          </p>
        </Upload.Dragger>
        {error && <Alert style={{ marginTop: 12 }} type="error" showIcon message={error} />}
      </Card>

      {result && v && (
        <>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Tag color={v.color} style={{ fontSize: 16, padding: '6px 14px' }}>
                {v.label}
              </Tag>
              <Typography.Text type="secondary">
                {result.filename} · {result.span_days} суток · {result.n_windows} окон ·{' '}
                {result.channels_used} исходных признаков распознано
                {result.features_total ? (
                  <>
                    {' · '}
                    <Tooltip
                      title={
                        'Часть признаков модели требует данных, которых в одном файле нет: ' +
                        'соседи по кусту, статистика месторождения, счётчики защитных ' +
                        'остановок. Пропуски заполняются медианами обучения или резервными нулями. ' +
                        'Источник каждого значения указан в объяснении.'
                      }
                    >
                      <span style={{ borderBottom: '1px dashed #bfbfbf', cursor: 'help' }}>
                        признаков доступно {result.features_total - (result.features_unavailable ?? 0)} из{' '}
                        {result.features_total}
                      </span>
                    </Tooltip>
                  </>
                ) : null}
              </Typography.Text>
            </div>
            <div style={{ color: '#8c8c8c', marginTop: 8 }}>{v.hint}</div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
              Оценка зависит от полноты переданных данных. Заполненные значения признаков отмечены в объяснении.
            </div>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col xs={12} md={6}>
                <Statistic
                  title="Пиковый риск"
                  value={(result.peak_risk * 100).toFixed(1)}
                  suffix="%"
                  valueStyle={{ color: v.color }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Риск в конце периода"
                  value={(result.latest_risk * 100).toFixed(1)}
                  suffix="%"
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Окон «наблюдение»" value={result.windows_above_watch} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Окон «тревога»"
                  value={result.windows_above_alert}
                  valueStyle={result.windows_above_alert ? { color: '#d64545' } : undefined}
                />
              </Col>
            </Row>
          </Card>

          <Row gutter={16} align="stretch">
            <Col xs={24} md={14} style={{ display: 'flex' }}>
              <Card title="Риск во времени (по окнам 48 ч)" style={{ flex: 1 }}>
                <Line
                  data={result.timeline.map((t) => ({
                    date: dayjs(t.window_end).format('DD.MM HH:mm'),
                    risk: +(t.risk * 100).toFixed(1),
                  }))}
                  xField="date"
                  yField="risk"
                  height={280}
                  autoFit
                  axis={{ y: { title: 'риск, %' } }}
                />
              </Card>
            </Col>
            <Col xs={24} md={10} style={{ display: 'flex' }}>
              <Card
                title={`Почему (вклады признаков, пиковое окно ${dayjs(result.peak_window_end).format('DD.MM')})`}
                style={{ flex: 1 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.contributions.map((c) => {
                    const up = c.shap >= 0;
                    return (
                      <Tooltip
                        key={c.feature}
                        title={`${c.feature} = ${c.value.toFixed(3)} · вклад ${up ? '+' : ''}${c.shap.toFixed(3)}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 210, fontSize: 13, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {c.label}{c.value_source && c.value_source !== 'computed' ? ' · заполнено' : ''}
                          </span>
                          <div style={{ flex: 1, background: '#f0f2f5', borderRadius: 4, height: 10 }}>
                            <div style={{
                              width: `${(Math.abs(c.shap) / maxAbs) * 100}%`, height: '100%',
                              borderRadius: 4, background: up ? '#d64545' : '#2e9e6b' }} />
                          </div>
                        </div>
                      </Tooltip>
                    );
                  })}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Красное толкает риск вверх, зелёное — вниз (TreeSHAP).
                  </Typography.Text>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
