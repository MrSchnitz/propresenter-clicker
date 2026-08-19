@echo off
cd /d "%~dp0ProPresenter Clicker.app\Contents\Resources\app"
set NODE_ENV=production
set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr /b APP_PORT= .env') do set PORT=%%a
start "" /min cmd /c "timeout /t 3 >nul & start "" http://localhost:%PORT%"
npx tsx server/index.ts
