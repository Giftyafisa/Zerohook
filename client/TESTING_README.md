# 🧪 Hkup Platform - Automated Testing Guide

This guide will help you set up and run automated browser testing for your Hkup platform to identify any issues or broken functionality.

## 🚀 Quick Start

### Option 1: Use the Batch Script (Windows)
1. Double-click `start-testing.bat` in the client folder
2. The script will automatically install dependencies and start testing
3. Watch the browser automatically navigate through your app

### Option 2: Manual Setup
1. Navigate to the `client` folder
2. Install dependencies: `npm install`
3. Install Playwright browsers: `npx playwright install`
4. Start testing: `npm run test:e2e:headed`

## 📋 Prerequisites

Before running tests, ensure:
- ✅ Your backend server is running on `http://localhost:5000`
- ✅ Your frontend is running on `http://localhost:3000`
- ✅ Database is properly configured and accessible
- ✅ You have test user accounts set up

## 🔧 Configuration

### 1. Test User Credentials
Edit `tests/test-users.config.js` and add your actual test user credentials:

```javascript
testUsers: [
  {
    email: 'your-test-user@example.com',
    password: 'your-test-password',
    name: 'Your Test User',
    role: 'user'
  }
]
```

### 2. Test Environment
The tests are configured to run against:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Database: Your configured database

## 🎯 What the Tests Cover

### Public Pages (No Auth Required)
- ✅ Homepage loading and navigation
- ✅ Login page functionality
- ✅ Registration page functionality
- ✅ Subscription page access
- ✅ Adult services browse page
- ✅ Profiles browse page

### Authentication Flow
- ✅ User registration process
- ✅ User login process
- ✅ Session management

### Protected Pages (Auth Required)
- ✅ Dashboard access
- ✅ User profile page
- ✅ Verification page
- ✅ Create service page
- ✅ Transactions page
- ✅ Trust score page

### Service Flow
- ✅ Service creation forms
- ✅ Service detail viewing
- ✅ Service browsing

### Profile Flow
- ✅ Profile browsing
- ✅ Profile detail viewing

### UI & Navigation
- ✅ Navigation menu functionality
- ✅ Responsive design testing
- ✅ Link validation

### Error Handling
- ✅ Invalid route handling
- ✅ Protected route access control
- ✅ Authentication redirects

## 🎭 Available Test Commands

```bash
# Run all tests in headless mode
npm run test:e2e

# Run tests with visible browser (recommended for debugging)
npm run test:e2e:headed

# Run tests with Playwright UI (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/app-navigation.spec.js

# Run tests on specific browser
npx playwright test --project=chromium
```

## 📊 Test Results & Reports

After running tests, you'll find detailed reports in:
- **HTML Report**: `playwright-report/index.html` (open in browser)
- **JSON Report**: `test-results.json`
- **JUnit Report**: `test-results.xml`
- **Screenshots**: Automatically captured on test failures
- **Videos**: Automatically recorded on test failures

## 🔍 Understanding Test Results

### ✅ Passing Tests
- All functionality working correctly
- Pages load without errors
- Navigation works as expected
- Forms submit successfully

### ❌ Failing Tests
- **Page Load Failures**: Check if components are properly exported/imported
- **Navigation Issues**: Verify React Router configuration
- **Form Submission Errors**: Check API endpoints and form validation
- **Authentication Problems**: Verify JWT tokens and protected routes
- **Component Rendering**: Check for missing dependencies or broken imports

## 🛠️ Troubleshooting Common Issues

### 1. Tests Can't Connect to App
```bash
# Ensure both servers are running
# Backend: npm start (in server folder)
# Frontend: npm start (in client folder)
```

### 2. Authentication Tests Failing
- Verify test user credentials in `test-users.config.js`
- Check if backend authentication endpoints are working
- Ensure JWT tokens are properly configured

### 3. Page Navigation Issues
- Check React Router configuration in `App.js`
- Verify all route components are properly exported
- Check for missing dependencies

### 4. Form Submission Problems
- Verify API endpoints are accessible
- Check form field names match backend expectations
- Ensure validation rules are properly configured

## 📱 Testing Different Devices

The tests automatically run on multiple viewports:
- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: Chrome Mobile, Safari Mobile
- **Responsive**: Tests different screen sizes

## 🔄 Continuous Testing

For development workflow:
```bash
# Watch mode - rerun tests on file changes
npx playwright test --watch

# Run tests in parallel for faster execution
npx playwright test --workers=4
```

## 📈 Performance Monitoring

Tests include performance checks:
- Page load times
- Component rendering performance
- Long-running tasks detection
- Memory usage monitoring

## 🎉 Success Criteria

Your app is working correctly when:
- ✅ All public pages load without errors
- ✅ Authentication flow works end-to-end
- ✅ Protected routes properly redirect unauthenticated users
- ✅ Forms submit and redirect correctly
- ✅ Navigation between pages works smoothly
- ✅ Responsive design works on all devices
- ✅ Error handling gracefully manages edge cases

## 🆘 Getting Help

If tests continue to fail:
1. Check the detailed HTML report for specific error details
2. Review browser console logs during test execution
3. Verify all dependencies are properly installed
4. Check if your backend API endpoints are responding
5. Ensure database connections are working

## 🚀 Next Steps

After fixing any issues found by the tests:
1. Run tests again to verify fixes
2. Add new tests for any new features
3. Integrate testing into your CI/CD pipeline
4. Set up automated testing on different environments

---

**Happy Testing! 🎯** Your app will be much more robust once all tests pass successfully.

