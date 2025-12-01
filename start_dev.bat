@echo off
set "NODE_PATH=C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64"
set "PATH=%NODE_PATH%;%PATH%"
echo Added Node.js to PATH: %NODE_PATH%
echo Starting SPWS1 Dev Server...
call npm.cmd run dev:full
pause
