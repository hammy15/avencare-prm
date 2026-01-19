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
import type { License, Person } from '@/types/database';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const CREDENTIAL_TYPES = ['RN', 'LPN', 'CNA', 'APRN', 'NP'] as const;
const STATUS_OPTIONS = ['active', 'expired', 'needs_manual', 'flagged', 'unknown'] as const;

const licenseSchema = z.object({
  person_id: z.string().min(1, 'Person is required'),
  state: z.string().length(2, 'State is required'),
  license_number: z.string().min(1, 'License number is required'),
  credential_type: z.enum(CREDENTIAL_TYPES),
  status: z.enum(STATUS_OPTIONS),
  expiration_date: z.string().optional().or(z.literal('')),
  is_compact: z.boolean(),
  notes: z.string().optional().or(z.literal('')),
});

type LicenseFormData = z.infer<typeof licenseSchema>;

interface LicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  license?: License | null;
  defaultPersonId?: string;
  onSuccess: () => void;
}

export function LicenseDialog({
  open,
  onOpenChange,
  license,
  defaultPersonId,
  onSuccess,
}: LicenseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const isEditing = !!license;

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      person_id: defaultPersonId || '',
      state: '',
      license_number: '',
      credential_type: 'RN',
      status: 'unknown',
      expiration_date: '',
      is_compact: false,
      notes: '',
    },
  });

  // Fetch people for dropdown
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await fetch('/api/people?pageSize=1000');
        const result = await response.json();
        if (result.data) {
          setPeople(result.data);
        }
      } catch (error) {
        console.error('Error fetching people:', error);
      }
    };

    if (open) {
      fetchPeople();
    }
  }, [open]);

  // Reset form when dialog opens/closes or license changes
  useEffect(() => {
    if (open) {
      if (license) {
        form.reset({
          person_id: license.person_id,
          state: license.state,
          license_number: license.license_number,
          credential_type: license.credential_type,
          status: license.status,
          expiration_date: license.expiration_date
            ? license.expiration_date.split('T')[0]
            : '',
          is_compact: license.is_compact,
          notes: license.notes || '',
        });
      } else {
        form.reset({
          person_id: defaultPersonId || '',
          state: '',
          license_number: '',
          credential_type: 'RN',
          status: 'unknown',
          expiration_date: '',
          is_compact: false,
          notes: '',
        });
      }
    }
  }, [open, license, defaultPersonId, form]);

  const onSubmit = async (data: LicenseFormData) => {
    try {
      setIsSubmitting(true);

      const url = isEditing ? `/api/licenses/${license.id}` : '/api/licenses';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          expiration_date: data.expiration_date || null,
          notes: data.notes || null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(isEditing ? 'License updated successfully' : 'License created successfully');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to save license');
      }
    } catch (error) {
      console.error('Error saving license:', error);
      toast.error('Failed to save license');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit License' : 'Add License'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="person_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Person *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a person" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.first_name} {person.last_name}
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
                control={form.control}
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
                        {CREDENTIAL_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
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
            </div>

            <FormField
              control={form.control}
              name="license_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiration_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_compact"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Compact License</FormLabel>
                    <FormDescription>
                      This license is part of the Nurse Licensure Compact
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
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
