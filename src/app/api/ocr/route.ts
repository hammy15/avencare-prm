import { NextRequest, NextResponse } from 'next/server';
import { getOCRProvider, getAvailableProviders } from '@/lib/ocr';

// POST /api/ocr - Process an uploaded file with OCR
export async function POST(request: NextRequest) {
  try {
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

  // Check if the provider is properly configured
  let configured = provider !== 'none';
  if (provider === 'ocrspace' && !process.env.OCRSPACE_API_KEY) {
    configured = false;
  } else if (provider === 'azure' && (!process.env.AZURE_VISION_ENDPOINT || !process.env.AZURE_VISION_KEY)) {
    configured = false;
  } else if (provider === 'google' && !process.env.GOOGLE_VISION_API_KEY) {
    configured = false;
  }

  return NextResponse.json({
    data: {
      provider,
      configured,
      availableProviders: getAvailableProviders(),
    },
  });
}
