const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

function buildConversations(start, count) {
  return Array.from({ length: count }, (_, i) => {
    const idx = start + i;
    return {
      id: `conv_${String(idx).padStart(2, '0')}`,
      otherUser: {
        id: `user_${idx}`,
        username: `User ${idx}`,
        profilePicture: null,
        verificationTier: 2
      },
      lastMessage: `Message ${idx}`,
      lastMessageType: 'text',
      lastMessageTime: new Date(Date.now() - idx * 60000).toISOString(),
      unreadCount: idx % 3 === 0 ? 1 : 0,
      hasActiveEscrow: false,
      createdAt: new Date(Date.now() - idx * 60000).toISOString()
    };
  });
}

async function waitForCount(page, selector, expected, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const count = await page.locator(selector).count();
    if (count >= expected) return count;
    await page.waitForTimeout(150);
  }
  return page.locator(selector).count();
}

async function runScenario(name, contextOptions) {
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
  const context = await browser.newContext(contextOptions);
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

  let conversationCalls = 0;

  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    const json = (body) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });

    if (path.includes('/auth/validate-token') && method === 'POST') {
      return json({
        valid: true,
        user: {
          id: 'smoke_user',
          username: 'Smoke User',
          account_type: 'client',
          verificationTier: 2,
          isSubscribed: true
        }
      });
    }

    if (path.includes('/countries/detect') && method === 'POST') {
      return json({
        success: true,
        detectedCountry: { code: 'NG', name: 'Nigeria', currency: 'NGN', currencySymbol: 'NGN' }
      });
    }

    if (path.endsWith('/countries') && method === 'GET') {
      return json({ countries: [{ code: 'NG', name: 'Nigeria' }, { code: 'GH', name: 'Ghana' }] });
    }

    if (path.includes('/chat/conversations') && method === 'GET') {
      conversationCalls += 1;
      const cursor = url.searchParams.get('cursor');
      if (!cursor) {
        return json({ conversations: buildConversations(1, 20), nextCursor: 'cursor_1', hasMore: true });
      }
      if (cursor === 'cursor_1') {
        return json({ conversations: buildConversations(21, 8), nextCursor: null, hasMore: false });
      }
      return json({ conversations: [], nextCursor: null, hasMore: false });
    }

    if (/\/chat\/messages\//.test(path) && method === 'GET') {
      return json({ messages: [] });
    }

    if (/\/chat\/read\//.test(path) && method === 'POST') {
      return json({ success: true });
    }

    return route.continue();
  });

  await context.route('**/socket.io/**', (route) => route.abort());

  await page.addInitScript(() => {
    localStorage.setItem('token', 'smoke-token');
  });

  await page.goto(`${BASE_URL}/messages?conversation=conv_01`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root', { state: 'attached', timeout: 15000 });

  const listSelector = '[aria-label="Conversations"] [role="listitem"]';
  let conversationsVisible = true;
  try {
    await page.waitForSelector('[aria-label="Conversations"]', { timeout: 15000 });
  } catch (error) {
    conversationsVisible = false;
  }

  if (!conversationsVisible) {
    const hasLoginEmail = await page.locator('input[type="email"], input[name="email"]').count();
    const currentUrl = page.url();
    await page.screenshot({ path: `test-results/chat-smoke-${name}-failure.png`, fullPage: true });
    throw new Error(
      `${name}: conversations list not visible. url=${currentUrl}, loginFieldCount=${hasLoginEmail}, consoleErrors=${consoleErrors.slice(0, 3).join(' | ')}, pageErrors=${pageErrors.slice(0, 3).join(' | ')}`
    );
  }

  const initialCount = await waitForCount(page, listSelector, 20);
  if (initialCount < 20) {
    throw new Error(`${name}: expected >=20 conversations on first page, got ${initialCount}`);
  }

  const scrollBox = page.locator('[aria-label="Conversations"]');
  await scrollBox.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  let loadedCount = await waitForCount(page, listSelector, 28, 3000);

  if (loadedCount < 28) {
    const loadMoreButton = page.getByRole('button', { name: 'Load more conversations' });
    if (await loadMoreButton.count() > 0) {
      await loadMoreButton.click();
      loadedCount = await waitForCount(page, listSelector, 28, 5000);
    }
  }

  if (loadedCount < 28) {
    throw new Error(`${name}: expected >=28 conversations after infinite scroll/load-more, got ${loadedCount}`);
  }

  if (conversationCalls < 2) {
    throw new Error(`${name}: expected at least 2 conversation page fetches, got ${conversationCalls}`);
  }

  console.log(`SMOKE_PASS ${name}: initial=${initialCount}, after_load=${loadedCount}, fetches=${conversationCalls}`);

  await context.close();
  await browser.close();
}

async function main() {
  await runScenario('desktop', { viewport: { width: 1366, height: 900 } });
  await runScenario('mobile', { ...devices['Pixel 5'] });
  console.log('CHAT_SMOKE_RESULT=PASS');
}

main().catch((error) => {
  console.error('CHAT_SMOKE_RESULT=FAIL');
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
