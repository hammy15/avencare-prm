import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOCRProvider, extractFieldsFromText } from '@/lib/ocr';

// POST /api/ocr - Process an uploaded file with OCR
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    const provider = getOCRProvider();

    if (!provider) {
      // OCR not configured, return empty result
      return NextResponse.json({
        data: {
          text: '',
          confidence: 0,
          extractedFields: {},
          message: 'OCR is not configured. Enable it by setting OCR_PROVIDER environment variable.',
        },
      });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process with OCR
    const result = await provider.extractText(buffer, file.type);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error processing OCR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR processing failed' },
      { status: 500 }
    );
  }
}

// GET /api/ocr/status - Check OCR configuration status
export async function GET() {
  const provider = process.env.OCR_PROVIDER || 'none';

  return NextResponse.json({
    data: {
      provider,
      configured: provider !== 'none',
      availableProviders: ['azure', 'google', 'tesseract', 'none'],
    },
  });
}
