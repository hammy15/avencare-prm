import { createClient } from '@/lib/supabase/server';

export interface ComplianceReportData {
  generatedAt: string;
  summary: {
    totalPeople: number;
    totalLicenses: number;
    activeLicenses: number;
    expiredLicenses: number;
    flaggedLicenses: number;
    needsManualVerification: number;
    complianceRate: number;
    complianceGrade: string;
  };
  expiringLicenses: Array<{
    personName: string;
    licenseNumber: string;
    state: string;
    credentialType: string;
    expirationDate: string;
    daysUntilExpiration: number;
  }>;
  flaggedItems: Array<{
    personName: string;
    licenseNumber: string;
    state: string;
    status: string;
    lastVerified: string | null;
    notes: string | null;
  }>;
  recentVerifications: Array<{
    personName: string;
    licenseNumber: string;
    state: string;
    verifiedAt: string;
    result: string;
    verifiedBy: string | null;
  }>;
  stateBreakdown: Array<{
    state: string;
    total: number;
    active: number;
    expired: number;
    complianceRate: number;
  }>;
}

function getComplianceGrade(rate: number): string {
  if (rate >= 95) return 'A+';
  if (rate >= 90) return 'A';
  if (rate >= 85) return 'A-';
  if (rate >= 80) return 'B+';
  if (rate >= 75) return 'B';
  if (rate >= 70) return 'B-';
  if (rate >= 65) return 'C+';
  if (rate >= 60) return 'C';
  if (rate >= 55) return 'C-';
  if (rate >= 50) return 'D';
  return 'F';
}

