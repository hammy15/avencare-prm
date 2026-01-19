import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

const createVerificationSchema = z.object({
  license_id: z.string().uuid(),
  source_id: z.string().uuid().optional().nullable(),
  result: z.enum(['verified', 'expired', 'not_found', 'error', 'pending']),
  status_found: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']).optional().nullable(),
  expiration_found: z.string().optional().nullable(),
  licensee_name: z.string().optional().nullable(),
  unencumbered: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  evidence_url: z.string().url().optional().nullable(),
  synced_data: z.object({
    licenseNumber: z.string().optional(),
    licenseName: z.string().optional(),
    status: z.string().optional(),
    expirationDate: z.string().optional(),
    unencumbered: z.boolean().optional(),
    source: z.string().optional(),
    syncedAt: z.string().optional(),
  }).optional().nullable(),
});

// GET /api/verifications - List verification history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const licenseId = searchParams.get('licenseId');
    const result = searchParams.get('result');
    const runType = searchParams.get('runType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    let query = supabase
      .from('verifications')
      .select(
        '*, license:licenses(*, person:people(*)), source:verification_sources(*), verifier:profiles!verified_by(full_name, email)',
        { count: 'exact' }
      );

    if (licenseId) {
      query = query.eq('license_id', licenseId);
    }
    if (result) {
      query = query.eq('result', result);
    }
    if (runType) {
      query = query.eq('run_type', runType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

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
    console.error('Error fetching verifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/verifications - Create a manual verification record
export async function POST(request: NextRequest) {
  try {
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
    const validation = createVerificationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { license_id, source_id, result, status_found, expiration_found, licensee_name, unencumbered, notes, evidence_url, synced_data } = validation.data;

    // Create verification record
    const { data: verification, error: verificationError } = await supabase
      .from('verifications')
      .insert({
        license_id,
        run_type: 'manual',
        source_id: source_id || null,
        result,
        status_found: status_found || null,
        expiration_found: expiration_found || null,
        unencumbered,
        notes: notes || null,
        evidence_url: evidence_url || null,
        verified_by: user.id,
        raw_response: synced_data || null,
      })
      .select(`
        *,
        source:verification_sources(*),
        verifier:profiles!verified_by(full_name, email)
      `)
      .single();

    if (verificationError) {
      return NextResponse.json({ error: verificationError.message }, { status: 500 });
    }

    // Update the license with verification results and synced data
    const updateData: Record<string, unknown> = {
      last_verified_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };

    if (status_found) {
      updateData.status = status_found;
    }
    if (expiration_found) {
      updateData.expiration_date = expiration_found;
    }
    if (licensee_name) {
      updateData.licensee_name = licensee_name;
    }
    // Save synced data for quick lookup (replaces old data)
    if (synced_data) {
      updateData.synced_data = synced_data;
    }

    const { error: updateLicenseError } = await supabase
      .from('licenses')
      .update(updateData)
      .eq('id', license_id);

    if (updateLicenseError) {
      console.error('Error updating license:', updateLicenseError);
    }

    await auditLog({
      action: 'verification_create',
      entityType: 'verification',
      entityId: verification.id,
      metadata: {
        license_id,
        result,
        status_found,
        run_type: 'manual',
      },
    });

    return NextResponse.json({ data: verification });
  } catch (error) {
    console.error('Error creating verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
