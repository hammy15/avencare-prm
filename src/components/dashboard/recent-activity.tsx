import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatRelative, formatName } from '@/lib/utils';
import type { Verification, License, Person } from '@/types/database';
import { Activity } from 'lucide-react';

interface RecentActivityProps {
  verifications: (Verification & { license: License & { person: Person } })[];
}

export function RecentActivity({ verifications }: RecentActivityProps) {
  if (verifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No recent verification activity.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {verifications.map((verification) => (
            <div
              key={verification.id}
              className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="space-y-1">
                <Link
                  href={`/licenses/${verification.license_id}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {verification.license.person
                    ? formatName(
                        verification.license.person.first_name,
                        verification.license.person.last_name
                      )
                    : 'Unknown'}
                </Link>
                <p className="text-sm text-gray-500">
                  {verification.license?.credential_type} - {verification.license?.state} #{verification.license?.license_number}
                </p>
              </div>
              <div className="text-right space-y-1">
                <StatusBadge status={verification.result} />
                <p className="text-xs text-gray-500">{formatRelative(verification.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
