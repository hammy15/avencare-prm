import puppeteer from 'puppeteer';

async function testAZScraper() {
  const testLicenseNumber = process.argv[2] || '161109';
  const lastName = process.argv[3] || 'CHAVEZ';

  console.log('='.repeat(60));
  console.log('Arizona RN Scraper Test (via Nursys)');
  console.log('='.repeat(60));
  console.log(`Testing license number: ${testLicenseNumber}`);
  console.log(`Last name: ${lastName}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Try Nursys Quick Confirm
    console.log('\n1. Navigating to Nursys Quick Confirm...');
    await page.goto('https://www.nursys.com/LQC/LQCSearch.aspx', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.screenshot({ path: '/tmp/nursys-initial.png' });
    console.log('   Screenshot saved: /tmp/nursys-initial.png');
    console.log(`   Current URL: ${page.url()}`);

    // Get page text
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('\n   Page content:\n', bodyText.substring(0, 2000));

    // Check for form elements
    const inputs = await page.$$eval('input, select', els =>
      els.map(el => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type || '',
        name: el.getAttribute('name') || '',
        id: el.id,
      }))
    );
    console.log('\n   Form elements:', JSON.stringify(inputs, null, 2));

    // Wait for any dynamic content
    await new Promise(r => setTimeout(r, 2000));

    // Look for state dropdown
    const stateSelect = await page.$('select[name*="State" i], select[id*="State" i], #ddState');
    if (stateSelect) {
      console.log('\n2. Selecting Arizona state...');
      await page.select('select[name*="State" i], select[id*="State" i], #ddState', 'AZ').catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    }

    // Look for license number input
    const licenseInput = await page.$('#txtLicNum, input[name*="LicNum" i], input[id*="license" i]');
    if (licenseInput) {
      console.log('   Entering license number...');
      await licenseInput.type(testLicenseNumber, { delay: 50 });
    }

    // Look for last name input
    const lastNameInput = await page.$('#txtLastName, input[name*="LastName" i]');
    if (lastNameInput) {
      console.log('   Entering last name...');
      await lastNameInput.type(lastName, { delay: 50 });
    }

    await page.screenshot({ path: '/tmp/nursys-filled.png' });
    console.log('   Screenshot after filling: /tmp/nursys-filled.png');

    // Click search
    const searchBtn = await page.$('#btnSearch, input[type="submit"], button[type="submit"]');
    if (searchBtn) {
      console.log('\n3. Clicking search...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        searchBtn.click(),
      ]);

      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: '/tmp/nursys-results.png' });
      console.log('   Screenshot saved: /tmp/nursys-results.png');

      const resultsText = await page.evaluate(() => document.body.innerText);
      console.log('\n   Results:\n', resultsText.substring(0, 3000));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testAZScraper();
