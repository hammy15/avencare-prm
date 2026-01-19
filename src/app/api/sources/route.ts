import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

const createSourceSchema = z.object({
  state: z.string().length(2).optional().nullable(),
  source_type: z.enum(['bon', 'cna_registry', 'nursys', 'other']),
  display_name: z.string().min(1, 'Display name is required'),
  lookup_url: z.string().url().optional().nullable(),
  instructions: z.string().optional().nullable(),
  supports_api: z.boolean().optional(),
  api_endpoint: z.string().url().optional().nullable(),
  api_config: z.record(z.string(), z.unknown()).optional().nullable(),
  active: z.boolean().optional(),
});

// GET /api/sources - List all verification sources
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const state = searchParams.get('state');
    const sourceType = searchParams.get('sourceType');
    const active = searchParams.get('active');

    let query = supabase.from('verification_sources').select('*');

    if (state) {
      query = query.eq('state', state);
    }
    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }
    if (active !== null) {
      query = query.eq('active', active === 'true');
    }

    query = query.order('state', { ascending: true, nullsFirst: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching sources:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/sources - Create a new source
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const validation = createSourceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('verification_sources')
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await auditLog({
      action: 'create',
      entityType: 'source',
      entityId: data.id,
      metadata: { display_name: data.display_name },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating source:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
