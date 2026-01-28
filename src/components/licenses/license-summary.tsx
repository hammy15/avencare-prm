'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Lightbulb,
  AlertOctagon,
} from 'lucide-react';
import { generateLicenseSummary } from '@/lib/summaries/license-summary';

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

interface LicenseSummaryCardProps {
  license: License;
}

const statusConfig = {
  good: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    badgeVariant: 'default' as const,
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
    badgeVariant: 'secondary' as const,
  },
  critical: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    badgeVariant: 'destructive' as const,
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    badgeVariant: 'outline' as const,
  },
};

export function LicenseSummaryCard({ license }: LicenseSummaryCardProps) {
  const summary = generateLicenseSummary(license);
  const config = statusConfig[summary.status];
  const StatusIcon = config.icon;

  return (
    <Card className={`border ${config.bgColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <StatusIcon className={`h-6 w-6 ${config.color} mt-0.5`} />
          <div className="flex-1">
            <CardTitle className="text-base leading-snug">{summary.headline}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Details */}
        <div className="space-y-1.5">
          {summary.details.map((detail, idx) => (
            <p key={idx} className="text-sm text-muted-foreground">
              {detail}
            </p>
          ))}
        </div>

        {/* Risk Factors */}
        {summary.riskFactors.length > 0 && (
          <Alert variant="destructive" className="bg-red-50">
            <AlertOctagon className="h-4 w-4" />
            <AlertTitle>Risk Factors</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {summary.riskFactors.map((risk, idx) => (
                  <li key={idx} className="text-sm">{risk}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Recommendations */}
        {summary.recommendations.length > 0 && (
          <div className="bg-white/60 rounded-lg p-3 border">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Recommendations</span>
            </div>
            <ul className="space-y-1">
              {summary.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact inline summary for list views
export function LicenseSummaryBadge({ license }: LicenseSummaryCardProps) {
  const summary = generateLicenseSummary(license);
  const config = statusConfig[summary.status];
  const StatusIcon = config.icon;

  return (
    <Badge variant={config.badgeVariant} className="gap-1">
      <StatusIcon className="h-3 w-3" />
      {summary.status === 'good' && 'Compliant'}
      {summary.status === 'warning' && 'Review Needed'}
      {summary.status === 'critical' && 'Action Required'}
      {summary.status === 'info' && 'Unknown'}
    </Badge>
  );
}
