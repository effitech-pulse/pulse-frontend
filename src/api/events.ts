import {apiClient} from './client';
import {buildEventsURL, buildEventURL} from '../lib/events.ts';

/** F3 uses decimal strings throughout, independently of legacy numeric APIs. */
export type DecimalInt64 = string;
export type EventID = string;
export type EventType = 'manual_check.saved.v1' | 'review.check.recorded.v1' | 'review.alert.recorded.v1' | 'well.metadata_changed.v1' | 'well.archived.v1' | 'well.restored.v1';
export interface EventFilters {limit?:number; types?:readonly EventType[]; well_id?:DecimalInt64; from?:string; to?:string; archive?:'all'|'current'|'archived'}
export interface EventSummary {
 event_id:EventID; event_type:EventType; occurred_at:string;
 well:{id:DecimalInt64;well_number:string|null;active:boolean;archived_at:string|null};
 target:{kind:'check'|'alert'|'well';id:string;revision:DecimalInt64|null};
 actor:{kind:'person'|'service'|'shared'|'unknown';id:string|null;name:string|null;authenticated:boolean|null};
 outcome:{verdict:'norm'|'watch'|'alert'|'insufficient'|'unknown'|null;review_status:'new'|'in_progress'|'closed'|'unknown'|null;conclusion:'confirmed'|'not_confirmed'|'inconclusive'|'unknown'|null};
}
export interface EventPage {items:EventSummary[];has_more:boolean;next_cursor:string|null}
export interface EventThresholdRule {scale:string;comparison:string;threshold:number;k_windows:DecimalInt64;lookback_days:number|null}
export interface EventDecisionRule {context_version:string;policy_id:string;rule_sha256:string;watch:EventThresholdRule|null;high:EventThresholdRule|null;high_enabled:boolean}
export interface EventManifestEntry {name:string;version:string|null;sha256:string|null}
export interface EventProvenance {
 envelope_version:string;snapshot_id:string;computed_at:string;model_name:string|null;model_version:string|null;model_saved_at:string|null;
 context_version:string|null;input_sha256:string|null;input_snapshot_id:string|null;as_of:string|null;feature_recipe_sha256:string|null;
 feature_schema_sha256:string|null;runtime_manifest_sha256:string|null;source_manifest_sha256:string|null;
 runtime_manifest:EventManifestEntry[];source_manifest:EventManifestEntry[];input_kind:string;context_completeness:string;provenance_status:string;
}
export interface EventSavedResult {
 provenance:EventProvenance|null;decision_rule:EventDecisionRule|null;model_name:string|null;model_version:string|null;model_saved_at:string|null;
 verdict:string|null;n_windows:DecimalInt64;channels_used:DecimalInt64;features_total:DecimalInt64;windows_running:DecimalInt64;
 features_unavailable:DecimalInt64;windows_above_watch:DecimalInt64;windows_above_alert:DecimalInt64;latest_risk:number;peak_risk:number;
 peak_window_end:string;span_days:DecimalInt64;
 timeline:{raw_score:number|null;watch_fired:boolean|null;high_fired:boolean|null;window_end:string;risk:number}[];
 contributions:{value_source:string|null;feature:string;value:number;shap:number;label:string}[];
}
export interface EventReviewSnapshot {revision:DecimalInt64;status:string;owner:string;conclusion:string;updated_at:string|null}
export interface EventWellSnapshot {
 revision:DecimalInt64;archived_at:string|null;responsible:string|null;fund_type:string;unitek_id:DecimalInt64|null;armits_id:DecimalInt64|null;
 well_number:string|null;ngdu:DecimalInt64;department:DecimalInt64;active:boolean;id:DecimalInt64;
}
export type EventDetail =
 | {kind:'check';check:{id:string;well_id:DecimalInt64;created_at:string;start:string;end:string};result:EventSavedResult}
 | {kind:'review';review_kind:'check'|'alert';revision:DecimalInt64;created_at:string;before:EventReviewSnapshot;after:EventReviewSnapshot;comment:string}
 | {kind:'well';revision:DecimalInt64;created_at:string;change_kind:'metadata'|'archive'|'restore';before:EventWellSnapshot;after:EventWellSnapshot;reason:string};
export interface EventDetailResponse {event:EventSummary;detail:EventDetail}

export const eventsApi = {
 list:async(filters:EventFilters,cursor?:string,signal?:AbortSignal):Promise<EventPage> =>
  (await apiClient.get<EventPage>(buildEventsURL(filters,cursor),{signal})).data,
 get:async(eventId:EventID,signal?:AbortSignal):Promise<EventDetailResponse> =>
  (await apiClient.get<EventDetailResponse>(buildEventURL(eventId,'api'),{signal})).data,
};
