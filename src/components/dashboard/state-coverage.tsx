'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface License {
  id: string;
  state: string;
  status: string;
}

interface StateCoverageProps {
  licenses: License[];
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// States with auto-verify scrapers implemented (14 states)
const AUTO_VERIFY_STATES = ['WA', 'OR', 'ID', 'AK', 'MT', 'AZ', 'CA', 'TX', 'FL', 'NY', 'NC', 'GA', 'OH', 'PA'];

export function StateCoverage({ licenses }: StateCoverageProps) {
  // Group licenses by state
  const stateStats = US_STATES.map(state => {
    const stateLicenses = licenses.filter(l => l.state === state);
    const active = stateLicenses.filter(l => l.status === 'active').length;
    const total = stateLicenses.length;
    const hasAutoVerify = AUTO_VERIFY_STATES.includes(state);

    return {
      state,
      total,
      active,
      hasAutoVerify,
      complianceRate: total > 0 ? Math.round((active / total) * 100) : null,
    };
  }).sort((a, b) => b.total - a.total);

  const statesWithLicenses = stateStats.filter(s => s.total > 0);
  const statesWithAutoVerify = statesWithLicenses.filter(s => s.hasAutoVerify).length;
  const totalStatesCount = statesWithLicenses.length;

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          State Coverage
          <Badge variant="outline" className="font-normal">
            {totalStatesCount} states
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {statesWithAutoVerify} with auto-verify
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[180px] pr-4">
          {statesWithLicenses.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No licenses tracked yet
            </div>
          ) : (
            <div className="space-y-2">
              {statesWithLicenses.map(({ state, total, active, hasAutoVerify, complianceRate }) => (
                <div
                  key={state}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-10 justify-center font-mono">
                      {state}
                    </Badge>
                    <span className="text-sm">
                      {active}/{total}
                    </span>
                    {hasAutoVerify && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        Auto
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {complianceRate !== null && (
                      <>
                        {complianceRate >= 80 && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {complianceRate >= 50 && complianceRate < 80 && (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        {complianceRate < 50 && (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm font-medium ${
                          complianceRate >= 80 ? 'text-green-600' :
                          complianceRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {complianceRate}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
