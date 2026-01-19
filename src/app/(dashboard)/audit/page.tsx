'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/shared/header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateTime } from '@/lib/utils';
import { Download, ScrollText } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading';
import { toast } from 'sonner';
import type { AuditLog } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';

const actionOptions = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'archive', label: 'Archive' },
  { value: 'unarchive', label: 'Unarchive' },
  { value: 'import', label: 'Import' },
  { value: 'verify', label: 'Verify' },
  { value: 'task_complete', label: 'Task Complete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
];

const entityOptions = [
  { value: 'all', label: 'All Entities' },
  { value: 'person', label: 'Person' },
  { value: 'license', label: 'License' },
  { value: 'verification', label: 'Verification' },
  { value: 'task', label: 'Task' },
  { value: 'source', label: 'Source' },
  { value: 'import_batch', label: 'Import' },
  { value: 'job', label: 'Job' },
];

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  archive: 'bg-orange-100 text-orange-800',
  unarchive: 'bg-purple-100 text-purple-800',
  import: 'bg-indigo-100 text-indigo-800',
  verify: 'bg-teal-100 text-teal-800',
  task_complete: 'bg-emerald-100 text-emerald-800',
  login: 'bg-gray-100 text-gray-800',
  logout: 'bg-gray-100 text-gray-800',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== 'all') params.set('action', actionFilter);
      if (entityFilter && entityFilter !== 'all') params.set('entityType', entityFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/audit?${params.toString()}`);
      const result = await response.json();
      if (result.data) {
        setLogs(result.data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, entityFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'csv');
      if (actionFilter && actionFilter !== 'all') params.set('action', actionFilter);
      if (entityFilter && entityFilter !== 'all') params.set('entityType', entityFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/audit?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Audit log exported');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export audit log');
    }
  };

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: 'created_at',
      header: 'Timestamp',
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <Badge className={actionColors[row.original.action] || 'bg-gray-100 text-gray-800'}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: 'entity_type',
      header: 'Entity',
      cell: ({ row }) => (
        <span className="capitalize">{row.original.entity_type.replace('_', ' ')}</span>
      ),
    },
    {
      accessorKey: 'entity_id',
      header: 'Entity ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.entity_id?.slice(0, 8) || '-'}</span>
      ),
    },
    {
      accessorKey: 'user_email',
      header: 'User',
      cell: ({ row }) => row.original.user_email || '-',
    },
    {
      accessorKey: 'metadata',
      header: 'Details',
      cell: ({ row }) => {
        const meta = row.original.metadata;
        if (!meta) return '-';

        // Show relevant details based on content
        if (typeof meta === 'object') {
          const keys = Object.keys(meta);
          if (keys.length === 0) return '-';

          // Show first 2-3 key-value pairs
          const preview = keys.slice(0, 2).map(k => `${k}: ${meta[k]}`).join(', ');
          return <span className="text-sm text-gray-600">{preview}</span>;
        }

        return '-';
      },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Audit Log"
        description="View system activity and changes"
        actions={
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Action</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                {actionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Entity</Label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                {entityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1 block">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>

          {(actionFilter !== 'all' || entityFilter !== 'all' || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActionFilter('all');
                setEntityFilter('all');
                setStartDate('');
                setEndDate('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {isLoading ? (
          <TableSkeleton rows={10} columns={6} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit logs found"
            description="Audit logs will appear here as actions are performed."
          />
        ) : (
          <DataTable
            columns={columns}
            data={logs}
            searchPlaceholder="Search logs..."
          />
        )}
      </div>
    </div>
  );
}
