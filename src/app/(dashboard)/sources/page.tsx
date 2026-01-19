'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/shared/header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SourceDialog } from '@/components/sources/source-dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUser } from '@/hooks/use-user';
import { Plus, Database, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading';
import type { VerificationSource } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';

const sourceTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'bon', label: 'Board of Nursing' },
  { value: 'cna_registry', label: 'CNA Registry' },
  { value: 'nursys', label: 'Nursys' },
  { value: 'other', label: 'Other' },
];

export default function SourcesPage() {
  const { isAdmin } = useUser();
  const [sources, setSources] = useState<VerificationSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<VerificationSource | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== 'all') params.set('sourceType', typeFilter);
      if (!showInactive) params.set('active', 'true');

      const response = await fetch(`/api/sources?${params.toString()}`);
      const result = await response.json();
      if (result.data) {
        setSources(result.data);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, showInactive]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleAddSource = () => {
    setSelectedSource(null);
    setDialogOpen(true);
  };

  const handleEditSource = (source: VerificationSource) => {
    setSelectedSource(source);
    setDialogOpen(true);
  };

  const columns: ColumnDef<VerificationSource>[] = [
    {
      accessorKey: 'state',
      header: 'State',
      cell: ({ row }) => row.original.state || 'National',
    },
    {
      accessorKey: 'display_name',
      header: 'Name',
    },
    {
      accessorKey: 'source_type',
      header: 'Type',
      cell: ({ row }) => {
        const types: Record<string, string> = {
          bon: 'BON',
          cna_registry: 'CNA Registry',
          nursys: 'Nursys',
          other: 'Other',
        };
        return types[row.original.source_type] || row.original.source_type;
      },
    },
    {
      accessorKey: 'supports_api',
      header: 'API',
      cell: ({ row }) =>
        row.original.supports_api ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            API
          </Badge>
        ) : null,
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.active ? 'active' : 'expired'} />
      ),
    },
    {
      accessorKey: 'lookup_url',
      header: 'URL',
      cell: ({ row }) =>
        row.original.lookup_url ? (
          <a
            href={row.original.lookup_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          '-'
        ),
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
              handleEditSource(row.original);
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
        title="Verification Sources"
        description="Manage BON, CNA registry, and other verification sources"
        actions={
          isAdmin && (
            <Button onClick={handleAddSource}>
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          )
        }
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {sourceTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm text-gray-600">
              Show inactive
            </Label>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={10} columns={6} />
        ) : sources.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No sources found"
            description="Verification sources define where to check licenses."
            action={
              isAdmin
                ? {
                    label: 'Add Source',
                    onClick: handleAddSource,
                  }
                : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={sources}
            searchPlaceholder="Search sources..."
          />
        )}
      </div>

      <SourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        source={selectedSource}
        onSuccess={() => {
          setDialogOpen(false);
          fetchSources();
        }}
      />
    </div>
  );
}
