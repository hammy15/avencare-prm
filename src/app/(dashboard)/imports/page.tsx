'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/shared/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CSVUpload } from '@/components/import/csv-upload';
import { PreviewTable } from '@/components/import/preview-table';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/use-user';
import { parseCSV, prepareForImport } from '@/lib/csv-parser';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Upload, History, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { CSVValidationResult, ImportBatch } from '@/types/database';
import type { ColumnDef } from '@tanstack/react-table';

export default function ImportsPage() {
  const { isAdmin } = useUser();
  const [activeTab, setActiveTab] = useState('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseResults, setParseResults] = useState<{
    rows: CSVValidationResult[];
    validCount: number;
    invalidCount: number;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const response = await fetch('/api/import');
      const result = await response.json();
      if (result.data) {
        setImportHistory(result.data);
      }
    } catch (error) {
      console.error('Error fetching import history:', error);
      toast.error('Failed to load import history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);

    try {
      const results = await parseCSV(selectedFile);
      setParseResults(results);

      if (results.invalidCount > 0) {
        toast.warning(`${results.invalidCount} rows have validation errors`);
      } else {
        toast.success(`${results.validCount} rows ready for import`);
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file');
      setFile(null);
      setParseResults(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parseResults || !file) return;

    const validRows = prepareForImport(parseResults.rows);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          rows: validRows,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      toast.success(
        `Import complete: ${result.data.createdRows} created, ${result.data.updatedRows} updated`
      );

      // Reset state
      setFile(null);
      setParseResults(null);

      // Switch to history tab and refresh
      setActiveTab('history');
      fetchHistory();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'history') {
      fetchHistory();
    }
  };

  const historyColumns: ColumnDef<ImportBatch>[] = [
    {
      accessorKey: 'file_name',
      header: 'File',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.file_name}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant={
              status === 'completed'
                ? 'default'
                : status === 'failed'
                ? 'destructive'
                : 'secondary'
            }
            className={
              status === 'completed'
                ? 'bg-green-100 text-green-800'
                : status === 'failed'
                ? 'bg-red-100 text-red-800'
                : ''
            }
          >
            {status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
            {status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'total_rows',
      header: 'Total Rows',
    },
    {
      accessorKey: 'created_rows',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-green-600">{row.original.created_rows}</span>
      ),
    },
    {
      accessorKey: 'updated_rows',
      header: 'Updated',
      cell: ({ row }) => (
        <span className="text-blue-600">{row.original.updated_rows}</span>
      ),
    },
    {
      accessorKey: 'error_rows',
      header: 'Errors',
      cell: ({ row }) => {
        const errors = row.original.error_rows;
        return errors > 0 ? (
          <span className="text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors}
          </span>
        ) : (
          <span className="text-gray-400">0</span>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ row }) => formatDate(row.original.created_at),
    },
  ];

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Import Licenses"
          description="Bulk import licenses from CSV files"
        />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Only administrators can import data.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Import Licenses"
        description="Bulk import licenses from CSV files"
      />

      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload CSV File</CardTitle>
                <CardDescription>
                  Upload a CSV file with license data. The file should include columns for
                  first_name, last_name, state, license_number, and credential_type.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CSVUpload
                  onFileSelect={handleFileSelect}
                  disabled={isParsing || isImporting}
                />
              </CardContent>
            </Card>

            {isParsing && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">Parsing CSV file...</p>
                </CardContent>
              </Card>
            )}

            {parseResults && !isParsing && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Preview</CardTitle>
                    <CardDescription>
                      Review the data before importing
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || parseResults.validCount === 0}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        Import {parseResults.validCount} rows
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <PreviewTable
                    results={parseResults.rows}
                    validCount={parseResults.validCount}
                    invalidCount={parseResults.invalidCount}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Import History</CardTitle>
                <CardDescription>
                  View previous import batches and their results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">Loading history...</p>
                  </div>
                ) : importHistory.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    No imports yet
                  </div>
                ) : (
                  <DataTable
                    columns={historyColumns}
                    data={importHistory}
                    searchPlaceholder="Search imports..."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
