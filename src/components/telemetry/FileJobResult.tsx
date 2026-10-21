import {Alert,Card,Descriptions,Table,Typography} from 'antd';
import type {FileSavedCheck,Int64,FileThresholdRule} from '@/api/fileJobs';
import {ReviewPanel} from './ReviewPanel';
import {fileJobPath} from '@/api/fileJobs';
const shown=(value:Int64|null|undefined)=>value===null||value===undefined?'Не передано':String(value);
const risk=(value:number|null|undefined)=>value===null||value===undefined?'Не передан':`${(value*100).toFixed(1)}%`;
const threshold=(rule:FileThresholdRule|null|undefined)=>rule?`${rule.scale} ${rule.comparison} ${rule.threshold}; окон: ${shown(rule.k_windows)}; история: ${shown(rule.lookback_days)} суток`:'Не передано';
const verdicts={norm:'Норма',watch:'Наблюдение',alert:'Тревога',insufficient:'Данных недостаточно'};
/** Проекция сохранённого ответа: ноль, false и null не подменяются. */
export function SavedFileCheckResult({check}:{check:FileSavedCheck}){
 const r=check.result;
 return <div className="pulse-stack pulse-monitoring-file-result">
  <Card className="pulse-monitoring-result-card" title={verdicts[r.verdict]}>
   {r.verdict==='insufficient'?<Alert type="warning" message="Недостаточно рабочих окон для оценки. Это не норма."/>:<p>Результат модели требует заключения технолога.</p>}
   <Descriptions column={1} size="small" bordered>
    <Descriptions.Item label="ID Pulse">{check.well_id}</Descriptions.Item><Descriptions.Item label="Период">{check.start} — {check.end}</Descriptions.Item>
    {r.filename&&<Descriptions.Item label="Файл">{r.filename}</Descriptions.Item>}
    <Descriptions.Item label="Модель">{r.model_name??'Не передана'}</Descriptions.Item><Descriptions.Item label="Версия модели">{r.model_version??'Не передана'}</Descriptions.Item>
    <Descriptions.Item label="Точки">{shown(check.points_count)}</Descriptions.Item><Descriptions.Item label="Рабочие окна">{shown(r.windows_running)} из {shown(r.n_windows)}</Descriptions.Item>
    <Descriptions.Item label="Признаки">Всего: {shown(r.features_total)} · недоступно: {shown(r.features_unavailable)}</Descriptions.Item>
    <Descriptions.Item label="Правило наблюдения">{threshold(r.decision_rule?.watch)}</Descriptions.Item>
    <Descriptions.Item label="Правило тревоги">{r.decision_rule?.high_enabled===false?'Отключено':threshold(r.decision_rule?.high)}</Descriptions.Item>
    <Descriptions.Item label="Происхождение">{r.provenance?.provenance_status??'Не передано'} · {r.provenance?.context_completeness??'Полнота контекста не передана'}</Descriptions.Item>
    <Descriptions.Item label="Отпечаток входа"><Typography.Text style={{overflowWrap:'anywhere'}}>{check.input_sha256}</Typography.Text></Descriptions.Item>
   </Descriptions>
  </Card>
  {r.verdict!=='insufficient'&&<>
   <Card className="pulse-monitoring-result-card"><p>Пиковый риск: {risk(r.peak_risk)} · риск в конце периода: {risk(r.latest_risk)}</p><p>Окон «наблюдение»: {shown(r.windows_above_watch)} · окон «тревога»: {shown(r.windows_above_alert)}</p></Card>
   <Card title="Сохранённая динамика риска"><Table rowKey="window_end" size="small" scroll={{x:620}} pagination={{pageSize:25}} dataSource={r.timeline??[]} locale={{emptyText:'История риска не передана'}} columns={[
    {title:'Окно',dataIndex:'window_end'},{title:'Риск',dataIndex:'risk',render:risk},{title:'Исходная оценка',dataIndex:'raw_score',render:shown},
    {title:'Наблюдение',dataIndex:'watch_fired',render:v=>v==null?'Не передано':v?'Да':'Нет'},{title:'Тревога',dataIndex:'high_fired',render:v=>v==null?'Не передано':v?'Да':'Нет'},
   ]}/></Card>
   <Card title="Почему — вклады признаков"><Table rowKey="feature" size="small" scroll={{x:620}} pagination={false} dataSource={r.contributions??[]} locale={{emptyText:'Объяснение не передано'}} columns={[
    {title:'Признак',render:(_,c)=>c.label||c.feature},{title:'Источник',dataIndex:'value_source',render:v=>({computed:'Рассчитано по данным',training_median:'Медиана обучения',zero_fallback:'Заполнение нулём'}[v as string]??'Источник не передан')},
    {title:'Значение',dataIndex:'value',render:shown},{title:'Вклад SHAP',dataIndex:'shap',render:shown},
   ]}/></Card>
  </>}
  <Card className="pulse-monitoring-note"><h2>Сохранённая проверка файла</h2><p>Результат сохранён. Проверка не импортирует телеметрию в фонд и не подтверждает отказ.</p></Card>
  <ReviewPanel key={check.job_id} path={`${fileJobPath(check.well_id,check.job_id)}/review`} privateFile />
 </div>;
}
