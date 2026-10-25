import type {PassportAction, PassportAttributes, PassportChangeSet, PassportDiff, PassportField, PassportInstallation, PassportIssue, PassportMutation, PassportPreview, PassportReceipt, PassportSlot} from '../api/equipmentPassports.ts';

export const passportSlots:PassportSlot[]=['pump','motor','control_station'];
export const slotLabel:Record<PassportSlot,string>={pump:'Насос',motor:'ПЭД',control_station:'Станция управления'};
export const actionLabel:Record<PassportAction,string>={register:'Добавить сведения',update:'Исправить сведения',replace:'Заменить',correct:'Исправить запись',close:'Снять',void:'Аннулировать запись'};
export const attributeLabels:Record<keyof PassportAttributes,string>={model:'Модель',manufacturer:'Изготовитель',serial_number:'Серийный номер',pump_nominal_flow_m3_day:'Номинальная подача, м³/сут',pump_nominal_head_m:'Номинальный напор, м',pump_stage_count:'Число ступеней',motor_rated_power_kw:'Мощность, кВт',motor_rated_voltage_v:'Напряжение, В',motor_rated_current_a:'Ток, А',motor_nominal_frequency_hz:'Частота, Гц',control_rated_power_kw:'Мощность, кВт',control_rated_voltage_v:'Напряжение, В',control_rated_current_a:'Ток, А',control_output_frequency_min_hz:'Мин. выходная частота, Гц',control_output_frequency_max_hz:'Макс. выходная частота, Гц'};
export const commonAttributes=['model','manufacturer','serial_number'] as const;
export function slotAttributes(slot:PassportSlot):(keyof PassportAttributes)[]{return [...commonAttributes,...(Object.keys(attributeLabels) as (keyof PassportAttributes)[]).filter(key=>key.startsWith(slot==='control_station'?'control_':`${slot}_`))];}
export interface PassportDraft {rows:PassportMutation[];version:number;preview:PassportPreview|null;receipt:PassportReceipt|null;idempotencyKey:string|null;conflict:boolean}
export type PassportDraftEvent =
 | {type:'change';rowKey:string;field:keyof PassportMutation;value:string}
 | {type:'clear'|'restore';rowKey:string;field:PassportField}
 | {type:'begin';rows:PassportMutation[]}
 | {type:'preview';version:number;preview:PassportPreview;idempotencyKey:string}
 | {type:'commit';version:number;receipt:PassportReceipt}
 | {type:'conflict'|'retry'|'private_reset'|'invalidate'};
