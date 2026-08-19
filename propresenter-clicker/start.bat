@echo off
cd /d "%~dp0ProPresenter Clicker.app\Contents\Resources\app"
set NODE_ENV=production
set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr /b APP_PORT= .env') do set PORT=%%a
rem An appPort saved from the admin panel (data\settings.json) wins over .env.
if exist data\settings.json (
  for /f tokens^=4^ delims^=^" %%a in ('findstr "appPort" data\settings.json') do set PORT=%%a
)
start "" /min cmd /c "timeout /t 3 >nul & start "" http://localhost:%PORT%"
npx tsx server/index.ts
