@echo off
echo Getting current IP address...

REM Get the current IP address
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| find "IPv4 Address"') do (
    for /f "tokens=1" %%j in ("%%i") do (
        set currentip=%%j
        goto :found
    )
)

:found
set currentip=%currentip: =%
echo Found IP: %currentip%

REM Update the API file
echo Updating API configuration...
powershell -Command "(Get-Content 'frontend\services\api.js') -replace 'http://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:5000/api', 'http://%currentip%:5000/api' | Set-Content 'frontend\services\api.js'"
powershell -Command "(Get-Content 'frontend\services\api.js') -replace 'http://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:5000', 'http://%currentip%:5000' | Set-Content 'frontend\services\api.js'"

REM Update the AI Service URL in monitoring.js
echo Updating AI Service URL in monitoring.js...
powershell -Command "(Get-Content 'frontend\app\monitoring.js') -replace 'http://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:5001', 'http://%currentip%:5001' | Set-Content 'frontend\app\monitoring.js'"

REM Update the AI Service URL in webcam-monitor.html
echo Updating AI Service URL in webcam-monitor.html...
powershell -Command "(Get-Content 'frontend\webcam-monitor.html') -replace 'http://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:5001', 'http://%currentip%:5001' | Set-Content 'frontend\webcam-monitor.html'"

REM Update the Webcam Stream URL in monitoring.js
echo Updating Webcam Stream URL in monitoring.js...
powershell -Command "(Get-Content 'frontend\app\monitoring.js') -replace 'http://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:5002', 'http://%currentip%:5002' | Set-Content 'frontend\app\monitoring.js'"

echo ✅ API updated to use IP: %currentip%
echo ✅ AI Service URL updated in monitoring.js: %currentip%
echo ✅ AI Service URL updated in webcam-monitor.html: %currentip%
echo ✅ Webcam Stream URL updated in monitoring.js: %currentip%
echo 🚀 Now restart your frontend server!
pause
