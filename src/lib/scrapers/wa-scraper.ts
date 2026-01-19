import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScraperResult, LicenseLookupParams } from './types';

/**
 * Washington State Department of Health License Scraper
 * URL: https://fortress.wa.gov/doh/providercredentialsearch
 *
 * This scraper navigates the WA DOH Provider Credential Search
 * to verify nursing licenses (RN, LPN, CNA, ARNP, etc.)
 */
export class WashingtonScraper extends BaseScraper {
  config: ScraperConfig = {
    state: 'WA',
    credentialTypes: ['RN', 'LPN', 'CNA', 'ARNP', 'LNA'],
    lookupUrl: 'https://fortress.wa.gov/doh/providercredentialsearch',
    timeout: 45000,
  };

  async verify(params: LicenseLookupParams): Promise<ScraperResult> {
    const page = await this.initBrowser();

    try {
      console.log(`[WA Scraper] Starting verification for license: ${params.licenseNumber}`);

      // Navigate to the search page
      await page.goto(this.config.lookupUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to fully load
      await this.wait(2000);

      // Take screenshot for debugging (optional)
      // await page.screenshot({ path: '/tmp/wa-scraper-initial.png' });

      // Try multiple possible selectors for the credential/license number input
      const credentialInputSelectors = [
        'input[name="credential"]',
        'input[name="Credential"]',
        'input[name="credentialNumber"]',
        'input[name="CredentialNumber"]',
        'input[name="licenseNumber"]',
        'input[name="LicenseNumber"]',
        'input[id*="credential" i]',
        'input[id*="license" i]',
        'input[placeholder*="credential" i]',
        'input[placeholder*="license" i]',
        '#txtCredential',
        '#CredentialNumber',
        'input[type="text"]:first-of-type',
      ];

      let credentialInput = null;
      for (const selector of credentialInputSelectors) {
        try {
          credentialInput = await page.$(selector);
          if (credentialInput) {
            console.log(`[WA Scraper] Found credential input with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!credentialInput) {
        // Try to find any text input
        const allInputs = await page.$$('input[type="text"]');
        if (allInputs.length > 0) {
          credentialInput = allInputs[0];
          console.log(`[WA Scraper] Using first text input as credential field`);
        }
      }

      if (!credentialInput) {
        return {
          success: false,
          error: 'scraper_error',
          errorDetails: 'Could not find credential input field on the page',
        };
      }

      // Clear and enter the license number
      await credentialInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await credentialInput.type(params.licenseNumber, { delay: 50 });

      // If last name is provided, try to enter it
      if (params.lastName) {
        const lastNameSelectors = [
          'input[name="lastName"]',
          'input[name="LastName"]',
          'input[name="last_name"]',
          'input[id*="lastName" i]',
          'input[id*="last" i]',
          '#txtLastName',
        ];

        for (const selector of lastNameSelectors) {
          try {
            const lastNameInput = await page.$(selector);
            if (lastNameInput) {
              await lastNameInput.type(params.lastName, { delay: 50 });
              console.log(`[WA Scraper] Entered last name`);
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
            console.log(`[WA Scraper] Submitted search with selector: ${selector}`);
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
      console.error(`[WA Scraper] Error: ${errorMessage}`);
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

      // Try to extract from labeled spans/divs
      const labelPatterns = [
        { label: /status/i, key: 'Status' },
        { label: /expir/i, key: 'Expiration' },
        { label: /name/i, key: 'Name' },
        { label: /credential/i, key: 'Credential' },
        { label: /license/i, key: 'License' },
        { label: /issue/i, key: 'Issue Date' },
        { label: /discipline/i, key: 'Discipline' },
      ];

      const allText = await page.evaluate(() => document.body.innerText);
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l);

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of labelPatterns) {
          if (pattern.label.test(lines[i]) && !rawData[pattern.key]) {
            // Check if this line has a value after a colon
            const colonMatch = lines[i].match(/:\s*(.+)$/);
            if (colonMatch) {
              rawData[pattern.key] = colonMatch[1];
            } else if (i + 1 < lines.length) {
              // Value might be on next line
              rawData[pattern.key] = lines[i + 1];
            }
          }
        }
      }

      // Look for the license number in the content to confirm we found the right record
      const foundLicense = allText.includes(licenseNumber);

      // Determine status
      let status = rawData['Status'] || rawData['License Status'] || rawData['Credential Status'];

      // Look for status keywords in the page
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

      console.log(`[WA Scraper] Parsed data:`, { status, expiration, name, hasDiscipline, rawData });

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
      console.error(`[WA Scraper] Parse error:`, error);
      return {
        success: false,
        error: 'parse_error',
        errorDetails: error instanceof Error ? error.message : 'Failed to parse results',
      };
    }
  }
}
