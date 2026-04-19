const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

function buildPricing() {
  return {
    sugar_daddy: {
      monthly: { price: 300, currency: 'GHS' },
      yearly: { price: 3000, currency: 'GHS' }
    },
    sugar_mommy: {
      monthly: { price: 300, currency: 'GHS' },
      yearly: { price: 3000, currency: 'GHS' }
    },
    both: {
      monthly: { price: 500, currency: 'GHS' },
      yearly: { price: 5000, currency: 'GHS' }
    }
  };
}

async function runCryptoSmoke() {
  const fallbackChromiumPath = path.join(
    process.env.LOCALAPPDATA || '',
    'ms-playwright',
    'chromium-1208',
    'chrome-win',
    'chrome.exe'
  );

  const launchOptions = fs.existsSync(fallbackChromiumPath)
    ? { headless: true, executablePath: fallbackChromiumPath }
    : { headless: true };

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  let hasSugarDaddyAccess = false;
  let verifyCalls = 0;

  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const reqPath = url.pathname;
    const method = req.method();

    const json = (body) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });

    if (reqPath.includes('/auth/validate-token') && method === 'POST') {
      return json({
        valid: true,
        user: {
          id: 'smoke_client_1',
          username: 'Smoke Client',
          account_type: 'client',
          verificationTier: 2,
          isSubscribed: true
        }
      });
    }

    if (reqPath.includes('/countries/detect') && method === 'POST') {
      return json({
        success: true,
        detectedCountry: { code: 'GH', name: 'Ghana', currency: 'GHS', currencySymbol: 'GHS' }
      });
    }

    if (reqPath.endsWith('/countries') && method === 'GET') {
      return json({ countries: [{ code: 'GH', name: 'Ghana' }, { code: 'NG', name: 'Nigeria' }] });
    }

    if (reqPath.includes('/sugar-access/status') && method === 'GET') {
      return json({
        hasSugarDaddyAccess,
        hasSugarMommyAccess: false,
        accessDetails: hasSugarDaddyAccess
          ? {
              sugar_daddy: {
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                billingCycle: 'monthly'
              }
            }
          : {},
        pricing: buildPricing(),
        effectivePricing: buildPricing()
      });
    }

    if (reqPath.includes('/users/sugar-profiles') && method === 'GET') {
      return json({
        profiles: hasSugarDaddyAccess
          ? [{
              id: 'sugar_profile_1',
              username: 'VVIP One',
              verification_tier: 2,
              reputation_score: 4.8,
              profile_data: {
                firstName: 'VVIP',
                lastName: 'One',
                location: { city: 'Accra', country: 'Ghana' },
                photos: []
              }
            }]
          : []
      });
    }

    if (reqPath.includes('/sugar-access/initialize') && method === 'POST') {
      return json({
        amount: 300,
        currency: 'GHS',
        paymentData: {
          address: 'TQf6xwvYzN5g8hXr1eV7pA1m8Q2b6dW9cK',
          cryptoAmount: '25.00',
          cryptoSymbol: 'USDT',
          network: 'TRON',
          qrData: 'USDT:TRON:TQf6xwvYzN5g8hXr1eV7pA1m8Q2b6dW9cK',
          reference: 'SMOKE-REF-001',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }
      });
    }

    if (reqPath.includes('/sugar-access/verify') && method === 'POST') {
      verifyCalls += 1;
      hasSugarDaddyAccess = true;
      return json({ success: true, status: 'confirmed' });
    }

    return route.continue();
  });

  await context.route('**/socket.io/**', (route) => route.abort());

  await page.addInitScript(() => {
    localStorage.setItem('token', 'smoke-token');
  });

  await page.goto(`${BASE_URL}/sugar-profiles`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root', { state: 'attached', timeout: 15000 });

  await page.waitForSelector('text=Sugar Profiles', { timeout: 15000 });
  await page.waitForSelector('text=Access Required', { timeout: 15000 });

  const purchaseButton = page.getByRole('button', { name: 'Purchase' }).first();
  await purchaseButton.click();

  await page.waitForSelector('text=Complete Crypto Payment', { timeout: 15000 });
  await page.waitForSelector('text=Waiting for payment...', { timeout: 15000 });

  await page.getByRole('button', { name: 'Check Now' }).click();

  await page.waitForFunction(() => {
    return document.body.innerText.includes('Sugar Daddy Access:')
      && document.body.innerText.includes('Active');
  }, { timeout: 15000 });

  if (verifyCalls < 1) {
    throw new Error(`expected at least one /sugar-access/verify call, got ${verifyCalls}`);
  }

  const hasAccessRequired = await page.locator('text=Access Required').count();
  if (hasAccessRequired > 0) {
    throw new Error('access gate still visible after confirmation');
  }

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`consoleErrors=${consoleErrors.slice(0, 3).join(' | ')}, pageErrors=${pageErrors.slice(0, 3).join(' | ')}`);
  }

  console.log(`SMOKE_PASS crypto-payment: verify_calls=${verifyCalls}`);
  await context.close();
  await browser.close();
}

runCryptoSmoke()
  .then(() => {
    console.log('CRYPTO_SMOKE_RESULT=PASS');
  })
  .catch((error) => {
    console.error('CRYPTO_SMOKE_RESULT=FAIL');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });