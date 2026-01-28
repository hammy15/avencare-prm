import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

const quickVerifySchema = z.object({
  person: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    facility_id: z.string().uuid().optional().nullable(),
  }),
  license: z.object({
    state: z.string().min(2),
    license_number: z.string().min(1),
    credential_type: z.enum(['RN', 'LPN', 'LVN', 'CNA', 'APRN', 'NP']),
    status: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']),
    expiration_date: z.string().optional().nullable(),
  }),
  verification: z.object({
    source_id: z.string().uuid().optional().nullable(),
    result: z.enum(['verified', 'expired', 'not_found', 'error', 'pending']),
    status_found: z.enum(['active', 'expired', 'needs_manual', 'flagged', 'unknown']),
    expiration_found: z.string().optional().nullable(),
    unencumbered: z.boolean().optional(),
    notes: z.string().optional().nullable(),
  }),
});

// POST /api/quick-verify - Create person, license, and verification in one transaction
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Auth is handled by middleware (cookie-based)

    const body = await request.json();
    const validation = quickVerifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { person: personData, license: licenseData, verification: verificationData } = validation.data;

    // Check if license already exists
    const { data: existingLicense } = await supabase
      .from('licenses')
      .select('id, person:people!inner(first_name, last_name)')
      .eq('state', licenseData.state)
      .eq('license_number', licenseData.license_number)
      .eq('credential_type', licenseData.credential_type)
      .eq('archived', false)
      .single();

    if (existingLicense) {
      const personData = existingLicense.person as unknown as { first_name: string; last_name: string } | null;
      return NextResponse.json(
        {
          error: 'License already exists',
          details: `This license is already in the database for ${personData?.first_name || ''} ${personData?.last_name || ''}`.trim(),
          license_id: existingLicense.id
        },
        { status: 409 }
      );
    }

    // Create person
    const { data: person, error: personError } = await supabase
      .from('people')
      .insert({
        first_name: personData.first_name,
        last_name: personData.last_name,
        email: personData.email || null,
        phone: personData.phone || null,
        facility_id: personData.facility_id || null,
      })
      .select()
      .single();

    if (personError) {
      return NextResponse.json({ error: personError.message }, { status: 500 });
    }

    // Create license
    const { data: license, error: licenseError } = await supabase
      .from('licenses')
      .insert({
        person_id: person.id,
        state: licenseData.state,
        license_number: licenseData.license_number,
        credential_type: licenseData.credential_type,
        status: licenseData.status,
        expiration_date: licenseData.expiration_date || null,
        last_verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (licenseError) {
      // Rollback person creation
      await supabase.from('people').delete().eq('id', person.id);
      return NextResponse.json({ error: licenseError.message }, { status: 500 });
    }

    // Create verification record
    const { data: verification, error: verificationError } = await supabase
      .from('verifications')
      .insert({
        license_id: license.id,
        run_type: 'manual',
        source_id: verificationData.source_id || null,
        result: verificationData.result,
        status_found: verificationData.status_found,
        expiration_found: verificationData.expiration_found || null,
        unencumbered: verificationData.unencumbered,
        notes: verificationData.notes || null,
        verified_by: null, // Using cookie-based auth
      })
      .select()
      .single();

    if (verificationError) {
      console.error('Error creating verification:', verificationError);
      // Don't fail the whole operation for verification error
    }

    await auditLog({
      action: 'quick_verify',
      entityType: 'license',
      entityId: license.id,
      metadata: {
        person_id: person.id,
        verification_id: verification?.id,
        status: licenseData.status,
      },
    });

    return NextResponse.json({
      data: {
        person,
        license,
        verification,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error in quick verify:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
