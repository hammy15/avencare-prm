'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/shared/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PersonDialog } from '@/components/people/person-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUser } from '@/hooks/use-user';
import { formatName, formatDate, formatPhone } from '@/lib/utils';
import { ArrowLeft, Edit, Trash, FileCheck, Mail, Phone, StickyNote } from 'lucide-react';
import { LoadingPage } from '@/components/shared/loading';
import { toast } from 'sonner';
import type { Person, License } from '@/types/database';

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin } = useUser();
  const [person, setPerson] = useState<(Person & { licenses: License[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPerson = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/people/${id}`);
      const result = await response.json();
      if (result.data) {
        setPerson(result.data);
      } else if (result.error) {
        toast.error(result.error);
        router.push('/people');
      }
    } catch (error) {
      console.error('Error fetching person:', error);
      toast.error('Failed to load person');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPerson();
  }, [id]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/people/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (response.ok) {
        toast.success('Person deleted successfully');
        router.push('/people');
      } else {
        toast.error(result.error || 'Failed to delete person');
      }
    } catch (error) {
      console.error('Error deleting person:', error);
      toast.error('Failed to delete person');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!person) {
    return null;
  }

  const hasLicenses = person.licenses && person.licenses.length > 0;

  return (
    <div className="flex flex-col h-full">
      <Header
        title={formatName(person.first_name, person.last_name)}
        description={`Added ${formatDate(person.created_at)}`}
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={hasLicenses}
                title={hasLicenses ? 'Cannot delete person with licenses' : undefined}
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Back link */}
        <Link
          href="/people"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to People
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{person.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{formatPhone(person.phone)}</p>
                </div>
              </div>
              {person.notes && (
                <div className="flex items-start gap-3">
                  <StickyNote className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="font-medium whitespace-pre-wrap">{person.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Licenses */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Licenses ({person.licenses?.length || 0})
              </CardTitle>
              {isAdmin && (
                <Button asChild size="sm">
                  <Link href={`/licenses/new?personId=${person.id}`}>Add License</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!hasLicenses ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No licenses found for this person.
                </p>
              ) : (
                <div className="space-y-3">
                  {person.licenses.map((license) => (
                    <Link
                      key={license.id}
                      href={`/licenses/${license.id}`}
                      className="block p-4 rounded-lg border hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {license.credential_type} - {license.state}
                          </p>
                          <p className="text-sm text-gray-500">
                            #{license.license_number}
                          </p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={license.status} />
                          {license.expiration_date && (
                            <p className="text-xs text-gray-500 mt-1">
                              Expires: {formatDate(license.expiration_date)}
                            </p>
                          )}
                        </div>
                      </div>
                      {license.archived && (
                        <p className="text-xs text-orange-600 mt-2">Archived</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PersonDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        person={person}
        onSuccess={() => {
          setEditDialogOpen(false);
          fetchPerson();
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Person"
        description={`Are you sure you want to delete ${formatName(person.first_name, person.last_name)}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