export async function generateComplianceReport(): Promise<ComplianceReportData> {
  const supabase = await createClient();
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Fetch all data in parallel
  const [
    { count: totalPeople },
    { data: licenses },
    { data: recentVerifications },
  ] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }),
    supabase
      .from('licenses')
      .select('*, person:people(first_name, last_name)')
      .eq('archived', false),
    supabase
      .from('verifications')
      .select('*, license:licenses(license_number, state, person:people(first_name, last_name)), verifier:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const allLicenses = licenses || [];

  // Calculate summary stats
  const activeLicenses = allLicenses.filter(l => l.status === 'active').length;
  const expiredLicenses = allLicenses.filter(l => l.status === 'expired').length;
  const flaggedLicenses = allLicenses.filter(l => l.status === 'flagged').length;
  const needsManual = allLicenses.filter(l => l.status === 'needs_manual').length;
  const totalLicenses = allLicenses.length;
  const complianceRate = totalLicenses > 0 ? Math.round((activeLicenses / totalLicenses) * 100) : 0;

  // Get expiring licenses (next 90 days)
  const expiringLicenses = allLicenses
    .filter(l => {
      if (!l.expiration_date) return false;
      const expDate = new Date(l.expiration_date);
      return expDate >= now && expDate <= ninetyDaysFromNow;
    })
    .map(l => ({
      personName: l.person ? `${l.person.first_name} ${l.person.last_name}` : 'Unknown',
      licenseNumber: l.license_number,
      state: l.state,
      credentialType: l.credential_type,
      expirationDate: l.expiration_date!,
      daysUntilExpiration: Math.ceil((new Date(l.expiration_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

  // Get flagged items
  const flaggedItems = allLicenses
    .filter(l => l.status === 'flagged' || l.status === 'expired')
    .map(l => ({
      personName: l.person ? `${l.person.first_name} ${l.person.last_name}` : 'Unknown',
      licenseNumber: l.license_number,
      state: l.state,
      status: l.status,
      lastVerified: l.last_verified_at,
      notes: l.notes,
    }));

  // Format recent verifications
  const formattedVerifications = (recentVerifications || []).map(v => ({
    personName: v.license?.person ? `${v.license.person.first_name} ${v.license.person.last_name}` : 'Unknown',
    licenseNumber: v.license?.license_number || 'N/A',
    state: v.license?.state || 'N/A',
    verifiedAt: v.created_at,
    result: v.result,
    verifiedBy: v.verifier?.full_name || (v.run_type === 'automated' ? 'Automated' : null),
  }));

  // Calculate state breakdown
  const stateMap = new Map<string, { total: number; active: number; expired: number }>();
  for (const license of allLicenses) {
    const existing = stateMap.get(license.state) || { total: 0, active: 0, expired: 0 };
    existing.total++;
    if (license.status === 'active') existing.active++;
    if (license.status === 'expired') existing.expired++;
    stateMap.set(license.state, existing);
  }

  const stateBreakdown = Array.from(stateMap.entries())
    .map(([state, stats]) => ({
      state,
      total: stats.total,
      active: stats.active,
      expired: stats.expired,
      complianceRate: stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalPeople: totalPeople || 0,
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      flaggedLicenses,
      needsManualVerification: needsManual,
      complianceRate,
      complianceGrade: getComplianceGrade(complianceRate),
    },
    expiringLicenses,
    flaggedItems,
    recentVerifications: formattedVerifications,
    stateBreakdown,
  };
}

// Generate HTML for the report (for PDF conversion)
export function generateReportHTML(data: ComplianceReportData): string {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Compliance Report - ${formatDate(data.generatedAt)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; padding: 40px; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #0d9488; padding-bottom: 20px; }
    .header h1 { font-size: 28px; color: #0d9488; margin-bottom: 8px; }
    .header p { color: #6b7280; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 18px; font-weight: 600; color: #0d9488; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .summary-card { background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .value { font-size: 32px; font-weight: 700; color: #111827; }
    .summary-card .label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .summary-card.grade { background: ${data.summary.complianceRate >= 80 ? '#d1fae5' : data.summary.complianceRate >= 60 ? '#fef3c7' : '#fee2e2'}; }
    .summary-card.grade .value { color: ${data.summary.complianceRate >= 80 ? '#059669' : data.summary.complianceRate >= 60 ? '#d97706' : '#dc2626'}; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; color: #374151; }
    tr:nth-child(even) { background: #f9fafb; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-green { background: #d1fae5; color: #059669; }
    .badge-red { background: #fee2e2; color: #dc2626; }
    .badge-yellow { background: #fef3c7; color: #d97706; }
    .badge-gray { background: #e5e7eb; color: #6b7280; }
    .urgent { color: #dc2626; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>License Compliance Report</h1>
    <p>Generated on ${formatDate(data.generatedAt)}</p>
  </div>

  <div class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="summary-grid">
      <div class="summary-card grade">
        <div class="value">${data.summary.complianceGrade}</div>
        <div class="label">Compliance Grade</div>
      </div>
      <div class="summary-card">
        <div class="value">${data.summary.complianceRate}%</div>
        <div class="label">Compliance Rate</div>
      </div>
      <div class="summary-card">
        <div class="value">${data.summary.totalLicenses}</div>
        <div class="label">Total Licenses</div>
      </div>
      <div class="summary-card">
        <div class="value">${data.summary.totalPeople}</div>
        <div class="label">Staff Members</div>
      </div>
    </div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="value" style="color: #059669;">${data.summary.activeLicenses}</div>
        <div class="label">Active</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: #dc2626;">${data.summary.expiredLicenses}</div>
        <div class="label">Expired</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: #f97316;">${data.summary.flaggedLicenses}</div>
        <div class="label">Flagged</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: #d97706;">${data.summary.needsManualVerification}</div>
        <div class="label">Needs Review</div>
      </div>
    </div>
  </div>

  ${data.expiringLicenses.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Upcoming Expirations (Next 90 Days)</h2>
    <table>
      <thead>
        <tr>
          <th>Staff Member</th>
          <th>License</th>
          <th>State</th>
          <th>Type</th>
          <th>Expires</th>
          <th>Days Left</th>
        </tr>
      </thead>
      <tbody>
        ${data.expiringLicenses.slice(0, 15).map(l => `
        <tr>
          <td>${l.personName}</td>
          <td>${l.licenseNumber}</td>
          <td><span class="badge badge-gray">${l.state}</span></td>
          <td>${l.credentialType}</td>
          <td>${formatDate(l.expirationDate)}</td>
          <td class="${l.daysUntilExpiration <= 30 ? 'urgent' : ''}">${l.daysUntilExpiration} days</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${data.flaggedItems.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Flagged & Expired Licenses</h2>
    <table>
      <thead>
        <tr>
          <th>Staff Member</th>
          <th>License</th>
          <th>State</th>
          <th>Status</th>
          <th>Last Verified</th>
        </tr>
      </thead>
      <tbody>
        ${data.flaggedItems.slice(0, 15).map(l => `
        <tr>
          <td>${l.personName}</td>
          <td>${l.licenseNumber}</td>
          <td><span class="badge badge-gray">${l.state}</span></td>
          <td><span class="badge ${l.status === 'expired' ? 'badge-red' : 'badge-yellow'}">${l.status}</span></td>
          <td>${l.lastVerified ? formatDate(l.lastVerified) : 'Never'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">License Distribution by State</h2>
    <table>
      <thead>
        <tr>
          <th>State</th>
          <th>Total</th>
          <th>Active</th>
          <th>Expired</th>
          <th>Compliance</th>
        </tr>
      </thead>
      <tbody>
        ${data.stateBreakdown.map(s => `
        <tr>
          <td><span class="badge badge-gray">${s.state}</span></td>
          <td>${s.total}</td>
          <td>${s.active}</td>
          <td>${s.expired}</td>
          <td><span class="badge ${s.complianceRate >= 80 ? 'badge-green' : s.complianceRate >= 60 ? 'badge-yellow' : 'badge-red'}">${s.complianceRate}%</span></td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>This report was automatically generated by Cascadia License Check</p>
    <p>For questions, contact your compliance administrator</p>
  </div>
</body>
</html>
  `.trim();
}
