import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { Header } from '@/components/shared/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportActions } from '@/components/reports/report-actions';
import { FileText, Users, Shield, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';

async function getReportStats() {
  const supabase = createAdminClient();

  const [
    { count: totalPeople },
    { count: totalLicenses },
    { count: activeLicenses },
    { count: expiredLicenses },
    { count: pendingTasks },
    { data: recentVerifications },
  ] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'expired').eq('archived', false),
    supabase.from('verification_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('verifications').select('*').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const complianceRate = (totalLicenses || 0) > 0
    ? Math.round(((activeLicenses || 0) / (totalLicenses || 1)) * 100)
    : 0;

  return {
    totalPeople: totalPeople || 0,
    totalLicenses: totalLicenses || 0,
    activeLicenses: activeLicenses || 0,
    expiredLicenses: expiredLicenses || 0,
    complianceRate,
    pendingTasks: pendingTasks || 0,
    recentVerificationsCount: recentVerifications?.length || 0,
  };
}

export default async function ReportsPage() {
  const stats = await getReportStats();

  const reportTypes = [
    {
      id: 'compliance',
      title: 'Compliance Summary',
      description: 'Overview of license compliance status, expiring licenses, and flagged items',
      icon: Shield,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      stats: [
        { label: 'Compliance Rate', value: `${stats.complianceRate}%` },
        { label: 'Total Licenses', value: stats.totalLicenses },
      ],
    },
    {
      id: 'people',
      title: 'Staff Report',
      description: 'Complete list of staff members with their license status and credentials',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      stats: [
        { label: 'Total Staff', value: stats.totalPeople },
        { label: 'Active Licenses', value: stats.activeLicenses },
      ],
    },
    {
      id: 'expiring',
      title: 'Expiration Report',
      description: 'Licenses expiring in the next 30, 60, and 90 days',
      icon: Calendar,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      stats: [
        { label: 'Pending Tasks', value: stats.pendingTasks },
        { label: 'Expired', value: stats.expiredLicenses },
      ],
    },
    {
      id: 'verification',
      title: 'Verification Activity',
      description: 'Recent verification history and audit trail',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      stats: [
        { label: 'Last 30 Days', value: stats.recentVerificationsCount },
      ],
    },
  ];

  return (
    <div className="flex flex-col">
      <Header
        title="Reports"
        description="Generate and download compliance reports"
        gradient
      />
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportTypes.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${report.bgColor}`}>
                    <report.icon className={`h-5 w-5 ${report.color}`} />
                  </div>
                  <ReportActions reportType={report.id} />
                </div>
                <CardTitle className="text-lg mt-3">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  {report.stats.map((stat, idx) => (
                    <div key={idx}>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <ReportActions reportType="compliance" variant="button" label="Download Compliance Report" />
              <ReportActions reportType="expiring" variant="button" label="Download Expiration Report" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
