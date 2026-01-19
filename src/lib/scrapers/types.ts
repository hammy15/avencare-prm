// Scraper types for license verification

export interface ScraperResult {
  success: boolean;
  // License info found
  licenseNumber?: string;
  licenseName?: string;
  status?: 'active' | 'expired' | 'inactive' | 'suspended' | 'revoked' | 'unknown';
  expirationDate?: string;
  issueDate?: string;
  credentialType?: string;
  // Discipline/encumbrance info
  unencumbered?: boolean;
  disciplinaryActions?: string[];
  // Raw data
  rawData?: Record<string, string>;
  // Error info
  error?: string;
  errorDetails?: string;
}

export interface ScraperConfig {
  state: string;
  credentialTypes: string[]; // RN, LPN, CNA, etc.
  lookupUrl: string;
  timeout?: number; // ms
}

export interface LicenseLookupParams {
  licenseNumber: string;
  lastName?: string;
  firstName?: string;
  state: string;
  credentialType: string;
}

export interface StateScraper {
  config: ScraperConfig;
  verify(params: LicenseLookupParams): Promise<ScraperResult>;
}
