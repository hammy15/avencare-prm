'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

interface Verification {
  id: string;
  created_at: string;
  result: string;
  run_type: string;
}

interface VerificationTrendsProps {
  verifications: Verification[];
}

export function VerificationTrends({ verifications }: VerificationTrendsProps) {
  const now = new Date();

  // Group verifications by day for last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(now, 13 - i);
    const start = startOfDay(date);
    const end = endOfDay(date);

    const dayVerifications = verifications.filter(v => {
      const vDate = new Date(v.created_at);
      return isWithinInterval(vDate, { start, end });
    });

    const verified = dayVerifications.filter(v => v.result === 'verified').length;
    const failed = dayVerifications.filter(v => ['expired', 'not_found', 'error'].includes(v.result)).length;
    const automated = dayVerifications.filter(v => v.run_type === 'automated').length;

    return {
      date: format(date, 'MM/dd'),
      verified,
      failed,
      automated,
      total: dayVerifications.length,
    };
  });

  const hasData = days.some(d => d.total > 0);

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Verification Trends</CardTitle>
        <p className="text-sm text-muted-foreground">Last 14 days of verification activity</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No verification data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="verified"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                name="Verified"
              />
              <Line
                type="monotone"
                dataKey="failed"
                stroke="#EF4444"
                strokeWidth={2}
                dot={false}
                name="Failed"
              />
              <Line
                type="monotone"
                dataKey="automated"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                name="Automated"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
