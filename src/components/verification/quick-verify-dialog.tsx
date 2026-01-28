'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { ExternalLink, Search, CheckCircle, UserPlus, ArrowRight, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { VerificationSource, Facility } from '@/types/database';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const CREDENTIAL_TYPES = ['RN', 'LPN', 'LVN', 'CNA', 'APRN', 'NP'] as const;

// Step 1: License lookup info
const lookupSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  state: z.string().min(2, 'State is required'),
  license_number: z.string().min(1, 'License number is required'),
  credential_type: z.enum(CREDENTIAL_TYPES),
});

// Step 3: Verification result
const resultSchema = z.object({
  status_found: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']),
  expiration_found: z.string().optional().or(z.literal('')),
  unencumbered: z.boolean(),
  notes: z.string().optional().or(z.literal('')),
  save_to_database: z.boolean(),
  facility_id: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});

type LookupFormData = z.infer<typeof lookupSchema>;
type ResultFormData = z.infer<typeof resultSchema>;

interface QuickVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QuickVerifyDialog({ open, onOpenChange, onSuccess }: QuickVerifyDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookupData, setLookupData] = useState<LookupFormData | null>(null);
  const [verificationSource, setVerificationSource] = useState<VerificationSource | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const lookupForm = useForm<LookupFormData>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      state: '',
      license_number: '',
      credential_type: 'RN',
    },
  });

  const resultForm = useForm<ResultFormData>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      status_found: 'active',
      expiration_found: '',
      unencumbered: true,
      notes: '',
      save_to_database: true,
      facility_id: '',
      email: '',
      phone: '',
    },
  });

  const saveToDatabase = resultForm.watch('save_to_database');

  // Fetch facilities for the dropdown
  useEffect(() => {
    const fetchFacilities = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('facilities')
        .select('*')
        .eq('active', true)
        .order('name');
      if (data) {
        setFacilities(data);
      }
    };
    if (open) {
      fetchFacilities();
    }
  }, [open]);

  // Fetch verification source when lookup data changes
  useEffect(() => {
    const fetchSource = async () => {
      if (!lookupData) return;

      const supabase = createClient();
      const sourceType = lookupData.credential_type === 'CNA' ? 'cna_registry' : 'bon';

      // Try state-specific source first
      let { data } = await supabase
        .from('verification_sources')
        .select('*')
        .eq('state', lookupData.state)
        .eq('source_type', sourceType)
        .eq('active', true)
        .single();

      // Fallback to national source
      if (!data) {
        const { data: nationalSource } = await supabase
          .from('verification_sources')
          .select('*')
          .is('state', null)
          .eq('source_type', sourceType)
          .eq('active', true)
          .single();
        data = nationalSource;
      }

      // Fallback to Nursys for nurses
      if (!data && lookupData.credential_type !== 'CNA') {
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
  }, [lookupData]);

  const handleLookupSubmit = (data: LookupFormData) => {
    setLookupData(data);
    setStep(2);
  };

  const handleResultSubmit = async (data: ResultFormData) => {
    if (!lookupData) return;

    try {
      setIsSubmitting(true);

      if (data.save_to_database) {
        // Create person and license in database
        const response = await fetch('/api/quick-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person: {
              first_name: lookupData.first_name,
              last_name: lookupData.last_name,
              email: data.email || null,
              phone: data.phone || null,
              facility_id: data.facility_id || null,
            },
            license: {
              state: lookupData.state,
              license_number: lookupData.license_number,
              credential_type: lookupData.credential_type,
              status: data.status_found,
              expiration_date: data.expiration_found || null,
            },
            verification: {
              source_id: verificationSource?.id || null,
              result: data.status_found === 'active' ? 'verified' :
                      data.status_found === 'expired' ? 'expired' : 'pending',
              status_found: data.status_found,
              expiration_found: data.expiration_found || null,
              unencumbered: data.unencumbered,
              notes: data.notes || null,
            },
          }),
        });

        const result = await response.json();

        if (response.ok) {
          toast.success('License verified and saved to database');
          resetAndClose();
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to save verification');
        }
      } else {
        // Just log the verification without saving person/license
        toast.success('Verification recorded (not saved to database)');
        resetAndClose();
      }
    } catch (error) {
      console.error('Error saving verification:', error);
      toast.error('Failed to save verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setLookupData(null);
    setVerificationSource(null);
    lookupForm.reset();
    resultForm.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetAndClose();
      else onOpenChange(open);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Quick License Verification
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Enter the license information to look up'}
            {step === 2 && 'Research the license using the source below'}
            {step === 3 && 'Record your verification findings'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : step > s
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
          ))}
        </div>

        {/* Step 1: Lookup Form */}
        {step === 1 && (
          <Form {...lookupForm}>
            <form onSubmit={lookupForm.handleSubmit(handleLookupSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={lookupForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={lookupForm.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Smith" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={lookupForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={lookupForm.control}
                  name="credential_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credential Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="RN">RN - Registered Nurse</SelectItem>
                          <SelectItem value="LPN">LPN - Licensed Practical Nurse</SelectItem>
                          <SelectItem value="CNA">CNA - Certified Nursing Assistant</SelectItem>
                          <SelectItem value="APRN">APRN - Advanced Practice RN</SelectItem>
                          <SelectItem value="NP">NP - Nurse Practitioner</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={lookupForm.control}
                name="license_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="RN12345678" className="font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button type="submit">
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Step 2: Research */}
        {step === 2 && lookupData && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <p className="font-medium">
                    {lookupData.first_name} {lookupData.last_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {lookupData.credential_type} - {lookupData.state} - #{lookupData.license_number}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                {verificationSource ? (
                  <div className="space-y-3">
                    <p className="font-medium">{verificationSource.display_name}</p>
                    {verificationSource.instructions && (
                      <p className="text-sm text-gray-500">{verificationSource.instructions}</p>
                    )}
                    {verificationSource.lookup_url && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(verificationSource.lookup_url!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open {verificationSource.state || 'National'} License Lookup
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No verification source configured for {lookupData.state} {lookupData.credential_type} licenses.
                    You can still record your verification manually.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(3)}>
                Record Results
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Record Results */}
        {step === 3 && lookupData && (
          <Form {...resultForm}>
            <form onSubmit={resultForm.handleSubmit(handleResultSubmit)} className="space-y-4">
              <FormField
                control={resultForm.control}
                name="status_found"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Status Found *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="needs_manual">Needs Manual Review</SelectItem>
                        <SelectItem value="flagged">Flagged/Disciplinary Action</SelectItem>
                        <SelectItem value="unknown">Could Not Verify</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resultForm.control}
                name="expiration_found"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date Found</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resultForm.control}
                name="unencumbered"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Unencumbered</FormLabel>
                      <FormDescription className="text-xs">
                        No restrictions or disciplinary actions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={resultForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} placeholder="Additional observations..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4 mt-4">
                <FormField
                  control={resultForm.control}
                  name="save_to_database"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-blue-50">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4" />
                          Save to Database
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Add this person and license to your records
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {saveToDatabase && (
                  <div className="mt-4 space-y-4 p-3 border rounded-lg bg-gray-50">
                    <FormField
                      control={resultForm.control}
                      name="facility_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facility</FormLabel>
                          <Select onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select facility (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">No facility</SelectItem>
                              {facilities.map((facility) => (
                                <SelectItem key={facility.id} value={facility.id}>
                                  {facility.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={resultForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="Optional" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resultForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Optional" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : saveToDatabase ? 'Save & Complete' : 'Complete'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
