import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';
import type { CSVRow, CredentialType, ImportError } from '@/types/database';

const CREDENTIAL_TYPES = ['RN', 'LPN', 'LVN', 'CNA', 'APRN', 'NP'] as const;

const importRowSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  state: z.string().length(2),
  license_number: z.string().min(1),
  credential_type: z.string().refine((val) => CREDENTIAL_TYPES.includes(val.toUpperCase() as CredentialType)),
  expiration_date: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable().or(z.literal('')),
});

const importSchema = z.object({
  fileName: z.string().min(1),
  rows: z.array(importRowSchema),
});

// GET /api/import - List import batches
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('import_batches')
      .select('*, importer:profiles!imported_by(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

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
    console.error('Error fetching import batches:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/import - Process CSV import
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Auth is handled by middleware (cookie-based)
    // No Supabase user check needed for this simple auth model

    // Parse request body
    const body = await request.json();
    const validation = importSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { fileName, rows } = validation.data;

    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        file_name: fileName,
        status: 'processing',
        total_rows: rows.length,
        processed_rows: 0,
        created_rows: 0,
        updated_rows: 0,
        error_rows: 0,
        imported_by: null, // Using cookie-based auth, no user ID
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    // Process rows
    let createdRows = 0;
    let updatedRows = 0;
    let errorRows = 0;
    const errors: ImportError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as CSVRow;

      try {
        // Check if person exists by name (could also match by email)
        let personId: string;
        const { data: existingPerson } = await supabase
          .from('people')
          .select('id')
          .eq('first_name', row.first_name)
          .eq('last_name', row.last_name)
          .maybeSingle();

        if (existingPerson) {
          personId = existingPerson.id;
          // Update person if email/phone provided
          if (row.email || row.phone) {
            await supabase
              .from('people')
              .update({
                ...(row.email && { email: row.email }),
                ...(row.phone && { phone: row.phone }),
                updated_at: new Date().toISOString(),
              })
              .eq('id', personId);
          }
        } else {
          // Create new person
          const { data: newPerson, error: personError } = await supabase
            .from('people')
            .insert({
              first_name: row.first_name,
              last_name: row.last_name,
              email: row.email || null,
              phone: row.phone || null,
              notes: null,
            })
            .select('id')
            .single();

          if (personError) {
            throw new Error(`Failed to create person: ${personError.message}`);
          }
          personId = newPerson.id;
        }

        // Check if license exists (by state + license_number + credential_type)
        const { data: existingLicense } = await supabase
          .from('licenses')
          .select('id')
          .eq('state', row.state.toUpperCase())
          .eq('license_number', row.license_number)
          .eq('credential_type', row.credential_type.toUpperCase())
          .maybeSingle();

        if (existingLicense) {
          // Update existing license
          const { error: updateError } = await supabase
            .from('licenses')
            .update({
              person_id: personId,
              expiration_date: row.expiration_date || null,
              notes: row.notes || null,
              import_batch_id: batch.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingLicense.id);

          if (updateError) {
            throw new Error(`Failed to update license: ${updateError.message}`);
          }
          updatedRows++;
        } else {
          // Create new license
          const { error: insertError } = await supabase
            .from('licenses')
            .insert({
              person_id: personId,
              state: row.state.toUpperCase(),
              license_number: row.license_number,
              credential_type: row.credential_type.toUpperCase() as CredentialType,
              status: 'unknown',
              expiration_date: row.expiration_date || null,
              is_compact: false,
              archived: false,
              notes: row.notes || null,
              import_batch_id: batch.id,
            });

          if (insertError) {
            throw new Error(`Failed to create license: ${insertError.message}`);
          }
          createdRows++;
        }
      } catch (err) {
        errorRows++;
        errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : 'Unknown error',
          data: row as unknown as Record<string, unknown>,
        });
      }
    }

    // Update batch with results
    const finalStatus = errorRows === rows.length ? 'failed' : 'completed';
    await supabase
      .from('import_batches')
      .update({
        status: finalStatus,
        processed_rows: rows.length,
        created_rows: createdRows,
        updated_rows: updatedRows,
        error_rows: errorRows,
        errors: errors.length > 0 ? errors : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batch.id);

    // Audit log
    await auditLog({
      action: 'import',
      entityType: 'import_batch',
      entityId: batch.id,
      metadata: {
        fileName,
        totalRows: rows.length,
        createdRows,
        updatedRows,
        errorRows,
      },
    });

    return NextResponse.json({
      data: {
        batchId: batch.id,
        totalRows: rows.length,
        createdRows,
        updatedRows,
        errorRows,
        errors: errors.slice(0, 10), // Return first 10 errors
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error processing import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
