'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/shared/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/use-user';
import { Settings, Shield, Database, Zap, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/shared/loading';

interface OCRStatus {
  provider: string;
  configured: boolean;
  availableProviders: string[];
}

export default function SettingsPage() {
  const { profile, isAdmin } = useUser();
  const [ocrStatus, setOcrStatus] = useState<OCRStatus | null>(null);
  const [isTestingCron, setIsTestingCron] = useState(false);

  useEffect(() => {
    const fetchOCRStatus = async () => {
      try {
        const response = await fetch('/api/ocr');
        const result = await response.json();
        if (result.data) {
          setOcrStatus(result.data);
        }
      } catch (error) {
        console.error('Error fetching OCR status:', error);
      }
    };

    fetchOCRStatus();
  }, []);

  const handleTestCron = async () => {
    setIsTestingCron(true);
    try {
      // This would require the CRON_SECRET which is server-side only
      toast.info('Cron job can only be triggered from the server or Vercel dashboard.');
    } catch (error) {
      toast.error('Failed to trigger cron job');
    } finally {
      setIsTestingCron(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Settings" description="System configuration" />
        <div className="flex-1 p-6">
          <p className="text-gray-500">You do not have permission to view settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" description="System configuration and status" />

      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{profile?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{profile?.full_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <Badge variant="outline" className="capitalize mt-1">
                  {profile?.role}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* OCR Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                OCR Configuration
              </CardTitle>
              <CardDescription>
                Optical character recognition for document processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ocrStatus ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Provider</p>
                    <p className="font-medium capitalize">
                      {ocrStatus.provider === 'none' ? 'Not configured' : ocrStatus.provider}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant={ocrStatus.configured ? 'default' : 'secondary'}>
                      {ocrStatus.configured ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Available Providers</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ocrStatus.availableProviders.map((p) => (
                        <Badge key={p} variant="outline" className="capitalize">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <LoadingSpinner />
              )}
            </CardContent>
          </Card>

          {/* Database Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database
              </CardTitle>
              <CardDescription>Supabase connection status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Provider</p>
                <p className="font-medium">Supabase (PostgreSQL)</p>
              </div>
            </CardContent>
          </Card>

          {/* Cron Job */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Monthly Verification Job
              </CardTitle>
              <CardDescription>
                Automated license verification scheduling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Endpoint</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  /api/cron/monthly-verification
                </code>
              </div>
              <div>
                <p className="text-sm text-gray-500">Schedule</p>
                <p className="font-medium">Monthly (configured in Vercel)</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Authentication</p>
                <p className="font-medium">CRON_SECRET header</p>
              </div>
              <Button
                variant="outline"
                onClick={handleTestCron}
                disabled={isTestingCron}
              >
                {isTestingCron ? 'Testing...' : 'Test Job Info'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Environment Variables Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Environment Variables
            </CardTitle>
            <CardDescription>
              Required environment variables for this application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm space-y-1">
              <p className="text-green-600"># Supabase</p>
              <p>NEXT_PUBLIC_SUPABASE_URL=</p>
              <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=</p>
              <p>SUPABASE_SERVICE_ROLE_KEY=</p>
              <p className="text-green-600 mt-4"># Cron Security</p>
              <p>CRON_SECRET=</p>
              <p className="text-green-600 mt-4"># OCR (optional)</p>
              <p>OCR_PROVIDER=azure|google|tesseract|none</p>
              <p>AZURE_VISION_ENDPOINT=</p>
              <p>AZURE_VISION_KEY=</p>
              <p>GOOGLE_VISION_API_KEY=</p>
              <p className="text-green-600 mt-4"># Nursys e-Notify (optional)</p>
              <p>NURSYS_ENOTIFY_API_URL=</p>
              <p>NURSYS_ENOTIFY_API_KEY=</p>
              <p>NURSYS_ENOTIFY_ORG_ID=</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
