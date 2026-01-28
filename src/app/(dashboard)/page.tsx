import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/shared/header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingExpirations } from '@/components/dashboard/upcoming-expirations';
import { PendingTasks } from '@/components/dashboard/pending-tasks';
import { ComplianceChart } from '@/components/dashboard/compliance-chart';
import { ComplianceScore } from '@/components/dashboard/compliance-score';
import { ExpirationTimeline } from '@/components/dashboard/expiration-timeline';
import { VerificationTrends } from '@/components/dashboard/verification-trends';
import { StateCoverage } from '@/components/dashboard/state-coverage';

async function getDashboardData() {
  const supabase = await createClient();

  // Calculate date for "recently verified" (within last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get counts and data in parallel
  const [
    { count: totalPeople },
    { count: totalLicenses },
    { count: activeLicenses },
    { count: expiredLicenses },
    { count: needsManual },
    { count: flaggedLicenses },
    { count: pendingTasks },
    { count: recentlyVerified },
    { data: upcomingExpirations },
    { data: recentVerifications },
    { data: pendingTasksList },
    { data: allLicenses },
    { data: allVerifications },
  ] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'expired').eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'needs_manual').eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'flagged').eq('archived', false),
    supabase.from('verification_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false)
      .gte('last_verified_at', thirtyDaysAgo),
    supabase
      .from('licenses')
      .select('*, person:people(*)')
      .eq('archived', false)
      .not('expiration_date', 'is', null)
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .lte('expiration_date', new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('expiration_date', { ascending: true }),
    supabase
      .from('verifications')
      .select('*, license:licenses(*, person:people(*))')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('verification_tasks')
      .select('*, license:licenses(*, person:people(*)), source:verification_sources(*)')
      .eq('status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from('licenses')
      .select('id, state, status, expiration_date, credential_type')
      .eq('archived', false),
    supabase
      .from('verifications')
      .select('id, created_at, result, run_type')
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }),
  ]);

  return {
    stats: {
      total_people: totalPeople || 0,
      total_licenses: totalLicenses || 0,
      active_licenses: activeLicenses || 0,
      expired_licenses: expiredLicenses || 0,
      needs_manual: needsManual || 0,
      flagged_licenses: flaggedLicenses || 0,
      pending_tasks: pendingTasks || 0,
      upcoming_expirations: upcomingExpirations?.length || 0,
    },
    complianceData: {
      active: activeLicenses || 0,
      expired: expiredLicenses || 0,
      needsManual: needsManual || 0,
      flagged: flaggedLicenses || 0,
      verifiedRecently: recentlyVerified || 0,
      totalLicenses: totalLicenses || 0,
    },
    upcomingExpirations: upcomingExpirations || [],
    recentVerifications: recentVerifications || [],
    pendingTasks: pendingTasksList || [],
    allLicenses: allLicenses || [],
    allVerifications: allVerifications || [],
  };
}

export default async function DashboardPage() {
  const {
    stats,
    complianceData,
    upcomingExpirations,
    recentVerifications,
    pendingTasks,
    allLicenses,
    allVerifications,
  } = await getDashboardData();

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        description="Real-time license verification and compliance overview"
        gradient
      />
      <div className="flex-1 p-6 space-y-6">
        {/* Quick Stats */}
        <DashboardStats stats={stats} />

        {/* Analytics Row - Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ComplianceScore {...complianceData} />
          <ComplianceChart
            active={complianceData.active}
            expired={complianceData.expired}
            needsManual={complianceData.needsManual}
            flagged={complianceData.flagged}
          />
          <StateCoverage licenses={allLicenses} />
        </div>

        {/* Timeline and Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ExpirationTimeline licenses={allLicenses} />
          <VerificationTrends verifications={allVerifications} />
        </div>

        {/* Action Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingExpirations licenses={upcomingExpirations.slice(0, 5)} />
          <PendingTasks tasks={pendingTasks} />
        </div>

        {/* Recent Activity */}
        <RecentActivity verifications={recentVerifications} />
      </div>
    </div>
  );
}
