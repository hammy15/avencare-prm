import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileCheck, AlertTriangle, Clock, Flag, ClipboardList } from 'lucide-react';
import type { DashboardStats as Stats } from '@/types/database';

interface DashboardStatsProps {
  stats: Stats;
}

const statCards = [
  { key: 'total_people', label: 'Total People', icon: Users, color: 'text-blue-600' },
  { key: 'active_licenses', label: 'Active Licenses', icon: FileCheck, color: 'text-green-600' },
  { key: 'expired_licenses', label: 'Expired', icon: AlertTriangle, color: 'text-red-600' },
  { key: 'needs_manual', label: 'Needs Manual', icon: Clock, color: 'text-yellow-600' },
  { key: 'flagged_licenses', label: 'Flagged', icon: Flag, color: 'text-orange-600' },
  { key: 'pending_tasks', label: 'Pending Tasks', icon: ClipboardList, color: 'text-purple-600' },
] as const;

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statCards.map(({ key, label, icon: Icon, color }) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
            <Icon className={`h-4 w-4 ${color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats[key]}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
