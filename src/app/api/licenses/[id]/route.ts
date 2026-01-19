import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

const updateLicenseSchema = z.object({
  person_id: z.string().uuid('Invalid person ID').optional(),
  state: z.string().length(2, 'State must be 2 characters').optional(),
  license_number: z.string().min(1, 'License number is required').optional(),
  credential_type: z.enum(['RN', 'LPN', 'CNA', 'APRN', 'NP']).optional(),
  status: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']).optional(),
  expiration_date: z.string().optional().nullable(),
  is_compact: z.boolean().optional(),
  compact_states: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
  archived: z.boolean().optional(),
  archived_at: z.string().optional().nullable(),
  archived_reason: z.string().optional().nullable(),
});

// GET /api/licenses/[id] - Get a single license
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('licenses')
      .select(`
        *,
        person:people(*),
        verifications:verifications(
          *,
          source:verification_sources(*),
          verifier:profiles!verified_by(*)
        ),
        tasks:verification_tasks(
          *,
          source:verification_sources(*),
          assignee:profiles!assigned_to(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'License not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort verifications by created_at desc
    if (data.verifications) {
      data.verifications.sort((a: { created_at: string }, b: { created_at: string }) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching license:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/licenses/[id] - Update a license
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateLicenseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Get the current license for audit
    const { data: current } = await supabase
      .from('licenses')
      .select('*')
      .eq('id', id)
      .single();

    if (!current) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // Handle archiving
    const updateData = { ...validation.data };
    if (validation.data.archived === true && !current.archived) {
      updateData.archived_at = new Date().toISOString();
    } else if (validation.data.archived === false && current.archived) {
      updateData.archived_at = null;
      updateData.archived_reason = null;
    }

    // Update the license
    const { data, error } = await supabase
      .from('licenses')
      .update(updateData)
      .eq('id', id)
      .select('*, person:people(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    const action = validation.data.archived === true ? 'archive' :
                   validation.data.archived === false ? 'unarchive' : 'update';

    await auditLog({
      action,
      entityType: 'license',
      entityId: id,
      metadata: {
        license_number: data.license_number,
        changes: validation.data,
      },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating license:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/licenses/[id] - Delete a license (hard delete, use archive instead)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the license for audit
    const { data: license } = await supabase
      .from('licenses')
      .select('*')
      .eq('id', id)
      .single();

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // Check if license has verifications
    const { count: verificationsCount } = await supabase
      .from('verifications')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', id);

    if (verificationsCount && verificationsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete license with verification history. Archive it instead.' },
        { status: 400 }
      );
    }

    // Delete the license
    const { error } = await supabase
      .from('licenses')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await auditLog({
      action: 'delete',
      entityType: 'license',
      entityId: id,
      metadata: {
        license_number: license.license_number,
        state: license.state,
        credential_type: license.credential_type,
      },
    });

    return NextResponse.json({ message: 'License deleted successfully' });
  } catch (error) {
    console.error('Error deleting license:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
