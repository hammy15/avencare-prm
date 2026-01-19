import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/shared/header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingExpirations } from '@/components/dashboard/upcoming-expirations';
import { PendingTasks } from '@/components/dashboard/pending-tasks';

async function getDashboardData() {
  const supabase = await createClient();

  // Get counts in parallel
  const [
    { count: totalPeople },
    { count: totalLicenses },
    { count: activeLicenses },
    { count: expiredLicenses },
    { count: needsManual },
    { count: flaggedLicenses },
    { count: pendingTasks },
    { data: upcomingExpirations },
    { data: recentVerifications },
    { data: pendingTasksList },
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
      .select('*, person:people(*)')
      .eq('archived', false)
      .not('expiration_date', 'is', null)
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .lte('expiration_date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('expiration_date', { ascending: true })
      .limit(5),
    supabase
      .from('verifications')
      .select('*, license:licenses(*, person:people(*))')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('verification_tasks')
      .select('*, license:licenses(*, person:people(*)), source:verification_sources(*)')
      .eq('status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5),
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
    upcomingExpirations: upcomingExpirations || [],
    recentVerifications: recentVerifications || [],
    pendingTasks: pendingTasksList || [],
  };
}

export default async function DashboardPage() {
  const { stats, upcomingExpirations, recentVerifications, pendingTasks } = await getDashboardData();

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        description="Overview of license verification status"
      />
      <div className="flex-1 p-6 space-y-6">
        <DashboardStats stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingExpirations licenses={upcomingExpirations} />
          <PendingTasks tasks={pendingTasks} />
        </div>

        <RecentActivity verifications={recentVerifications} />
      </div>
    </div>
  );
}
