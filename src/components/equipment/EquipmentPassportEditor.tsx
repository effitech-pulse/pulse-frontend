import {useEffect,useRef} from 'react';
import {Alert,Button,Card,Checkbox,Form,Input,Space} from 'antd';
import type {PassportDraftEvent} from '../../lib/equipmentPassportDraft';
import {actionLabel,attributeLabels,slotAttributes,slotLabel} from '../../lib/equipmentPassportDraft';
import type {PassportField,PassportInstallation,PassportIssue,PassportMutation} from '../../api/equipmentPassports';

export function EquipmentPassportEditor({row,original,linkedId,issues,busy,checkBlocked,onEvent,onCheck,onCancel}:{row:PassportMutation;original?:PassportInstallation;linkedId?:string;issues:PassportIssue[];busy:boolean;checkBlocked:boolean;onEvent:(event:PassportDraftEvent)=>void;onCheck:()=>void;onCancel:()=>void}){
 const first=useRef<HTMLDivElement>(null);
 useEffect(()=>{first.current?.querySelector<HTMLInputElement>('input')?.focus();},[]);
 const isPatch=row.action==='update'||row.action==='correct';
 const linked=!!row.linked_installation_id;
 const change=(field:keyof PassportMutation,value:string)=>onEvent({type:'change',rowKey:row.row_key,field,value});
 const field=(key:PassportField,label:string,date=false)=>{
  const touched=Object.hasOwn(row,key);const raw=row[key];const cleared=touched&&raw===null;
  const previous=key==='installed_on'?original?.installed_on:key==='removed_on'?original?.removed_on:key==='replacement_on'?original?.removed_on:original?.attributes[key];
  const value=touched?raw:previous;const errors=issues.filter(issue=>issue.field===key&&issue.severity==='error');
  return <Form.Item key={key} label={label} htmlFor={`passport-${key}`} validateStatus={errors.length?'error':undefined} help={errors.length?<span id={`passport-${key}-error`}>{errors.map(issue=>issue.message).join('; ')}</span>:undefined}>
   <Input id={`passport-${key}`} type={date?'date':'text'} inputMode={!date&&!['model','manufacturer','serial_number'].includes(key)?'decimal':undefined}
    value={cleared?'':value??''} disabled={busy||cleared} placeholder={cleared?'Будет очищено':'Не указано'} aria-describedby={errors.length?`passport-${key}-error`:undefined} aria-invalid={errors.length>0}
    maxLength={key==='serial_number'?120:['model','manufacturer'].includes(key)?200:undefined} onChange={event=>{if(isPatch&&event.target.value===String(previous??''))onEvent({type:'restore',rowKey:row.row_key,field:key});else change(key,event.target.value);}}/>
   {date?<Checkbox disabled={busy} checked={cleared} onChange={event=>onEvent({type:event.target.checked?'clear':'restore',rowKey:row.row_key,field:key})}>{key==='replacement_on'?'Граница замены неизвестна':'Дата неизвестна'}</Checkbox>:isPatch?<Button type="link" disabled={busy} onClick={()=>onEvent({type:cleared?'restore':'clear',rowKey:row.row_key,field:key})}>{cleared?'Вернуть значение':'Очистить значение'}</Button>:null}
  </Form.Item>;
 };
 const dateFields=row.action==='close'?field('removed_on','Дата снятия',true):row.action==='replace'||linked?field('replacement_on','Дата замены / связанная граница',true):row.action==='void'?null:<>{field('installed_on','Дата установки',true)}{row.action==='correct'&&original?.status==='closed'?field('removed_on','Дата снятия',true):null}</>;
 return <Card className="passport-surface" title={`${slotLabel[row.slot]} · ${actionLabel[row.action]}`}><div ref={first}>
  <p>1. Внести сведения → 2. Проверить изменения → 3. Подтвердить → 4. Результат</p>
  <Alert type={row.action==='void'?'warning':'info'} showIcon message={row.action==='close'?'После сохранения установка будет закрыта, слот останется без текущих сведений.':row.action==='register'?'Новые сведения создадут экземпляр и его первую установку. Неизвестные значения остаются пустыми.':row.action==='replace'?'Физическая замена: новый экземпляр и установка':row.action==='void'?'Запись будет отмечена ошибочной. Предшественник автоматически не восстанавливается.':'Исправление сохраняет экземпляр и установку. Исходная запись остаётся в истории.'}/>
  {original?<p>Экземпляр {original.component_id} · установка {original.id} · {original.status}</p>:null}
  <Form layout="vertical" onFinish={onCheck} className="passport-form">
   {row.action==='correct'&&linkedId?<Checkbox disabled={busy} checked={linked} onChange={event=>{
    const next={...row};delete next.installed_on;delete next.removed_on;delete next.replacement_on;
    if(event.target.checked)next.linked_installation_id=linkedId;else delete next.linked_installation_id;
    onEvent({type:'begin',rows:[next]});
   }}>Исправить связанную границу с установкой {linkedId}</Checkbox>:null}
   {linked?<Alert type="warning" message={`Одна граница изменит снятие ${row.installation_id} и установку ${row.linked_installation_id}. Проверка покажет оба эпизода.`}/>:null}
   <div className="passport-fields">
    {row.action!=='close'&&row.action!=='void'?slotAttributes(row.slot).map(key=>field(key,attributeLabels[key])):null}
    {dateFields}
    <Form.Item label="Источник документа (необязательно)" htmlFor="passport-source_reference"><Input id="passport-source_reference" value={row.source_reference} maxLength={200} disabled={busy} onChange={event=>change('source_reference',event.target.value)}/></Form.Item>
    <Form.Item label={`Причина${row.action==='register'?' (необязательно)':' изменения'}`} htmlFor="passport-change_reason" help={issues.filter(issue=>issue.field==='change_reason').map(issue=>issue.message).join('; ')}><Input.TextArea id="passport-change_reason" value={row.change_reason} maxLength={500} disabled={busy} onChange={event=>change('change_reason',event.target.value)}/></Form.Item>
   </div>
   <p>Номинальные характеристики из паспорта. Единицы фиксированы. Неизвестные даты не определяют длительность.</p>
   <Space wrap><Button onClick={onCancel}>Отмена</Button><Button type="primary" danger={row.action==='void'} htmlType="submit" disabled={checkBlocked} loading={busy}>{row.action==='void'?'Проверить аннулирование':row.action==='close'?'Проверить снятие':'Проверить'}</Button></Space>
  </Form>
 </div></Card>;
}
