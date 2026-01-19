import puppeteer, { Browser, Page } from 'puppeteer';
import type { ScraperConfig, ScraperResult, LicenseLookupParams, StateScraper } from './types';

export abstract class BaseScraper implements StateScraper {
  abstract config: ScraperConfig;
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  protected async initBrowser(): Promise<Page> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
    this.page = await this.browser.newPage();

    // Set a reasonable timeout
    this.page.setDefaultTimeout(this.config.timeout || 30000);

    // Set user agent to avoid bot detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    return this.page;
  }

  protected async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  abstract verify(params: LicenseLookupParams): Promise<ScraperResult>;

  // Helper to safely get text content
  protected async getText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) {
        return await page.evaluate(el => el.textContent?.trim() || null, element);
      }
    } catch {
      // Element not found
    }
    return null;
  }

  // Helper to safely wait and click
  protected async clickIfExists(page: Page, selector: string): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      return true;
    } catch {
      return false;
    }
  }

  // Helper to wait for a specified time (replacement for deprecated waitForTimeout)
  protected async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Parse common date formats
  protected parseDate(dateStr: string | null): string | undefined {
    if (!dateStr) return undefined;

    // Try common formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch {
          continue;
        }
      }
    }

    return undefined;
  }

  // Normalize status strings
  protected normalizeStatus(statusStr: string | null): ScraperResult['status'] {
    if (!statusStr) return 'unknown';

    const status = statusStr.toLowerCase().trim();

    if (status.includes('active') || status.includes('current') || status.includes('valid')) {
      return 'active';
    }
    if (status.includes('expired')) {
      return 'expired';
    }
    if (status.includes('inactive') || status.includes('lapsed')) {
      return 'inactive';
    }
    if (status.includes('suspended')) {
      return 'suspended';
    }
    if (status.includes('revoked') || status.includes('revocation')) {
      return 'revoked';
    }

    return 'unknown';
  }
}
