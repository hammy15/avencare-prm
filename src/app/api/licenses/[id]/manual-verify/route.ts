import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

const manualVerifySchema = z.object({
  result: z.enum(['verified', 'expired', 'not_found', 'flagged']),
  expirationDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

// POST /api/licenses/[id]/manual-verify - Record a manual verification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Parse and validate request body
    const body = await request.json();
    const validation = manualVerifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Get the license
    const { data: license, error: licenseError } = await supabase
      .from('licenses')
      .select('*, person:people(first_name, last_name)')
      .eq('id', id)
      .single();

    if (licenseError || !license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // Map result to license status
    const mapResultToStatus = (result: string): string => {
      switch (result) {
        case 'verified': return 'active';
        case 'expired': return 'expired';
        case 'not_found': return 'needs_manual';
        case 'flagged': return 'flagged';
        default: return 'needs_manual';
      }
    };

    // Create verification record
    const { data: verification, error: verificationError } = await supabase
      .from('verifications')
      .insert({
        license_id: id,
        run_type: 'manual',
        result: validation.data.result,
        status_found: mapResultToStatus(validation.data.result),
        expiration_found: validation.data.expirationDate || null,
        notes: validation.data.notes || 'Manually verified via state board website',
        verified_by: null,
      })
      .select()
      .single();

    if (verificationError) {
      console.error('Error creating verification:', verificationError);
      return NextResponse.json({ error: 'Failed to create verification record' }, { status: 500 });
    }

    // Update the license
    const updateData: Record<string, unknown> = {
      status: mapResultToStatus(validation.data.result),
      last_verified_at: new Date().toISOString(),
    };

    if (validation.data.expirationDate) {
      updateData.expiration_date = validation.data.expirationDate;
    }

    const { error: updateError } = await supabase
      .from('licenses')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating license:', updateError);
    }

    await auditLog({
      action: 'manual_verify',
      entityType: 'license',
      entityId: id,
      metadata: {
        verification_id: verification.id,
        result: validation.data.result,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        verification,
        licenseStatus: mapResultToStatus(validation.data.result),
      },
    });
  } catch (error) {
    console.error('Error in manual-verify:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
