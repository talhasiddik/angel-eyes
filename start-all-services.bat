@echo off
title Angel Eyes - Start All Services
color 0A

echo ========================================
echo   Angel Eyes - System Startup
echo   Logitech C270 Webcam Integration
echo ========================================
echo.

REM Check current IP
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| find "IPv4 Address"') do (
    for /f "tokens=1" %%j in ("%%i") do (
        set currentip=%%j
        goto :ip_found
    )
)

:ip_found
set currentip=%currentip: =%
echo ✅ Your IP: %currentip%
echo.

echo Starting services in order...
echo.

REM Start Backend API (MongoDB + Express)
echo [1/3] Starting Backend API (MongoDB + Express)...
start "Backend API - Port 5000" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak >nul
echo ✅ Backend API started on port 5000
echo.

REM Start AI Service (Flask)
echo [2/3] Starting AI Service (Flask)...
start "AI Service - Port 5001" cmd /k "cd backend\ai-service && python app.py"
timeout /t 3 /nobreak >nul
echo ✅ AI Service started on port 5001
echo.

REM Start Webcam Stream Server
echo [3/3] Starting Webcam Stream Server...
start "Webcam Stream - Port 5002" cmd /k "cd backend && python webcam-stream-server.py"
timeout /t 3 /nobreak >nul
echo ✅ Webcam Stream Server started on port 5002
echo.

echo ========================================
echo   All Services Started! 
echo ========================================
echo.
echo Service URLs:
echo   📊 Backend API:        http://%currentip%:5000
echo   🤖 AI Service:         http://%currentip%:5001
echo   🎥 Webcam Stream:      http://%currentip%:5002
echo.
echo Next Steps:
echo   1. Start mobile app:   cd frontend ^&^& npx expo start
echo   2. Or use browser:     Double-click webcam-monitor.html
echo.
echo ⚠️  Keep this window open - closing will stop all services
echo.
pause
