'use client';

import { useState } from 'react';
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
import { toast } from 'sonner';
import type { License, VerificationSource } from '@/types/database';

const verificationSchema = z.object({
  result: z.enum(['verified', 'expired', 'not_found', 'error', 'pending']),
  status_found: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']),
  expiration_found: z.string().optional().or(z.literal('')),
  licensee_name: z.string().optional().or(z.literal('')),
  unencumbered: z.boolean(),
  notes: z.string().optional().or(z.literal('')),
});

type VerificationFormData = z.infer<typeof verificationSchema>;

interface RecordVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  license: License;
  source?: VerificationSource | null;
  onSuccess: () => void;
}

export function RecordVerificationDialog({
  open,
  onOpenChange,
  license,
  source,
  onSuccess,
}: RecordVerificationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      result: 'verified',
      status_found: 'active',
      expiration_found: '',
      licensee_name: '',
      unencumbered: true,
      notes: '',
    },
  });

  const statusFound = form.watch('status_found');

  // Auto-set result based on status_found
  const handleStatusChange = (value: string) => {
    form.setValue('status_found', value as VerificationFormData['status_found']);
    if (value === 'active') {
      form.setValue('result', 'verified');
    } else if (value === 'expired') {
      form.setValue('result', 'expired');
    } else {
      form.setValue('result', 'pending');
    }
  };

  const onSubmit = async (data: VerificationFormData) => {
    try {
      setIsSubmitting(true);

      // Build synced data for caching
      const syncedData = {
        licenseNumber: license.license_number,
        licenseName: data.licensee_name || undefined,
        status: data.status_found,
        expirationDate: data.expiration_found || undefined,
        unencumbered: data.unencumbered,
        source: 'manual',
        syncedAt: new Date().toISOString(),
      };

      const response = await fetch('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_id: license.id,
          source_id: source?.id || null,
          result: data.result,
          status_found: data.status_found,
          expiration_found: data.expiration_found || null,
          licensee_name: data.licensee_name || null,
          unencumbered: data.unencumbered,
          notes: data.notes || null,
          synced_data: syncedData, // Include synced data for caching
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Verification recorded and data synced');
        form.reset();
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to record verification');
      }
    } catch (error) {
      console.error('Error recording verification:', error);
      toast.error('Failed to record verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Verification Result</DialogTitle>
          <DialogDescription>
            Record the results of your manual license verification for {license.credential_type} #{license.license_number}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status_found"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Status Found *</FormLabel>
                  <Select onValueChange={handleStatusChange} value={field.value}>
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
              control={form.control}
              name="licensee_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name on License</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Holly Chavez" />
                  </FormControl>
                  <FormDescription>
                    Enter the exact name as shown on the state registry
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
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
              control={form.control}
              name="unencumbered"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Unencumbered</FormLabel>
                    <FormDescription>
                      License has no restrictions or disciplinary actions
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      {...field}
                      placeholder="Any additional observations or details..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {statusFound === 'flagged' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  This license will be flagged for review. Please include details about any disciplinary actions in the notes.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Recording...' : 'Record Verification'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
