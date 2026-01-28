import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

const createLicenseSchema = z.object({
  person_id: z.string().uuid('Invalid person ID'),
  state: z.string().length(2, 'State must be 2 characters'),
  license_number: z.string().min(1, 'License number is required'),
  credential_type: z.enum(['RN', 'LPN', 'LVN', 'CNA', 'APRN', 'NP']),
  status: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']).optional(),
  expiration_date: z.string().optional().nullable(),
  is_compact: z.boolean().optional(),
  compact_states: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/licenses - List all licenses
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const state = searchParams.get('state');
    const credentialType = searchParams.get('credentialType');
    const archived = searchParams.get('archived') === 'true';
    const personId = searchParams.get('personId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    let query = supabase
      .from('licenses')
      .select('*, person:people(*)', { count: 'exact' });

    // Filters
    query = query.eq('archived', archived);

    if (search) {
      query = query.or(`license_number.ilike.%${search}%,person.first_name.ilike.%${search}%,person.last_name.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (state) {
      query = query.eq('state', state);
    }
    if (credentialType) {
      query = query.eq('credential_type', credentialType);
    }
    if (personId) {
      query = query.eq('person_id', personId);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    console.error('Error fetching licenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/licenses - Create a new license
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Auth is handled by middleware (cookie-based)

    // Parse and validate request body
    const body = await request.json();
    const validation = createLicenseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Check for duplicate active license
    const { data: existing } = await supabase
      .from('licenses')
      .select('id')
      .eq('state', validation.data.state)
      .eq('license_number', validation.data.license_number)
      .eq('credential_type', validation.data.credential_type)
      .eq('archived', false)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A license with this state, number, and type already exists' },
        { status: 400 }
      );
    }

    // Create the license
    const { data, error } = await supabase
      .from('licenses')
      .insert({
        ...validation.data,
        status: validation.data.status || 'unknown',
      })
      .select('*, person:people(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await auditLog({
      action: 'create',
      entityType: 'license',
      entityId: data.id,
      metadata: {
        license_number: data.license_number,
        state: data.state,
        credential_type: data.credential_type,
      },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating license:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
