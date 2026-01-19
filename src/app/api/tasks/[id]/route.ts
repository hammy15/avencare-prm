import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

const updateTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  due_date: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const completeTaskSchema = z.object({
  status_result: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']),
  expiration_date: z.string().optional().nullable(),
  unencumbered: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  evidence_url: z.string().url().optional().nullable(),
});

// GET /api/tasks/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('verification_tasks')
      .select(`
        *,
        license:licenses(*, person:people(*)),
        source:verification_sources(*),
        assignee:profiles!assigned_to(*),
        verification:verifications(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/tasks/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

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

    const body = await request.json();
    const validation = updateTaskSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('verification_tasks')
      .update(validation.data)
      .eq('id', id)
      .select(`
        *,
        license:licenses(*, person:people(*)),
        source:verification_sources(*),
        assignee:profiles!assigned_to(*)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await auditLog({
      action: 'update',
      entityType: 'task',
      entityId: id,
      metadata: { changes: validation.data },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tasks/[id]/complete - Complete a task with verification result
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

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

    // Get the task
    const { data: task, error: taskError } = await supabase
      .from('verification_tasks')
      .select('*, source:verification_sources(*)')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status === 'completed') {
      return NextResponse.json({ error: 'Task already completed' }, { status: 400 });
    }

    const body = await request.json();
    const validation = completeTaskSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { status_result, expiration_date, unencumbered, notes, evidence_url } = validation.data;

    // Create verification record
    const { data: verification, error: verificationError } = await supabase
      .from('verifications')
      .insert({
        license_id: task.license_id,
        run_type: 'manual',
        source_id: task.source_id,
        result: status_result === 'active' ? 'verified' :
                status_result === 'expired' ? 'expired' : 'pending',
        status_found: status_result,
        expiration_found: expiration_date,
        unencumbered,
        notes,
        evidence_url,
        verified_by: user.id,
      })
      .select()
      .single();

    if (verificationError) {
      return NextResponse.json({ error: verificationError.message }, { status: 500 });
    }

    // Update the task
    const { error: updateTaskError } = await supabase
      .from('verification_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        verification_id: verification.id,
      })
      .eq('id', id);

    if (updateTaskError) {
      return NextResponse.json({ error: updateTaskError.message }, { status: 500 });
    }

    // Update the license
    const { error: updateLicenseError } = await supabase
      .from('licenses')
      .update({
        status: status_result,
        expiration_date: expiration_date || undefined,
        last_verified_at: new Date().toISOString(),
      })
      .eq('id', task.license_id);

    if (updateLicenseError) {
      return NextResponse.json({ error: updateLicenseError.message }, { status: 500 });
    }

    await auditLog({
      action: 'task_complete',
      entityType: 'task',
      entityId: id,
      metadata: {
        verification_id: verification.id,
        status_result,
      },
    });

    return NextResponse.json({ data: { task_id: id, verification_id: verification.id } });
  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
