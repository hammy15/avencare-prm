'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/shared/header';
import { DataTable } from '@/components/shared/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatName, formatDate } from '@/lib/utils';
import { ClipboardList } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading';
import type { VerificationTask, License, Person, VerificationSource, Profile } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
];

type TaskWithRelations = VerificationTask & {
  license: License & { person: Person };
  source: VerificationSource | null;
  assignee: Profile | null;
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/tasks?${params.toString()}`);
      const result = await response.json();
      if (result.data) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleRowClick = (task: TaskWithRelations) => {
    router.push(`/tasks/${task.id}`);
  };

  const columns: ColumnDef<TaskWithRelations>[] = [
    {
      accessorKey: 'license.person',
      header: 'Person',
      cell: ({ row }) =>
        row.original.license?.person
          ? formatName(row.original.license.person.first_name, row.original.license.person.last_name)
          : '-',
    },
    {
      accessorKey: 'license',
      header: 'License',
      cell: ({ row }) => {
        const license = row.original.license;
        return license ? `${license.credential_type} - ${license.state}` : '-';
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => row.original.source?.display_name || '-',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => row.original.priority,
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }) => formatDate(row.original.due_date),
    },
    {
      accessorKey: 'assignee',
      header: 'Assigned To',
      cell: ({ row }) =>
        row.original.assignee?.full_name || row.original.assignee?.email || '-',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Verification Tasks"
        description="Manual verification tasks queue"
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton rows={10} columns={7} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No tasks found"
            description={
              statusFilter === 'pending'
                ? 'No pending verification tasks. All caught up!'
                : 'No tasks match the current filters.'
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={tasks}
            searchPlaceholder="Search tasks..."
            onRowClick={handleRowClick}
          />
        )}
      </div>
    </div>
  );
}
