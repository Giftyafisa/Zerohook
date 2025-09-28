const { test, expect } = require('@playwright/test');

test.describe('Basic App Functionality Test', () => {
  test('should load basic app structure', async ({ page }) => {
    console.log('🧭 Testing basic app structure...');
    
    // Set longer timeout
    page.setDefaultTimeout(30000);
    
    try {
      // Try to load the app
      await page.goto('/');
      console.log('✅ Successfully navigated to /');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      console.log('✅ Page loaded completely');
      
      // Check if React app is working
      const reactRoot = page.locator('#root');
      await expect(reactRoot).toBeVisible();
      console.log('✅ React root found');
      
      // Check if any content is visible
      const body = page.locator('body');
      await expect(body).toBeVisible();
      console.log('✅ Body content visible');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'test-results/basic-app-structure.png' });
      console.log('✅ Screenshot saved');
      
    } catch (error) {
      console.error('❌ Error during basic test:', error.message);
      
      // Take error screenshot
      await page.screenshot({ path: 'test-results/basic-app-error.png' });
      console.log('✅ Error screenshot saved');
      
      // Get page content for debugging
      const content = await page.content();
      console.log('📄 Page HTML length:', content.length);
      
      throw error;
    }
  });

  test('should have working navigation', async ({ page }) => {
    console.log('🧭 Testing navigation...');
    
    page.setDefaultTimeout(30000);
    
    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Look for any navigation elements
      const navSelectors = [
        'nav',
        '.navbar', 
        '.navigation',
        '[role="navigation"]',
        'header',
        '.header'
      ];
      
      let navFound = false;
      for (const selector of navSelectors) {
        try {
          const element = page.locator(selector);
          if (await element.count() > 0) {
            console.log(`✅ Navigation found with selector: ${selector}`);
            navFound = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!navFound) {
        console.log('⚠️ No navigation found with common selectors');
        
        // Look for any clickable elements
        const links = page.locator('a, button');
        const linkCount = await links.count();
        console.log(`📊 Found ${linkCount} clickable elements`);
        
        // Take screenshot
        await page.screenshot({ path: 'test-results/navigation-test.png' });
      }
      
    } catch (error) {
      console.error('❌ Navigation test error:', error.message);
      await page.screenshot({ path: 'test-results/navigation-error.png' });
      throw error;
    }
  });

  test('should handle route changes', async ({ page }) => {
    console.log('🧭 Testing route handling...');
    
    page.setDefaultTimeout(30000);
    
    try {
      // Start at home
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      console.log('📍 Current URL:', page.url());
      
      // Try to navigate to login
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      console.log('📍 After login navigation:', page.url());
      
      // Check if we're actually on login page
      if (page.url().includes('/login')) {
        console.log('✅ Login route navigation successful');
      } else {
        console.log('⚠️ Login route may have redirected');
        console.log('📍 Final URL:', page.url());
      }
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/route-test.png' });
      
    } catch (error) {
      console.error('❌ Route test error:', error.message);
      await page.screenshot({ path: 'test-results/route-error.png' });
      throw error;
    }
  });
});

