import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { auditLogsApi } from './api';
import type { AuditAction, AuditStatus, AuditLogFilters } from './types';
import { Skeleton } from '@/components/ui/skeleton';

// Mock token - in real app, get from auth context
const MOCK_TOKEN = 'your-jwt-token';

const actionColors: Record<AuditAction, string> = {
  CREATE: 'bg-green-500',
  UPDATE: 'bg-blue-500',
  DELETE: 'bg-red-500',
  LOGIN: 'bg-purple-500',
  LOGIN_FAILED: 'bg-orange-500',
  LOGOUT: 'bg-gray-500',
  PASSWORD_CHANGE: 'bg-yellow-500',
  PERMISSION_CHANGE: 'bg-indigo-500',
  ROLE_CHANGE: 'bg-pink-500',
  REFUND: 'bg-amber-500',
  VOID: 'bg-red-700',
  EXPORT: 'bg-teal-500',
  IMPORT: 'bg-cyan-500',
  APPROVE: 'bg-green-600',
  REJECT: 'bg-red-600',
};

const statusColors: Record<AuditStatus, string> = {
  SUCCESS: 'bg-green-500',
  FAILED: 'bg-red-500',
  PENDING: 'bg-yellow-500',
};

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 20,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditLogsApi.getAuditLogs(MOCK_TOKEN, filters),
  });

  const handleFilterChange = (key: keyof AuditLogFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Audit Logs</h1>
        <p className='text-muted-foreground'>
          Track all system activities and changes
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter audit logs by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Action</label>
              <Select
                value={filters.action || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('action', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All actions' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Actions</SelectItem>
                  <SelectItem value='CREATE'>Create</SelectItem>
                  <SelectItem value='UPDATE'>Update</SelectItem>
                  <SelectItem value='DELETE'>Delete</SelectItem>
                  <SelectItem value='LOGIN'>Login</SelectItem>
                  <SelectItem value='LOGIN_FAILED'>Login Failed</SelectItem>
                  <SelectItem value='LOGOUT'>Logout</SelectItem>
                  <SelectItem value='PASSWORD_CHANGE'>Password Change</SelectItem>
                  <SelectItem value='REFUND'>Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>Resource</label>
              <Select
                value={filters.resource || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('resource', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All resources' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Resources</SelectItem>
                  <SelectItem value='product'>Product</SelectItem>
                  <SelectItem value='transaction'>Transaction</SelectItem>
                  <SelectItem value='outlet'>Outlet</SelectItem>
                  <SelectItem value='auth'>Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>Status</label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('status', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All statuses' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Statuses</SelectItem>
                  <SelectItem value='SUCCESS'>Success</SelectItem>
                  <SelectItem value='FAILED'>Failed</SelectItem>
                  <SelectItem value='PENDING'>Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>User ID</label>
              <Input
                placeholder='User ID'
                value={filters.userId || ''}
                onChange={(e) => handleFilterChange('userId', e.target.value || undefined)}
              />
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>Resource ID</label>
              <Input
                placeholder='Resource ID'
                value={filters.resourceId || ''}
                onChange={(e) =>
                  handleFilterChange('resourceId', e.target.value || undefined)
                }
              />
            </div>
          </div>

          {(filters.action || filters.resource || filters.status || filters.userId || filters.resourceId) && (
            <Button
              variant='outline'
              size='sm'
              className='mt-4'
              onClick={() =>
                setFilters({ page: 1, limit: 20 })
              }
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            {data ? `${data.total} total entries` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-2'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : error ? (
            <div className='text-center py-8 text-red-500'>
              Failed to load audit logs. Please try again.
            </div>
          ) : !data?.logs.length ? (
            <div className='text-center py-8 text-muted-foreground'>
              No audit logs found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className='font-mono text-sm'>
                        {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-col'>
                          <span className='font-medium'>
                            {log.user?.username || 'Unknown'}
                          </span>
                          <span className='text-xs text-muted-foreground'>
                            {log.user?.email || log.userId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={actionColors[log.action]}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-col'>
                          <span className='font-medium'>{log.resource}</span>
                          {log.resourceId && (
                            <span className='text-xs text-muted-foreground font-mono'>
                              {log.resourceId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className={statusColors[log.status]}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className='font-mono text-sm'>
                        {log.ipAddress || '-'}
                      </TableCell>
                      <TableCell>
                        {log.changes && Object.keys(log.changes).length > 0 && (
                          <span className='text-sm text-muted-foreground'>
                            {Object.keys(log.changes).length} changes
                          </span>
                        )}
                        {log.errorMessage && (
                          <span className='text-sm text-red-500'>
                            {log.errorMessage}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className='flex items-center justify-between mt-4'>
                <div className='text-sm text-muted-foreground'>
                  Showing page {data.page} of {data.totalPages}
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={data.page === 1}
                    onClick={() => handlePageChange(data.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={data.page === data.totalPages}
                    onClick={() => handlePageChange(data.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
