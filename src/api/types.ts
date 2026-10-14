// Types mirroring the FastAPI Pydantic schemas (src/schemas/*).

export interface Well {
  id: number;
  unitek_id: number;
  armits_id: number;
  well_number: string | null;
  ngdu: number;
  department: number;
  active: boolean;
}

export interface WellUpdate {
  unitek_id?: number;
  armits_id?: number;
  well_number?: string | null;
  ngdu?: number;
  department?: number;
  active?: boolean;
}

export interface Prediction {
  id: number;
  well_id: number;
  status: string;
  parameters: Record<string, unknown>;
  processing_date: string; // ISO date
  created_at: string;
}

export interface Complication {
  id: number;
  well_id: number | null;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
}

export interface WellClassification {
  well_id: number;
  classification: string | null;
}

export interface Department {
  id: number;
  name: string;
}

export interface Ngdu {
  id: number;
  name: string;
}

export interface WellCreate {
  unitek_id: number;
  armits_id: number;
  ngdu: number;
  department: number;
  active?: boolean;
}

export interface WellImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export interface Parameter {
  field: string;
  name: string;
  aliases: string[];
}

export interface MetabaseDashboard {
  id: number;
  name: string;
}

export interface AnalyticsStatus {
  enabled: boolean;
  dashboards: MetabaseDashboard[];
}

export interface EmbedUrl {
  url: string;
}

export interface AuditEntry {
  id: number;
  ts: string;
  actor: string | null;
  method: string;
  path: string;
  status_code: number;
}

export interface Incident {
  id: number;
  well_id: number;
  failure_type: string;
  failure_date: string;
  days_before: number;
  created_at: string;
}

export interface IncidentCreate {
  failure_type: string;
  failure_date: string;
  days_before: number;
}


export interface RunArchiveEvent {
  id: number;
  dag_id: string;
  run_id: string;
  execution_date: string;
  well_id: number | null;
  ngdu: number | null;
  department: number | null;
  status_type: string;
  severity: string;
  source: string | null;
  message: string | null;
  parameters: Record<string, unknown> | null;
  artifacts_path: string | null;
  created_at: string;
}

export interface ApiError {
  code: string;
  message: string;
  detail?: unknown;
}

export interface IncidentStats {
  total: number;
  by_type: { failure_type: string; count: number }[];
  by_month: { month: string; count: number }[];
}
