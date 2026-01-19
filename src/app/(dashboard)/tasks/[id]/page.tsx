'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/shared/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUser } from '@/hooks/use-user';
import { formatName, formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, ExternalLink, User, FileCheck, CheckCircle } from 'lucide-react';
import { LoadingPage } from '@/components/shared/loading';
import { toast } from 'sonner';
import type { VerificationTask, License, Person, VerificationSource, Profile, Verification } from '@/types/database';

type TaskWithRelations = VerificationTask & {
  license: License & { person: Person };
  source: VerificationSource | null;
  assignee: Profile | null;
  verification: Verification | null;
};

const completeSchema = z.object({
  status_result: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']),
  expiration_date: z.string().optional().or(z.literal('')),
  unencumbered: z.boolean(),
  notes: z.string().optional().or(z.literal('')),
});

type CompleteFormData = z.infer<typeof completeSchema>;

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin } = useUser();
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CompleteFormData>({
    resolver: zodResolver(completeSchema),
    defaultValues: {
      status_result: 'active',
      expiration_date: '',
      unencumbered: true,
      notes: '',
    },
  });

  const fetchTask = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/tasks/${id}`);
      const result = await response.json();
      if (result.data) {
        setTask(result.data);
        // Pre-fill form with license data
        if (result.data.license) {
          form.setValue('expiration_date', result.data.license.expiration_date?.split('T')[0] || '');
        }
      } else if (result.error) {
        toast.error(result.error);
        router.push('/tasks');
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      toast.error('Failed to load task');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, [id]);

  const onSubmit = async (data: CompleteFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/tasks/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          expiration_date: data.expiration_date || null,
          notes: data.notes || null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Task completed successfully');
        router.push('/tasks');
      } else {
        toast.error(result.error || 'Failed to complete task');
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!task) {
    return null;
  }

  const isCompleted = task.status === 'completed';

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Verification Task"
        description={task.source?.display_name || 'Manual Verification'}
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Back link */}
        <Link
          href="/tasks"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Tasks
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Task Status
                <StatusBadge status={task.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Priority</p>
                <p className="font-medium">{task.priority}</p>
              </div>
              {task.due_date && (
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium">{formatDate(task.due_date)}</p>
                </div>
              )}
              {task.assignee && (
                <div>
                  <p className="text-sm text-gray-500">Assigned To</p>
                  <p className="font-medium">{task.assignee.full_name || task.assignee.email}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">{formatDateTime(task.created_at)}</p>
              </div>
              {isCompleted && task.completed_at && (
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="font-medium">{formatDateTime(task.completed_at)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* License Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                License Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.license && (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Credential</p>
                    <p className="font-medium">{task.license.credential_type} - {task.license.state}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">License Number</p>
                    <p className="font-medium font-mono">{task.license.license_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Current Status</p>
                    <StatusBadge status={task.license.status} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Expiration</p>
                    <p className="font-medium">{formatDate(task.license.expiration_date)}</p>
                  </div>
                  <Link
                    href={`/licenses/${task.license.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                  >
                    View license <ExternalLink className="h-3 w-3" />
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          {/* Person Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                License Holder
              </CardTitle>
            </CardHeader>
            <CardContent>
              {task.license?.person ? (
                <Link
                  href={`/people/${task.license.person.id}`}
                  className="block p-4 rounded-lg border hover:border-gray-300 transition-colors"
                >
                  <p className="font-medium">
                    {formatName(task.license.person.first_name, task.license.person.last_name)}
                  </p>
                  {task.license.person.email && (
                    <p className="text-sm text-gray-500">{task.license.person.email}</p>
                  )}
                </Link>
              ) : (
                <p className="text-sm text-gray-500">No person associated</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Verification Source */}
        {task.source && (
          <Card>
            <CardHeader>
              <CardTitle>Verification Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{task.source.display_name}</p>
                  {task.source.instructions && (
                    <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{task.source.instructions}</p>
                  )}
                </div>
                {task.source.lookup_url && (
                  <Button asChild variant="outline">
                    <a href={task.source.lookup_url} target="_blank" rel="noopener noreferrer">
                      Open Source <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Form */}
        {!isCompleted && isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Complete Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status_result"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verification Result *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                              <SelectItem value="flagged">Flagged</SelectItem>
                              <SelectItem value="needs_manual">Needs Further Review</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
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
                    name="unencumbered"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Unencumbered</FormLabel>
                          <FormDescription>
                            License has no restrictions, limitations, or disciplinary actions
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
                          <Textarea rows={3} {...field} placeholder="Any additional notes about this verification..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/tasks')}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Completing...' : 'Complete Task'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Completed Info */}
        {isCompleted && task.verification && (
          <Card>
            <CardHeader>
              <CardTitle>Verification Result</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Result</p>
                  <StatusBadge status={task.verification.result} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status Found</p>
                  <StatusBadge status={task.verification.status_found || 'unknown'} />
                </div>
                {task.verification.expiration_found && (
                  <div>
                    <p className="text-sm text-gray-500">Expiration Found</p>
                    <p className="font-medium">{formatDate(task.verification.expiration_found)}</p>
                  </div>
                )}
                {task.verification.notes && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="whitespace-pre-wrap">{task.verification.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
