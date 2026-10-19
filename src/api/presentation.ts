import { apiClient } from './client';
import type { Well } from './types';
export interface PresentationWell extends Well {latest_check: {id:string; verdict:string; latest_risk:number; created_at:string; model_version:string | null} | null}
export interface PresentationSummary {wells: PresentationWell[]; count:number; checked:number; watch:number; alert:number; insufficient:number}
export interface PresentationScenario {scenario_id:string; origin:string; seed:number; count:number; affected:number; ramp_days:number; profile_count:number; profiles_sha256:string; notice:string}
export const presentationApi = {scenario:async () => (await apiClient.get<PresentationScenario>('/api/v1/presentation/scenario')).data, summary:async () => (await apiClient.get<PresentationSummary>('/api/v1/presentation/summary')).data};
