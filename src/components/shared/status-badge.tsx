import { cn } from '@/lib/utils';
import type { LicenseStatus, TaskStatus, VerificationResult } from '@/types/database';

interface StatusBadgeProps {
  status: LicenseStatus | TaskStatus | VerificationResult | string;
  className?: string;
  showDot?: boolean;
}

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

type StatusType = 'active' | 'expired' | 'pending' | 'flagged' | 'unknown';

const statusMapping: Record<string, StatusType> = {
  active: 'active',
  verified: 'active',
  completed: 'active',
  expired: 'expired',
  not_found: 'expired',
  error: 'expired',
  failed: 'expired',
  needs_manual: 'pending',
  pending: 'pending',
  in_progress: 'pending',
  processing: 'pending',
  running: 'pending',
  flagged: 'flagged',
  unknown: 'unknown',
  skipped: 'unknown',
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const label = statusLabels[status] || status;
  const statusType = statusMapping[status] || 'unknown';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {showDot && (
        <span
          className={cn(
            'status-dot',
            `status-dot-${statusType}`,
            statusType === 'pending' && 'status-dot-pulse'
          )}
        />
      )}
      <span
        className={cn('text-xs font-medium', `text-status-${statusType}`)}
      >
        {label}
      </span>
    </span>
  );
}

// State badge for displaying state codes
export function StateBadge({ state, className }: { state: string; className?: string }) {
  const stateUpper = state?.toUpperCase() || '';
  const stateClass = ['WA', 'OR', 'ID', 'MT', 'AZ', 'CA', 'AK'].includes(stateUpper)
    ? `state-badge-${stateUpper}`
    : '';
  return (
    <span className={cn('state-badge', stateClass, className)}>{stateUpper}</span>
  );
}

// Credential type badge
export function CredentialBadge({ type, className }: { type: string; className?: string }) {
  const typeUpper = (type || '').toUpperCase();
  const credentialClass = ['RN', 'LPN', 'CNA', 'APRN', 'NP', 'LVN'].includes(typeUpper)
    ? `credential-badge-${typeUpper}`
    : '';
  return (
    <span className={cn('credential-badge', credentialClass, className)}>
      {typeUpper}
    </span>
  );
}

// Eligibility badge for staffing decisions
export function EligibilityBadge({
  eligibility,
  className,
}: {
  eligibility: 'eligible' | 'ineligible' | 'needs-review';
  className?: string;
}) {
  return (
    <span
      className={cn('eligibility-badge', `eligibility-${eligibility}`, className)}
    >
      {eligibility === 'eligible' && 'Eligible'}
      {eligibility === 'ineligible' && 'Ineligible'}
      {eligibility === 'needs-review' && 'Needs Review'}
    </span>
  );
}
