import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScraperResult, LicenseLookupParams } from './types';

/**
 * Texas Board of Nursing License Scraper
 * URL: https://www.bon.texas.gov/verify_a_license.asp
 *
 * This scraper navigates the Texas BON License Verification system
 * to verify nursing licenses (RN, LVN, APRN)
 */
export class TexasScraper extends BaseScraper {
  config: ScraperConfig = {
    state: 'TX',
    credentialTypes: ['RN', 'LVN', 'LPN', 'APRN'],
    lookupUrl: 'https://www.bon.texas.gov/forms/rnlookup.asp',
    timeout: 45000,
  };

  async verify(params: LicenseLookupParams): Promise<ScraperResult> {
    const page = await this.initBrowser();

    try {
      console.log(`[TX Scraper] Starting verification for license: ${params.licenseNumber}`);

      // Texas has separate pages for RN and LVN
      const lookupUrl = params.credentialType === 'LVN' || params.credentialType === 'LPN'
        ? 'https://www.bon.texas.gov/forms/lvnlookup.asp'
        : 'https://www.bon.texas.gov/forms/rnlookup.asp';

      await page.goto(lookupUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.wait(2000);

      // Find license number input field
      const licenseInputSelectors = [
        'input[name="lic_no"]',
        'input[name="license"]',
        'input[name="licenseNumber"]',
        'input[id*="lic" i]',
        'input[type="text"]',
      ];

      let licenseInput = null;
      for (const selector of licenseInputSelectors) {
        try {
          licenseInput = await page.$(selector);
          if (licenseInput) {
            console.log(`[TX Scraper] Found license input with selector: ${selector}`);
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

      // Enter last name if available
      if (params.lastName) {
        const lastNameSelectors = [
          'input[name="last_name"]',
          'input[name="lastName"]',
          'input[name="lname"]',
          'input[id*="last" i]',
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

      // Submit the form
      const submitSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value*="Search" i]',
        'input[value*="Verify" i]',
        'button:contains("Search")',
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
        /invalid\s*license/i,
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

      return await this.parseResults(page, params.licenseNumber);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TX Scraper] Error: ${errorMessage}`);
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

      // Look for status
      let status = rawData['Status'] || rawData['License Status'];
      if (!status) {
        if (/\bactive\b/i.test(allText)) status = 'Active';
        else if (/\bexpired\b/i.test(allText)) status = 'Expired';
        else if (/\binactive\b/i.test(allText)) status = 'Inactive';
        else if (/\bencumbered\b/i.test(allText)) status = 'Suspended';
      }

      // Get expiration date
      const expiration = rawData['Expiration'] || rawData['Expiration Date'] || rawData['Expires'];

      // Get name
      const name = rawData['Name'] || rawData['Licensee Name'] || rawData['Provider'];

      // Check for disciplinary actions
      const hasDiscipline = /discipline|action|sanction|encumbered|restriction/i.test(allText);

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
