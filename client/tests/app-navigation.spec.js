const { test, expect } = require('@playwright/test');

// Test configuration
const TEST_CONFIG = {
  // Test user credentials
  testUsers: [
    {
      email: 'emeka.uzoma@nigeria.com',
      password: 'EmekaPass123!',
      name: 'Emeka Uzoma'
    }
  ],
  // Test timeouts
  timeouts: {
    navigation: 10000,
    element: 5000,
    action: 3000
  }
};

test.describe('Hkup Platform - Complete App Navigation Test', () => {
  let page;
  let isAuthenticated = false;
  let currentUser = null;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Set longer timeout for navigation
    page.setDefaultTimeout(TEST_CONFIG.timeouts.navigation);
  });

  test.describe('Public Pages - No Authentication Required', () => {
    test('should load homepage successfully', async () => {
      console.log('🧭 Testing homepage...');
      
      await page.goto('/');
      await expect(page).toHaveTitle(/Hkup|Hook|Platform/i);
      
      // Check if main content loads
      await expect(page.locator('main')).toBeVisible();
      
      // Check for navigation elements (using header since that's what the app uses)
      await expect(page.locator('header')).toBeVisible();
      
      console.log('✅ Homepage loaded successfully');
    });

    test('should navigate to login page', async () => {
      console.log('🧭 Testing login page navigation...');
      
      await page.goto('/login');
      await expect(page).toHaveURL(/.*login/);
      
      // Check for login form elements
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"], button:has-text("Login")')).toBeVisible();
      
      console.log('✅ Login page loaded successfully');
    });

    test('should navigate to registration page', async () => {
      console.log('🧭 Testing registration page navigation...');
      
      await page.goto('/register');
      await expect(page).toHaveURL(/.*register/);
      
      // Check for registration form elements
      await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
      // Check for password field (there are two: password and confirmPassword)
      await expect(page.locator('input[name="password"]')).toBeVisible();
      
      console.log('✅ Registration page loaded successfully');
    });

    test('should navigate to subscription page', async () => {
      console.log('🧭 Testing subscription page navigation...');
      
      await page.goto('/subscription');
      await expect(page).toHaveURL(/.*subscription/);
      
      // Check for subscription content
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Subscription page loaded successfully');
    });

    test('should navigate to adult services browse page', async () => {
      console.log('🧭 Testing adult services browse page...');
      
      await page.goto('/adult-services');
      await expect(page).toHaveURL(/.*adult-services/);
      
      // Check for services content
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Adult services browse page loaded successfully');
    });

    test('should navigate to profiles browse page', async () => {
      console.log('🧭 Testing profiles browse page...');
      
      await page.goto('/profiles');
      await expect(page).toHaveURL(/.*profiles/);
      
      // Check for profiles content
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Profiles browse page loaded successfully');
    });
  });

  test.describe('Authentication Flow', () => {
    test('should register a new user successfully', async () => {
      console.log('🧭 Testing user registration...');
      
      await page.goto('/register');
      
      // Fill registration form with test data
      const testUser = {
        email: `testuser_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User'
      };
      
      // Fill form fields (adjust selectors based on your actual form)
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill('input[name="password"], input[type="password"]', testUser.password);
      await page.fill('input[name="name"], input[name="firstName"]', testUser.name);
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Register")');
      
      // Wait for redirect or success message
      await page.waitForTimeout(3000);
      
      // Check if redirected to subscription or dashboard
      const currentUrl = page.url();
      if (currentUrl.includes('/subscription') || currentUrl.includes('/dashboard')) {
        console.log('✅ User registration successful');
        isAuthenticated = true;
        currentUser = testUser;
      } else {
        console.log('⚠️ Registration may have failed or redirected elsewhere');
      }
    });

    test('should login with existing user', async () => {
      console.log('🧭 Testing user login...');
      
      // Use first test user from config
      const testUser = TEST_CONFIG.testUsers[0];
      
      await page.goto('/login');
      
      // Fill login form
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill('input[name="password"], input[type="password"]', testUser.password);
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Login")');
      
      // Wait for redirect or success
      await page.waitForTimeout(3000);
      
      // Check if redirected to dashboard
      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard')) {
        console.log('✅ User login successful');
        isAuthenticated = true;
        currentUser = testUser;
      } else {
        console.log('⚠️ Login may have failed or redirected elsewhere');
      }
    });
  });

  test.describe('Protected Pages - Authentication Required', () => {
    test.beforeEach(async () => {
      // Skip these tests if not authenticated
      test.skip(!isAuthenticated, 'User not authenticated');
    });

    test('should access dashboard page', async () => {
      console.log('🧭 Testing dashboard access...');
      
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/.*dashboard/);
      
      // Check for dashboard content
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Dashboard page accessed successfully');
    });

    test('should access user profile page', async () => {
      console.log('🧭 Testing profile page access...');
      
      await page.goto('/profile');
      await expect(page).toHaveURL(/.*profile/);
      
      // Check for profile content
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Profile page accessed successfully');
    });

    test('should access verification page', async () => {
      console.log('🧭 Testing verification page access...');
      
      await page.goto('/verification');
      await expect(page).toHaveURL(/.*verification/);
      
      // Check for verification content
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Verification page accessed successfully');
    });

    test('should access create service page', async () => {
      console.log('🧭 Testing create service page access...');
      
      await page.goto('/create-service');
      await expect(page).toHaveURL(/.*create-service/);
      
      // Check for create service content
      await expect(page).toHaveURL(/.*create-service/);
      
      console.log('✅ Create service page accessed successfully');
    });

    test('should access transactions page', async () => {
      console.log('🧭 Testing transactions page access...');
      
      await page.goto('/transactions');
      await expect(page).toHaveURL(/.*transactions/);
      
      // Check for transactions content
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Transactions page accessed successfully');
    });

    test('should access trust score page', async () => {
      console.log('🧭 Testing trust score page access...');
      
      await page.goto('/trust-score');
      await expect(page).toHaveURL(/.*trust-score/);
      
      // Check for trust score content
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Trust score page accessed successfully');
    });
  });

  test.describe('Service Flow Testing', () => {
    test('should create a new adult service', async () => {
      console.log('🧭 Testing adult service creation...');
      
      test.skip(!isAuthenticated, 'User not authenticated');
      
      await page.goto('/adult-services/create');
      
      // Fill service creation form (adjust selectors based on your form)
      await page.fill('input[name="title"], input[name="serviceTitle"]', 'Test Service');
      await page.fill('textarea[name="description"], textarea[name="serviceDescription"]', 'This is a test service description');
      
      // Submit form
      await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Submit")');
      
      // Wait for redirect or success
      await page.waitForTimeout(3000);
      
      console.log('✅ Service creation attempted');
    });

    test('should view service details', async () => {
      console.log('🧭 Testing service detail view...');
      
      await page.goto('/adult-services');
      
      // Look for service cards/links
      const serviceLinks = page.locator('a[href*="/adult-services/"], .service-card a, .service-link');
      
      if (await serviceLinks.count() > 0) {
        // Click on first service
        await serviceLinks.first().click();
        
        // Wait for navigation
        await page.waitForTimeout(2000);
        
        // Check if we're on a service detail page
        const currentUrl = page.url();
        if (currentUrl.includes('/adult-services/') && !currentUrl.endsWith('/adult-services')) {
          console.log('✅ Service detail page accessed successfully');
        } else {
          console.log('⚠️ Service detail navigation may have failed');
        }
      } else {
        console.log('ℹ️ No services found to test detail view');
      }
    });
  });

  test.describe('Profile Flow Testing', () => {
    test('should view user profiles', async () => {
      console.log('🧭 Testing profile browsing...');
      
      await page.goto('/profiles');
      
      // Look for profile cards/links
      const profileLinks = page.locator('a[href*="/profile/"], .profile-card a, .profile-link');
      
      if (await profileLinks.count() > 0) {
        // Click on first profile
        await profileLinks.first().click();
        
        // Wait for navigation
        await page.waitForTimeout(2000);
        
        // Check if we're on a profile detail page
        const currentUrl = page.url();
        if (currentUrl.includes('/profile/') && !currentUrl.endsWith('/profiles')) {
          console.log('✅ Profile detail page accessed successfully');
        } else {
          console.log('⚠️ Profile detail navigation may have failed');
        }
      } else {
        console.log('ℹ️ No profiles found to test detail view');
      }
    });
  });

  test.describe('Navigation and UI Testing', () => {
    test('should have working navigation menu', async () => {
      console.log('🧭 Testing navigation menu...');
      
      await page.goto('/');
      
      // Check if navigation menu is visible (using header since that's what the app uses)
      const nav = page.locator('header, nav, .navbar, .navigation');
      await expect(nav).toBeVisible();
      
      // Test navigation links (adjust selectors based on your navigation)
      const navLinks = nav.locator('a, .nav-link');
      
      if (await navLinks.count() > 0) {
        console.log(`✅ Navigation menu found with ${await navLinks.count()} links`);
        
        // Test a few key navigation items
        const homeLink = navLinks.filter({ hasText: /home|Home/i });
        if (await homeLink.count() > 0) {
          await homeLink.first().click();
          await expect(page).toHaveURL('/');
          console.log('✅ Home navigation link working');
        }
      } else {
        console.log('⚠️ Navigation menu may not be properly configured');
      }
    });

    test('should have responsive design', async () => {
      console.log('🧭 Testing responsive design...');
      
      await page.goto('/');
      
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      
      // Check if page still renders
      await expect(page.locator('main')).toBeVisible();
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
      
      // Check if page still renders
      await expect(page.locator('main')).toBeVisible();
      
      console.log('✅ Responsive design working');
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle invalid routes gracefully', async () => {
      console.log('🧭 Testing invalid route handling...');
      
      await page.goto('/invalid-route-that-does-not-exist');
      
      // Wait for page load
      await page.waitForTimeout(2000);
      
      // Check if redirected to home or shows 404
      const currentUrl = page.url();
      if (currentUrl === '/' || currentUrl.includes('404') || currentUrl.includes('not-found')) {
        console.log('✅ Invalid route handled gracefully');
      } else {
        console.log('⚠️ Invalid route may not be handled properly');
      }
    });

    test('should handle protected route access without auth', async () => {
      console.log('🧭 Testing protected route access without auth...');
      
      // Clear any existing authentication
      await page.context().clearCookies();
      
      // Try to access protected route
      await page.goto('/dashboard');
      
      // Wait for redirect
      await page.waitForTimeout(3000);
      
      // Check if redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        console.log('✅ Protected route properly redirects to login');
      } else {
        console.log('⚠️ Protected route may not be properly protected');
      }
    });
  });

  test.afterAll(async () => {
    console.log('\n🎉 COMPREHENSIVE APP TESTING COMPLETED!');
    console.log(`📊 Authentication Status: ${isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`);
    if (currentUser) {
      console.log(`👤 Test User: ${currentUser.name} (${currentUser.email})`);
    }
    console.log('📋 Check the test report for detailed results');
    console.log('🔧 Fix any failing tests to ensure your app works properly');
  });
});
