import {parseLosslessJSON} from '../lib/fileJobs';
import axios, { AxiosError } from 'axios';
import type { ApiError } from './types';

// VITE_API_URL points at the Go backend. When empty, requests are relative
// and handled by the Vite dev proxy (see vite.config.ts).
const baseURL = import.meta.env.VITE_API_URL ?? '';
const apiKey = import.meta.env.VITE_API_KEY;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
  transformResponse: [(raw:unknown) => {if(typeof raw!=='string'||!raw.trim())return raw;try{return parseLosslessJSON(raw);}catch{return raw;}}],
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
  },
});

/** Normalises an axios error into the backend's structured ApiError shape. */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axErr = error as AxiosError<ApiError>;
    const headers = axErr.response?.headers;
    const keys = Object.keys(headers ?? {}).filter(key => key.toLowerCase() === 'x-request-id');
    const value: unknown = keys.length === 1 ? headers?.[keys[0]] : undefined;
    // Reject combined/duplicate headers and controls, including a final newline.
    const http_request_id = typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value) && !/[\r\n]/.test(value) ? value : undefined;
    if (axErr.response?.data?.message) {
      // The header is authoritative. Never trust a body-provided correlation ID,
      // mutate response data or replace an existing business request_id.
      const { http_request_id: _untrustedId, ...body } = axErr.response.data;
      return { ...body, ...(http_request_id ? { http_request_id } : {}) };
    }
    // FastAPI HTTPException кладёт человекочитаемый текст в detail
    const detail = (axErr.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') {
      return { code: `http_${axErr.response?.status ?? 0}`, message: detail, ...(http_request_id ? { http_request_id } : {}) };
    }
    return { code: 'network_error', message: axErr.message, ...(http_request_id ? { http_request_id } : {}) };
  }
  return { code: 'unknown_error', message: String(error) };
}
