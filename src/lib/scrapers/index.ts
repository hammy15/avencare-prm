import type { StateScraper, LicenseLookupParams, ScraperResult } from './types';
import { WashingtonScraper } from './wa-scraper';
import { OregonScraper } from './or-scraper';
import { IdahoScraper } from './id-scraper';
import { AlaskaScraper } from './ak-scraper';
import { MontanaScraper } from './mt-scraper';
import { ArizonaScraper } from './az-scraper';
import { CaliforniaScraper } from './ca-scraper';

// Registry of available scrapers by state
// Cascadia + additional operating states: WA, OR, ID, AK, MT, AZ, CA
const scraperRegistry: Record<string, new () => StateScraper> = {
  WA: WashingtonScraper,
  OR: OregonScraper,
  ID: IdahoScraper,
  AK: AlaskaScraper,
  MT: MontanaScraper,
  AZ: ArizonaScraper,
  CA: CaliforniaScraper,
};

// List of states with implemented scrapers
export function getAvailableStates(): string[] {
  return Object.keys(scraperRegistry);
}

// Check if a state has an available scraper
export function hasScraperForState(state: string): boolean {
  return state.toUpperCase() in scraperRegistry;
}

// Get scraper instance for a state
export function getScraperForState(state: string): StateScraper | null {
  const ScraperClass = scraperRegistry[state.toUpperCase()];
  if (ScraperClass) {
    return new ScraperClass();
  }
  return null;
}

// Main function to verify a license
export async function verifyLicense(params: LicenseLookupParams): Promise<ScraperResult> {
  const scraper = getScraperForState(params.state);

  if (!scraper) {
    return {
      success: false,
      error: 'no_scraper',
      errorDetails: `No scraper available for state: ${params.state}. Available states: ${getAvailableStates().join(', ')}`,
    };
  }

  // Check if the credential type is supported
  if (!scraper.config.credentialTypes.includes(params.credentialType)) {
    return {
      success: false,
      error: 'unsupported_credential',
      errorDetails: `Credential type ${params.credentialType} not supported for ${params.state}. Supported types: ${scraper.config.credentialTypes.join(', ')}`,
    };
  }

  try {
    return await scraper.verify(params);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: 'verification_failed',
      errorDetails: errorMessage,
    };
  }
}

// Export types
export type { ScraperResult, LicenseLookupParams, StateScraper, ScraperConfig } from './types';
