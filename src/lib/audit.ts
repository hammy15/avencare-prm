import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditLog } from '@/types/database';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'unarchive'
  | 'import'
  | 'verify'
  | 'task_assign'
  | 'task_complete'
  | 'export';

export type EntityType =
  | 'person'
  | 'license'
  | 'verification'
  | 'task'
  | 'source'
  | 'import_batch'
  | 'job'
  | 'document'
  | 'profile';

interface AuditLogParams {
  action: AuditAction | string;
  entityType: EntityType | string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 * Uses admin client to bypass RLS since audit logs should always be insertable
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  const {
    action,
    entityType,
    entityId,
    metadata,
    userId,
    userEmail,
    ipAddress,
    userAgent,
  } = params;

  try {
    // If userId not provided, try to get from current session
    let finalUserId = userId;
    let finalUserEmail = userEmail;

    if (!finalUserId) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          finalUserId = user.id;
          finalUserEmail = finalUserEmail || user.email;
        }
      } catch {
        // Ignore auth errors in audit logging
      }
    }

    const adminClient = createAdminClient();

    await adminClient.from('audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: finalUserId,
      user_email: finalUserEmail,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    // Log to console but don't throw - audit logging should never break main functionality
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(options: {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const {
    action,
    entityType,
    entityId,
    userId,
    startDate,
    endDate,
    page = 1,
    pageSize = 50,
  } = options;

  const supabase = await createClient();

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' });

  if (action) {
    query = query.eq('action', action);
  }
  if (entityType) {
    query = query.eq('entity_type', entityType);
  }
  if (entityId) {
    query = query.eq('entity_id', entityId);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }
  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return {
    logs: data as AuditLog[],
    total: count || 0,
  };
}

/**
 * Export audit logs to CSV format
 */
export function auditLogsToCSV(logs: AuditLog[]): string {
  const headers = [
    'ID',
    'Timestamp',
    'Action',
    'Entity Type',
    'Entity ID',
    'User ID',
    'User Email',
    'Metadata',
    'IP Address',
  ];

  const rows = logs.map((log) => [
    log.id,
    log.created_at,
    log.action,
    log.entity_type,
    log.entity_id || '',
    log.user_id || '',
    log.user_email || '',
    log.metadata ? JSON.stringify(log.metadata) : '',
    log.ip_address || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return csvContent;
}
