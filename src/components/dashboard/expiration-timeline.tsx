'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { format, addDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface License {
  id: string;
  expiration_date: string | null;
  credential_type: string;
  person?: {
    first_name: string;
    last_name: string;
  };
}

interface ExpirationTimelineProps {
  licenses: License[];
}

export function ExpirationTimeline({ licenses }: ExpirationTimelineProps) {
  const now = new Date();

  // Group licenses by month for next 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = addDays(now, i * 30);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const count = licenses.filter(l => {
      if (!l.expiration_date) return false;
      const expDate = new Date(l.expiration_date);
      return isWithinInterval(expDate, { start, end });
    }).length;

    return {
      month: format(start, 'MMM'),
      count,
      isUrgent: i === 0 || i === 1,
    };
  });

  const maxCount = Math.max(...months.map(m => m.count), 1);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Expiration Timeline</CardTitle>
        <p className="text-sm text-muted-foreground">Licenses expiring over next 6 months</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={months} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, maxCount + 1]}
            />
            <Tooltip
              formatter={(value) => [`${value} licenses`, 'Expiring']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {months.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isUrgent ? '#EF4444' : entry.count > 0 ? '#F59E0B' : '#10B981'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
