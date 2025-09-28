@echo off
echo 🧪 Starting Hkup Platform Automated Testing
echo.

echo 📋 Step 1: Installing Playwright dependencies...
npm install

echo.
echo 🎭 Step 2: Installing Playwright browsers...
npx playwright install

echo.
echo 🚀 Step 3: Starting automated browser testing...
echo.
echo 💡 Available test commands:
echo    - npm run test:e2e          (Run all tests)
echo    - npm run test:e2e:headed   (Run tests with visible browser)
echo    - npm run test:e2e:ui       (Run tests with Playwright UI)
echo    - npm run test:e2e:debug    (Run tests in debug mode)
echo.

echo 🎯 Starting comprehensive app testing...
npm run test:e2e:headed

echo.
echo ✅ Testing completed! Check the test results above.
echo 📊 Detailed reports available in test-results/ folder
echo.
pause

