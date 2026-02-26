@echo off
REM AI Resume Screening ATS - Start All Services (Windows)
REM This script starts both the Python PDF extraction service and the main web application

echo ================================
echo AI Resume Screening ATS Startup
echo ================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed
    echo Please install Node.js 16 or higher
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i

echo Python found: %PYTHON_VERSION%
echo Node.js found: %NODE_VERSION%
echo.

REM Create logs directory
if not exist "logs" mkdir logs

REM Start Python PDF Extraction Service
echo Starting PDF Extraction Service...
cd pdf-extractor

if not exist "venv" (
    echo    Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

if not exist "venv\installed" (
    echo    Installing Python dependencies...
    pip install -r requirements.txt > nul 2>&1
    echo installed > venv\installed
)

if not exist ".env" (
    echo    Creating .env file...
    copy .env.example .env
)

echo    Starting service on http://localhost:5000
start /B python app.py > ..\logs\pdf-extractor.log 2>&1

cd ..

REM Wait for Python service to be ready
echo    Waiting for service to be ready...
timeout /t 5 /nobreak >nul

echo PDF Extraction Service started
echo.

REM Start Main Web Application
echo Starting Web Application...

if not exist "node_modules" (
    echo    Installing Node dependencies...
    call npm install > logs\npm-install.log 2>&1
)

echo    Starting development server on http://localhost:5173
start /B npm run dev > logs\vite.log 2>&1

REM Wait for Vite to be ready
echo    Waiting for server to be ready...
timeout /t 5 /nobreak >nul

echo.
echo ================================
echo All Services Started!
echo ================================
echo.
echo Service URLs:
echo    Web App:          http://localhost:5173
echo    PDF Extractor:    http://localhost:5000
echo.
echo Logs:
echo    PDF Extractor:    logs\pdf-extractor.log
echo    Web Application:  logs\vite.log
echo.
echo Press any key to open the application in your browser...
pause >nul

start http://localhost:5173

echo.
echo Services are running in the background
echo Close this window or press Ctrl+C to stop services
pause
