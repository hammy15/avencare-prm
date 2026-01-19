import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { verifyLicense, hasScraperForState, getAvailableStates } from '@/lib/scrapers';

// POST /api/licenses/[id]/verify - Auto-verify a license using web scraping
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the license with person info
    const { data: license, error: licenseError } = await supabase
      .from('licenses')
      .select('*, person:people(first_name, last_name)')
      .eq('id', id)
      .single();

    if (licenseError || !license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // Check if we have a scraper for this state
    if (!hasScraperForState(license.state)) {
      return NextResponse.json({
        error: 'No auto-verification available',
        details: `No scraper available for state: ${license.state}. Available states: ${getAvailableStates().join(', ')}`,
        availableStates: getAvailableStates(),
      }, { status: 400 });
    }

    // Get person info for the lookup
    const person = license.person as { first_name: string; last_name: string } | null;

    // Perform the verification
    const result = await verifyLicense({
      licenseNumber: license.license_number,
      lastName: person?.last_name,
      firstName: person?.first_name,
      state: license.state,
      credentialType: license.credential_type,
    });

    // Map scraper status to our license status
    const mapStatus = (scraperStatus: string | undefined): string => {
      switch (scraperStatus) {
        case 'active': return 'active';
        case 'expired': return 'expired';
        case 'suspended':
        case 'revoked': return 'flagged';
        case 'inactive': return 'expired';
        default: return 'needs_manual';
      }
    };

    // Map to verification result
    const mapVerificationResult = (scraperStatus: string | undefined): string => {
      switch (scraperStatus) {
        case 'active': return 'verified';
        case 'expired': return 'expired';
        default: return 'pending';
      }
    };

    if (result.success) {
      // Create verification record
      const { data: verification, error: verificationError } = await supabase
        .from('verifications')
        .insert({
          license_id: id,
          run_type: 'automated',
          result: mapVerificationResult(result.status),
          status_found: mapStatus(result.status),
          expiration_found: result.expirationDate || null,
          unencumbered: result.unencumbered,
          notes: `Auto-verified via web scraper. Raw data: ${JSON.stringify(result.rawData || {})}`,
          verified_by: user.id,
          raw_response: result.rawData || null,
        })
        .select()
        .single();

      if (verificationError) {
        console.error('Error creating verification:', verificationError);
      }

      // Update the license status and save synced data
      const syncedData = {
        licenseNumber: result.licenseNumber,
        licenseName: result.licenseName,
        status: result.status,
        expirationDate: result.expirationDate,
        unencumbered: result.unencumbered,
        rawData: result.rawData || {},
        source: license.state,
        syncedAt: new Date().toISOString(),
      };

      const updateData: Record<string, unknown> = {
        last_verified_at: new Date().toISOString(),
        synced_data: syncedData,  // Save synced data for quick lookup
        synced_at: new Date().toISOString(),
      };

      if (result.status) {
        updateData.status = mapStatus(result.status);
      }
      if (result.expirationDate) {
        updateData.expiration_date = result.expirationDate;
      }
      if (result.licenseName) {
        // Update licensee name if we got it from the source
        updateData.licensee_name = result.licenseName;
      }

      const { error: updateError } = await supabase
        .from('licenses')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating license:', updateError);
      }

      await auditLog({
        action: 'auto_verify',
        entityType: 'license',
        entityId: id,
        metadata: {
          verification_id: verification?.id,
          scraper_result: result,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          verification,
          scraperResult: result,
        },
      });
    } else {
      // Verification failed - still log it
      await auditLog({
        action: 'auto_verify_failed',
        entityType: 'license',
        entityId: id,
        metadata: {
          error: result.error,
          errorDetails: result.errorDetails,
        },
      });

      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.errorDetails,
      }, { status: 422 });
    }
  } catch (error) {
    console.error('Error in auto-verify:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/licenses/[id]/verify - Check if auto-verification is available
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get the license
    const { data: license, error } = await supabase
      .from('licenses')
      .select('state, credential_type')
      .eq('id', id)
      .single();

    if (error || !license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    const available = hasScraperForState(license.state);

    return NextResponse.json({
      available,
      state: license.state,
      credentialType: license.credential_type,
      availableStates: getAvailableStates(),
    });
  } catch (error) {
    console.error('Error checking auto-verify availability:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
