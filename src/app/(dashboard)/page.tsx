import { createAdminClient } from '@/lib/supabase/server';
import { QuickVerifySection } from '@/components/verification/quick-verify-section';
import { ComplianceScore } from '@/components/dashboard/compliance-score';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import Link from 'next/link';
import {
  Shield,
  Users,
  FileCheck,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  Clock
} from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const supabase = createAdminClient();

  const [
    { count: totalPeople },
    { count: totalLicenses },
    { count: activeLicenses },
    { count: expiredLicenses },
    { count: needsManual },
    { count: flaggedLicenses },
    { data: recentVerifications },
  ] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'expired').eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'needs_manual').eq('archived', false),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'flagged').eq('archived', false),
    supabase
      .from('verifications')
      .select('*, license:licenses(*, person:people(*))')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const complianceRate = (totalLicenses || 0) > 0
    ? Math.round(((activeLicenses || 0) / (totalLicenses || 1)) * 100)
    : 0;

  return {
    stats: {
      totalPeople: totalPeople || 0,
      totalLicenses: totalLicenses || 0,
      activeLicenses: activeLicenses || 0,
      expiredLicenses: expiredLicenses || 0,
      needsManual: needsManual || 0,
      flaggedLicenses: flaggedLicenses || 0,
      complianceRate,
    },
    recentVerifications: recentVerifications || [],
  };
}

export default async function HomePage() {
  const { stats, recentVerifications } = await getDashboardData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left - Title and CTA */}
            <div className="text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">Avencare License Check</h1>
              </div>
              <p className="text-teal-100 text-lg max-w-md">
                Verify healthcare credentials instantly. Keep your team compliant.
              </p>
            </div>

            {/* Right - Quick Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{stats.totalLicenses}</div>
                <div className="text-teal-200 text-sm">Total Licenses</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-300">{stats.activeLicenses}</div>
                <div className="text-teal-200 text-sm">Active</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-300">{stats.needsManual + stats.expiredLicenses}</div>
                <div className="text-teal-200 text-sm">Need Attention</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Verify Section */}
        <div className="mb-8">
          <QuickVerifySection />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link href="/people" className="group">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalPeople}</div>
              <div className="text-sm text-gray-500">Staff Members</div>
            </div>
          </Link>

          <Link href="/licenses?status=active" className="group">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileCheck className="h-5 w-5 text-green-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-green-600 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.activeLicenses}</div>
              <div className="text-sm text-gray-500">Active Licenses</div>
            </div>
          </Link>

          <Link href="/licenses?status=expired" className="group">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-red-200 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Clock className="h-5 w-5 text-red-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-red-600 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-red-600">{stats.expiredLicenses}</div>
              <div className="text-sm text-gray-500">Expired</div>
            </div>
          </Link>

          <Link href="/licenses?status=flagged" className="group">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-amber-200 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-amber-600">{stats.flaggedLicenses}</div>
              <div className="text-sm text-gray-500">Flagged</div>
            </div>
          </Link>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Compliance Score */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-600" />
                Compliance Score
              </h2>
              <ComplianceScore
                active={stats.activeLicenses}
                expired={stats.expiredLicenses}
                needsManual={stats.needsManual}
                flagged={stats.flaggedLicenses}
                verifiedRecently={stats.activeLicenses}
                totalLicenses={stats.totalLicenses}
              />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <RecentActivity verifications={recentVerifications as any} />
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/imports" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-center">
            <div className="text-gray-600 text-sm font-medium">Import CSV</div>
          </Link>
          <Link href="/reports" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-center">
            <div className="text-gray-600 text-sm font-medium">Reports</div>
          </Link>
          <Link href="/verifications" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-center">
            <div className="text-gray-600 text-sm font-medium">History</div>
          </Link>
          <Link href="/sources" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-center">
            <div className="text-gray-600 text-sm font-medium">Sources</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
