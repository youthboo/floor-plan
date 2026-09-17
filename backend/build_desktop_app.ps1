# Builds the FloorPlan Interest Calculator as a standalone Windows app (.exe) —
# bundles the Flask backend + the built React frontend + a pywebview native window,
# so it can be double-clicked and run with no separate servers, Node, or Python setup.
#
# Usage (from an elevated or normal PowerShell prompt):
#   cd backend
#   powershell -ExecutionPolicy Bypass -File .\build_desktop_app.ps1
# Output: backend\dist\FloorPlan Interest Calculator\FloorPlan Interest Calculator.exe
#
# macOS: PyInstaller does not cross-compile — this must be run on an actual
# Windows machine (or VM). build_desktop_app.sh is the macOS equivalent.
#
# Requirements on this Windows machine before running:
#   - Python 3.9+ (added to PATH, or set $env:PYTHON_BIN to its full path)
#   - Node.js + pnpm (for building the frontend)
#   - Microsoft Edge WebView2 Runtime — preinstalled on Windows 11 and most
#     Windows 10 machines; if missing, pywebview falls back to the older MSHTML
#     (IE) renderer automatically, so this only affects visual fidelity, not
#     whether the app starts.

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$FrontendDir = Join-Path $RepoRoot 'frontend'

$PythonBin = if ($env:PYTHON_BIN) { $env:PYTHON_BIN } else { 'python' }

Write-Host "==> Building frontend (frontend/dist)..."
Push-Location $FrontendDir
try {
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw "pnpm build failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
}

Write-Host "==> Installing desktop packaging dependencies..."
& $PythonBin -m pip install -r (Join-Path $ScriptDir 'requirements-desktop.txt')
if ($LASTEXITCODE -ne 0) { throw "pip install failed with exit code $LASTEXITCODE" }

Write-Host "==> Running PyInstaller..."
Set-Location $ScriptDir
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue 'build', 'dist'
Get-ChildItem -Filter '*.spec' | Remove-Item -Force -ErrorAction SilentlyContinue

# Note the ';' data-separator (Windows) vs ':' (macOS/Linux) — this is the one
# PyInstaller flag whose syntax actually differs by host OS.
& $PythonBin -m PyInstaller `
    --name "FloorPlan Interest Calculator" `
    --windowed `
    --onedir `
    --noconfirm `
    --add-data "config/Rental_Charge_Conditions_v2.xlsx;config" `
    --add-data "../frontend/dist;frontend_dist" `
    --hidden-import webview `
    --hidden-import webview.platforms.winforms `
    --hidden-import webview.platforms.win32 `
    --hidden-import webview.platforms.edgechromium `
    --hidden-import webview.platforms.mshtml `
    app.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE" }

$ExeDir = Join-Path $ScriptDir 'dist\FloorPlan Interest Calculator'
Write-Host ""
Write-Host "==> Done."
Write-Host "    App folder: $ExeDir"
Write-Host "    Run it:     `"$ExeDir\FloorPlan Interest Calculator.exe`""
Write-Host ""
Write-Host "    User data (campaigns, uploads, output files) is created NEXT TO wherever"
Write-Host "    the app FOLDER is placed when it's run (AR_Outputs\, uploads\, data\, etc."
Write-Host "    as siblings of the .exe inside that folder) — the whole"
Write-Host "    'FloorPlan Interest Calculator' folder must be moved together as one unit,"
Write-Host "    never just the .exe file by itself."
Write-Host ""
Write-Host "    Note: an unsigned .exe like this will likely trigger a Windows SmartScreen"
Write-Host "    warning ('Windows protected your PC') on first run — click 'More info' ->"
Write-Host "    'Run anyway'. This is expected for an unsigned internal build, not an error."
Write-Host ""
Write-Host "    To zip for distribution: .\package_windows_desktop.ps1"
