import { apiClient } from './client';
import type { Decimal } from './access';
export interface Workplace { organization: string | null; division: string | null; department: string | null }
export interface ColleagueRef { id: Decimal; name: string; job_title: string | null; active: boolean }
/** Safe directory projection; never derives from the management Account DTO. */
export interface EmployeeProfile extends ColleagueRef { workplace: Workplace; manager: ColleagueRef | null }
export interface PeoplePage { items: EmployeeProfile[]; next_cursor: string | null }
export interface PeopleQuery { search?: string; include_inactive?: boolean; limit?: number; cursor?: string }
export interface ManagedProfile { revision: Decimal; job_title: string | null; workplace: Workplace; manager_id: Decimal | null }
export const peopleApi = {
 list: async (query: PeopleQuery = {}) => (await apiClient.get<PeoplePage>('/api/v1/people', { params: query })).data,
 get: async (id: Decimal) => (await apiClient.get<EmployeeProfile>(`/api/v1/people/${encodeURIComponent(id)}`)).data,
};
