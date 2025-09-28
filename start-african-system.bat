@echo off
echo.
echo 🌍 Starting African Country-Specific Payment System...
echo.

cd server

echo 📦 Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
) else (
    echo Dependencies already installed
)

echo.
echo 🗄️  Setting up database...
node setup-database.js

echo.
echo 🌐 Starting server...
echo.
echo 📱 The system will be available at: http://localhost:5000
echo 🔗 API endpoints: http://localhost:5000/api
echo 💚 Health check: http://localhost:5000/api/health
echo.
echo 📋 Available features:
echo    🌍 10 African countries supported
echo    💳 Paystack integration
echo    🪙 Crypto payments (Coinbase, Binance, Luno)
echo    🇬🇭 Ghanaian Bitnob platform
echo    🏦 Local bank integration
echo    📱 Mobile money support
echo.
echo 🔧 To test the system, open another terminal and run: node test-african-system.js
echo 🔧 To stop the server, press Ctrl+C
echo.

node index.js

pause
