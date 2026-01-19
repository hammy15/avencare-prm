'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { CSVValidationResult } from '@/types/database';

interface PreviewTableProps {
  results: CSVValidationResult[];
  validCount: number;
  invalidCount: number;
}

export function PreviewTable({ results, validCount, invalidCount }: PreviewTableProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data to preview
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {validCount} valid rows
        </Badge>
        {invalidCount > 0 && (
          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            {invalidCount} invalid rows
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[400px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] sticky left-0 bg-white">Row</TableHead>
              <TableHead className="w-[80px] sticky left-[60px] bg-white">Status</TableHead>
              <TableHead className="min-w-[120px]">First Name</TableHead>
              <TableHead className="min-w-[120px]">Last Name</TableHead>
              <TableHead className="min-w-[80px]">State</TableHead>
              <TableHead className="min-w-[140px]">License #</TableHead>
              <TableHead className="min-w-[80px]">Type</TableHead>
              <TableHead className="min-w-[120px]">Expiration</TableHead>
              <TableHead className="min-w-[200px]">Email</TableHead>
              <TableHead className="min-w-[200px]">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow
                key={result.row}
                className={result.valid ? '' : 'bg-red-50'}
              >
                <TableCell className="font-mono text-sm sticky left-0 bg-inherit">
                  {result.row}
                </TableCell>
                <TableCell className="sticky left-[60px] bg-inherit">
                  {result.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </TableCell>
                <TableCell>{result.data.first_name || '-'}</TableCell>
                <TableCell>{result.data.last_name || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{result.data.state || '-'}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {result.data.license_number || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {result.data.credential_type || '-'}
                  </Badge>
                </TableCell>
                <TableCell>{result.data.expiration_date || '-'}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {result.data.email || '-'}
                </TableCell>
                <TableCell>
                  {result.errors.length > 0 && (
                    <div className="flex items-start gap-1 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{result.errors.join('; ')}</span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
