import { createAdminClient } from '@/lib/supabase/admin';
import type { License, VerificationJob } from '@/types/database';

interface JobRunnerOptions {
  batchSize?: number;
  dryRun?: boolean;
}

/**
 * Run the monthly verification job
 * This processes all non-archived licenses and creates verification tasks
 */
export async function runVerificationJob(options: JobRunnerOptions = {}): Promise<{
  jobId: string;
  processed: number;
  autoVerified: number;
  tasksCreated: number;
  errors: number;
}> {
  const { batchSize = 100, dryRun = false } = options;
  const supabase = createAdminClient();

  // Create job record
  const { data: job, error: jobError } = await supabase
    .from('verification_jobs')
    .insert({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobError || !job) {
    throw new Error('Failed to create job record');
  }

  let processed = 0;
  let autoVerified = 0;
  let tasksCreated = 0;
  let errors = 0;
  const errorDetails: { license_id: string; message: string; timestamp: string }[] = [];

  try {
    // Get total count of non-archived licenses
    const { count: totalCount } = await supabase
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false);

    await supabase
      .from('verification_jobs')
      .update({ total_licenses: totalCount || 0 })
      .eq('id', job.id);

    // Process licenses in batches
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: licenses, error: fetchError } = await supabase
        .from('licenses')
        .select('*, nursys_enrollment:nursys_enrollments(*)')
        .eq('archived', false)
        .range(offset, offset + batchSize - 1)
        .order('id');

      if (fetchError) {
        throw new Error(`Failed to fetch licenses: ${fetchError.message}`);
      }

      if (!licenses || licenses.length === 0) {
        hasMore = false;
        break;
      }

      // Process each license
      for (const license of licenses as (License & { nursys_enrollment?: { active: boolean }[] })[]) {
        try {
          const result = await processLicense(supabase, license, job.id, dryRun);
          processed++;

          if (result.autoVerified) {
            autoVerified++;
          }
          if (result.taskCreated) {
            tasksCreated++;
          }
        } catch (error) {
          errors++;
          errorDetails.push({
            license_id: license.id,
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });
        }

        // Update progress periodically
        if (processed % 50 === 0) {
          await supabase
            .from('verification_jobs')
            .update({
              processed_licenses: processed,
              auto_verified: autoVerified,
              tasks_created: tasksCreated,
              errors,
            })
            .eq('id', job.id);
        }
      }

      offset += batchSize;
      hasMore = licenses.length === batchSize;
    }

    // Mark job as complete
    await supabase
      .from('verification_jobs')
      .update({
        status: 'completed',
        processed_licenses: processed,
        auto_verified: autoVerified,
        tasks_created: tasksCreated,
        errors,
        error_details: errorDetails.length > 0 ? errorDetails : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return {
      jobId: job.id,
      processed,
      autoVerified,
      tasksCreated,
      errors,
    };
  } catch (error) {
    // Mark job as failed
    await supabase
      .from('verification_jobs')
      .update({
        status: 'failed',
        processed_licenses: processed,
        auto_verified: autoVerified,
        tasks_created: tasksCreated,
        errors,
        error_details: [
          ...errorDetails,
          {
            license_id: '',
            message: error instanceof Error ? error.message : 'Job failed',
            timestamp: new Date().toISOString(),
          },
        ],
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    throw error;
  }
}

async function processLicense(
  supabase: ReturnType<typeof createAdminClient>,
  license: License & { nursys_enrollment?: { active: boolean }[] },
  jobId: string,
  dryRun: boolean
): Promise<{ autoVerified: boolean; taskCreated: boolean }> {
  // Check if license is enrolled in Nursys e-Notify
  const hasActiveNursysEnrollment = license.nursys_enrollment?.some((e) => e.active);

  if (hasActiveNursysEnrollment) {
    // Auto-verified via e-Notify - create verification record
    if (!dryRun) {
      await supabase.from('verifications').insert({
        license_id: license.id,
        run_type: 'automated',
        result: 'pending',
        notes: 'Awaiting Nursys e-Notify notification',
        job_id: jobId,
      });

      await supabase
        .from('licenses')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('id', license.id);
    }

    return { autoVerified: true, taskCreated: false };
  }

  // Find appropriate verification source
  const credentialType = license.credential_type;
  const sourceType = credentialType === 'CNA' ? 'cna_registry' : 'bon';

  const { data: source } = await supabase
    .from('verification_sources')
    .select('id')
    .eq('state', license.state)
    .eq('source_type', sourceType)
    .eq('active', true)
    .single();

  // Check if there's already a pending task for this license
  const { data: existingTask } = await supabase
    .from('verification_tasks')
    .select('id')
    .eq('license_id', license.id)
    .eq('status', 'pending')
    .single();

  if (existingTask) {
    // Task already exists, skip
    return { autoVerified: false, taskCreated: false };
  }

  // Create manual verification task
  if (!dryRun) {
    await supabase.from('verification_tasks').insert({
      license_id: license.id,
      source_id: source?.id || null,
      status: 'pending',
      priority: calculatePriority(license),
      due_date: calculateDueDate(),
      job_id: jobId,
    });
  }

  return { autoVerified: false, taskCreated: true };
}

function calculatePriority(license: License): number {
  let priority = 0;

  // Higher priority for licenses expiring soon
  if (license.expiration_date) {
    const daysUntilExpiration = Math.ceil(
      (new Date(license.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiration < 30) {
      priority += 5;
    } else if (daysUntilExpiration < 60) {
      priority += 3;
    } else if (daysUntilExpiration < 90) {
      priority += 1;
    }
  }

  // Higher priority for flagged licenses
  if (license.status === 'flagged') {
    priority += 5;
  }

  // Higher priority for licenses needing manual review
  if (license.status === 'needs_manual') {
    priority += 3;
  }

  return Math.min(priority, 10);
}

function calculateDueDate(): string {
  // Due in 14 days
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  return dueDate.toISOString().split('T')[0];
}
