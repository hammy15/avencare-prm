import { formatDistanceToNow, format, differenceInDays } from 'date-fns';

interface License {
  id: string;
  license_number: string;
  state: string;
  credential_type: string;
  status: string;
  expiration_date: string | null;
  last_verified_at: string | null;
  synced_data?: Record<string, unknown> | null;
  notes?: string | null;
  archived?: boolean;
  person?: {
    first_name: string;
    last_name: string;
  };
}

interface LicenseSummary {
  headline: string;
  status: 'good' | 'warning' | 'critical' | 'info';
  details: string[];
  recommendations: string[];
  riskFactors: string[];
}

export function generateLicenseSummary(license: License): LicenseSummary {
  const details: string[] = [];
  const recommendations: string[] = [];
  const riskFactors: string[] = [];
  let status: 'good' | 'warning' | 'critical' | 'info' = 'info';

  const personName = license.person
    ? `${license.person.first_name} ${license.person.last_name}`
    : 'This staff member';

  const credentialFull = getCredentialFullName(license.credential_type);

  // Headline based on license status
  let headline = '';

  if (license.archived) {
    headline = `This ${license.credential_type} license has been archived.`;
    status = 'info';
    details.push(`License #${license.license_number} in ${license.state} is no longer being tracked.`);
    return { headline, status, details, recommendations, riskFactors };
  }

  // Check status
  switch (license.status) {
    case 'active':
      status = 'good';
      headline = `${personName}'s ${license.state} ${license.credential_type} license is ACTIVE and in good standing.`;
      details.push(`This ${credentialFull} license is currently valid.`);
      break;

    case 'expired':
      status = 'critical';
      headline = `URGENT: ${personName}'s ${license.state} ${license.credential_type} license has EXPIRED.`;
      details.push(`License #${license.license_number} is no longer valid.`);
      riskFactors.push('License is expired - staff member cannot legally practice');
      recommendations.push('Immediately verify renewal status with the state board');
      recommendations.push('Remove from patient care schedule until license is renewed');
      break;

    case 'flagged':
      status = 'critical';
      headline = `ATTENTION: ${personName}'s ${license.state} ${license.credential_type} license requires immediate review.`;
      details.push('This license has been flagged for potential issues.');
      riskFactors.push('License may have disciplinary actions or restrictions');
      recommendations.push('Review synced data from state board for details');
      recommendations.push('Verify eligibility to practice');
      break;

    case 'needs_manual':
      status = 'warning';
      headline = `${personName}'s ${license.state} ${license.credential_type} license needs manual verification.`;
      details.push('Automated verification was not possible for this license.');
      recommendations.push('Manually verify license status on the state board website');
      recommendations.push('Consider contacting the state board directly');
      break;

    default:
      status = 'warning';
      headline = `${personName}'s ${license.state} ${license.credential_type} license status is unknown.`;
      details.push('The license has not been verified yet.');
      recommendations.push('Run verification to determine current status');
  }

  // Check expiration date
  if (license.expiration_date) {
    const expDate = new Date(license.expiration_date);
    const daysUntil = differenceInDays(expDate, new Date());

    if (daysUntil < 0) {
      details.push(`Expired on ${format(expDate, 'MMMM d, yyyy')} (${Math.abs(daysUntil)} days ago).`);
      if (license.status !== 'expired') {
        riskFactors.push('Expiration date has passed but status may not be updated');
      }
    } else if (daysUntil <= 30) {
      if (status !== 'critical') status = 'warning';
      details.push(`Expires on ${format(expDate, 'MMMM d, yyyy')} - only ${daysUntil} days remaining!`);
      riskFactors.push('License expires within 30 days');
      recommendations.push('Ensure renewal application is submitted immediately');
    } else if (daysUntil <= 60) {
      if (status === 'good') status = 'warning';
      details.push(`Expires on ${format(expDate, 'MMMM d, yyyy')} (${daysUntil} days remaining).`);
      recommendations.push('Begin renewal process soon');
    } else if (daysUntil <= 90) {
      details.push(`Expires on ${format(expDate, 'MMMM d, yyyy')} (${daysUntil} days remaining).`);
      recommendations.push('Plan to initiate renewal within the next month');
    } else {
      details.push(`Valid until ${format(expDate, 'MMMM d, yyyy')}.`);
    }
  } else {
    details.push('No expiration date on file.');
    recommendations.push('Verify expiration date with state board');
  }

  // Check last verification
  if (license.last_verified_at) {
    const lastVerified = new Date(license.last_verified_at);
    const daysSinceVerification = differenceInDays(new Date(), lastVerified);

    if (daysSinceVerification > 90) {
      if (status === 'good') status = 'warning';
      details.push(`Last verified ${formatDistanceToNow(lastVerified, { addSuffix: true })} - may be outdated.`);
      recommendations.push('Run a fresh verification to ensure data is current');
    } else if (daysSinceVerification > 30) {
      details.push(`Last verified ${formatDistanceToNow(lastVerified, { addSuffix: true })}.`);
    } else {
      details.push(`Recently verified ${formatDistanceToNow(lastVerified, { addSuffix: true })}.`);
    }
  } else {
    if (status !== 'critical') status = 'warning';
    details.push('This license has never been verified.');
    recommendations.push('Run verification to confirm license status');
  }

  // Add notes if present
  if (license.notes) {
    details.push(`Notes: ${license.notes}`);
  }

  return { headline, status, details, recommendations, riskFactors };
}

