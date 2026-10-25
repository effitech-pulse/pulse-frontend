import {Alert,Button,Card,Spin,Table} from 'antd';
import axios from 'axios';
import type {ReactNode} from 'react';
import type {EventDetailResponse,EventSavedResult,EventProvenance,EventReviewSnapshot,EventWellSnapshot,EventThresholdRule,EventManifestEntry} from '@/api/events';
import {toApiError} from '@/api/client';
import {eventActorCopy,eventErrorState,eventVerdictCopy,formatEventTime,reviewConclusionCopy,reviewStatusCopy} from '@/lib/events';
import '@/styles/events.css';

const shown=(value:string|number|boolean|null):string=>value===null||value===''?'Не указано':typeof value==='boolean'?(value?'Да':'Нет'):String(value);
function Fields({items}:{items:readonly (readonly [string,ReactNode])[]}) {
 return <dl className="pulse-events-fields">{items.map(([label,value])=><div key={label}><dt>{label}:</dt><dd>{value}</dd></div>)}</dl>;
}
/** Explicit retry is about to remove its control; do not focus after a later response. */
export function focusEventRetry(source:HTMLElement,heading:HTMLElement|null,ticket:{current:()=>boolean}) {
 if(ticket.current()&&source.contains(document.activeElement))heading?.focus();
}
export function EventFeedback({error,loading=false,context='detail',continuation=false,onRetry,onRestart,unavailable=false}:{error?:unknown;loading?:boolean;context?:'list'|'detail';continuation?:boolean;onRetry?:(source:HTMLElement)=>void;onRestart?:(source:HTMLElement)=>void;unavailable?:boolean}) {
 if(loading)return <Card className="pulse-event-card"><div role="status" aria-live="polite" aria-busy="true" className="pulse-event-loading"><Spin/><span>{context==='list'?'Загрузка истории…':'Загрузка события…'}</span></div></Card>;
 const status=axios.isAxiosError(error)?error.response?.status??0:0;
 const body=axios.isAxiosError(error)?error.response?.data:undefined;
 const state=unavailable?'unavailable':eventErrorState(status,body);
 const message=state==='unauthorized'?'Войдите, чтобы продолжить':status===403?'Нет доступа к истории событий':state==='unavailable'?(context==='list'?'История выбранной скважины недоступна':'Событие недоступно'):state==='restart'?'История изменилась. Обновите список':state==='invalid'?'Проверьте условия поиска':continuation?'Не удалось загрузить продолжение':context==='list'?'История временно недоступна':'Событие временно недоступно';
 const reference=error?toApiError(error).http_request_id:undefined;
 return <div className="pulse-event-feedback" role="alert">
  <Alert type={state==='restart'?'warning':'error'} message={message} description={reference?<span>Код обращения: {reference}</span>:undefined}/>
  {state==='restart'&&onRestart?<Button onClick={event=>onRestart(event.currentTarget)}>Обновить список</Button>:state==='retry'&&onRetry?<Button onClick={event=>onRetry(event.currentTarget)}>{continuation?'Повторить загрузку':'Повторить'}</Button>:null}
 </div>;
}
function ReviewSnapshot({snapshot}:{snapshot:EventReviewSnapshot}) {
 return <Fields items={[
  ['Ревизия',snapshot.revision],['Статус',reviewStatusCopy(snapshot.status)],['Ответственный',shown(snapshot.owner)],
  ['Заключение',reviewConclusionCopy(snapshot.conclusion)],['Обновлено',formatEventTime(snapshot.updated_at)],
 ]}/>;
}
function WellSnapshot({snapshot}:{snapshot:EventWellSnapshot}) {
 return <Fields items={[
  ['Ревизия',snapshot.revision],['ID Pulse',snapshot.id],['Номер',shown(snapshot.well_number)],['НГДУ',shown(snapshot.ngdu)],['Цех',shown(snapshot.department)],
  ['Активна',shown(snapshot.active)],['В архиве',snapshot.archived_at===null?'Нет':formatEventTime(snapshot.archived_at)],
  ['Ответственный',shown(snapshot.responsible)],['Тип фонда (сохранённый)',shown(snapshot.fund_type)],['Unitek ID',shown(snapshot.unitek_id)],['Armits ID',shown(snapshot.armits_id)],
 ]}/>;
}
function Manifest({label,entries}:{label:string;entries:EventManifestEntry[]|null}) {
 return <section className="pulse-event-subsection"><h3>{label}</h3>{entries===null?<p>Не указано</p>:entries.length===0?<p>Записей нет</p>:entries.map((entry,index)=><Fields key={index} items={[["Название",entry.name],["Версия",shown(entry.version)],["SHA256",shown(entry.sha256)]]}/>)}</section>;
}
function Provenance({value}:{value:EventProvenance|null}) {
 if(value===null)return <p>Происхождение результата: не указано</p>;
 return <section className="pulse-event-subsection"><h3>Происхождение результата</h3><Fields items={[
  ['Версия конверта',value.envelope_version],['ID снимка',value.snapshot_id],['Вычислено',formatEventTime(value.computed_at)],
  ['Модель',shown(value.model_name)],['Версия модели',shown(value.model_version)],['Модель сохранена',formatEventTime(value.model_saved_at)],
  ['Версия контекста',shown(value.context_version)],['SHA256 входа',shown(value.input_sha256)],['ID снимка входа',shown(value.input_snapshot_id)],
  ['Данные по',formatEventTime(value.as_of)],['SHA256 рецепта признаков',shown(value.feature_recipe_sha256)],['SHA256 схемы признаков',shown(value.feature_schema_sha256)],
  ['SHA256 среды выполнения',shown(value.runtime_manifest_sha256)],['SHA256 источников',shown(value.source_manifest_sha256)],
  ['Тип входа',value.input_kind],['Полнота контекста',value.context_completeness],['Статус происхождения',value.provenance_status],
 ]}/><Manifest label="Среда выполнения" entries={value.runtime_manifest}/><Manifest label="Источники" entries={value.source_manifest}/></section>;
}
function Threshold({label,rule}:{label:string;rule:EventThresholdRule|null}) {
 return <section className="pulse-event-subsection"><h4>{label}</h4>{rule===null?<p>Не указано</p>:<Fields items={[
  ['Шкала',rule.scale],['Сравнение',rule.comparison],['Порог',String(rule.threshold)],['Окон',rule.k_windows],['История, суток',shown(rule.lookback_days)],
 ]}/>}</section>;
}
function SavedEventResult({result:r}:{result:EventSavedResult}) {
 const verdict=eventVerdictCopy(r.verdict);
 return <div className="pulse-event-result">
  <Alert type={r.verdict==='alert'?'error':r.verdict==='norm'?'info':'warning'} message={verdict} description={r.verdict==='insufficient'?'Не оценено. Сохранённый результат не означает норму.':r.verdict===null||!['norm','watch','alert'].includes(r.verdict)?'Сохранённое заключение не позволяет считать результат нормой.':undefined}/>
  <div>
   <p>Окна: {r.n_windows} · Каналы: {r.channels_used} · Длительность: {r.span_days} дней</p>
   <p>Всего признаков: {r.features_total} · Окон в работе: {r.windows_running}</p>
   <p>Недоступных признаков: {r.features_unavailable}</p>
   <p>Окон выше наблюдения: {r.windows_above_watch} · Выше тревоги: {r.windows_above_alert}</p>
  </div>
  <p>Сохранённые значения риска: последний {shown(r.latest_risk)}; максимальный {shown(r.peak_risk)}. Результат: {verdict.toLocaleLowerCase('ru')}.</p>
  <section className="pulse-event-subsection"><h3>История окон</h3>{r.timeline.length===0?<p>Сохранённых окон нет.</p>:<div className="pulse-events-table" role="region" aria-label="Сохранённая история окон" tabIndex={0}><Table size="small" rowKey="key" pagination={{pageSize:25,showSizeChanger:false}} scroll={{x:760}} dataSource={r.timeline.map((point,index)=>({key:String(index),window_end:point.window_end,risk:point.risk,raw_score:point.raw_score,watch_fired:point.watch_fired,high_fired:point.high_fired}))} columns={[
   {title:'Окно · UTC',dataIndex:'window_end',render:formatEventTime},{title:'Риск',dataIndex:'risk',render:shown},
   {title:'Исходная оценка',dataIndex:'raw_score',render:shown},{title:'Наблюдение',dataIndex:'watch_fired',render:shown},{title:'Тревога',dataIndex:'high_fired',render:shown},
  ]}/></div>}</section>
  <section className="pulse-event-subsection"><h3>Вклад признаков</h3>{r.contributions.length===0?<p>Сохранённых вкладов нет.</p>:<div className="pulse-events-table" role="region" aria-label="Сохранённые вклады признаков" tabIndex={0}><Table size="small" rowKey="key" pagination={{pageSize:25,showSizeChanger:false}} scroll={{x:760}} dataSource={r.contributions.map((entry,index)=>({key:String(index),feature:entry.feature,label:entry.label,value:entry.value,shap:entry.shap,value_source:entry.value_source}))} columns={[
   {title:'Признак',dataIndex:'feature'},{title:'Название',dataIndex:'label',render:shown},{title:'Значение',dataIndex:'value',render:shown},{title:'Вклад SHAP',dataIndex:'shap',render:shown},
   {title:'Источник значения',dataIndex:'value_source',render:(v:string|null)=>v===null?'Не указано':({computed:'Рассчитано по данным',training_median:'Медиана обучения',zero_fallback:'Заполнение нулём'}[v]??`Источник не распознан: ${v}`)},
  ]}/></div>}</section>
  <Provenance value={r.provenance}/>
  {r.decision_rule===null?<p>Правило решения: не указано</p>:<section className="pulse-event-subsection"><h3>Правило решения</h3><Fields items={[
   ['Версия контекста',r.decision_rule.context_version],['Политика',r.decision_rule.policy_id],['SHA256 правила',r.decision_rule.rule_sha256],['Высокий порог включён',shown(r.decision_rule.high_enabled)],
  ]}/><div className="pulse-event-comparison"><Threshold label="Наблюдение" rule={r.decision_rule.watch}/><Threshold label="Тревога" rule={r.decision_rule.high}/></div></section>}
  <Fields items={[["Модель",shown(r.model_name)],["Версия модели",shown(r.model_version)],["Дата сохранения модели",formatEventTime(r.model_saved_at)],["Конец пикового окна",formatEventTime(r.peak_window_end)]]}/>
 </div>;
}
/** One read-only projection for /events/:id and well exact mode; never mounts legacy readers. */
export function EventDetailView({data}:{data:EventDetailResponse}) {
 const {event,detail}=data;
 return <>
  <p className="pulse-event-meta">{formatEventTime(event.occurred_at)} · {eventActorCopy(event.actor)}{event.actor.kind==='person'&&event.actor.name===null&&event.actor.id?` ${event.actor.id}`:''}</p>
  <Card className="pulse-event-card"><div className="pulse-event-stack"><h2>Текущая карточка</h2><p>{event.well.well_number===null?'':`№ ${event.well.well_number} · `}ID Pulse: {event.well.id}</p><p className="pulse-event-muted">{event.well.active?'Активна':'Неактивна'} · {event.well.archived_at===null?'Вне архива':`В архиве с ${formatEventTime(event.well.archived_at)}`}</p></div></Card>
  <h2 className="pulse-event-historical-heading">На момент события</h2>
  <Card className="pulse-event-card"><div className="pulse-event-stack">
   {detail.kind==='check'?<>
    <h2>Сохранённая проверка</h2><p>ID проверки: {detail.check.id}</p><p className="pulse-event-muted">Период: {formatEventTime(detail.check.start)} — {formatEventTime(detail.check.end)}</p>
    <p className="pulse-event-muted">Сохранена: {formatEventTime(detail.check.created_at)} · ID Pulse: {detail.check.well_id}</p>
    <SavedEventResult result={detail.result}/>
   </>:detail.kind==='review'?<>
    <h2>Ревизия обработки {detail.revision}</h2><p>{detail.review_kind==='check'?'Проверка':'Тревога'}: {event.target.id}</p>
    <p className="pulse-event-muted">Сохранена: {formatEventTime(detail.created_at)}</p>
    <div className="pulse-event-comparison"><section className="pulse-event-subsection"><h3>До</h3><ReviewSnapshot snapshot={detail.before}/></section><section className="pulse-event-subsection"><h3>После</h3><ReviewSnapshot snapshot={detail.after}/></section></div>
    <section className="pulse-event-subsection"><h3>Комментарий</h3><p className="pulse-event-text">{shown(detail.comment)}</p></section>
   </>:<>
    <h2>Ревизия карточки {detail.revision}</h2><p>Изменение: {{metadata:'Метаданные',archive:'Архивирование',restore:'Восстановление'}[detail.change_kind]}</p><p className="pulse-event-muted">Сохранена: {formatEventTime(detail.created_at)}</p>
    <div className="pulse-event-comparison"><section className="pulse-event-subsection"><h3>До</h3><WellSnapshot snapshot={detail.before}/></section><section className="pulse-event-subsection"><h3>После</h3><WellSnapshot snapshot={detail.after}/></section></div>
    <section className="pulse-event-subsection"><h3>Причина</h3><p className="pulse-event-text">{shown(detail.reason)}</p></section>
   </>}
  </div></Card>
 </>;
}
