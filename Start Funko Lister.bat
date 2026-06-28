@echo off
title Funko Lister
cd /d "%~dp0"

echo ==============================================
echo            Funko Lister
echo ==============================================
echo.

REM --- 1. Make sure Node.js is installed ---
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed yet.
  echo.
  echo  Please do this once:
  echo    1^) Go to   https://nodejs.org
  echo    2^) Download the big green "LTS" button and run the installer.
  echo    3^) Click Next / I Agree / Install until it finishes.
  echo    4^) Restart your computer.
  echo    5^) Double-click this file again.
  echo.
  pause
  exit /b
)

REM --- 2. Install the app the first time ---
if not exist "node_modules" (
  echo  First-time setup: installing the app. This can take a few minutes...
  echo.
  call npm install
  echo.
)

REM --- 3. Ask for the Anthropic API key the first time ---
if not exist ".env" (
  echo  Paste your Anthropic API key below, then press Enter.
  echo  ^(To paste: right-click inside this window. The key starts with sk-ant- ^)
  echo.
  set /p APIKEY=Key:
  > .env echo ANTHROPIC_API_KEY=%APIKEY%
  echo.
  echo  Saved. You won't be asked again.
  echo.
)

REM --- 4. Open the browser a few seconds after the app starts ---
start "" /min cmd /c "ping -n 5 127.0.0.1 >nul & start http://localhost:3000"

echo  Starting Funko Lister...
echo  Your web browser will open at  http://localhost:3000
echo.
echo  KEEP THIS BLACK WINDOW OPEN while you use the app.
echo  To stop the app later: just close this window.
echo.
call npm start

echo.
echo  The app has stopped. You can close this window.
pause
