import Papa from 'papaparse';
import { z } from 'zod';
import type { CSVRow, CSVValidationResult, CredentialType } from '@/types/database';

// Valid credential types
const CREDENTIAL_TYPES = ['RN', 'LPN', 'LVN', 'CNA', 'APRN', 'NP'] as const;

// US State codes
const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
] as const;

// Zod schema for CSV row validation
const csvRowSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  state: z.string()
    .min(2, 'State is required')
    .max(2, 'State must be 2 characters')
    .transform((val) => val.toUpperCase())
    .refine((val) => STATE_CODES.includes(val as typeof STATE_CODES[number]), {
      message: 'Invalid state code',
    }),
  license_number: z.string().min(1, 'License number is required'),
  credential_type: z.string()
    .transform((val) => val.toUpperCase())
    .refine((val) => CREDENTIAL_TYPES.includes(val as CredentialType), {
      message: `Credential type must be one of: ${CREDENTIAL_TYPES.join(', ')}`,
    }),
  expiration_date: z.string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: 'Invalid date format' }
    ),
  notes: z.string().optional().or(z.literal('')),
});

// Column name mappings (various formats people might use)
const COLUMN_MAPPINGS: Record<string, keyof CSVRow> = {
  // Full name (will be split)
  name: 'first_name', // We'll handle splitting in the transform
  'full name': 'first_name',
  fullname: 'first_name',
  // First name variations
  first_name: 'first_name',
  firstname: 'first_name',
  'first name': 'first_name',
  first: 'first_name',
  fname: 'first_name',
  // Last name variations
  last_name: 'last_name',
  lastname: 'last_name',
  'last name': 'last_name',
  last: 'last_name',
  lname: 'last_name',
  surname: 'last_name',
  // Email variations
  email: 'email',
  email_address: 'email',
  'email address': 'email',
  // Phone variations
  phone: 'phone',
  phone_number: 'phone',
  'phone number': 'phone',
  telephone: 'phone',
  tel: 'phone',
  mobile: 'phone',
  // State variations
  state: 'state',
  st: 'state',
  license_state: 'state',
  'license state': 'state',
  // License number variations
  license_number: 'license_number',
  'license number': 'license_number',
  license: 'license_number',
  license_no: 'license_number',
  'license no': 'license_number',
  lic_number: 'license_number',
  // Credential type variations
  credential_type: 'credential_type',
  'credential type': 'credential_type',
  credential: 'credential_type',
  type: 'credential_type',
  license_type: 'credential_type',
  'license type': 'credential_type',
  // Expiration date variations
  expiration_date: 'expiration_date',
  'expiration date': 'expiration_date',
  expiration: 'expiration_date',
  exp_date: 'expiration_date',
  'exp date': 'expiration_date',
  expires: 'expiration_date',
  // Notes variations
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
  comment: 'notes',
};

/**
 * Parse and validate a CSV file
 */
export async function parseCSV(file: File): Promise<{
  rows: CSVValidationResult[];
  headers: string[];
  validCount: number;
  invalidCount: number;
}> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Normalize header to lowercase and trim
        const normalized = header.toLowerCase().trim();
        // Map to standard column name if found
        return COLUMN_MAPPINGS[normalized] || normalized;
      },
      complete: (results) => {
        const rows: CSVValidationResult[] = [];
        let validCount = 0;
        let invalidCount = 0;

        results.data.forEach((row, index) => {
          const validationResult = validateRow(row as Record<string, string>, index + 1);
          rows.push(validationResult);

          if (validationResult.valid) {
            validCount++;
          } else {
            invalidCount++;
          }
        });

        resolve({
          rows,
          headers: results.meta.fields || [],
          validCount,
          invalidCount,
        });
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

/**
 * Validate a single row
 */
function validateRow(row: Record<string, string>, rowNumber: number): CSVValidationResult {
  const errors: string[] = [];

  // Clean up empty strings to undefined
  const cleanedRow: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(row)) {
    cleanedRow[key] = value?.trim() || undefined;
  }

  // Handle combined "name" field - split into first_name and last_name
  if (cleanedRow.first_name && !cleanedRow.last_name) {
    const nameParts = cleanedRow.first_name.split(/\s+/);
    if (nameParts.length >= 2) {
      cleanedRow.first_name = nameParts[0];
      cleanedRow.last_name = nameParts.slice(1).join(' ');
    }
  }

  // Parse with zod
  const result = csvRowSchema.safeParse(cleanedRow);

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    });
  }

  return {
    row: rowNumber,
    data: {
      first_name: cleanedRow.first_name || '',
      last_name: cleanedRow.last_name || '',
      email: cleanedRow.email,
      phone: cleanedRow.phone,
      state: (cleanedRow.state || '').toUpperCase(),
      license_number: cleanedRow.license_number || '',
      credential_type: (cleanedRow.credential_type || '').toUpperCase(),
      expiration_date: cleanedRow.expiration_date,
      notes: cleanedRow.notes,
    },
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a CSV template for download
 */
export function generateCSVTemplate(): string {
  const headers = [
    'first_name',
    'last_name',
    'email',
    'phone',
    'state',
    'license_number',
    'credential_type',
    'expiration_date',
    'notes',
  ];

  const exampleRow = [
    'Jane',
    'Doe',
    'jane.doe@example.com',
    '555-123-4567',
    'WA',
    'RN12345678',
    'RN',
    '2025-12-31',
    'Example notes',
  ];

  return [headers.join(','), exampleRow.join(',')].join('\n');
}

/**
 * Convert validated rows to the format expected by the import API
 */
export function prepareForImport(rows: CSVValidationResult[]): CSVRow[] {
  return rows
    .filter((r) => r.valid)
    .map((r) => r.data);
}
