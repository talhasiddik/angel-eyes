# Audio Capture Installation Script
# Run this to install PyAudio for audio capture

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "AUDIO CAPTURE SETUP - PyAudio Installation" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check Python version
Write-Host "Checking Python version..." -ForegroundColor Yellow
python --version

Write-Host ""
Write-Host "Installing PyAudio for audio capture from Logitech C270 microphone..." -ForegroundColor Yellow
Write-Host ""

# Try installing pipwin first (most reliable on Windows)
Write-Host "Step 1: Installing pipwin..." -ForegroundColor Green
pip install pipwin

Write-Host ""
Write-Host "Step 2: Installing PyAudio via pipwin..." -ForegroundColor Green
pipwin install pyaudio

Write-Host ""
Write-Host "Step 3: Installing other dependencies..." -ForegroundColor Green
pip install -r webcam-server-requirements.txt

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "TESTING PYAUDIO INSTALLATION" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Test PyAudio
Write-Host "Testing PyAudio..." -ForegroundColor Yellow
python -c "import pyaudio; p = pyaudio.PyAudio(); print(f'✅ PyAudio working! Found {p.get_device_count()} audio devices'); p.terminate()"

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Green
Write-Host "INSTALLATION COMPLETE!" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Plug in your Logitech C270 webcam" -ForegroundColor White
Write-Host "2. Run: python webcam-stream-server.py" -ForegroundColor White
Write-Host "3. Look for: '✅ Audio recording started'" -ForegroundColor White
Write-Host "4. Start Live Monitoring in the mobile app" -ForegroundColor White
Write-Host ""
Write-Host "Cry detection will now work in real-time! 🎤" -ForegroundColor Green
Write-Host ""
