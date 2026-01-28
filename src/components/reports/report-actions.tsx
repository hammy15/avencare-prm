'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, MoreVertical, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReportActionsProps {
  reportType: string;
  variant?: 'dropdown' | 'button';
  label?: string;
}

export function ReportActions({ reportType, variant = 'dropdown', label }: ReportActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const downloadReport = async (format: 'html' | 'json') => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/${reportType}?format=${format}`);

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      if (format === 'html') {
        const html = await response.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Report data exported successfully');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'button') {
    return (
      <Button
        variant="outline"
        onClick={() => downloadReport('html')}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {label || 'Download Report'}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => downloadReport('html')}>
          <FileText className="h-4 w-4 mr-2" />
          Download HTML Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadReport('json')}>
          <Download className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
