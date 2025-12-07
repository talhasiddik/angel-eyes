@echo off
echo ======================================================================
echo STOPPING ALL ANGEL EYES SERVICES
echo ======================================================================
echo.

echo Stopping Node.js backend server (port 5000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

echo Stopping AI Service (port 5001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5001 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

echo Stopping Webcam Server (port 5002)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5002 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

echo Stopping React Native frontend (port 8081)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8081 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

echo Stopping Expo Metro bundler (port 19000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :19000 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo ======================================================================
echo ALL SERVICES STOPPED
echo ======================================================================
pause
