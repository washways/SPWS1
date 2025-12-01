$NodePath = "C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64"
$env:Path = "$NodePath;$env:Path"
Write-Host "Added Node.js to PATH: $NodePath"
Write-Host "Starting Dev Server..."
# Use npm.cmd explicitly to avoid PowerShell execution policy issues with npm.ps1
& "C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64\npm.cmd" run dev:full
