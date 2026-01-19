'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Header } from '@/components/shared/header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LicenseDialog } from '@/components/licenses/license-dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUser } from '@/hooks/use-user';
import { formatName, formatDate } from '@/lib/utils';
import { Plus, FileCheck } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading';
import type { License, Person } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'needs_manual', label: 'Needs Manual' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'unknown', label: 'Unknown' },
];

const credentialOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'RN', label: 'RN' },
  { value: 'LPN', label: 'LPN' },
  { value: 'CNA', label: 'CNA' },
  { value: 'APRN', label: 'APRN' },
  { value: 'NP', label: 'NP' },
];

function LicensesPageContent() {
  const router = useRouter();
  const { isAdmin } = useUser();
  const [licenses, setLicenses] = useState<(License & { person: Person })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  const fetchLicenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter && typeFilter !== 'all') params.set('credentialType', typeFilter);
      params.set('archived', showArchived.toString());

      const response = await fetch(`/api/licenses?${params.toString()}`);
      const result = await response.json();
      if (result.data) {
        setLicenses(result.data);
      }
    } catch (error) {
      console.error('Error fetching licenses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, showArchived]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const handleAddLicense = () => {
    setSelectedLicense(null);
    setDialogOpen(true);
  };

  const handleRowClick = (license: License) => {
    router.push(`/licenses/${license.id}`);
  };

  const columns: ColumnDef<License & { person: Person }>[] = [
    {
      accessorKey: 'person',
      header: 'Person',
      cell: ({ row }) =>
        row.original.person
          ? formatName(row.original.person.first_name, row.original.person.last_name)
          : '-',
    },
    {
      accessorKey: 'credential_type',
      header: 'Type',
    },
    {
      accessorKey: 'state',
      header: 'State',
    },
    {
      accessorKey: 'license_number',
      header: 'License #',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'expiration_date',
      header: 'Expires',
      cell: ({ row }) => formatDate(row.original.expiration_date),
    },
    {
      accessorKey: 'last_verified_at',
      header: 'Last Verified',
      cell: ({ row }) => formatDate(row.original.last_verified_at),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Licenses"
        description="Manage nurse and CNA licenses"
        actions={
          isAdmin && (
            <Button onClick={handleAddLicense}>
              <Plus className="h-4 w-4 mr-2" />
              Add License
            </Button>
          )
        }
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

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {credentialOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm text-gray-600">
              Show archived
            </Label>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={10} columns={7} />
        ) : licenses.length === 0 ? (
          <EmptyState
            icon={FileCheck}
            title="No licenses found"
            description={
              showArchived
                ? 'No archived licenses found.'
                : 'Get started by adding a license to the system.'
            }
            action={
              isAdmin && !showArchived
                ? {
                    label: 'Add License',
                    onClick: handleAddLicense,
                  }
                : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={licenses}
            searchPlaceholder="Search licenses..."
            onRowClick={handleRowClick}
          />
        )}
      </div>

      <LicenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        license={selectedLicense}
        onSuccess={() => {
          setDialogOpen(false);
          fetchLicenses();
        }}
      />
    </div>
  );
}

export default function LicensesPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} columns={7} />}>
      <LicensesPageContent />
    </Suspense>
  );
}
