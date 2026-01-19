'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/shared/header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Plus, Building2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading';
import { FacilityDialog } from '@/components/facilities/facility-dialog';
import { useUser } from '@/hooks/use-user';
import type { Facility } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';

export default function FacilitiesPage() {
  const { isAdmin } = useUser();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  const fetchFacilities = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/facilities');
      const result = await response.json();
      if (result.data) {
        setFacilities(result.data);
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const handleEdit = (facility: Facility) => {
    setSelectedFacility(facility);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedFacility(null);
    setDialogOpen(true);
  };

  const columns: ColumnDef<Facility>[] = [
    {
      accessorKey: 'name',
      header: 'Facility Name',
      cell: ({ row }) => (
        <button
          onClick={() => handleEdit(row.original)}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: 'city',
      header: 'City',
    },
    {
      accessorKey: 'state',
      header: 'State',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          row.original.active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {row.original.active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Facilities"
        description="Manage healthcare facilities"
        actions={
          isAdmin && (
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Facility
            </Button>
          )
        }
      />

      <div className="flex-1 p-6">
        {isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : facilities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No facilities"
            description="Add facilities to track where your nursing staff work."
            action={isAdmin ? { label: 'Add Facility', onClick: handleAdd } : undefined}
          />
        ) : (
          <DataTable
            columns={columns}
            data={facilities}
            searchPlaceholder="Search facilities..."
          />
        )}
      </div>

      <FacilityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        facility={selectedFacility}
        onSuccess={() => {
          setDialogOpen(false);
          fetchFacilities();
        }}
      />
    </div>
  );
}
