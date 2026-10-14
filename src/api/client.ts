import axios, { AxiosError } from 'axios';
import type { ApiError } from './types';

// VITE_API_URL points at the FastAPI backend. When empty, requests are relative
// and handled by the Vite dev proxy (see vite.config.ts).
const baseURL = import.meta.env.VITE_API_URL ?? '';
const apiKey = import.meta.env.VITE_API_KEY;

export const apiClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
  },
});

/** Normalises an axios error into the backend's structured ApiError shape. */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axErr = error as AxiosError<ApiError>;
    if (axErr.response?.data?.message) {
      return axErr.response.data;
    }
    // FastAPI HTTPException кладёт человекочитаемый текст в detail
    const detail = (axErr.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') {
      return { code: `http_${axErr.response?.status ?? 0}`, message: detail };
    }
    return { code: 'network_error', message: axErr.message };
  }
  return { code: 'unknown_error', message: String(error) };
}
