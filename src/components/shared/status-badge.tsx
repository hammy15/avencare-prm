import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LicenseStatus, TaskStatus, VerificationResult } from '@/types/database';

interface StatusBadgeProps {
  status: LicenseStatus | TaskStatus | VerificationResult | string;
  className?: string;
}

const statusStyles: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  // License statuses
  active: { variant: 'default', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  expired: { variant: 'destructive', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  needs_manual: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  flagged: { variant: 'secondary', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
  unknown: { variant: 'outline', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },

  // Task statuses
  pending: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  in_progress: { variant: 'default', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  completed: { variant: 'default', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  skipped: { variant: 'outline', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' },

  // Verification results
  verified: { variant: 'default', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  not_found: { variant: 'destructive', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  error: { variant: 'destructive', className: 'bg-red-100 text-red-800 hover:bg-red-100' },

  // Import statuses
  processing: { variant: 'default', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  failed: { variant: 'destructive', className: 'bg-red-100 text-red-800 hover:bg-red-100' },

  // Job statuses
  running: { variant: 'default', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  expired: 'Expired',
  needs_manual: 'Needs Manual',
  flagged: 'Flagged',
  unknown: 'Unknown',
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
  verified: 'Verified',
  not_found: 'Not Found',
  error: 'Error',
  processing: 'Processing',
  failed: 'Failed',
  running: 'Running',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.unknown;
  const label = statusLabels[status] || status;

  return (
    <Badge variant={style.variant} className={cn(style.className, className)}>
      {label}
    </Badge>
  );
}
