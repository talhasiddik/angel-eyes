@echo off
title Angel Eyes - Webcam Monitor Launcher
color 0A

echo ========================================
echo   Angel Eyes - Webcam Monitor
echo   Logitech C270 Integration
echo ========================================
echo.

REM Check if AI service is running
echo [1/3] Checking AI Service...
curl -s http://192.168.18.73:5001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ AI Service is running
) else (
    echo ❌ AI Service not running!
    echo.
    echo Please start the AI service first:
    echo   cd backend\ai-service
    echo   python app.py
    echo.
    pause
    exit
)

echo.
echo [2/3] Checking webcam-monitor.html...
if exist "frontend\webcam-monitor.html" (
    echo ✅ Webcam monitor file found
) else (
    echo ❌ webcam-monitor.html not found!
    pause
    exit
)

echo.
echo [3/3] Opening webcam monitor in browser...
start "" "frontend\webcam-monitor.html"
echo ✅ Browser opened

echo.
echo ========================================
echo   Setup Complete! 
echo ========================================
echo.
echo 📹 Your webcam monitor should open in browser
echo 🎯 Click "Start Monitoring" to begin
echo 🤖 AI analysis runs every 2 seconds
echo ⚠️  Press Ctrl+C to close this window
echo.
echo Tips:
echo   - Grant camera permission when prompted
echo   - Position webcam to see baby clearly
echo   - Good lighting improves detection
echo   - Keep browser tab active for best performance
echo.

pause
