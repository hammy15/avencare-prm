'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/shared/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LicenseDialog } from '@/components/licenses/license-dialog';
import { RecordVerificationDialog } from '@/components/licenses/record-verification-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StatusBadge, StateBadge, CredentialBadge, EligibilityBadge } from '@/components/shared/status-badge';
import { useUser } from '@/hooks/use-user';
import { formatName, formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Edit, Archive, ArchiveRestore, ExternalLink, User, MapPin, FileCheck, History, ClipboardList, Search, CheckCircle, Zap, Loader2, Shield, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { LoadingPage } from '@/components/shared/loading';
import { toast } from 'sonner';
import type { License, Person, Verification, VerificationTask, VerificationSource, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

type LicenseWithRelations = License & {
  person: Person;
  verifications: (Verification & { source: VerificationSource | null; verifier: Profile | null })[];
  tasks: (VerificationTask & { source: VerificationSource | null; assignee: Profile | null })[];
};

// Helper to determine eligibility
function getEligibility(license: License): 'eligible' | 'ineligible' | 'needs-review' {
  if (license.status === 'active' && !license.archived) {
    return 'eligible';
  }
  if (license.status === 'expired' || license.status === 'flagged' || license.archived) {
    return 'ineligible';
  }
  return 'needs-review';
}

// Helper to check if expiring soon (within 30 days)
function isExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const expDate = new Date(date);
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return expDate <= thirtyDaysFromNow && expDate > new Date();
}

// Helper to check if verification is stale (older than 30 days)
function isVerificationStale(date: string | null): boolean {
  if (!date) return true;
  const verifyDate = new Date(date);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return verifyDate < thirtyDaysAgo;
}

export default function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin } = useUser();
  const [license, setLicense] = useState<LicenseWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [verificationSource, setVerificationSource] = useState<VerificationSource | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [autoVerifyAvailable, setAutoVerifyAvailable] = useState(false);
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);

  const fetchLicense = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/licenses/${id}`);
      const result = await response.json();
      if (result.data) {
        setLicense(result.data);
      } else if (result.error) {
        toast.error(result.error);
        router.push('/licenses');
      }
    } catch (error) {
      console.error('Error fetching license:', error);
      toast.error('Failed to load license');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLicense();
  }, [id]);

  // Fetch verification source for this license's state
  useEffect(() => {
    const fetchSource = async () => {
      if (!license) return;

      const supabase = createClient();

      // Get the source type based on credential type
      const sourceType = license.credential_type === 'CNA' ? 'cna_registry' : 'bon';

      // First try to find a state-specific source
      let { data, error } = await supabase
        .from('verification_sources')
        .select('*')
        .eq('state', license.state)
        .eq('source_type', sourceType)
        .eq('active', true)
        .single();

      // If no state-specific source, try to find a national source
      if (error || !data) {
        const { data: nationalSource } = await supabase
          .from('verification_sources')
          .select('*')
          .is('state', null)
          .eq('source_type', sourceType)
          .eq('active', true)
          .single();
        data = nationalSource;
      }

      // If still no source, try Nursys as fallback for nurses
      if (!data && license.credential_type !== 'CNA') {
        const { data: nursysSource } = await supabase
          .from('verification_sources')
          .select('*')
          .eq('source_type', 'nursys')
          .eq('active', true)
          .single();
        data = nursysSource;
      }

      setVerificationSource(data);
    };

    fetchSource();
  }, [license?.id, license?.state, license?.credential_type]);

  // Check if auto-verification is available for this license
  useEffect(() => {
    const checkAutoVerify = async () => {
      if (!license) return;

      try {
        const response = await fetch(`/api/licenses/${id}/verify`);
        const result = await response.json();
        setAutoVerifyAvailable(result.available);
      } catch {
        setAutoVerifyAvailable(false);
      }
    };

    checkAutoVerify();
  }, [id, license?.state]);

  const handleAutoVerify = async () => {
    if (!license) return;

    try {
      setIsAutoVerifying(true);
      const response = await fetch(`/api/licenses/${id}/verify`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('License verified automatically');
        fetchLicense();
      } else {
        toast.error(result.error || 'Auto-verification failed', {
          description: result.details,
        });
      }
    } catch (error) {
      console.error('Error auto-verifying:', error);
      toast.error('Failed to auto-verify license');
    } finally {
      setIsAutoVerifying(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!license) return;

    try {
      setIsArchiving(true);
      const response = await fetch(`/api/licenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archived: !license.archived,
          archived_reason: !license.archived ? 'Archived by user' : null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(license.archived ? 'License unarchived' : 'License archived');
        fetchLicense();
      } else {
        toast.error(result.error || 'Failed to update license');
      }
    } catch (error) {
      console.error('Error archiving license:', error);
      toast.error('Failed to update license');
    } finally {
      setIsArchiving(false);
      setArchiveDialogOpen(false);
    }
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!license) {
    return null;
  }

  const eligibility = getEligibility(license);
  const expiringSoon = isExpiringSoon(license.expiration_date);
  const verificationStale = isVerificationStale(license.last_verified_at);

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`${license.credential_type} License`}
        description={`${license.state} • #${license.license_number}`}
        gradient
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant={license.archived ? 'default' : 'secondary'}
                onClick={() => setArchiveDialogOpen(true)}
              >
                {license.archived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    Unarchive
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </>
                )}
              </Button>
            </div>
          )
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Back link */}
        <Link
          href="/licenses"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Licenses
        </Link>

        {/* Alert banners */}
        <div className="space-y-3">
          {license.archived && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-center gap-3">
              <Archive className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">This license is archived</p>
                {license.archived_reason && (
                  <p className="text-sm text-muted-foreground">Reason: {license.archived_reason}</p>
                )}
              </div>
            </div>
          )}

          {eligibility === 'ineligible' && !license.archived && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-status-expired" />
              <div>
                <p className="text-sm font-medium text-status-expired">Not Eligible for Staffing</p>
                <p className="text-sm text-red-600">
                  This license {license.status === 'expired' ? 'has expired' : 'is flagged'} and cannot be used for staffing.
                </p>
              </div>
            </div>
          )}

          {expiringSoon && !license.archived && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-status-pending" />
              <div>
                <p className="text-sm font-medium text-amber-800">Expiring Soon</p>
                <p className="text-sm text-amber-600">
                  This license expires on {formatDate(license.expiration_date)}. Consider renewal.
                </p>
              </div>
            </div>
          )}

          {verificationStale && !license.archived && eligibility !== 'ineligible' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-blue-800">Verification Needed</p>
                <p className="text-sm text-blue-600">
                  {license.last_verified_at
                    ? `Last verified ${formatDate(license.last_verified_at)}. Consider re-verifying.`
                    : 'This license has never been verified.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Compliance Summary Card */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Eligibility</p>
                  <EligibilityBadge eligibility={eligibility} className="mt-0.5" />
                </div>
              </div>

              <div className="h-10 w-px bg-border" />

              <div>
                <p className="text-sm text-muted-foreground">Credential</p>
                <CredentialBadge type={license.credential_type} className="mt-0.5" />
              </div>

              <div className="h-10 w-px bg-border" />

              <div>
                <p className="text-sm text-muted-foreground">State</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <StateBadge state={license.state} />
                  {license.is_compact && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      Compact
                    </span>
                  )}
                </div>
              </div>

              <div className="h-10 w-px bg-border" />

              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <StatusBadge status={license.status} className="mt-0.5" />
              </div>

              <div className="h-10 w-px bg-border hidden lg:block" />

              <div className="hidden lg:block">
                <p className="text-sm text-muted-foreground">License Number</p>
                <code className="text-sm font-medium bg-muted px-2 py-0.5 rounded mt-0.5 inline-block">
                  {license.license_number}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* License Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                License Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Credential Type</p>
                <p className="font-medium mt-1">{license.credential_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">State</p>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{license.state}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">License Number</p>
                <code className="font-medium font-mono mt-1 block">{license.license_number}</code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Expiration Date</p>
                <p className={`font-medium mt-1 ${expiringSoon ? 'text-status-pending' : license.status === 'expired' ? 'text-status-expired' : ''}`}>
                  {formatDate(license.expiration_date) || 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Verified</p>
                <p className={`font-medium mt-1 ${verificationStale ? 'text-muted-foreground' : 'text-status-active'}`}>
                  {license.last_verified_at ? formatDateTime(license.last_verified_at) : 'Never'}
                </p>
              </div>
              {license.notes && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p>
                  <p className="text-sm whitespace-pre-wrap mt-1">{license.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Person Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                License Holder
              </CardTitle>
            </CardHeader>
            <CardContent>
              {license.person ? (
                <Link
                  href={`/people/${license.person.id}`}
                  className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all"
                >
                  <p className="font-medium text-lg">
                    {formatName(license.person.first_name, license.person.last_name)}
                  </p>
                  {license.person.email && (
                    <p className="text-sm text-muted-foreground">{license.person.email}</p>
                  )}
                  <p className="text-sm text-primary mt-2 flex items-center gap-1">
                    View profile
                    <ExternalLink className="h-3 w-3" />
                  </p>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">No person associated</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Verification Summary</CardTitle>
              <CardDescription>Overview of verification activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Verifications</span>
                <span className="font-semibold">{license.verifications?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Tasks</span>
                <span className="font-semibold">
                  {license.tasks?.filter((t) => t.status === 'pending').length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Last Result</span>
                {license.verifications?.[0] ? (
                  <StatusBadge status={license.verifications[0].result} />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Synced Data Section - Show cached verification data */}
        {license.synced_data && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-blue-900">
                  <FileCheck className="h-5 w-5" />
                  Synced Data from State Registry
                </span>
                <span className="text-xs font-normal text-blue-600">
                  Last synced: {formatDateTime(license.synced_at)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {license.synced_data.licenseName && (
                  <div>
                    <p className="text-xs text-blue-600">Name on Record</p>
                    <p className="font-medium text-blue-900">{license.synced_data.licenseName}</p>
                  </div>
                )}
                {license.synced_data.status && (
                  <div>
                    <p className="text-xs text-blue-600">Status</p>
                    <p className="font-medium text-blue-900 capitalize">{license.synced_data.status}</p>
                  </div>
                )}
                {license.synced_data.expirationDate && (
                  <div>
                    <p className="text-xs text-blue-600">Expiration</p>
                    <p className="font-medium text-blue-900">{formatDate(license.synced_data.expirationDate)}</p>
                  </div>
                )}
                {license.synced_data.unencumbered !== undefined && (
                  <div>
                    <p className="text-xs text-blue-600">Encumbrances</p>
                    <p className="font-medium text-blue-900">
                      {license.synced_data.unencumbered ? 'None' : 'Has encumbrances'}
                    </p>
                  </div>
                )}
              </div>
              {license.synced_data.rawData && Object.keys(license.synced_data.rawData).length > 0 && (
                <details className="mt-4">
                  <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                    View raw data from source
                  </summary>
                  <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-40 border border-blue-200">
                    {JSON.stringify(license.synced_data.rawData, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {/* Research License Section */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Verify License
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show message when auto-verify is not available */}
              {!autoVerifyAvailable && ['RN', 'LPN', 'APRN', 'NP', 'CNS', 'CNM', 'CRNA'].includes(license.credential_type) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>{license.state} {license.credential_type}</strong> licenses require manual verification via Nursys.
                    Click the button below to open the Nursys lookup, then record your findings.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  {verificationSource ? (
                    <>
                      <p className="font-medium">{verificationSource.display_name}</p>
                      {verificationSource.instructions && (
                        <p className="text-sm text-gray-500">{verificationSource.instructions}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No verification source configured for {license.state} {license.credential_type} licenses.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {autoVerifyAvailable && (
                    <Button
                      onClick={handleAutoVerify}
                      disabled={isAutoVerifying}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isAutoVerifying ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      {isAutoVerifying ? 'Verifying...' : 'Auto Verify'}
                    </Button>
                  )}
                  {/* Nursys button for RN types when auto-verify not available */}
                  {!autoVerifyAvailable && ['RN', 'LPN', 'APRN', 'NP', 'CNS', 'CNM', 'CRNA'].includes(license.credential_type) && (
                    <Button
                      variant="default"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => window.open('https://www.nursys.com/LQC/LQCSearch.aspx', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Nursys Lookup
                    </Button>
                  )}
                  {verificationSource?.lookup_url && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(verificationSource.lookup_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open {verificationSource.state || 'State'} Lookup
                    </Button>
                  )}
                  <Button onClick={() => setRecordDialogOpen(true)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Record Verification
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for History */}
        <Tabs defaultValue="verifications" className="w-full">
          <TabsList>
            <TabsTrigger value="verifications" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Verification History ({license.verifications?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Tasks ({license.tasks?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verifications" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {!license.verifications || license.verifications.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No verification history yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {license.verifications.map((verification) => (
                      <div
                        key={verification.id}
                        className="flex items-start justify-between p-4 rounded-lg border"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={verification.result} />
                            <span className="text-sm text-gray-500 capitalize">
                              {verification.run_type}
                            </span>
                          </div>
                          {verification.source && (
                            <p className="text-sm text-gray-600">
                              via {verification.source.display_name}
                            </p>
                          )}
                          {verification.notes && (
                            <p className="text-sm text-gray-500">{verification.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {formatDateTime(verification.created_at)}
                          </p>
                          {verification.verifier && (
                            <p className="text-xs text-gray-400">
                              by {verification.verifier.full_name || verification.verifier.email}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {!license.tasks || license.tasks.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No tasks for this license.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {license.tasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="block p-4 rounded-lg border hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <StatusBadge status={task.status} />
                            {task.source && (
                              <p className="text-sm text-gray-600">
                                {task.source.display_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {task.due_date && (
                              <p className="text-sm text-gray-500">
                                Due: {formatDate(task.due_date)}
                              </p>
                            )}
                            {task.assignee && (
                              <p className="text-xs text-gray-400">
                                Assigned to {task.assignee.full_name || task.assignee.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <LicenseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        license={license}
        onSuccess={() => {
          setEditDialogOpen(false);
          fetchLicense();
        }}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title={license.archived ? 'Unarchive License' : 'Archive License'}
        description={
          license.archived
            ? 'Are you sure you want to unarchive this license? It will become active in the system again.'
            : 'Are you sure you want to archive this license? It will be hidden from the main list but the history will be preserved.'
        }
        confirmLabel={license.archived ? 'Unarchive' : 'Archive'}
        variant={license.archived ? 'default' : 'destructive'}
        onConfirm={handleArchiveToggle}
        isLoading={isArchiving}
      />

      <RecordVerificationDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        license={license}
        source={verificationSource}
        onSuccess={() => {
          setRecordDialogOpen(false);
          fetchLicense();
        }}
      />
    </div>
  );
}
