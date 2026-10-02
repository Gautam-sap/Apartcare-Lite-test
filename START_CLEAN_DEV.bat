@echo off
setlocal
cd /d %~dp0
if not exist .venv\Scripts\python.exe (
  echo Creating Python virtual environment...
  py -3.13 -m venv .venv
  if errorlevel 1 (
    echo Python 3.13 is required. Install Python 3.13 and run this again.
    pause
    exit /b 1
  )
)
call .venv\Scripts\activate.bat
set APARTCARE_RUNTIME_DIR=%CD%\backend\runtime
set APARTCARE_STATE_FILE=%CD%\backend\runtime\apartcare_state.json
if not exist backend\runtime mkdir backend\runtime
if not exist node_modules (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 goto :error
)
if not exist .venv\Lib\site-packages\fastapi (
  echo Installing backend dependencies...
  python -m pip install -e .
  if errorlevel 1 goto :error
)
start "ApartCare FastAPI :8000" cmd /k "cd /d %CD% && call .venv\Scripts\activate.bat && set APARTCARE_RUNTIME_DIR=%CD%\backend\runtime && set APARTCARE_STATE_FILE=%CD%\backend\runtime\apartcare_state.json && python -m uvicorn api.index:app --reload --host 127.0.0.1 --port 8000"
start "ApartCare Next.js :3000" cmd /k "cd /d %CD% && npm run dev"
echo.
echo ApartCare Clean Development started.
echo UI:      http://localhost:3000
echo Backend: http://127.0.0.1:8000/health (direct)
exit /b 0
:error
echo Setup failed. Review the message above.
pause
exit /b 1
