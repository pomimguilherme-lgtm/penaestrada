@echo off
echo Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERRO: Node.js nao encontrado. Instale em https://nodejs.org
  pause
  exit /b 1
)

echo Instalando dependencias do backend...
cd backend
call npm install
cd ..

echo Instalando dependencias do frontend...
cd frontend
call npm install
cd ..

echo.
echo Instalacao concluida!
echo.
echo Para iniciar o projeto:
echo   Terminal 1: cd backend ^&^& npm run dev
echo   Terminal 2: cd frontend ^&^& npm run dev
echo.
echo Acesse: http://localhost:3000
echo Login admin: admin@penaestrada.com / admin123
pause
