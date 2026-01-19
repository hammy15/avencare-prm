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
import type { VerificationSource } from '@/types/database';

const US_STATES = [
  '', 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const SOURCE_TYPES = ['bon', 'cna_registry', 'nursys', 'other'] as const;

const sourceSchema = z.object({
  state: z.string().optional(),
  source_type: z.enum(SOURCE_TYPES),
  display_name: z.string().min(1, 'Display name is required'),
  lookup_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  instructions: z.string().optional().or(z.literal('')),
  supports_api: z.boolean(),
  api_endpoint: z.string().url('Invalid URL').optional().or(z.literal('')),
  active: z.boolean(),
});

type SourceFormData = z.infer<typeof sourceSchema>;

interface SourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: VerificationSource | null;
  onSuccess: () => void;
}

export function SourceDialog({ open, onOpenChange, source, onSuccess }: SourceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!source;

  const form = useForm<SourceFormData>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      state: 'national',
      source_type: 'bon',
      display_name: '',
      lookup_url: '',
      instructions: '',
      supports_api: false,
      api_endpoint: '',
      active: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (source) {
        form.reset({
          state: source.state || 'national',
          source_type: source.source_type,
          display_name: source.display_name,
          lookup_url: source.lookup_url || '',
          instructions: source.instructions || '',
          supports_api: source.supports_api,
          api_endpoint: source.api_endpoint || '',
          active: source.active,
        });
      } else {
        form.reset({
          state: 'national',
          source_type: 'bon',
          display_name: '',
          lookup_url: '',
          instructions: '',
          supports_api: false,
          api_endpoint: '',
          active: true,
        });
      }
    }
  }, [open, source, form]);

  const onSubmit = async (data: SourceFormData) => {
    try {
      setIsSubmitting(true);

      const url = isEditing ? `/api/sources/${source.id}` : '/api/sources';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          state: data.state === 'national' || !data.state ? null : data.state,
          lookup_url: data.lookup_url || null,
          instructions: data.instructions || null,
          api_endpoint: data.api_endpoint || null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(isEditing ? 'Source updated' : 'Source created');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to save source');
      }
    } catch (error) {
      console.error('Error saving source:', error);
      toast.error('Failed to save source');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Source' : 'Add Source'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="source_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bon">Board of Nursing</SelectItem>
                        <SelectItem value="cna_registry">CNA Registry</SelectItem>
                        <SelectItem value="nursys">Nursys</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
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
                    <FormLabel>State</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="National" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="national">National (All States)</SelectItem>
                        {US_STATES.filter(s => s).map((state) => (
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
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Washington State Nursing Commission" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lookup_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lookup URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} placeholder="How to verify a license using this source..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supports_api"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Supports API</FormLabel>
                    <FormDescription>
                      This source has an API for automated verification
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

            {form.watch('supports_api') && (
              <FormField
                control={form.control}
                name="api_endpoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Endpoint</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://api.example.com/verify" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Only active sources are used for verification
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
