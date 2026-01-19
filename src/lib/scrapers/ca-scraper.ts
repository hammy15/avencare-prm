import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScraperResult, LicenseLookupParams } from './types';

/**
 * California Board of Registered Nursing License Scraper
 * URL: https://www.rn.ca.gov/verification.shtml
 *
 * California uses the DCA BreEZe system for license verification.
 * This scraper navigates the CA BRN verification portal
 * to verify nursing licenses (RN, NP, CNM, etc.)
 *
 * Note: CNAs in California are certified through CDPH, not BRN
 */
export class CaliforniaScraper extends BaseScraper {
  config: ScraperConfig = {
    state: 'CA',
    credentialTypes: ['RN', 'NP', 'CNM', 'CRNA', 'CNS', 'PHN'],
    lookupUrl: 'https://www.rn.ca.gov/verification.shtml',
    timeout: 45000,
  };

  async verify(params: LicenseLookupParams): Promise<ScraperResult> {
    const page = await this.initBrowser();

    try {
      console.log(`[CA Scraper] Starting verification for license: ${params.licenseNumber}`);

      // Navigate to the search page
      await page.goto(this.config.lookupUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to fully load
      await this.wait(2000);

      // CA BRN page may have a link to the actual verification tool
      // Try to find and click on verification link
      const verifyLinks = await page.$$('a[href*="verification"], a[href*="lookup"], a[href*="search"], a[href*="breeze"]');
      if (verifyLinks.length > 0) {
        for (const link of verifyLinks) {
          const href = await page.evaluate(el => el.getAttribute('href'), link);
          const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', link);
          if (text.includes('verify') || text.includes('look') || text.includes('search') || text.includes('license')) {
            console.log(`[CA Scraper] Clicking verification link: ${href}`);
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
              link.click(),
            ]);
            await this.wait(2000);
            break;
          }
        }
      }

      // Try to find the license number input
      const licenseInputSelectors = [
        'input[name*="license" i]',
        'input[name*="credential" i]',
        'input[name*="number" i]',
        'input[id*="license" i]',
        'input[id*="credential" i]',
        'input[placeholder*="license" i]',
        'input[placeholder*="number" i]',
        '#LicenseNumber',
        '#licenseNumber',
        '#txtLicense',
        '#license_number',
        'input[type="text"]',
        'input[type="search"]',
      ];

      let licenseInput = null;
      for (const selector of licenseInputSelectors) {
        try {
          const inputs = await page.$$(selector);
          for (const input of inputs) {
            const isVisible = await page.evaluate(el => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden';
            }, input);
            if (isVisible) {
              licenseInput = input;
              console.log(`[CA Scraper] Found license input with selector: ${selector}`);
              break;
            }
          }
          if (licenseInput) break;
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

      // Clear and enter the license number
      await licenseInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await licenseInput.type(params.licenseNumber, { delay: 50 });

      // If last name is provided, try to enter it
      if (params.lastName) {
        const lastNameSelectors = [
          'input[name*="lastName" i]',
          'input[name*="last" i]',
          'input[id*="lastName" i]',
          'input[id*="last" i]',
          '#txtLastName',
          '#LastName',
          '#last_name',
        ];

        for (const selector of lastNameSelectors) {
          try {
            const lastNameInput = await page.$(selector);
            if (lastNameInput) {
              await lastNameInput.type(params.lastName, { delay: 50 });
              console.log(`[CA Scraper] Entered last name`);
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
        'input[value*="Verify" i]',
        'input[value*="Look" i]',
        'button:contains("Search")',
        'button:contains("Verify")',
        '#btnSearch',
        '#btnVerify',
        '#search',
        '.btn-search',
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
            console.log(`[CA Scraper] Submitted search with selector: ${selector}`);
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
        /your\s*search\s*returned\s*no/i,
        /no\s*data/i,
        /license\s*was\s*not\s*found/i,
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
      console.error(`[CA Scraper] Error: ${errorMessage}`);
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
      // Try to click on the first result if there's a results list
      const resultLinks = await page.$$('a[href*="detail"], a[href*="view"], .result-row a, table tbody tr a');
      if (resultLinks.length > 0) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
          resultLinks[0].click(),
        ]);
        await this.wait(1000);
      }

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

      // Extract from labeled divs (common in CA state sites)
      const labeledDivs = await page.$$('.field, .form-group, .detail-row, .info-row, .license-detail');
      for (const div of labeledDivs) {
        const label = await page.evaluate(el => {
          const labelEl = el.querySelector('label, .label, .field-label, strong, b');
          return labelEl?.textContent?.trim() || '';
        }, div);
        const value = await page.evaluate(el => {
          const valueEl = el.querySelector('.value, .field-value, span:not(.label):not(strong):not(b)');
          return valueEl?.textContent?.trim() || '';
        }, div);
        if (label && value) {
          rawData[label.replace(/[:\s]+$/, '')] = value;
        }
      }

      // Try to extract from text patterns
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
        { label: /address/i, key: 'Address' },
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

      // Determine status - CA uses specific terminology
      let status = rawData['Status'] || rawData['License Status'] || rawData['Credential Status'];

      if (!status) {
        if (/\bclear\b/i.test(allText) || /\bactive\b/i.test(allText)) status = 'Active';
        else if (/\bexpired\b/i.test(allText)) status = 'Expired';
        else if (/\binactive\b/i.test(allText) || /\bdelinquent\b/i.test(allText)) status = 'Inactive';
        else if (/\bsuspended\b/i.test(allText)) status = 'Suspended';
        else if (/\brevoked\b/i.test(allText) || /\bcanceled\b/i.test(allText)) status = 'Revoked';
      }

      // Get expiration date
      const expiration = rawData['Expiration'] || rawData['Expiration Date'] || rawData['Expires'];

      // Check for disciplinary actions
      const hasDiscipline = /discipline|action|sanction|restriction|probation|accusation/i.test(allText);

      // Get name
      const name = rawData['Name'] || rawData['Provider Name'] || rawData['Licensee'];

      console.log(`[CA Scraper] Parsed data:`, { status, expiration, name, hasDiscipline, rawData });

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
      console.error(`[CA Scraper] Parse error:`, error);
      return {
        success: false,
        error: 'parse_error',
        errorDetails: error instanceof Error ? error.message : 'Failed to parse results',
      };
    }
  }
}
