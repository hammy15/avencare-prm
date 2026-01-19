import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatName, isExpiringSoon } from '@/lib/utils';
import type { License, Person } from '@/types/database';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpcomingExpirationsProps {
  licenses: (License & { person: Person })[];
}

export function UpcomingExpirations({ licenses }: UpcomingExpirationsProps) {
  if (licenses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Upcoming Expirations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No licenses expiring in the next 90 days.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Upcoming Expirations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {licenses.map((license) => {
            const isUrgent = isExpiringSoon(license.expiration_date);
            const daysUntil = license.expiration_date
              ? Math.ceil((new Date(license.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div
                key={license.id}
                className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  <Link
                    href={`/licenses/${license.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {license.person
                      ? formatName(license.person.first_name, license.person.last_name)
                      : 'Unknown'}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {license.credential_type} - {license.state}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'text-sm font-medium',
                    daysUntil && daysUntil <= 30 ? 'text-red-600' : 'text-yellow-600'
                  )}>
                    {formatDate(license.expiration_date)}
                  </p>
                  {daysUntil !== null && (
                    <p className="text-xs text-gray-500">
                      {daysUntil} days
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Link
          href="/licenses?filter=expiring"
          className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-700"
        >
          View all expiring licenses
        </Link>
      </CardContent>
    </Card>
  );
}
