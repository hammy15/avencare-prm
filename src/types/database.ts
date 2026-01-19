// Database types for Cascadia License Check
// These types mirror the Supabase schema

export type UserRole = 'admin' | 'viewer';
export type CredentialType = 'RN' | 'LPN' | 'CNA' | 'APRN' | 'NP';
export type LicenseStatus = 'active' | 'expired' | 'needs_manual' | 'flagged' | 'unknown';
export type SourceType = 'bon' | 'cna_registry' | 'nursys' | 'other';
export type RunType = 'manual' | 'automated' | 'import';
export type VerificationResult = 'verified' | 'expired' | 'not_found' | 'error' | 'pending';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  facility_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  facility?: Facility;
}

export interface SyncedData {
  licenseNumber?: string;
  licenseName?: string;
  status?: string;
  expirationDate?: string;
  unencumbered?: boolean;
  rawData?: Record<string, string>;
  source?: string;
  syncedAt?: string;
}

export interface License {
  id: string;
  person_id: string;
  state: string;
  license_number: string;
  credential_type: CredentialType;
  status: LicenseStatus;
  expiration_date: string | null;
  is_compact: boolean;
  compact_states: string[] | null;
  archived: boolean;
  archived_at: string | null;
  archived_reason: string | null;
  last_verified_at: string | null;
  import_batch_id: string | null;
  notes: string | null;
  licensee_name: string | null;
  synced_data: SyncedData | null;  // Cached data from state verification
  synced_at: string | null;        // When data was last synced
  created_at: string;
  updated_at: string;
  // Joined fields
  person?: Person;
}

export interface VerificationSource {
  id: string;
  state: string | null;
  source_type: SourceType;
  display_name: string;
  lookup_url: string | null;
  instructions: string | null;
  supports_api: boolean;
  api_endpoint: string | null;
  api_config: Record<string, unknown> | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  license_id: string;
  run_type: RunType;
  source_id: string | null;
  result: VerificationResult;
  status_found: LicenseStatus | null;
  expiration_found: string | null;
  unencumbered: boolean | null;
  raw_response: Record<string, unknown> | null;
  evidence_url: string | null;
  notes: string | null;
  verified_by: string | null;
  job_id: string | null;
  created_at: string;
  // Joined fields
  source?: VerificationSource;
  verifier?: Profile;
}

export interface VerificationTask {
  id: string;
  license_id: string;
  source_id: string | null;
  status: TaskStatus;
  priority: number;
  due_date: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  verification_id: string | null;
  notes: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  license?: License & { person?: Person };
  source?: VerificationSource;
  assignee?: Profile;
}

export interface Document {
  id: string;
  license_id: string | null;
  verification_id: string | null;
  task_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  ocr_text: string | null;
  ocr_extracted: OCRExtracted | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface OCRExtracted {
  licenseNumber?: string;
  state?: string;
  expirationDate?: string;
  status?: string;
  name?: string;
  confidence?: number;
}

export interface ImportBatch {
  id: string;
  file_name: string;
  status: ImportStatus;
  total_rows: number;
  processed_rows: number;
  created_rows: number;
  updated_rows: number;
  error_rows: number;
  errors: ImportError[] | null;
  imported_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ImportError {
  row: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface VerificationJob {
  id: string;
  status: JobStatus;
  total_licenses: number;
  processed_licenses: number;
  auto_verified: number;
  tasks_created: number;
  errors: number;
  error_details: JobError[] | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface JobError {
  license_id: string;
  message: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  user_email: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface NursysEnrollment {
  id: string;
  license_id: string;
  nursys_id: string | null;
  enrolled_at: string | null;
  last_notification_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Dashboard stats
export interface DashboardStats {
  total_people: number;
  total_licenses: number;
  active_licenses: number;
  expired_licenses: number;
  needs_manual: number;
  flagged_licenses: number;
  pending_tasks: number;
  upcoming_expirations: number;
}

// CSV Import types
export interface CSVRow {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  state: string;
  license_number: string;
  credential_type: string;
  expiration_date?: string;
  notes?: string;
}

export interface CSVValidationResult {
  row: number;
  data: CSVRow;
  valid: boolean;
  errors: string[];
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
