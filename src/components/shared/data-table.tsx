'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Columns3,
  LayoutGrid,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from 'lucide-react';

export type DensityMode = 'compact' | 'comfort' | 'spacious';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchColumn?: string;
  enableVirtualization?: boolean;
  virtualRowHeight?: number;
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;
  initialDensity?: DensityMode;
  showDensityToggle?: boolean;
  showColumnToggle?: boolean;
  showSearch?: boolean;
  filterComponent?: React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

const densityConfig: Record<DensityMode, { rowHeight: number; cellPadding: string }> = {
  compact: { rowHeight: 32, cellPadding: 'py-1 px-2' },
  comfort: { rowHeight: 44, cellPadding: 'py-2.5 px-3' },
  spacious: { rowHeight: 56, cellPadding: 'py-4 px-4' },
};

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  searchColumn,
  enableVirtualization = true,
  virtualRowHeight,
  isLoading = false,
  onRowClick,
  initialDensity = 'comfort',
  showDensityToggle = true,
  showColumnToggle = true,
  showSearch = true,
  filterComponent,
  emptyMessage = 'No results found.',
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [density, setDensity] = React.useState<DensityMode>(initialDensity);

  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
  });

  const { rows } = table.getRowModel();
  const rowHeight = virtualRowHeight ?? densityConfig[density].rowHeight;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  const densityClass = `table-density-${density}`;
  const cellClass = densityConfig[density].cellPadding;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          {showSearch && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={
                  searchColumn
                    ? (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''
                    : globalFilter
                }
                onChange={(event) => {
                  if (searchColumn) {
                    table.getColumn(searchColumn)?.setFilterValue(event.target.value);
                  } else {
                    setGlobalFilter(event.target.value);
                  }
                }}
                className="pl-9 h-9 w-[250px] bg-background"
              />
              {(searchColumn
                ? Boolean(table.getColumn(searchColumn)?.getFilterValue())
                : Boolean(globalFilter)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => {
                    if (searchColumn) {
                      table.getColumn(searchColumn)?.setFilterValue('');
                    } else {
                      setGlobalFilter('');
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Custom filters */}
          {filterComponent}
        </div>

        <div className="flex items-center gap-2">
          {/* Density Toggle */}
          {showDensityToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline capitalize">{density}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Density</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['compact', 'comfort', 'spacious'] as DensityMode[]).map((mode) => (
                  <DropdownMenuCheckboxItem
                    key={mode}
                    checked={density === mode}
                    onCheckedChange={() => setDensity(mode)}
                    className="capitalize"
                  >
                    {mode}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Column Visibility */}
          {showColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Columns</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id.replace(/_/g, ' ')}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        ref={tableContainerRef}
        className={cn(
          'rounded-lg border border-border overflow-auto',
          densityClass,
          enableVirtualization ? 'max-h-[600px]' : ''
        )}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'font-semibold text-xs uppercase tracking-wider text-muted-foreground',
                      cellClass,
                      header.column.getCanSort() && 'cursor-pointer select-none'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <span className="inline-flex">
                            {header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : enableVirtualization ? (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className={cn(
                        'transition-colors',
                        onRowClick && 'cursor-pointer hover:bg-accent/50'
                      )}
                      onClick={() => onRowClick?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn('text-sm', cellClass)}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-accent/50'
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn('text-sm', cellClass)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {rows.length} {rows.length === 1 ? 'result' : 'results'}
          {globalFilter && ` matching "${globalFilter}"`}
        </span>
        {enableVirtualization && rows.length > 50 && (
          <span className="text-xs opacity-60">Virtualized for performance</span>
        )}
      </div>
    </div>
  );
}

// Status badge components for the design system
export function StatusDot({
  status,
  pulse = false,
  className,
}: {
  status: 'active' | 'expired' | 'pending' | 'flagged' | 'unknown';
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'status-dot',
        `status-dot-${status}`,
        pulse && 'status-dot-pulse',
        className
      )}
    />
  );
}

// Note: StatusBadge, EligibilityBadge, StateBadge, CredentialBadge
// are exported from '@/components/shared/status-badge' - import from there
