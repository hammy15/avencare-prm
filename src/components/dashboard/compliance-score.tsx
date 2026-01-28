'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComplianceScoreProps {
  active: number;
  expired: number;
  needsManual: number;
  flagged: number;
  verifiedRecently: number;
  totalLicenses: number;
}

function getGrade(score: number): { grade: string; color: string; bgColor: string } {
  if (score >= 95) return { grade: 'A+', color: 'text-green-600', bgColor: 'bg-green-100' };
  if (score >= 90) return { grade: 'A', color: 'text-green-600', bgColor: 'bg-green-100' };
  if (score >= 85) return { grade: 'A-', color: 'text-green-600', bgColor: 'bg-green-100' };
  if (score >= 80) return { grade: 'B+', color: 'text-blue-600', bgColor: 'bg-blue-100' };
  if (score >= 75) return { grade: 'B', color: 'text-blue-600', bgColor: 'bg-blue-100' };
  if (score >= 70) return { grade: 'B-', color: 'text-blue-600', bgColor: 'bg-blue-100' };
  if (score >= 65) return { grade: 'C+', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  if (score >= 60) return { grade: 'C', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  if (score >= 55) return { grade: 'C-', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  if (score >= 50) return { grade: 'D', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  return { grade: 'F', color: 'text-red-600', bgColor: 'bg-red-100' };
}

export function ComplianceScore({
  active,
  expired,
  needsManual,
  flagged,
  verifiedRecently,
  totalLicenses,
}: ComplianceScoreProps) {
  // Calculate compliance score (0-100)
  // Formula: (active / total) * 60 + (verifiedRecently / total) * 20 + (1 - flagged/total) * 20
  const total = totalLicenses || 1;
  const activeScore = (active / total) * 60;
  const verificationScore = (verifiedRecently / total) * 20;
  const flaggedPenalty = (flagged / total) * 20;
  const expiredPenalty = (expired / total) * 10;

  const rawScore = activeScore + verificationScore + (20 - flaggedPenalty) - expiredPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const { grade, color, bgColor } = getGrade(score);

  // Determine trend (mock for now, would compare to previous period)
  const trend = score >= 80 ? 'up' : score >= 60 ? 'stable' : 'down';

  const metrics = [
    {
      label: 'Active Rate',
      value: totalLicenses > 0 ? Math.round((active / totalLicenses) * 100) : 0,
      icon: CheckCircle2,
      iconColor: 'text-green-500',
    },
    {
      label: 'Recently Verified',
      value: totalLicenses > 0 ? Math.round((verifiedRecently / totalLicenses) * 100) : 0,
      icon: CheckCircle2,
      iconColor: 'text-blue-500',
    },
    {
      label: 'Issues Found',
      value: expired + flagged,
      icon: flagged > 0 ? XCircle : AlertTriangle,
      iconColor: flagged > 0 ? 'text-red-500' : 'text-yellow-500',
      isCount: true,
    },
  ];

  return (
    <Card className="col-span-1 relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          Compliance Score
          <div className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
            {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
            {trend === 'stable' && <Minus className="h-4 w-4 text-gray-500" />}
            <span className="capitalize">{trend}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Score Circle */}
          <div className="relative">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <motion.circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                className={color}
                initial={{ strokeDasharray: '0 251.2' }}
                animate={{
                  strokeDasharray: `${(score / 100) * 251.2} 251.2`,
                }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className={`text-3xl font-bold ${color}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                {grade}
              </motion.div>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex-1 space-y-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <metric.icon className={`h-4 w-4 ${metric.iconColor}`} />
                  <span className="text-sm text-muted-foreground">{metric.label}</span>
                </div>
                <span className="text-sm font-semibold">
                  {metric.isCount ? metric.value : `${metric.value}%`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Score</span>
            <span className={`font-bold ${color}`}>{score}/100</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
