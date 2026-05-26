@echo off
TITLE Shop Display Local Server
echo ======================================================
echo Starting Local Shop Display Server...
echo ======================================================
echo Checking dependencies...
call npm install --no-audit --no-fund
echo.
echo Starting the server...
node server.js
pause
