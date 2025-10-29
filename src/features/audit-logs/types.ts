export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PERMISSION_CHANGE'
  | 'ROLE_CHANGE'
  | 'REFUND'
  | 'VOID'
  | 'EXPORT'
  | 'IMPORT'
  | 'APPROVE'
  | 'REJECT';

export type AuditStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changes?: Record<string, { old: any; new: any }>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  status: AuditStatus;
  errorMessage?: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface AuditLogFilters {
  userId?: string;
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  status?: AuditStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  tenantId: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  logs: AuditLog[];
}

export interface AuditStats {
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
}
