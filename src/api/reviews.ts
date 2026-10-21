import { apiClient } from './client';
export type ReviewStatus = 'new' | 'in_progress' | 'closed';
export type ReviewConclusion = '' | 'confirmed' | 'not_confirmed' | 'inconclusive';
export interface ReviewState {revision: number; status: ReviewStatus; owner: string; conclusion: ReviewConclusion; updated_at: string | null}
export interface ReviewEvent {revision: number; created_at: string; actor: {id: string; name: string; authenticated: boolean}; comment: string; before: ReviewState; after: ReviewState}
export interface Review {state: ReviewState; events: ReviewEvent[]; has_more: boolean}
export interface ReviewInput {request_id: string; revision: number; status: ReviewStatus; owner: string; conclusion: ReviewConclusion; comment: string}
export const reviewsApi = {
  get: async (path: string, before?: number,signal?:AbortSignal) => (await apiClient.get<Review>(path, {params:{before},signal})).data,
  save: async (path: string, input: ReviewInput,signal?:AbortSignal) => (await apiClient.put<Review>(path, input,{signal})).data,
};
