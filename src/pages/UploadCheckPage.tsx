import { Alert, Button, Card, Spin, Typography, Upload } from 'antd';
import { useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { apiClient, toApiError } from '@/api/client';
import type { MlContribution } from '@/api/ml';
import { RiskHistoryChart } from '@/components/ml/RiskHistoryChart';
import { ExplainBars } from '@/components/ml/ExplainBars';
import { formatSnapshotTime } from '@/lib/displayTime';
import {useFileCapabilities} from '@/hooks/useFileJobs';
import {FileJobUpload} from '@/components/telemetry/FileJobUpload';

export interface UploadResult {
  filename: string;
  verdict: 'alert' | 'watch' | 'norm' | 'insufficient';
  windows_running?: number;
  n_windows: number;
  span_days: number;
  channels_used: number;
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
const VERDICTS = {
  alert: { label: 'Тревога', className: 'pulse-status-alert', hint: 'Модель выдала тревогу по выбранному периоду. Требуется заключение технолога.' },
  watch: { label: 'Наблюдение', className: 'pulse-status-watch', hint: 'Есть изменение режима — проверьте динамику.' },
  norm: { label: 'Норма', className: 'pulse-monitoring-status-normal', hint: 'Условие наблюдения модели за выбранный период не выполнено.' },
  insufficient: { label: 'Данных недостаточно', className: 'pulse-monitoring-status-unknown', hint: 'Недостаточно рабочих окон для оценки. Проверьте историю, каналы и интервалы простоя.' },
} as const;

/** Разовый серверный результат: недостаточность данных не становится нулевым риском. */
export function FileCheckResult({ result }: { result: UploadResult }) {
  const verdict = VERDICTS[result.verdict];
  const scored = result.verdict !== 'insufficient';
  const available = result.features_total !== undefined && result.features_unavailable !== undefined ? result.features_total - result.features_unavailable : null;
  return <div className="pulse-stack pulse-monitoring-file-result">
    <Card className="pulse-monitoring-result-card">
      <div className="pulse-monitoring-verdict"><span className={`pulse-status ${verdict.className}`}>{verdict.label}</span><strong>{verdict.hint}</strong></div>
      <p className="pulse-monitoring-caption">{result.filename} · Данные за {result.span_days} суток · {result.channels_used} исходных каналов распознано</p>
      <div className="pulse-monitoring-result-metrics">
        <div><span>История</span><strong>{result.span_days} дней</strong></div>
        <div><span>Рабочие окна</span><strong>{result.windows_running ?? '—'} из {result.n_windows}</strong></div>
        <div><span>Доступные признаки</span><strong>{available === null ? '—' : `${available} из ${result.features_total}`}</strong></div>
      </div>
      <div className="pulse-monitoring-result-limit"><h2>Ограничения оценки</h2><p>Часть признаков недоступна без метаданных фонда. Результат по файлу требует проверки технологом.</p><p className="pulse-monitoring-caption">Заполненные признаки отмечены в объяснении. При недостаточной истории работы показывается «Данных недостаточно».</p></div>
    </Card>
    {scored && <>
      <Card className="pulse-monitoring-result-card"><div className="pulse-monitoring-risk-metrics">
        <div><span>Пиковый риск</span><strong>{(result.peak_risk*100).toFixed(1)}%</strong></div>
        <div><span>Риск в конце периода</span><strong>{(result.latest_risk*100).toFixed(1)}%</strong></div>
        <div><span>Окон «наблюдение»</span><strong>{result.windows_above_watch}</strong></div>
        <div><span>Окон «тревога»</span><strong>{result.windows_above_alert}</strong></div>
      </div></Card>
      <Card className="pulse-monitoring-result-card"><h2>Риск по окнам наблюдения</h2>{result.timeline.length ? <RiskHistoryChart data={result.timeline.map(point=>({date:formatSnapshotTime(point.window_end),risk:point.risk}))} /> : <p className="pulse-monitoring-caption">История риска не передана.</p>}</Card>
      <Card className="pulse-monitoring-result-card"><h2>Почему — вклады признаков</h2><ExplainBars wellId={null} topN={result.contributions.length} contributions={result.contributions} windowKind={result.peak_window_end ? 'peak' : 'unknown'} windowEnd={result.peak_window_end || null} /></Card>
    </>}
    <Card className="pulse-monitoring-note"><h2>Разовая проверка</h2><p>Результат доступен только в текущем сеансе. Сохранённые проверки находятся в карточке скважины.</p></Card>
  </div>;
}

export function UploadCheckPage(){
  const capability=useFileCapabilities();
  const {privateBlocked}=useAuth();
  const durableOpened=useRef(false);
  if(capability.enabled)durableOpened.current=true;
  if(privateBlocked)return <Alert type="warning" message="Проверка недоступна"/>;
  if(durableOpened.current)return <FileJobUpload available={capability.enabled}/>;
  if(capability.isLoading)return <Spin/>;
  return <LegacyUploadCheckPage/>;
}

function LegacyUploadCheckPage() {
  const { can, capturePrivate } = useAuth();
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<{message:string;http_request_id?:string}|null>(null);
  const [result,setResult] = useState<UploadResult|null>(null);
  const uploading = useRef(false);
  const beforeUpload = (file: File) => {
    if (!can('filechecks.legacy.run') || uploading.current) return false;
    if (file.size > 50*1024*1024) {setError({message:'Размер файла превышает 50 МБ. Выберите меньший архив.'});setResult(null);return false;}
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {setError({message:'Выберите файл CSV, XLSX или XLS.'});setResult(null);return false;}
    const ticket=capturePrivate();
    uploading.current=true;setLoading(true);setError(null);setResult(null);
    const data=new FormData();data.append('file',file);
    void apiClient.post<UploadResult>('/api/v1/ml/upload',data,{headers:{'Content-Type':'multipart/form-data'}})
      .then(response=>{if(ticket.current())setResult(response.data);})
      .catch(problem=>{if(ticket.current())setError(toApiError(problem));})
      .finally(()=>{uploading.current=false;if(ticket.current())setLoading(false);});
    return false;
  };
  const uploadProps={accept:'.csv,.xlsx,.xls',multiple:false,showUploadList:false,disabled:loading||!can('filechecks.legacy.run'),beforeUpload};
  return <div className="pulse-stack pulse-monitoring-page pulse-monitoring-file">
    <div className="pulse-page-heading pulse-toolbar"><div><h1>Проверка телеметрии</h1><p>Загрузите архив скважины и получите оценку доступных данных</p></div><Upload {...uploadProps}><Button type="primary" disabled={loading||!can('filechecks.legacy.run')}>Выбрать файл</Button></Upload></div>
    <div className="pulse-monitoring-upload-grid">
      <Card className="pulse-monitoring-upload-card"><h2>Архив телеметрии</h2><Upload.Dragger {...uploadProps}>
        <div className="pulse-monitoring-drop-content"><strong>{loading ? 'Файл обрабатывается' : 'Перетащите файл сюда'}</strong><p>{loading ? 'Дождитесь ответа модели' : 'или выберите файл на компьютере'}</p><span className="pulse-monitoring-file-choice">Выбрать файл</span></div>
      </Upload.Dragger><p className="pulse-monitoring-caption">XLSX, XLS или CSV · до 50 МБ · одна скважина</p></Card>
      <Card className="pulse-monitoring-requirements"><h2>Что нужно для оценки</h2><p>Колонка времени и каналы телеметрии</p><p>От 30 дней истории; желательно 60</p><p className="pulse-monitoring-caption">Нули при простое сохраняются. Маркеры неисправности датчиков очищаются.</p><p className="pulse-monitoring-caption">Контекст соседних скважин может отсутствовать.</p><p className="pulse-monitoring-caption">Результат разовой проверки не сохраняется автоматически.</p></Card>
    </div>
    {!can('filechecks.legacy.run') && <Alert type="info" message="Для проверки файла нужны дополнительные права" />}
    {loading && <div className="pulse-monitoring-loading" role="status"><Spin /><Typography.Text>Файл обрабатывается. Процент выполнения недоступен.</Typography.Text></div>}
    {error && <div role="alert"><Alert type="error" showIcon message={error.message} description="Проверьте файл и повторите загрузку." />{error.http_request_id && <p className="pulse-error-reference">Код обращения: {error.http_request_id}</p>}</div>}
    {result && <FileCheckResult result={result} />}
  </div>;
}
