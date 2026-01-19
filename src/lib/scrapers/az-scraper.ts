import { BaseScraper } from './base-scraper';
import type { ScraperConfig, ScraperResult, LicenseLookupParams } from './types';

/**
 * Arizona State Board of Nursing License Scraper
 *
 * NOTE: Arizona uses two different systems:
 * - RN/LPN/APRN: Nursys (has bot detection, use NursysScraper)
 * - CNA/LNA/CMA/LHA/SN: boardsofnursing.org (this scraper)
 *
 * This scraper handles CNA/LNA/CMA/LHA/SN via:
 * URL: https://azbn.boardsofnursing.org/licenselookup
 */
export class ArizonaScraper extends BaseScraper {
  config: ScraperConfig = {
    state: 'AZ',
    credentialTypes: ['CNA', 'LNA', 'UCNA', 'CMA', 'LHA', 'SN'],
    lookupUrl: 'https://azbn.boardsofnursing.org/licenselookup',
    timeout: 45000,
  };

  async verify(params: LicenseLookupParams): Promise<ScraperResult> {
    // Check if this is an RN/LPN/APRN - redirect to Nursys
    const rnTypes = ['RN', 'LPN', 'APRN', 'NP', 'CNS', 'CNM', 'CRNA'];
    if (rnTypes.includes(params.credentialType.toUpperCase())) {
      return {
        success: false,
        error: 'unsupported_credential',
        errorDetails: `Arizona ${params.credentialType} licenses must be verified via Nursys. Use the Nursys scraper or verify manually at https://www.nursys.com`,
      };
    }

    const page = await this.initBrowser();

    try {
      console.log(`[AZ Scraper] Starting verification for license: ${params.licenseNumber}`);

      // Navigate to the search page
      await page.goto(this.config.lookupUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.wait(2000);

      // Click on "Search by License Number" tab
      const licenseTab = await page.$('a[href="#licenseNumberTab"], a[data-toggle="tab"]:contains("License")');
      if (licenseTab) {
        await licenseTab.click();
        await this.wait(500);
      } else {
        // Try clicking the second tab
        const tabs = await page.$$('.nav-tabs a, .nav-link');
        if (tabs.length >= 2) {
          await tabs[1].click();
          await this.wait(500);
        }
      }

      // Find license number input - it's under the License Number tab
      const licenseInput = await page.$('#LicenseSearch_LicenseSearchInput_LicenseNumber');

      if (!licenseInput) {
        return {
          success: false,
          error: 'scraper_error',
          errorDetails: 'Could not find license number input field',
        };
      }

      // Enter license number
      console.log(`[AZ Scraper] Entering license number: ${params.licenseNumber}`);
      await licenseInput.click();
      await licenseInput.type(params.licenseNumber, { delay: 50 });

      // Select license type if we know it
      const typeSelect = await page.$('#LicenseSearch_LicenseSearchInput_LicenseTypeId');
      if (typeSelect && params.credentialType) {
        const typeMap: Record<string, string> = {
          'CNA': 'CNA',
          'LNA': 'LNA',
          'UCNA': 'UCNA',
          'CMA': 'CMA',
          'LHA': 'LHA',
          'SN': 'SN',
        };
        const typeValue = typeMap[params.credentialType.toUpperCase()];
        if (typeValue) {
          // Try to select the right option
          const options = await page.$$eval('#LicenseSearch_LicenseSearchInput_LicenseTypeId option', opts =>
            opts.map(o => ({ value: o.value, text: o.textContent }))
          );
          const matchingOption = options.find(o => o.text?.includes(typeValue));
          if (matchingOption?.value) {
            await page.select('#LicenseSearch_LicenseSearchInput_LicenseTypeId', matchingOption.value);
          }
        }
      }

      await page.screenshot({ path: '/tmp/az-before-search.png' });

      // Find and click search button
      const searchBtn = await page.$('button[type="submit"], input[type="submit"], .btn-primary');
      if (!searchBtn) {
        // Try finding button by text
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
          if (text.includes('search')) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
              btn.click(),
            ]);
            break;
          }
        }
      } else {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          searchBtn.click(),
        ]);
      }

      await this.wait(2000);
      await page.screenshot({ path: '/tmp/az-after-search.png' });

      // Check for no results
      const pageContent = await page.content();
      const pageText = await page.evaluate(() => document.body.innerText);

      if (/no\s*records?\s*found/i.test(pageText) ||
          /no\s*results/i.test(pageText) ||
          /0\s*records/i.test(pageText)) {
        return {
          success: false,
          error: 'not_found',
          errorDetails: 'No license found matching the search criteria',
        };
      }

      // Parse results
      return await this.parseResults(page, params.licenseNumber);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AZ Scraper] Error: ${errorMessage}`);
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
      // Look for result rows/cards
      const resultRows = await page.$$('.search-result, .result-row, tr[data-id], .card');

      if (resultRows.length > 0) {
        // Click first result to see details
        const firstResult = resultRows[0];
        const detailLink = await firstResult.$('a');
        if (detailLink) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
            detailLink.click(),
          ]);
          await this.wait(1000);
        }
      }

      // Extract data from tables
      const tables = await page.$$('table');
      for (const table of tables) {
        const rows = await table.$$('tr');
        for (const row of rows) {
          const cells = await row.$$('td, th');
          if (cells.length >= 2) {
            const label = await page.evaluate(el => el.textContent?.trim() || '', cells[0]);
            const value = await page.evaluate(el => el.textContent?.trim() || '', cells[1]);
            if (label && value && label !== value) {
              rawData[label.replace(/[:\s]+$/, '')] = value;
            }
          }
        }
      }

      // Extract from definition lists
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

      // Extract from labeled elements
      const labeledFields = await page.$$('.field, .form-group, .detail-item, [class*="detail"]');
      for (const field of labeledFields) {
        const label = await page.evaluate(el => {
          const labelEl = el.querySelector('label, .label, strong, b, .field-label');
          return labelEl?.textContent?.trim() || '';
        }, field);
        const value = await page.evaluate(el => {
          const valueEl = el.querySelector('.value, .field-value, span:not(label):not(.label)');
          if (valueEl) return valueEl.textContent?.trim() || '';
          // Try getting text after label
          const text = el.textContent || '';
          const labelText = el.querySelector('label, .label, strong, b')?.textContent || '';
          return text.replace(labelText, '').trim();
        }, field);
        if (label && value && label !== value) {
          rawData[label.replace(/[:\s]+$/, '')] = value;
        }
      }

      // Get all text and parse
      const allText = await page.evaluate(() => document.body.innerText);
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l);

      // Extract status
      let status = rawData['Status'] || rawData['License Status'] || rawData['Credential Status'];
      if (!status) {
        const statusPatterns = [
          { pattern: /status[:\s]+(\w+)/i, group: 1 },
          { pattern: /\b(active|expired|inactive|suspended|revoked)\b/i, group: 1 },
        ];
        for (const { pattern, group } of statusPatterns) {
          const match = allText.match(pattern);
          if (match) {
            status = match[group];
            break;
          }
        }
      }

      // Extract expiration
      let expiration = rawData['Expiration'] || rawData['Expiration Date'] || rawData['Expires'];
      if (!expiration) {
        const expMatch = allText.match(/expir\w*[:\s]+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
        if (expMatch) expiration = expMatch[1];
      }

      // Extract name
      let name = rawData['Name'] || rawData['Licensee Name'] || rawData['Full Name'];
      if (!name) {
        const nameMatch = allText.match(/name[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
        if (nameMatch) name = nameMatch[1];
      }

      // Check for discipline
      const hasDiscipline = /discipline|action|sanction|restriction|probation/i.test(allText);

      // Verify we found the license
      const foundLicense = allText.includes(licenseNumber);

      console.log(`[AZ Scraper] Parsed:`, { status, expiration, name, foundLicense, rawData });

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
      console.error(`[AZ Scraper] Parse error:`, error);
      return {
        success: false,
        error: 'parse_error',
        errorDetails: error instanceof Error ? error.message : 'Failed to parse results',
      };
    }
  }
}
