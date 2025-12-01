$NodePath = "C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64"
$env:Path = "$NodePath;$env:Path"
Write-Host "Added Node.js to PATH: $NodePath"
Write-Host "Building Project..."
& "$NodePath\npm.cmd" run build
Write-Host "Build Complete! Check the 'dist' folder."