function getCredentialFullName(type: string): string {
  const mapping: Record<string, string> = {
    RN: 'Registered Nurse',
    LPN: 'Licensed Practical Nurse',
    LVN: 'Licensed Vocational Nurse',
    CNA: 'Certified Nursing Assistant',
    APRN: 'Advanced Practice Registered Nurse',
    NP: 'Nurse Practitioner',
    ARNP: 'Advanced Registered Nurse Practitioner',
    CRNP: 'Certified Registered Nurse Practitioner',
  };
  return mapping[type.toUpperCase()] || type;
}

// Generate a compliance summary for a person
export function generatePersonComplianceSummary(
  person: { first_name: string; last_name: string },
  licenses: License[]
): {
  grade: string;
  score: number;
  headline: string;
  details: string[];
  recommendations: string[];
} {
  if (licenses.length === 0) {
    return {
      grade: 'N/A',
      score: 0,
      headline: `${person.first_name} ${person.last_name} has no licenses on file.`,
      details: ['No credentials are being tracked for this staff member.'],
      recommendations: ['Add licenses if this person requires credentials for their role.'],
    };
  }

  const activeCount = licenses.filter(l => l.status === 'active' && !l.archived).length;
  const expiredCount = licenses.filter(l => l.status === 'expired' && !l.archived).length;
  const flaggedCount = licenses.filter(l => l.status === 'flagged' && !l.archived).length;
  const totalActive = licenses.filter(l => !l.archived).length;

  const score = totalActive > 0 ? Math.round((activeCount / totalActive) * 100) : 0;

  let grade = 'F';
  if (score >= 95) grade = 'A+';
  else if (score >= 90) grade = 'A';
  else if (score >= 85) grade = 'A-';
  else if (score >= 80) grade = 'B+';
  else if (score >= 75) grade = 'B';
  else if (score >= 70) grade = 'B-';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';

  const details: string[] = [];
  const recommendations: string[] = [];

  let headline = '';
  if (expiredCount > 0 || flaggedCount > 0) {
    headline = `${person.first_name} ${person.last_name} has ${expiredCount + flaggedCount} license(s) requiring immediate attention.`;
    if (expiredCount > 0) {
      details.push(`${expiredCount} expired license(s) need renewal.`);
      recommendations.push('Prioritize license renewals immediately.');
    }
    if (flaggedCount > 0) {
      details.push(`${flaggedCount} license(s) flagged for review.`);
      recommendations.push('Review flagged licenses for potential issues.');
    }
  } else if (score === 100) {
    headline = `${person.first_name} ${person.last_name} is fully compliant with all ${activeCount} license(s) active.`;
    details.push('All credentials are current and in good standing.');
  } else {
    headline = `${person.first_name} ${person.last_name} has ${activeCount} of ${totalActive} license(s) active.`;
    details.push(`Compliance rate: ${score}%`);
  }

  // Check for upcoming expirations
  const expiringLicenses = licenses.filter(l => {
    if (!l.expiration_date || l.archived) return false;
    const days = differenceInDays(new Date(l.expiration_date), new Date());
    return days > 0 && days <= 90;
  });

  if (expiringLicenses.length > 0) {
    details.push(`${expiringLicenses.length} license(s) expiring within 90 days.`);
    recommendations.push('Begin renewal process for expiring licenses.');
  }

  return { grade, score, headline, details, recommendations };
}
