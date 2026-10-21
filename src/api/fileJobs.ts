import {apiClient} from './client';
import {parseLosslessJSON, validPulseId} from '../lib/fileJobs.ts';
export type FileJobState='pending_dispatch'|'queued'|'running'|'retry_wait'|'cancel_requested'|'succeeded'|'failed'|'quarantined'|'cancelled'|'expired'|'revoked';
export interface FileCapabilities {enabled:boolean;mode:'off'|'synthetic';formats?:('csv'|'xlsx')[];max_raw_bytes?:number;max_rows?:number;max_wells?:number}
export interface FileMapping {field:string;parameter:string;unit:string;scale:number;offset:number;missing:string;is_set:boolean}
export interface FileParseSpec {version:'file_input_v1';format:'csv'|'xlsx';delimiter:string;sheet:string;header_row:number;time_column:string;timestamp_layout:string;timezone:string;well_column:string|null;well_identity:''|'pulse'|'unitek'|'armits';mappings:FileMapping[]}
export type Int64=number|string;
export interface FileThresholdRule {scale:string;comparison:string;threshold:number;k_windows:Int64;lookback_days:number|null}
export interface FileDecisionRule {context_version:string;policy_id:string;rule_sha256:string;watch:FileThresholdRule|null;high:FileThresholdRule|null;high_enabled:boolean}
export interface FileManifestEntry {name:string;version:string|null;sha256:string|null}
export interface FileProvenance {envelope_version:string;snapshot_id:string;computed_at:string;model_name:string|null;model_version:string|null;model_saved_at:string|null;context_version:string|null;input_sha256:string|null;input_snapshot_id:string|null;as_of:string|null;feature_recipe_sha256:string|null;feature_schema_sha256:string|null;runtime_manifest_sha256:string|null;source_manifest_sha256:string|null;runtime_manifest:FileManifestEntry[]|null;source_manifest:FileManifestEntry[]|null;input_kind:string;context_completeness:string;provenance_status:string}
export interface SavedFileResult {
 filename?:string|null;verdict:'norm'|'watch'|'alert'|'insufficient';span_days?:Int64|null;n_windows?:Int64|null;windows_running?:Int64|null;channels_used?:Int64|null;features_total?:Int64|null;features_unavailable?:Int64|null;windows_above_watch?:Int64|null;windows_above_alert?:Int64|null;latest_risk?:number|null;peak_risk?:number|null;peak_window_end?:string|null;model_name?:string|null;model_version?:string|null;model_saved_at?:string|null;
 timeline?:{window_end:string;risk:number|null;raw_score?:number|null;watch_fired?:boolean|null;high_fired?:boolean|null}[]|null;
 contributions?:{feature:string;label?:string;value?:number|null;shap?:number|null;value_source?:string|null}[]|null;
 provenance?:FileProvenance|null;decision_rule?:FileDecisionRule|null;
}
export interface FileJobStatus {id:string;well_id:string;state:FileJobState;revision:number;created_at:string;updated_at:string;deadline_at:string;started_at:string|null;finished_at:string|null;next_attempt_at:string|null;attempt:number;max_attempts:number;error_code:string|null;status_url:string;result_url:string|null;cancel_url:string|null;check_id:string|null;input:{format:string;raw_bytes:number;canonical_bytes:number;rows:number;raw_sha256:string;canonical_sha256:string;fingerprint_sha256:string};execution:{model_name:string;bundle_sha256:string;context_version:string}}
export interface FileSavedCheck {id:string;job_id:string;well_id:string;source_kind:string;start:string;end:string;created_at:string;input_sha256:string;points_count:Int64;resolution:string;result:SavedFileResult}
export interface FileJobPage {items:FileJobStatus[];next_before:string|null}
export interface FileJobResult {job_id:string;check:FileSavedCheck}
export function fileJobPath(well:string,job?:string):string {
 if(!validPulseId(well) || (job!==undefined&&!/^[a-f0-9]{32}$/.test(job)))throw new Error('invalid_file_job_identity');
 return `/api/v1/wells/${well}/file-check-jobs${job?`/${job}`:''}`;
}
const options=(signal?:AbortSignal)=>({signal,transformResponse:[parseLosslessJSON]});
export const fileJobsApi={
 capabilities:async(signal?:AbortSignal)=>(await apiClient.get<FileCapabilities>('/api/v1/file-check-capabilities',options(signal))).data,
 submit:async(well:string,file:File,spec:FileParseSpec,key:string,signal?:AbortSignal)=>{const data=new FormData();data.append('request_id',key);data.append('parse_spec',JSON.stringify(spec));data.append('file',file);return(await apiClient.post<FileJobStatus>(fileJobPath(well),data,{...options(signal),headers:{'Content-Type':'multipart/form-data'}})).data;},
 list:async(well:string,before?:string,signal?:AbortSignal)=>(await apiClient.get<FileJobPage>(fileJobPath(well),{...options(signal),params:{before}})).data,
 status:async(well:string,job:string,signal?:AbortSignal)=>(await apiClient.get<FileJobStatus>(fileJobPath(well,job),options(signal))).data,
 result:async(well:string,job:string,signal?:AbortSignal)=>(await apiClient.get<FileJobResult>(`${fileJobPath(well,job)}/result`,options(signal))).data,
 cancel:async(well:string,job:string,revision:number,signal?:AbortSignal)=>(await apiClient.post<FileJobStatus>(`${fileJobPath(well,job)}/cancel`,{revision},options(signal))).data,
};
