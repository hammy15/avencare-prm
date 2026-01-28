'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle, XCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { QuickVerifyDialog } from './quick-verify-dialog';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const CREDENTIAL_TYPES = [
  { value: 'RN', label: 'RN - Registered Nurse' },
  { value: 'LPN', label: 'LPN - Licensed Practical Nurse' },
  { value: 'LVN', label: 'LVN - Licensed Vocational Nurse' },
  { value: 'CNA', label: 'CNA - Certified Nursing Assistant' },
  { value: 'APRN', label: 'APRN - Advanced Practice RN' },
  { value: 'NP', label: 'NP - Nurse Practitioner' },
];

// State board lookup URLs
const STATE_LOOKUP_URLS: Record<string, string> = {
  WA: 'https://doh.wa.gov/licenses-permits-and-certificates/provider-credential-search',
  OR: 'https://osbn.oregon.gov/verify',
  CA: 'https://www.rn.ca.gov/verify.shtml',
  TX: 'https://www.bon.texas.gov/verify_a_license.asp',
  FL: 'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders',
  NY: 'https://www.op.nysed.gov/verification-search',
  AZ: 'https://azbn.gov/licensure/verification',
  ID: 'https://ibn.idaho.gov/IBNPortal/LicenseVerification.aspx',
  MT: 'https://ebiz.mt.gov/pol/',
  AK: 'https://www.commerce.alaska.gov/cbp/main/search/professional',
  GA: 'https://sos.ga.gov/PLB/lookup',
  NC: 'https://portal.ncbon.com/verification/search.aspx',
  OH: 'https://elicense.ohio.gov/oh_verifylicense',
  PA: 'https://www.pals.pa.gov/#!/page/search',
};

interface VerificationResult {
  status: 'active' | 'expired' | 'not_found' | 'error';
  message: string;
  details?: {
    name?: string;
    expirationDate?: string;
    licenseNumber?: string;
  };
}

export function QuickVerifySection() {
  const [state, setState] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [credentialType, setCredentialType] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleSearch = async () => {
    if (!state || !licenseNumber) return;

    setIsSearching(true);
    setResult(null);

    try {
      // Check if license exists in our database
      const response = await fetch(
        `/api/licenses?search=${encodeURIComponent(licenseNumber)}&state=${state}`
      );
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const license = data.data[0];
        setResult({
          status: license.status === 'active' ? 'active' :
                  license.status === 'expired' ? 'expired' : 'error',
          message: license.status === 'active'
            ? 'License found and verified active in our system'
            : `License found with status: ${license.status}`,
          details: {
            name: license.person ? `${license.person.first_name} ${license.person.last_name}` : undefined,
            expirationDate: license.expiration_date,
            licenseNumber: license.license_number,
          },
        });
      } else {
        // License not in our system - show option to add
        setResult({
          status: 'not_found',
          message: 'License not found in our database. Verify externally and add to system.',
        });
      }
    } catch (error) {
      setResult({
        status: 'error',
        message: 'Error searching for license. Please try again.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'expired':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'not_found':
        return <AlertCircle className="h-6 w-6 text-amber-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Expired</Badge>;
      case 'not_found':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Not Found</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const lookupUrl = state ? STATE_LOOKUP_URLS[state] : null;

  return (
    <>
      <Card className="border-2 border-teal-100 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Search className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Quick License Verification</h2>
              <p className="text-sm text-gray-500">Search and verify healthcare credentials</p>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="state" className="text-gray-700">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="state" className="mt-1">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="credentialType" className="text-gray-700">Credential Type</Label>
              <Select value={credentialType} onValueChange={setCredentialType}>
                <SelectTrigger id="credentialType" className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CREDENTIAL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="licenseNumber" className="text-gray-700">License Number</Label>
              <Input
                id="licenseNumber"
                placeholder="Enter license #"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={!state || !licenseNumber || isSearching}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Verify
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* External lookup link */}
          {lookupUrl && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-700">
                Verify directly at {state} Board of Nursing
              </span>
              <a
                href={lookupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Open {state} Lookup
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`p-4 rounded-lg ${
              result.status === 'active' ? 'bg-green-50 border border-green-200' :
              result.status === 'expired' ? 'bg-red-50 border border-red-200' :
              result.status === 'not_found' ? 'bg-amber-50 border border-amber-200' :
              'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(result.status)}
                    {result.details?.name && (
                      <span className="font-medium text-gray-900">{result.details.name}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{result.message}</p>
                  {result.details?.expirationDate && (
                    <p className="text-sm text-gray-500 mt-1">
                      Expires: {new Date(result.details.expirationDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {result.status === 'not_found' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddDialog(true)}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Add to System
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <QuickVerifyDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </>
  );
}
