import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Card,Checkbox,Space} from 'antd';
import {PulseTable} from '../common/PulseTable';
import {createEmptyTableQuery} from '../../lib/tableQuery';
import {actionLabel,passportDiffFields,slotLabel} from '../../lib/equipmentPassportDraft';
import type {PassportDiff,PassportIssue,PassportMutation,PassportPreview} from '../../api/equipmentPassports';

type PassportPreviewRow=Pick<PassportMutation,'row_key'|'well_id'|'slot'|'action'>&{diff?:PassportDiff;issues:PassportIssue[]};

const statusLabel:Record<string,string>={current:'Текущая',closed:'Закрыта',voided:'Аннулирована'};
export function PassportFullDiff({diff}:{diff:PassportDiff}){
 return <div className="passport-diff-fields">{passportDiffFields(diff).map(field=><div className="passport-diff-field" key={field.key}><strong>{field.episode} · {field.label}</strong><div><span className="passport-value-label">Было: </span>{field.field==='status'?(statusLabel[field.before]??field.before):field.before}</div><div><span className="passport-value-label">Станет: </span>{field.field==='status'?(statusLabel[field.after]??field.after):field.after}</div></div>)}</div>;
}
export function EquipmentPassportPreview({preview,busy,ambiguous,isImport,onCommit,onBack}:{preview:PassportPreview;busy:boolean;ambiguous:boolean;isImport:boolean;onCommit:(ack:boolean)=>void;onBack:()=>void}){
 const heading=useRef<HTMLHeadingElement>(null);const fullHeading=useRef<HTMLHeadingElement>(null);
 const [query,setQuery]=useState(createEmptyTableQuery),[pagination,setPagination]=useState({page:1,pageSize:25});
 const [ack,setAck]=useState(false),[confirmed,setConfirmed]=useState(false),[expanded,setExpanded]=useState(false),[expired,setExpired]=useState(()=>Date.now()>=Date.parse(preview.expires_at));
 useEffect(()=>{heading.current?.focus();const timer=setInterval(()=>setExpired(Date.now()>=Date.parse(preview.expires_at)),1000);return()=>clearInterval(timer);},[preview.id]);
 const issues=preview.issues??[];const errors=issues.filter(issue=>issue.severity==='error');const warnings=issues.filter(issue=>issue.severity==='warning');
 const validNoOp=errors.length===0&&preview.changed_count===0;
 const diffs=new Map(preview.diff.map(diff=>[diff.row_key,diff]));
 const rows:PassportPreviewRow[]=preview.commands.rows.map(({row_key,well_id,slot,action})=>({row_key,well_id,slot,action,diff:diffs.get(row_key),issues:issues.filter(issue=>issue.row_key===row_key)}));
 const actions=preview.commands.rows.map(row=>row.action);const excel=isImport;
 const confirmation=excel?'Подтверждаю сохранение всего пакета':actions.includes('replace')?'Подтверждаю физическую замену оборудования':actions.includes('void')?'Подтверждаю аннулирование записи без восстановления предшественника':actions.includes('close')?'Подтверждаю снятие без замены':'Подтверждаю сохранение сведений';
 return <Card className="passport-surface"><h3 ref={heading} tabIndex={-1}>Проверить все изменения</h3>
  <Alert type="info" message={`${new Set(preview.commands.rows.map(row=>row.well_id)).size} скважин · ${preview.commands.rows.length} строк · ${preview.changed_count} изменений · ${preview.unchanged_count} без изменений`} description={`Изменения ещё не сохранены. Предпросмотр действителен до ${preview.expires_at}.`}/>
  {expired?<Alert type="warning" message="Предпросмотр истёк. Вернитесь к вводу и повторите проверку."/>:null}
  {validNoOp?<Alert type="info" message="Все значения совпадают. Завершение выдаст квитанцию без изменения версий."/>:null}
  <PulseTable<PassportPreviewRow> mode="local" rows={rows} rowKey="row_key" query={query} onQueryChange={next=>{setQuery(next);setPagination(previous=>({...previous,page:1}));}} pagination={{...pagination,onPageChange:(page,pageSize)=>setPagination({page,pageSize})}}
   schema={{fields:[{key:'well_id',label:'ID Pulse',kind:'pulseId',read:row=>row.well_id},{key:'slot',label:'Слот',kind:'enum',read:row=>row.slot},{key:'action',label:'Действие',kind:'enum',read:row=>row.action}],defaultSort:[],rowId:row=>row.row_key}}
   columns={[{key:'well_id',title:'Строка / скважина',render:(_,row)=><span>{row.row_key} · {row.well_id}</span>},{key:'slot',title:'Слот / действие',filterKeys:['slot','action'],render:(_,row)=><span>{slotLabel[row.slot]} · {actionLabel[row.action]}</span>},{key:'result',title:'Изменения',render:(_,row)=><div>{row.issues.some(issue=>issue.severity==='error')?'Ошибка':row.diff?<span>{JSON.stringify(row.diff.before)===JSON.stringify(row.diff.after)?'Без изменений':'Изменится'} · {row.diff.before.length} → {row.diff.after.length} эпизодов</span>:'Diff не подготовлен'}{row.issues.map((issue,index)=><p key={index}>{issue.field?`${issue.field} · `:''}{issue.message}</p>)}</div>}]}/>
  <Button type="link" aria-expanded={expanded} aria-controls="passport-complete-diff" onClick={()=>{setExpanded(previous=>!previous);requestAnimationFrame(()=>fullHeading.current?.focus());}}>{expanded?'Свернуть':`Показать полный diff (${preview.diff.length} строк)`}</Button>
  {expanded?<section id="passport-complete-diff"><h4 tabIndex={-1} ref={fullHeading}>Полный diff всех строк</h4>{preview.diff.map(diff=><section key={diff.row_key}><h4>{diff.row_key} · ID Pulse {diff.well_id} · {slotLabel[diff.slot]} · {actionLabel[diff.action]}</h4><PassportFullDiff diff={diff}/><p>Документ: {preview.commands.rows.find(row=>row.row_key===diff.row_key)?.source_reference||'Не указан'}</p></section>)}</section>:null}
  {errors.length?<Alert type="error" message="Ошибки блокируют весь пакет" description={errors.map(issue=><p key={`${issue.row_key}-${issue.field}-${issue.code}`}>{issue.row_key} · {issue.field} · {issue.message}</p>)}/>:null}
  {warnings.length?<><Alert type="warning" message="Требуется подтверждение предупреждений" description={warnings.map((issue,index)=><p key={index}>{issue.row_key} · {issue.message}</p>)}/><Checkbox disabled={busy||ambiguous} checked={ack} onChange={event=>setAck(event.target.checked)}>Я ознакомился со всеми предупреждениями</Checkbox></>:null}
  <Checkbox disabled={busy||ambiguous} checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}>{confirmation}</Checkbox>
  <p>Сохраняются все строки одного неизменного предпросмотра. Сортировка и фильтры меняют только отображение.</p>
  <Space wrap><Button disabled={busy||ambiguous} onClick={onBack}>Вернуться к вводу</Button><Button type="primary" danger={actions.includes('void')} loading={busy} disabled={(expired&&!ambiguous)||!!errors.length||!expanded||!confirmed||(warnings.length>0&&!ack)} onClick={()=>onCommit(ack)}>{errors.length?'Исправьте ошибки':ambiguous?'Повторить тот же commit':validNoOp?'Завершить без изменений':`Сохранить ${preview.changed_count} изменений`}</Button></Space>
  {!expanded?<p>Раскройте полный diff перед подтверждением.</p>:null}
 </Card>;
}
