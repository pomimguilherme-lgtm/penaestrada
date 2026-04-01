@echo off
echo Iniciando Pe na Estrada...

start "Backend - Pe na Estrada" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 3 /nobreak >nul
start "Frontend - Pe na Estrada" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Servidor iniciado!
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
timeout /t 5 /nobreak >nul
start http://localhost:3000
