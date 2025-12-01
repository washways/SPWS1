@echo off
set "NODE_PATH=C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64"
set "PATH=%NODE_PATH%;%PATH%"
echo Added Node.js to PATH: %NODE_PATH%
echo Building Project...
call npm.cmd run build
echo Build Complete! Check the 'dist' folder.
pause
