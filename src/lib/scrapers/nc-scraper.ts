import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScraperResult, LicenseLookupParams } from './types';

/**
 * North Carolina Board of Nursing License Scraper
 * URL: https://portal.ncbon.com/LicenseVerification/Search.aspx
 */
export class NorthCarolinaScraper extends BaseScraper {
  config: ScraperConfig = {
    state: 'NC',
    credentialTypes: ['RN', 'LPN', 'APRN', 'NP'],
    lookupUrl: 'https://portal.ncbon.com/LicenseVerification/Search.aspx',
    timeout: 45000,
  };

  async verify(params: LicenseLookupParams): Promise<ScraperResult> {
    const page = await this.initBrowser();

    try {
      console.log(`[NC Scraper] Starting verification for license: ${params.licenseNumber}`);

      await page.goto(this.config.lookupUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.wait(2000);

      // Find and fill license number
      const licenseInput = await page.$('input[id*="License" i], input[name*="license" i], input[type="text"]');
      if (!licenseInput) {
        return { success: false, error: 'scraper_error', errorDetails: 'Could not find license input' };
      }

      await licenseInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await licenseInput.type(params.licenseNumber, { delay: 50 });

      if (params.lastName) {
        const lastNameInput = await page.$('input[id*="Last" i], input[name*="last" i]');
        if (lastNameInput) await lastNameInput.type(params.lastName, { delay: 50 });
      }

      // Submit
      const submitBtn = await page.$('input[type="submit"], button[type="submit"], input[value*="Search" i]');
      if (submitBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          submitBtn.click(),
        ]);
      }

      await this.wait(2000);

      const pageContent = await page.content();
      if (/no\s*records?\s*found|not\s*found/i.test(pageContent)) {
        return { success: false, error: 'not_found', errorDetails: 'No license found' };
      }

      return await this.parseResults(page, params.licenseNumber);

    } catch (error) {
      return { success: false, error: 'scraper_error', errorDetails: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      await this.closeBrowser();
    }
  }

  private async parseResults(page: import('puppeteer').Page, licenseNumber: string): Promise<ScraperResult> {
    const rawData: Record<string, string> = {};
    try {
      const allText = await page.evaluate(() => document.body.innerText);

      const tables = await page.$$('table');
      for (const table of tables) {
        const rows = await table.$$('tr');
        for (const row of rows) {
          const cells = await row.$$('td');
          if (cells.length >= 2) {
            const label = await page.evaluate(el => el.textContent?.trim() || '', cells[0]);
            const value = await page.evaluate(el => el.textContent?.trim() || '', cells[1]);
            if (label && value) rawData[label.replace(/[:\s]+$/, '')] = value;
          }
        }
      }

      let status = rawData['Status'] || rawData['License Status'];
      if (!status) {
        if (/\bactive\b/i.test(allText)) status = 'Active';
        else if (/\bexpired\b/i.test(allText)) status = 'Expired';
      }

      return {
        success: Object.keys(rawData).length > 0,
        licenseNumber,
        licenseName: rawData['Name'] || rawData['Licensee'],
        status: this.normalizeStatus(status || null),
        expirationDate: this.parseDate(rawData['Expiration'] || rawData['Expiration Date'] || null),
        unencumbered: !/discipline|action|sanction/i.test(allText),
        rawData,
      };
    } catch {
      return { success: false, error: 'parse_error', errorDetails: 'Failed to parse results' };
    }
  }
}
