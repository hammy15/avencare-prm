import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScraperResult, LicenseLookupParams } from './types';

/**
 * Florida Board of Nursing License Scraper
 * URL: https://mqa-internet.doh.state.fl.us/MQASearchServices/Home
 *
 * This scraper navigates the Florida DOH MQA Search Services
 * to verify nursing licenses (RN, LPN, ARNP, CNA)
 */
export class FloridaScraper extends BaseScraper {
  config: ScraperConfig = {
    state: 'FL',
    credentialTypes: ['RN', 'LPN', 'ARNP', 'APRN', 'CNA'],
    lookupUrl: 'https://mqa-internet.doh.state.fl.us/MQASearchServices/Home',
    timeout: 45000,
  };

  async verify(params: LicenseLookupParams): Promise<ScraperResult> {
    const page = await this.initBrowser();

    try {
      console.log(`[FL Scraper] Starting verification for license: ${params.licenseNumber}`);

      await page.goto(this.config.lookupUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.wait(2000);

      // Florida MQA search - find license number input
      const licenseInputSelectors = [
        'input[name="LicenseNumber"]',
        'input[name="licenseNumber"]',
        'input[id*="License" i]',
        'input[placeholder*="license" i]',
        '#LicenseNumber',
        'input[type="text"]',
      ];

      let licenseInput = null;
      for (const selector of licenseInputSelectors) {
        try {
          licenseInput = await page.$(selector);
          if (licenseInput) {
            console.log(`[FL Scraper] Found license input with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!licenseInput) {
        return {
          success: false,
          error: 'scraper_error',
          errorDetails: 'Could not find license input field on the page',
        };
      }

      // Enter license number
      await licenseInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await licenseInput.type(params.licenseNumber, { delay: 50 });

      // Enter last name if provided
      if (params.lastName) {
        const lastNameSelectors = [
          'input[name="LastName"]',
          'input[name="lastName"]',
          'input[id*="LastName" i]',
          '#LastName',
        ];

        for (const selector of lastNameSelectors) {
          try {
            const lastNameInput = await page.$(selector);
            if (lastNameInput) {
              await lastNameInput.type(params.lastName, { delay: 50 });
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // Submit form
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Search")',
        '.btn-primary',
        '#searchBtn',
        'button.btn',
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const submitBtn = await page.$(selector);
          if (submitBtn) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
              submitBtn.click(),
            ]);
            submitted = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!submitted) {
        await page.keyboard.press('Enter');
        await this.wait(3000);
      }

      await this.wait(2000);

      // Check for no results
      const pageContent = await page.content();
      const noResultsPatterns = [
        /no\s*records?\s*found/i,
        /no\s*results?/i,
        /not\s*found/i,
        /no\s*matching/i,
        /no\s*licenses?\s*found/i,
      ];

      for (const pattern of noResultsPatterns) {
        if (pattern.test(pageContent)) {
          return {
            success: false,
            error: 'not_found',
            errorDetails: 'No license found matching the search criteria',
          };
        }
      }

      // Try to click on the result row to get details
      try {
        const resultLink = await page.$('table tr td a, .result-item a, a[href*="Detail"]');
        if (resultLink) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
            resultLink.click(),
          ]);
          await this.wait(1000);
        }
      } catch {
        // Continue with current page
      }

      return await this.parseResults(page, params.licenseNumber);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[FL Scraper] Error: ${errorMessage}`);
      return {
        success: false,
        error: 'scraper_error',
        errorDetails: errorMessage,
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
          const cells = await row.$$('td, th');
          if (cells.length >= 2) {
            const label = await page.evaluate(el => el.textContent?.trim() || '', cells[0]);
            const value = await page.evaluate(el => el.textContent?.trim() || '', cells[1]);
            if (label && value) {
              rawData[label.replace(/[:\s]+$/, '')] = value;
            }
          }
        }
      }

      // Parse definition lists
      const dts = await page.$$('dt, .label, .field-label');
      for (const dt of dts) {
        const label = await page.evaluate(el => el.textContent?.trim() || '', dt);
        const dd = await page.evaluateHandle(el => el.nextElementSibling, dt);
        if (dd) {
          const value = await page.evaluate(el => el?.textContent?.trim() || '', dd);
          if (label && value) {
            rawData[label.replace(/[:\s]+$/, '')] = value;
          }
        }
      }

      // Determine status
      let status = rawData['Status'] || rawData['License Status'] || rawData['Current Status'];
      if (!status) {
        if (/\bclear\/active\b/i.test(allText) || /\bactive\b/i.test(allText)) status = 'Active';
        else if (/\bexpired\b/i.test(allText)) status = 'Expired';
        else if (/\binactive\b/i.test(allText)) status = 'Inactive';
        else if (/\bdelinquent\b/i.test(allText)) status = 'Expired';
      }

      // Get expiration date
      const expiration = rawData['Expiration'] || rawData['Expiration Date'] || rawData['Expires'] || rawData['Exp Date'];

      // Get name
      const name = rawData['Name'] || rawData['Licensee'] || rawData['Provider Name'];

      // Check for disciplinary actions
      const hasDiscipline = /discipline|action|sanction|restriction|probation|board\s*order/i.test(allText);

      return {
        success: Object.keys(rawData).length > 0 || allText.includes(licenseNumber),
        licenseNumber,
        licenseName: name || undefined,
        status: this.normalizeStatus(status || null),
        expirationDate: this.parseDate(expiration || null),
        unencumbered: !hasDiscipline,
        rawData,
      };

    } catch (error) {
      return {
        success: false,
        error: 'parse_error',
        errorDetails: error instanceof Error ? error.message : 'Failed to parse results',
      };
    }
  }
}
