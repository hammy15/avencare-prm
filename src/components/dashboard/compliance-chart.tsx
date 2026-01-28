'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ComplianceChartProps {
  active: number;
  expired: number;
  needsManual: number;
  flagged: number;
}

const COLORS = {
  active: '#10B981',
  expired: '#EF4444',
  needsManual: '#F59E0B',
  flagged: '#F97316',
};

export function ComplianceChart({ active, expired, needsManual, flagged }: ComplianceChartProps) {
  const total = active + expired + needsManual + flagged;
  const complianceRate = total > 0 ? Math.round((active / total) * 100) : 0;

  const data = [
    { name: 'Active', value: active, color: COLORS.active },
    { name: 'Expired', value: expired, color: COLORS.expired },
    { name: 'Needs Manual', value: needsManual, color: COLORS.needsManual },
    { name: 'Flagged', value: flagged, color: COLORS.flagged },
  ].filter(item => item.value > 0);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          License Status Distribution
          <span className={`text-2xl font-bold ${complianceRate >= 80 ? 'text-green-600' : complianceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {complianceRate}%
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Overall compliance rate</p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No license data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} licenses`, '']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
