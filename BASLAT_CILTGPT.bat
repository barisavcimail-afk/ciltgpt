@echo off
setlocal

cd /d "%~dp0"

set "LOCAL_NODE=node"
set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

where node >nul 2>nul
if %errorlevel% equ 0 (
  start "" "http://localhost:3000/dashboard"
  node server.js
  goto :end
)

if exist "%BUNDLED_NODE%" (
  start "" "http://localhost:3000/dashboard"
  "%BUNDLED_NODE%" server.js
  goto :end
)

echo Node.js bulunamadi.
echo Lutfen Node.js kurun veya Codex runtime dosyalarinin mevcut oldugundan emin olun.
pause

:end
endlocal
