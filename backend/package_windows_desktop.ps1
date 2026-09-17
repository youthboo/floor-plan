# Creates a Windows distribution zip safe to send to other Windows machines.
#
# Prerequisite: run .\build_desktop_app.ps1 first (or omit -SkipBuild to build automatically).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\package_windows_desktop.ps1
# Output:
#   backend\dist\FloorPlan-Interest-Calculator-windows.zip

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppName = 'FloorPlan Interest Calculator'
$AppDir = Join-Path $ScriptDir "dist\$AppName"
$Readme = Join-Path $ScriptDir 'windows\DISTRIBUTE_README.txt'
$OutZip = Join-Path $ScriptDir 'dist\FloorPlan-Interest-Calculator-windows.zip'
$BundleDirName = 'FloorPlan-windows'
$Stage = Join-Path $ScriptDir "dist\_package_stage\$BundleDirName"

if (-not $SkipBuild) {
    Write-Host "==> Building desktop app..."
    & (Join-Path $ScriptDir 'build_desktop_app.ps1')
}
else {
    Write-Host "==> -SkipBuild — using existing dist\"
}

if (-not (Test-Path $AppDir)) {
    Write-Error "missing $AppDir — run .\build_desktop_app.ps1 first"
    exit 1
}

Write-Host "==> Staging..."
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $ScriptDir 'dist\_package_stage')
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
Copy-Item -Recurse -Path $AppDir -Destination (Join-Path $Stage $AppName)
if (Test-Path $Readme) {
    Copy-Item -Path $Readme -Destination (Join-Path $Stage 'DISTRIBUTE_README.txt')
}
else {
    Write-Warning "no $Readme found — zipping without a distribute readme"
}

Write-Host "==> Zipping..."
Remove-Item -Force -ErrorAction SilentlyContinue $OutZip
Compress-Archive -Path $Stage -DestinationPath $OutZip -Force

Write-Host ""
Write-Host "==> Done."
Write-Host "    Send: $OutZip"
Write-Host "    Recipient unzips the folder `"$BundleDirName`" -> uses `"$AppName\$AppName.exe`""
Write-Host ""
Write-Host "    Avoid sending just dist\`"$AppName`" without the enclosing zip — the .exe"
Write-Host "    only works alongside the rest of the files in its own folder."
