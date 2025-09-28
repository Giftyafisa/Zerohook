@echo off
echo 🚀 Starting Hkup Platform - Enhanced System
echo.

echo 📊 Step 1: Setting up database...
cd server
npm run setup-db
if %errorlevel% neq 0 (
    echo ❌ Database setup failed
    pause
    exit /b 1
)

echo.
echo 🧪 Step 2: Testing system integration...
npm run test-system
if %errorlevel% neq 0 (
    echo ⚠️  System integration test had issues, but continuing...
)

echo.
echo 🌐 Step 3: Starting server...
npm start
if %errorlevel% neq 0 (
    echo ❌ Server failed to start
    pause
    exit /b 1
)

echo.
echo ✅ System started successfully!
echo 🌍 Server should be running on http://localhost:5000
echo 📱 Frontend should be running on http://localhost:3000
echo.
pause

