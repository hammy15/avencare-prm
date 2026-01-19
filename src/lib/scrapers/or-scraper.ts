import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScraperResult, LicenseLookupParams } from './types';

/**
 * Oregon State Board of Nursing License Scraper
 * URL: https://osbn.oregon.gov/OSBNVerification/
 *
 * This scraper navigates the OSBN Verification portal
 * to verify nursing licenses (RN, LPN, CNA, NP, etc.)
 */
export class OregonScraper extends BaseScraper {
  config: ScraperConfig = {
    state: 'OR',
    credentialTypes: ['RN', 'LPN', 'CNA', 'NP', 'CNS', 'CRNA', 'CNM'],
    lookupUrl: 'https://osbn.oregon.gov/OSBNVerification/',
    timeout: 45000,
  };

  async verify(params: LicenseLookupParams): Promise<ScraperResult> {
    const page = await this.initBrowser();

    try {
      console.log(`[OR Scraper] Starting verification for license: ${params.licenseNumber}`);

      // Navigate to the search page
      await page.goto(this.config.lookupUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to fully load
      await this.wait(2000);

      // Try multiple possible selectors for license number input
      const licenseInputSelectors = [
        'input[name="licenseNumber"]',
        'input[name="LicenseNumber"]',
        'input[name="license"]',
        'input[id*="license" i]',
        'input[id*="credential" i]',
        'input[placeholder*="license" i]',
        '#LicenseNumber',
        '#licenseNumber',
        'input[type="text"]:first-of-type',
      ];

      let licenseInput = null;
      for (const selector of licenseInputSelectors) {
        try {
          licenseInput = await page.$(selector);
          if (licenseInput) {
            console.log(`[OR Scraper] Found license input with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!licenseInput) {
        // Try to find any text input
        const allInputs = await page.$$('input[type="text"]');
        if (allInputs.length > 0) {
          licenseInput = allInputs[0];
          console.log(`[OR Scraper] Using first text input as license field`);
        }
      }

      if (!licenseInput) {
        return {
          success: false,
          error: 'scraper_error',
          errorDetails: 'Could not find license input field on the page',
        };
      }

      // Clear and enter the license number
      await licenseInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await licenseInput.type(params.licenseNumber, { delay: 50 });

      // If last name is provided, try to enter it
      if (params.lastName) {
        const lastNameSelectors = [
          'input[name="lastName"]',
          'input[name="LastName"]',
          'input[name="last_name"]',
          'input[id*="lastName" i]',
          'input[id*="last" i]',
          '#LastName',
          '#lastName',
        ];

        for (const selector of lastNameSelectors) {
          try {
            const lastNameInput = await page.$(selector);
            if (lastNameInput) {
              await lastNameInput.type(params.lastName, { delay: 50 });
              console.log(`[OR Scraper] Entered last name`);
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // Find and click the search button
      const submitSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value*="Search" i]',
        'button:contains("Search")',
        '#btnSearch',
        '.search-button',
        'button.btn-primary',
        'input[value*="Verify" i]',
        'button:contains("Verify")',
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
            console.log(`[OR Scraper] Submitted search with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!submitted) {
        // Try pressing Enter
        await page.keyboard.press('Enter');
        await this.wait(3000);
      }

      // Wait for results to load
      await this.wait(2000);

      // Check for "no results" message
      const pageContent = await page.content();
      const noResultsPatterns = [
        /no\s*records?\s*found/i,
        /no\s*results?/i,
        /not\s*found/i,
        /0\s*results?/i,
        /no\s*matching/i,
        /no\s*license/i,
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

      // Parse the results
      return await this.parseResults(page, params.licenseNumber);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[OR Scraper] Error: ${errorMessage}`);
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
      // Try to extract data from tables
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

      // Try to extract from definition lists (dl/dt/dd)
      const dts = await page.$$('dt');
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

      // Try to extract from labeled divs/spans
      const allText = await page.evaluate(() => document.body.innerText);
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l);

      const labelPatterns = [
        { label: /status/i, key: 'Status' },
        { label: /expir/i, key: 'Expiration' },
        { label: /name/i, key: 'Name' },
        { label: /license\s*(number|#|no)/i, key: 'License Number' },
        { label: /credential/i, key: 'Credential' },
        { label: /issue/i, key: 'Issue Date' },
        { label: /discipline|action/i, key: 'Discipline' },
        { label: /type/i, key: 'License Type' },
      ];

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of labelPatterns) {
          if (pattern.label.test(lines[i]) && !rawData[pattern.key]) {
            const colonMatch = lines[i].match(/:\s*(.+)$/);
            if (colonMatch) {
              rawData[pattern.key] = colonMatch[1];
            } else if (i + 1 < lines.length) {
              rawData[pattern.key] = lines[i + 1];
            }
          }
        }
      }

      // Check if we found the license
      const foundLicense = allText.includes(licenseNumber);

      // Determine status
      let status = rawData['Status'] || rawData['License Status'] || rawData['Credential Status'];

      if (!status) {
        if (/\bactive\b/i.test(allText)) status = 'Active';
        else if (/\bexpired\b/i.test(allText)) status = 'Expired';
        else if (/\binactive\b/i.test(allText)) status = 'Inactive';
        else if (/\bsuspended\b/i.test(allText)) status = 'Suspended';
        else if (/\brevoked\b/i.test(allText)) status = 'Revoked';
      }

      // Get expiration date
      const expiration = rawData['Expiration'] || rawData['Expiration Date'] || rawData['Expires'];

      // Check for disciplinary actions
      const hasDiscipline = /discipline|action|sanction|restriction|probation/i.test(allText);

      // Get name
      const name = rawData['Name'] || rawData['Provider Name'] || rawData['Licensee'];

      console.log(`[OR Scraper] Parsed data:`, { status, expiration, name, hasDiscipline, rawData });

      return {
        success: foundLicense || Object.keys(rawData).length > 0,
        licenseNumber,
        licenseName: name || undefined,
        status: this.normalizeStatus(status || null),
        expirationDate: this.parseDate(expiration || null),
        unencumbered: !hasDiscipline,
        rawData,
      };

    } catch (error) {
      console.error(`[OR Scraper] Parse error:`, error);
      return {
        success: false,
        error: 'parse_error',
        errorDetails: error instanceof Error ? error.message : 'Failed to parse results',
      };
    }
  }
}
