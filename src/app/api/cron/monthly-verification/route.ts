import { NextRequest, NextResponse } from 'next/server';
import { runVerificationJob } from '@/lib/verification/job-runner';
import { auditLog } from '@/lib/audit';

// POST /api/cron/monthly-verification
// Secured with CRON_SECRET header
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run the verification job
    console.log('Starting monthly verification job...');
    const result = await runVerificationJob();
    console.log('Monthly verification job completed:', result);

    // Audit log
    await auditLog({
      action: 'verify',
      entityType: 'job',
      entityId: result.jobId,
      metadata: {
        processed: result.processed,
        auto_verified: result.autoVerified,
        tasks_created: result.tasksCreated,
        errors: result.errors,
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        ...result,
      },
    });
  } catch (error) {
    console.error('Error running monthly verification:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Job failed',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking job status (for monitoring)
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      endpoint: '/api/cron/monthly-verification',
      method: 'POST',
      description: 'Runs monthly license verification job',
    },
  });
}
