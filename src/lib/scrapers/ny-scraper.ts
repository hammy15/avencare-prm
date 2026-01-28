import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScraperResult, LicenseLookupParams } from './types';

/**
 * New York State Education Department License Scraper
 * URL: http://www.op.nysed.gov/opsearches.htm
 *
 * Verifies nursing licenses (RN, LPN) through NY NYSED Office of Professions
 */
export class NewYorkScraper extends BaseScraper {
  config: ScraperConfig = {
    state: 'NY',
    credentialTypes: ['RN', 'LPN', 'NP', 'APRN'],
    lookupUrl: 'http://www.op.nysed.gov/opsearches.htm',
    timeout: 45000,
  };

  async verify(params: LicenseLookupParams): Promise<ScraperResult> {
    const page = await this.initBrowser();

    try {
      console.log(`[NY Scraper] Starting verification for license: ${params.licenseNumber}`);

      // NY uses a form-based search
      await page.goto(this.config.lookupUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.wait(2000);

      // Find license number input
      const licenseInputSelectors = [
        'input[name="LicNo"]',
        'input[name="licenseNo"]',
        'input[name="license"]',
        'input[id*="lic" i]',
        'input[type="text"]',
      ];

      let licenseInput = null;
      for (const selector of licenseInputSelectors) {
        try {
          licenseInput = await page.$(selector);
          if (licenseInput) break;
        } catch { continue; }
      }

      if (!licenseInput) {
        return {
          success: false,
          error: 'scraper_error',
          errorDetails: 'Could not find license input field',
        };
      }

      await licenseInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await licenseInput.type(params.licenseNumber, { delay: 50 });

      // Enter last name if available
      if (params.lastName) {
        const lastNameSelectors = ['input[name="LastName"]', 'input[name="lname"]', 'input[id*="last" i]'];
        for (const selector of lastNameSelectors) {
          try {
            const input = await page.$(selector);
            if (input) {
              await input.type(params.lastName, { delay: 50 });
              break;
            }
          } catch { continue; }
        }
      }

      // Submit
      const submitSelectors = ['input[type="submit"]', 'button[type="submit"]', 'input[value*="Search" i]'];
      for (const selector of submitSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
              btn.click(),
            ]);
            break;
          }
        } catch { continue; }
      }

      await this.wait(2000);

      const pageContent = await page.content();
      if (/no\s*records?\s*found|not\s*found/i.test(pageContent)) {
        return { success: false, error: 'not_found', errorDetails: 'No license found' };
      }

      return await this.parseResults(page, params.licenseNumber);

    } catch (error) {
      return {
        success: false,
        error: 'scraper_error',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.closeBrowser();
    }
  }

  private async parseResults(page: import('puppeteer').Page, licenseNumber: string): Promise<ScraperResult> {
    const rawData: Record<string, string> = {};

    try {
      const allText = await page.evaluate(() => document.body.innerText);

      // Parse tables
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

      let status = rawData['Status'] || rawData['Registration Status'];
      if (!status) {
        if (/\bregistered\b/i.test(allText) || /\bactive\b/i.test(allText)) status = 'Active';
        else if (/\bexpired\b/i.test(allText) || /\blapsed\b/i.test(allText)) status = 'Expired';
      }

      const expiration = rawData['Expiration'] || rawData['Registration Expiration'];
      const name = rawData['Name'] || rawData['Licensee'];
      const hasDiscipline = /discipline|misconduct|sanction/i.test(allText);

      return {
        success: Object.keys(rawData).length > 0,
        licenseNumber,
        licenseName: name,
        status: this.normalizeStatus(status || null),
        expirationDate: this.parseDate(expiration || null),
        unencumbered: !hasDiscipline,
        rawData,
      };
    } catch (error) {
      return { success: false, error: 'parse_error', errorDetails: 'Failed to parse results' };
    }
  }
}
