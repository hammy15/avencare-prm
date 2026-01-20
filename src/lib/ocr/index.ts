import type { OCRExtracted } from '@/types/database';

export interface OCRResult {
  text: string;
  confidence: number;
  extractedFields?: OCRExtracted;
}

export interface OCRProvider {
  extractText(file: Buffer, mimeType: string): Promise<OCRResult>;
}

// Get the configured OCR provider
export function getOCRProvider(): OCRProvider | null {
  const provider = process.env.OCR_PROVIDER || 'none';

  switch (provider) {
    case 'azure':
      return new AzureOCRProvider();
    case 'google':
      return new GoogleOCRProvider();
    case 'ocrspace':
      return new OCRSpaceProvider();
    case 'tesseract':
      return new TesseractOCRProvider();
    case 'none':
    default:
      return null;
  }
}

// Get list of available providers for the settings page
export function getAvailableProviders(): string[] {
  return ['azure', 'google', 'ocrspace', 'tesseract', 'none'];
}

// Extract fields from OCR text using regex patterns
export function extractFieldsFromText(text: string): OCRExtracted {
  const extracted: OCRExtracted = {};

  // License number patterns (various formats)
  const licensePatterns = [
    /license\s*#?\s*:?\s*([A-Z0-9]{5,15})/i,
    /lic\s*#?\s*:?\s*([A-Z0-9]{5,15})/i,
    /([A-Z]{2,3}\d{6,10})/,
    /(\d{6,10})/,
  ];

  for (const pattern of licensePatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.licenseNumber = match[1];
      break;
    }
  }

  // State patterns
  const statePattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
  const stateMatch = text.match(statePattern);
  if (stateMatch) {
    extracted.state = stateMatch[1];
  }

  // Expiration date patterns
  const datePatterns = [
    /exp(?:ires?|iration)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /valid\s*(?:thru|through|until)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.expirationDate = normalizeDate(match[1]);
      break;
    }
  }

  // Status patterns
  const statusKeywords: Record<string, string[]> = {
    active: ['active', 'valid', 'current', 'good standing'],
    expired: ['expired', 'inactive', 'lapsed'],
  };

  const lowerText = text.toLowerCase();
  for (const [status, keywords] of Object.entries(statusKeywords)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      extracted.status = status;
      break;
    }
  }

  // Name patterns
  const namePattern = /name\s*:?\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)/;
  const nameMatch = text.match(namePattern);
  if (nameMatch) {
    extracted.name = `${nameMatch[1]} ${nameMatch[2]}`;
  }

  return extracted;
}

function normalizeDate(dateStr: string): string {
  // Try to parse and return ISO format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    let [month, day, year] = parts;
    if (year.length === 2) {
      year = (parseInt(year) > 50 ? '19' : '20') + year;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
}

// Azure Computer Vision implementation
class AzureOCRProvider implements OCRProvider {
  private endpoint: string;
  private key: string;

  constructor() {
    this.endpoint = process.env.AZURE_VISION_ENDPOINT || '';
    this.key = process.env.AZURE_VISION_KEY || '';
  }

  async extractText(file: Buffer, mimeType: string): Promise<OCRResult> {
    if (!this.endpoint || !this.key) {
      throw new Error('Azure Vision credentials not configured');
    }

    const response = await fetch(`${this.endpoint}/vision/v3.2/read/analyze`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.key,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(file),
    });

    if (!response.ok) {
      throw new Error(`Azure OCR failed: ${response.statusText}`);
    }

    // Get operation location for polling
    const operationLocation = response.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('No operation location returned');
    }

    // Poll for results
    let result;
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const pollResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.key,
        },
      });

      result = await pollResponse.json();
      if (result.status === 'succeeded') break;
      if (result.status === 'failed') {
        throw new Error('Azure OCR processing failed');
      }
    }

    // Extract text from result
    const text = result.analyzeResult?.readResults
      ?.flatMap((r: { lines: { text: string }[] }) => r.lines.map((l: { text: string }) => l.text))
      .join('\n') || '';

    return {
      text,
      confidence: 0.9, // Azure doesn't provide overall confidence
      extractedFields: extractFieldsFromText(text),
    };
  }
}

// Google Cloud Vision implementation
class GoogleOCRProvider implements OCRProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_VISION_API_KEY || '';
  }

  async extractText(file: Buffer, mimeType: string): Promise<OCRResult> {
    if (!this.apiKey) {
      throw new Error('Google Vision API key not configured');
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: file.toString('base64'),
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google OCR failed: ${response.statusText}`);
    }

    const result = await response.json();
    const annotation = result.responses?.[0]?.fullTextAnnotation;

    if (!annotation) {
      return { text: '', confidence: 0, extractedFields: {} };
    }

    return {
      text: annotation.text || '',
      confidence: 0.9,
      extractedFields: extractFieldsFromText(annotation.text || ''),
    };
  }
}

// OCR.space implementation
class OCRSpaceProvider implements OCRProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OCRSPACE_API_KEY || '';
  }

  async extractText(file: Buffer, mimeType: string): Promise<OCRResult> {
    if (!this.apiKey) {
      throw new Error('OCR.space API key not configured');
    }

    // Determine file type for OCR.space
    const fileType = mimeType.includes('pdf') ? 'pdf' :
                     mimeType.includes('png') ? 'png' :
                     mimeType.includes('gif') ? 'gif' : 'jpg';

    // Create form data with base64 content
    const base64Content = `data:${mimeType};base64,${file.toString('base64')}`;

    const formData = new URLSearchParams();
    formData.append('apikey', this.apiKey);
    formData.append('base64Image', base64Content);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('filetype', fileType);
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2 is more accurate

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`OCR.space request failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.IsErroredOnProcessing) {
      throw new Error(`OCR.space processing error: ${result.ErrorMessage?.[0] || 'Unknown error'}`);
    }

    // Extract text from all parsed results
    const parsedResults = result.ParsedResults || [];
    const text = parsedResults
      .map((r: { ParsedText?: string }) => r.ParsedText || '')
      .join('\n')
      .trim();

    // Calculate average confidence from word-level confidence if available
    let confidence = 0.9; // Default confidence
    if (parsedResults.length > 0 && parsedResults[0].TextOverlay?.Lines) {
      const allWords = parsedResults[0].TextOverlay.Lines
        .flatMap((line: { Words?: { WordText: string }[] }) => line.Words || []);
      if (allWords.length > 0) {
        // OCR.space doesn't provide word confidence in the standard response
        // but the text quality from Engine 2 is generally good
        confidence = 0.92;
      }
    }

    return {
      text,
      confidence,
      extractedFields: extractFieldsFromText(text),
    };
  }
}

// Tesseract.js implementation (for client-side or Node.js)
class TesseractOCRProvider implements OCRProvider {
  async extractText(file: Buffer, mimeType: string): Promise<OCRResult> {
    // Note: This requires tesseract.js to be installed
    // For server-side use, you'd need node-tesseract-ocr or similar

    try {
      // Dynamic import for tesseract.js (optional dependency)
      // @ts-expect-error - tesseract.js is an optional dependency
      const Tesseract = await import('tesseract.js');

      const result = await Tesseract.recognize(file, 'eng', {
        logger: () => {},
      });

      return {
        text: result.data.text,
        confidence: result.data.confidence / 100,
        extractedFields: extractFieldsFromText(result.data.text),
      };
    } catch (error) {
      console.error('Tesseract error:', error);
      throw new Error('Tesseract OCR not available');
    }
  }
}
