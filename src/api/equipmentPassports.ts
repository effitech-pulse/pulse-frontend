import {apiClient} from './client';
import {getTablePage} from './table';
import type {TablePageRequest} from '../lib/tableTransport';
import type {TableQuery} from '../lib/tableQuery';

export type PassportSlot = 'pump' | 'motor' | 'control_station';
export type PassportAction = 'register' | 'update' | 'replace' | 'correct' | 'close' | 'void';
export interface PassportAttributes {
 model: string|null; manufacturer: string|null; serial_number: string|null;
 pump_nominal_flow_m3_day: string|null; pump_nominal_head_m: string|null; pump_stage_count: number|null;
 motor_rated_power_kw: string|null; motor_rated_voltage_v: string|null; motor_rated_current_a: string|null; motor_nominal_frequency_hz: string|null;
 control_rated_power_kw: string|null; control_rated_voltage_v: string|null; control_rated_current_a: string|null; control_output_frequency_min_hz: string|null; control_output_frequency_max_hz: string|null;
}
export type PassportField = keyof PassportAttributes | 'installed_on' | 'removed_on' | 'replacement_on';
export type PassportMutation = Partial<PassportAttributes> & {
 row_key:string;well_id:string;expected_well_revision:string;expected_passport_revision:string;slot:PassportSlot;action:PassportAction;
 component_id?:string|null;installation_id?:string|null;linked_installation_id?:string|null;
 installed_on?:string|null;removed_on?:string|null;replacement_on?:string|null;change_reason:string;source_reference:string;
};
export interface PassportChangeSet {schema_version:'equipment-passport-v1';rows:PassportMutation[]}
export interface PassportInstallation {id:string|null;component_id:string|null;slot:PassportSlot;status:'current'|'closed'|'voided';installed_on:string|null;removed_on:string|null;predecessor_id:string|null;attributes:PassportAttributes}
export interface PassportActor {account_id:string;name:string}
export interface PassportRowSource {row_key:string;sheet:string;index:number}
export interface PassportChangeProvenance {source:'manual'|'excel';actor:PassportActor;recorded_at:string;source_reference:string|null;receipt_id:string;source_file_sha256:string|null;template_version:string|null;source_row:PassportRowSource|null}
export interface PassportView {well_id:string;well_revision:string;passport_id:string|null;revision:string;slots:PassportInstallation[];provenance:{slot:PassportSlot;last_change:PassportChangeProvenance}[]}
export interface PassportDiff {row_key:string;well_id:string;slot:PassportSlot;action:PassportAction;before:PassportInstallation[];after:PassportInstallation[]}
export interface PassportIssue {row_key:string;field:string|null;severity:'error'|'warning';code:string;message:string}
export interface PassportPreview {id:string;digest:string;expires_at:string;commands:PassportChangeSet;diff:PassportDiff[];issues:PassportIssue[];changed_count:number;unchanged_count:number}
export interface PassportReceipt {id:string;request_id:string;recorded_at:string;actor:PassportActor;source:'manual'|'excel';source_file_sha256:string|null;changed_count:number;unchanged_count:number;wells:{well_id:string;before_revision:string;after_revision:string}[];rows:{row_key:string;well_id:string;component_id:string|null;installation_id:string|null}[]}
export interface PassportEvent {id:string;well_id:string;revision:string;row_key:string;action:PassportAction;slot:PassportSlot;recorded_at:string;actor:PassportActor;source:'manual'|'excel';source_reference:string|null;reason:string;diff:PassportDiff;receipt_id:string;source_file_sha256:string|null;template_version:string|null;source_row:PassportRowSource|null}
export interface PassportCommitInput {preview_id:string;digest:string;acknowledge_warnings:boolean;idempotency_key:string}
const ROOT='/api/v1/equipment-passports';
const wellPath=(id:string)=>`/api/v1/wells/${encodeURIComponent(id)}/equipment-passport`;
export const readEquipmentPassport=(wellId:string,signal?:AbortSignal)=>apiClient.get<PassportView>(wellPath(wellId),{signal}).then(r=>r.data);
export const readEquipmentPassportHistory=(wellId:string,request:TablePageRequest,signal?:AbortSignal)=>getTablePage<PassportEvent>(`${wellPath(wellId)}/history`,request,signal);
export const prepareEquipmentPassport=(input:PassportChangeSet,signal?:AbortSignal)=>apiClient.post<PassportPreview>(`${ROOT}/previews`,input,{signal}).then(r=>r.data);
export function importEquipmentPassport(file:File,signal?:AbortSignal){const form=new FormData();form.append('file',file);return apiClient.post<PassportPreview>(`${ROOT}/import/previews`,form,{signal,headers:{'Content-Type':undefined}}).then(r=>r.data);}
export const readEquipmentPassportPreview=(id:string,signal?:AbortSignal)=>apiClient.get<PassportPreview>(`${ROOT}/previews/${encodeURIComponent(id)}`,{signal}).then(r=>r.data);
export const cancelEquipmentPassportPreview=(id:string,signal?:AbortSignal)=>apiClient.delete(`${ROOT}/previews/${encodeURIComponent(id)}`,{signal}).then(()=>undefined);
export const commitEquipmentPassport=(input:PassportCommitInput,signal?:AbortSignal)=>apiClient.post<PassportReceipt>(`${ROOT}/previews/${encodeURIComponent(input.preview_id)}/commit`,{digest:input.digest,acknowledge_warnings:input.acknowledge_warnings},{signal,headers:{'Idempotency-Key':input.idempotency_key}}).then(r=>r.data);
export const readEquipmentPassportReceipt=(id:string,signal?:AbortSignal)=>apiClient.get<PassportReceipt>(`${ROOT}/receipts/${encodeURIComponent(id)}`,{signal}).then(r=>r.data);
// Axios's JSON transform must not consume binary downloads.
const blobOptions=(signal?:AbortSignal)=>({signal,responseType:'blob' as const,transformResponse:[(value:Blob)=>value]});
export const downloadEquipmentPassportTemplate=(wellIds:string[],signal?:AbortSignal)=>apiClient.post<Blob>(`${ROOT}/template`,{well_ids:wellIds},blobOptions(signal)).then(r=>r.data);
export const exportEquipmentPassports=(input:{well_ids:string[];mode:'current_components'|'history';query?:TableQuery},signal?:AbortSignal)=>apiClient.post<Blob>(`${ROOT}/export`,input,blobOptions(signal)).then(r=>r.data);
