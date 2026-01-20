'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Header } from '@/components/shared/header';
import { DataTable } from '@/components/shared/data-table';
import { SavedViews, useSavedViews } from '@/components/shared/saved-views';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LicenseDialog } from '@/components/licenses/license-dialog';
import { StatusBadge, StateBadge, CredentialBadge, EligibilityBadge } from '@/components/shared/status-badge';
import { useUser } from '@/hooks/use-user';
import { formatName, formatDate } from '@/lib/utils';
import { Plus, FileCheck, Filter, X } from 'lucide-react';
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
  { value: 'LVN', label: 'LVN' },
  { value: 'CNA', label: 'CNA' },
  { value: 'APRN', label: 'APRN' },
  { value: 'NP', label: 'NP' },
];

const stateOptions = [
  { value: 'all', label: 'All States' },
  { value: 'WA', label: 'Washington' },
  { value: 'OR', label: 'Oregon' },
  { value: 'ID', label: 'Idaho' },
  { value: 'MT', label: 'Montana' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'CA', label: 'California' },
  { value: 'AK', label: 'Alaska' },
];

// Helper to determine eligibility based on license status
function getEligibility(license: License): 'eligible' | 'ineligible' | 'needs-review' {
  if (license.status === 'active' && !license.archived) {
    return 'eligible';
  }
  if (license.status === 'expired' || license.status === 'flagged' || license.archived) {
    return 'ineligible';
  }
  return 'needs-review';
}

function LicensesPageContent() {
  const router = useRouter();
  const { isAdmin } = useUser();
  const [licenses, setLicenses] = useState<(License & { person: Person })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  // Saved views
  const {
    views,
    activeViewId,
    saveView,
    deleteView,
    selectView,
    setDefault,
    getDefaultView,
  } = useSavedViews('licenses-views');

  // Current filters as an object
  const currentFilters = useMemo(
    () => ({
      status: statusFilter,
      type: typeFilter,
      state: stateFilter,
      showArchived,
    }),
    [statusFilter, typeFilter, stateFilter, showArchived]
  );

  // Apply view filters
  const handleViewSelect = useCallback((view: { filters: Record<string, unknown>; id: string; name: string; createdAt: string }) => {
    const filters = view.filters as {
      status?: string;
      type?: string;
      state?: string;
      showArchived?: boolean;
    };
    setStatusFilter((filters.status as string) || 'all');
    setTypeFilter((filters.type as string) || 'all');
    setStateFilter((filters.state as string) || 'all');
    setShowArchived(filters.showArchived || false);
    selectView(view);
  }, [selectView]);

  // Load default view on mount
  useEffect(() => {
    const defaultView = getDefaultView();
    if (defaultView) {
      handleViewSelect(defaultView);
    }
  }, [getDefaultView, handleViewSelect]);

  const hasActiveFilters =
    statusFilter !== 'all' || typeFilter !== 'all' || stateFilter !== 'all' || showArchived;

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setStateFilter('all');
    setShowArchived(false);
  };

  const fetchLicenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter && typeFilter !== 'all') params.set('credentialType', typeFilter);
      if (stateFilter && stateFilter !== 'all') params.set('state', stateFilter);
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
  }, [statusFilter, typeFilter, stateFilter, showArchived]);

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
        row.original.person ? (
          <span className="font-medium">
            {formatName(row.original.person.first_name, row.original.person.last_name)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: 'credential_type',
      header: 'Type',
      cell: ({ row }) => <CredentialBadge type={row.original.credential_type} />,
    },
    {
      accessorKey: 'state',
      header: 'State',
      cell: ({ row }) => <StateBadge state={row.original.state} />,
    },
    {
      accessorKey: 'license_number',
      header: 'License #',
      cell: ({ row }) => (
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {row.original.license_number}
        </code>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'eligibility',
      header: 'Eligibility',
      cell: ({ row }) => <EligibilityBadge eligibility={getEligibility(row.original)} />,
    },
    {
      accessorKey: 'expiration_date',
      header: 'Expires',
      cell: ({ row }) => {
        const date = row.original.expiration_date;
        if (!date) return <span className="text-muted-foreground">-</span>;
        const isExpired = new Date(date) < new Date();
        const isExpiringSoon =
          !isExpired && new Date(date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        return (
          <span
            className={
              isExpired
                ? 'text-status-expired font-medium'
                : isExpiringSoon
                  ? 'text-status-pending font-medium'
                  : ''
            }
          >
            {formatDate(date)}
          </span>
        );
      },
    },
    {
      accessorKey: 'last_verified_at',
      header: 'Last Verified',
      cell: ({ row }) => {
        const date = row.original.last_verified_at;
        if (!date) return <span className="text-muted-foreground">Never</span>;
        return <span className="text-muted-foreground">{formatDate(date)}</span>;
      },
    },
  ];

  // Filter component for the DataTable
  const filterComponent = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Status" />
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
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {credentialOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={stateFilter} onValueChange={setStateFilter}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="State" />
        </SelectTrigger>
        <SelectContent>
          {stateOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 pl-2 border-l border-border">
        <Switch
          id="show-archived"
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
        <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
          Archived
        </Label>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          onClick={clearFilters}
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}

      <div className="border-l border-border pl-2 ml-auto">
        <SavedViews
          views={views}
          currentFilters={currentFilters}
          activeViewId={activeViewId}
          onViewSelect={handleViewSelect}
          onViewSave={saveView}
          onViewDelete={deleteView}
          onSetDefault={setDefault}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Licenses"
        description="Manage nurse and CNA licenses across Western U.S. states"
        gradient
        actions={
          isAdmin && (
            <Button
              onClick={handleAddLicense}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add License
            </Button>
          )
        }
      />

      <div className="flex-1 p-6">
        {isLoading ? (
          <TableSkeleton rows={10} columns={8} />
        ) : licenses.length === 0 && !hasActiveFilters ? (
          <EmptyState
            icon={FileCheck}
            title="No licenses found"
            description="Get started by adding a license to the system."
            action={
              isAdmin
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
            searchPlaceholder="Search by name, license #..."
            onRowClick={handleRowClick}
            filterComponent={filterComponent}
            showSearch={true}
            showDensityToggle={true}
            showColumnToggle={true}
            emptyMessage={
              hasActiveFilters
                ? 'No licenses match your filters.'
                : 'No licenses found.'
            }
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
    <Suspense fallback={<TableSkeleton rows={10} columns={8} />}>
      <LicensesPageContent />
    </Suspense>
  );
}
