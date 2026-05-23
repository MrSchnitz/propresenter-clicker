@echo off
cd /d "%~dp0"
set NODE_ENV=production
npx tsx server/index.ts
