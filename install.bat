@echo off
setlocal EnableExtensions

echo === MorseMotion: установка зависимостей ===

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"
if errorlevel 1 (
    echo [ОШИБКА] Не удалось открыть папку проекта.
    pause
    exit /b 1
)

if not exist package.json (
    echo [ОШИБКА] В папке скрипта не найден package.json.
    echo Помести install.bat в корневую папку MorseMotion.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден. Установи Node.js 20 или новее: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] npm не найден. Переустанови Node.js 20 или новее: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 20 (
    echo [ОШИБКА] Обнаружена версия Node.js ниже 20. Проекту нужен Node.js 20+.
    pause
    exit /b 1
)

echo.
echo Установленная версия Node.js:
node -v
echo Установленная версия npm:
npm -v

echo.
echo Устанавливаю зафиксированные зависимости из package-lock.json...
call npm ci --no-audit --no-fund

if errorlevel 1 (
    echo.
    echo [ОШИБКА] npm ci завершился с ошибкой.
    echo Проверь подключение к интернету и соответствие package-lock.json.
    pause
    exit /b 1
)

echo.
echo === Готово. Зависимости установлены. ===
echo Для запуска в режиме разработки: npm run dev
echo Для сборки проекта: npm run build
pause
