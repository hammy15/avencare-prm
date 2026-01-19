'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/shared/header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { PersonDialog } from '@/components/people/person-dialog';
import { useUser } from '@/hooks/use-user';
import { formatName, formatDate } from '@/lib/utils';
import { Plus, Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading';
import type { Person } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';

export default function PeoplePage() {
  const router = useRouter();
  const { isAdmin } = useUser();
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const fetchPeople = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/people');
      const result = await response.json();
      if (result.data) {
        setPeople(result.data);
      }
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleAddPerson = () => {
    setSelectedPerson(null);
    setDialogOpen(true);
  };

  const handleEditPerson = (person: Person) => {
    setSelectedPerson(person);
    setDialogOpen(true);
  };

  const handleRowClick = (person: Person) => {
    router.push(`/people/${person.id}`);
  };

  const columns: ColumnDef<Person>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => formatName(row.original.first_name, row.original.last_name),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => row.original.email || '-',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => row.original.phone || '-',
    },
    {
      accessorKey: 'licenses',
      header: 'Licenses',
      cell: ({ row }) => {
        const licenses = (row.original as Person & { licenses: { count: number }[] }).licenses;
        return licenses?.[0]?.count || 0;
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Added',
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        if (!isAdmin) return null;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEditPerson(row.original);
            }}
          >
            Edit
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="People"
        description="Manage nurses and CNAs in the system"
        actions={
          isAdmin && (
            <Button onClick={handleAddPerson}>
              <Plus className="h-4 w-4 mr-2" />
              Add Person
            </Button>
          )
        }
      />

      <div className="flex-1 p-6">
        {isLoading ? (
          <TableSkeleton rows={10} columns={5} />
        ) : people.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No people found"
            description="Get started by adding a person to the system."
            action={
              isAdmin
                ? {
                    label: 'Add Person',
                    onClick: handleAddPerson,
                  }
                : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={people}
            searchPlaceholder="Search people..."
            onRowClick={handleRowClick}
          />
        )}
      </div>

      <PersonDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        person={selectedPerson}
        onSuccess={() => {
          setDialogOpen(false);
          fetchPeople();
        }}
      />
    </div>
  );
}