export function createPassportDraft(rows:PassportMutation[]=[]):PassportDraft{return {rows,version:0,preview:null,receipt:null,idempotencyKey:null,conflict:false};}
export function reducePassportDraft(state:PassportDraft,event:PassportDraftEvent):PassportDraft {
 if(event.type==='private_reset')return {...createPassportDraft(),version:state.version+1};
 if(event.type==='preview')return event.version===state.version?{...state,preview:event.preview,receipt:null,idempotencyKey:event.idempotencyKey,conflict:false}:state;
 if(event.type==='commit')return event.version===state.version?{...state,receipt:event.receipt,preview:null}:state;
 if(event.type==='retry')return state;
 if(event.type==='conflict')return {...state,preview:null,conflict:true,version:state.version+1};
 let rows=state.rows;
 if(event.type==='begin')rows=event.rows;
 else if(event.type==='change'||event.type==='clear'||event.type==='restore')rows=rows.map(row=>{
  if(row.row_key!==event.rowKey)return row;
  if(event.type==='restore'){const copy={...row};delete copy[event.field];return copy;}
  return {...row,[event.field]:event.type==='change'?event.value:null};
 });
 return {...state,rows,preview:null,receipt:null,idempotencyKey:null,conflict:event.type==='begin'?false:state.conflict,version:state.version+1};
}
/** Строковая нормализация сохраняет precision: бинарные float не участвуют. */
export function normalizePassportDecimal(raw:string):string {
 const value=raw.trim().replace(',','.');if(!/^\d+(?:\.\d+)?$/.test(value))throw new Error('Введите десятичное число без экспоненты');
 const [whole,fraction='']=value.split('.');const integer=whole.replace(/^0+(?=\d)/,'');const decimal=fraction.replace(/0+$/,'');
 if(decimal.length>6||(integer+decimal).replace(/^0+/,'').length>15||BigInt(integer)>1000000000n||(integer==='1000000000'&&decimal))throw new Error('Число вне допустимой точности или диапазона');
 return decimal?`${integer}.${decimal}`:integer;
}
export class PassportDraftValidationError extends Error {
 issues:PassportIssue[];
 constructor(rowKey:string,field:string,message:string){super(message);this.issues=[{row_key:rowKey,field,severity:'error',code:'invalid_input',message}];}
}
export function toPassportChangeSet(draft:PassportDraft):PassportChangeSet {
 const rows=draft.rows.map(original=>{
  const row={...original};
  const invalid=(field:string,message:string):never=>{throw new PassportDraftValidationError(row.row_key,field,message);};
  for(const key of ['well_id','expected_well_revision','expected_passport_revision','component_id','installation_id','linked_installation_id'] as const){const value=row[key];if(value!=null&&(typeof value!=='string'||!/^(0|[1-9]\d*)$/.test(value)||BigInt(value)>9223372036854775807n||(!key.startsWith('expected_')&&BigInt(value)===0n)))throw new Error('Некорректный точный ID / revision');}
  const presentAttributes=(Object.keys(attributeLabels) as (keyof PassportAttributes)[]).filter(key=>row[key]!==undefined);
  if(presentAttributes.some(key=>!slotAttributes(row.slot).includes(key)))throw new Error('Поле недопустимо для слота');
  const dates=['installed_on','removed_on','replacement_on'] as const;
  const forbiddenDates=row.action==='update'?['removed_on','replacement_on']:row.action==='replace'?['installed_on','removed_on']:row.action==='register'?['removed_on','replacement_on']:row.action==='void'?dates:row.action==='close'?['installed_on','replacement_on']:[];
  if((row.action==='close'||row.action==='void')&&presentAttributes.length||forbiddenDates.some(key=>row[key as typeof dates[number]]!==undefined))throw new Error('Поле недопустимо для действия');
  for(const key of Object.keys(attributeLabels) as (keyof PassportAttributes)[]){
   const value=row[key];if(value===undefined||value===null)continue;
   if(!slotAttributes(row.slot).includes(key))throw new Error('Поле недопустимо для слота');
   if(String(value).trim()===''){if(row.action==='register'||row.action==='replace'){(row as Record<string,unknown>)[key]=null;continue;}invalid(key,'Для удаления выберите явную очистку значения');}
   if(key==='pump_stage_count'){const text=String(value);if(!/^\d+$/.test(text)||BigInt(text)<1n||BigInt(text)>100000n)invalid(key,'Число ступеней: 1…100000');row.pump_stage_count=parseInt(text,10);}
   else if(!commonAttributes.includes(key as typeof commonAttributes[number])){const decimal=(()=>{try{return normalizePassportDecimal(String(value));}catch(error){return invalid(key,error instanceof Error?error.message:'Некорректное число');}})();if(decimal==='0'&&key!=='control_output_frequency_min_hz')invalid(key,'Номинальное значение должно быть положительным');(row as Record<string,unknown>)[key]=decimal;}
   else (row as Record<string,unknown>)[key]=String(value).trim();
  }
  for(const field of ['installed_on','removed_on','replacement_on'] as const){const value=row[field];if(value!==undefined&&value!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Укажите полную календарную дату');}
  if((row.action==='close'&&row.removed_on===undefined)||(row.action==='replace'&&row.replacement_on===undefined)||(row.linked_installation_id&&row.replacement_on===undefined))throw new Error('Укажите дату или явно отметьте неизвестную дату');
  if(row.linked_installation_id&&(row.installed_on!==undefined||row.removed_on!==undefined))throw new Error('Связанная граница задаётся одной датой замены');
  return row;
 });return {schema_version:'equipment-passport-v1',rows};
}
const installationLabels:Record<string,string>={id:'ID установки',component_id:'ID экземпляра',status:'Статус',installed_on:'Дата установки',removed_on:'Дата снятия',predecessor_id:'Предшественник'};
export interface PassportDiffField {key:string;episode:string;field:string;label:string;before:string;after:string}
/** Полный diff каждого эпизода, включая неизвестные атрибуты и обе стороны замены. */
export function passportDiffFields(diff:PassportDiff):PassportDiffField[]{
 const pairs:{before?:PassportInstallation;after?:PassportInstallation}[]=diff.before.map(before=>({before,after:diff.after.find(after=>after.id!==null&&after.id===before.id)}));
 for(const after of diff.after)if(after.id===null||!diff.before.some(before=>before.id===after.id))pairs.push({after});
 return pairs.flatMap(({before,after},index)=>Object.entries({...installationLabels,...Object.fromEntries(slotAttributes(diff.slot).map(key=>[key,attributeLabels[key]]))}).map(([field,label])=>{
  const display=(value:PassportInstallation|undefined,isAfter:boolean)=>{if(!value)return 'Не было';const raw=field in installationLabels?value[field as keyof PassportInstallation]:value.attributes[field as keyof PassportAttributes];if(raw==null)return isAfter&&(field==='id'||field==='component_id')?'Создаст сервер':'Не указано';return String(raw);};
  return {key:`${diff.row_key}-${index}-${field}`,episode:before?.id??after?.id??'Новая установка',field,label,before:display(before,false),after:display(after,true)};
 }));
}
