import type {
  AuditLog,
  AuditLogFilters,
  AuditLogResponse,
  AuditStats,
} from './types';

const API_BASE = 'http://localhost:3000/api/v1';

export const auditLogsApi = {
  async getAuditLogs(
    token: string,
    filters: AuditLogFilters = {}
  ): Promise<AuditLogResponse> {
    const params = new URLSearchParams();
    
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.action) params.append('action', filters.action);
    if (filters.resource) params.append('resource', filters.resource);
    if (filters.resourceId) params.append('resourceId', filters.resourceId);
    if (filters.status) params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${API_BASE}/audit-logs?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audit logs');
    }

    return response.json();
  },

  async getAuditLogById(token: string, id: string): Promise<{ log: AuditLog }> {
    const response = await fetch(`${API_BASE}/audit-logs/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audit log');
    }

    return response.json();
  },

  async getAuditLogStats(
    token: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ stats: AuditStats }> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${API_BASE}/audit-logs/stats?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audit stats');
    }

    return response.json();
  },

  async getResourceHistory(
    token: string,
    resource: string,
    resourceId: string
  ): Promise<{ logs: AuditLog[] }> {
    const response = await fetch(
      `${API_BASE}/audit-logs/resource/${resource}/${resourceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch resource history');
    }

    return response.json();
  },
};
