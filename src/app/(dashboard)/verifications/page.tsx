'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/shared/header';
import { DataTable } from '@/components/shared/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatName, formatDateTime } from '@/lib/utils';
import { Shield } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading';
import type { Verification, License, Person, VerificationSource, Profile } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';
import { createClient } from '@/lib/supabase/client';

type VerificationWithRelations = Verification & {
  license: License & { person: Person };
  source: VerificationSource | null;
  verifier: Profile | null;
};

const resultOptions = [
  { value: 'all', label: 'All Results' },
  { value: 'verified', label: 'Verified' },
  { value: 'expired', label: 'Expired' },
  { value: 'not_found', label: 'Not Found' },
  { value: 'error', label: 'Error' },
  { value: 'pending', label: 'Pending' },
];

const runTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'manual', label: 'Manual' },
  { value: 'automated', label: 'Automated' },
  { value: 'import', label: 'Import' },
];

export default function VerificationsPage() {
  const [verifications, setVerifications] = useState<VerificationWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState('all');
  const [runTypeFilter, setRunTypeFilter] = useState('all');

  const fetchVerifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();

      let query = supabase
        .from('verifications')
        .select(`
          *,
          license:licenses(*, person:people(*)),
          source:verification_sources(*),
          verifier:profiles!verified_by(*)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (resultFilter && resultFilter !== 'all') {
        query = query.eq('result', resultFilter);
      }
      if (runTypeFilter && runTypeFilter !== 'all') {
        query = query.eq('run_type', runTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching verifications:', error);
      } else {
        setVerifications(data as VerificationWithRelations[]);
      }
    } catch (error) {
      console.error('Error fetching verifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [resultFilter, runTypeFilter]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const columns: ColumnDef<VerificationWithRelations>[] = [
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
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
      accessorKey: 'run_type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="capitalize">{row.original.run_type}</span>
      ),
    },
    {
      accessorKey: 'result',
      header: 'Result',
      cell: ({ row }) => <StatusBadge status={row.original.result} />,
    },
    {
      accessorKey: 'status_found',
      header: 'Status Found',
      cell: ({ row }) =>
        row.original.status_found ? (
          <StatusBadge status={row.original.status_found} />
        ) : (
          '-'
        ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => row.original.source?.display_name || '-',
    },
    {
      accessorKey: 'verifier',
      header: 'Verified By',
      cell: ({ row }) =>
        row.original.verifier?.full_name ||
        row.original.verifier?.email ||
        (row.original.run_type === 'automated' ? 'System' : '-'),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Verifications"
        description="License verification history"
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={resultFilter} onValueChange={setResultFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Results" />
            </SelectTrigger>
            <SelectContent>
              {resultOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={runTypeFilter} onValueChange={setRunTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {runTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton rows={10} columns={8} />
        ) : verifications.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No verifications found"
            description="Verification records will appear here as licenses are verified."
          />
        ) : (
          <DataTable
            columns={columns}
            data={verifications}
            searchPlaceholder="Search verifications..."
          />
        )}
      </div>
    </div>
  );
}
