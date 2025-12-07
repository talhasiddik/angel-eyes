@echo off
REM Emergency Fix Script - Restore Working AI Service

echo ============================================================
echo RESTORING AI SERVICE TO WORKING STATE
echo ============================================================
echo.

cd /d "%~dp0backend\ai-service"

echo Step 1: Checking if AI service is running...
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul

echo Step 2: Deleting broken virtual environment...
if exist .venv (
    rmdir /s /q .venv
)

echo Step 3: Creating fresh virtual environment...
python -m venv .venv

echo Step 4: Upgrading pip...
.\.venv\Scripts\python.exe -m pip install --upgrade pip

echo Step 5: Installing working versions (TensorFlow 2.20.0 + Keras 3.12.0)...
.\.venv\Scripts\pip.exe install tensorflow==2.20.0
.\.venv\Scripts\pip.exe install keras==3.12.0
.\.venv\Scripts\pip.exe install "numpy<2.0.0"

echo Step 6: Installing other dependencies...
.\.venv\Scripts\pip.exe install Flask Flask-CORS
.\.venv\Scripts\pip.exe install scikit-learn opencv-python mediapipe
.\.venv\Scripts\pip.exe install h5py Pillow joblib
.\.venv\Scripts\pip.exe install librosa soundfile pydub
.\.venv\Scripts\pip.exe install python-dotenv requests

echo.
echo ============================================================
echo TESTING AI SERVICE
echo ============================================================
echo.

.\.venv\Scripts\python.exe app.py

pause
