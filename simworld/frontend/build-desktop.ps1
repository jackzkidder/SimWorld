$ErrorActionPreference = "Stop"

# Load VS developer environment
$vsDevShell = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\Launch-VsDevShell.ps1"
if (Test-Path $vsDevShell) {
    & $vsDevShell -Arch amd64
}

# Manually ensure Windows SDK libs are in LIB path
$sdkLib = "C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0"
$msvcLib = (Get-ChildItem "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" | Sort-Object Name -Descending | Select-Object -First 1).FullName

$env:LIB = "$msvcLib\lib\x64;$sdkLib\ucrt\x64;$sdkLib\um\x64"
$env:INCLUDE = "$msvcLib\include;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\ucrt;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared"

# Add Cargo to PATH
$env:PATH += ";$env:USERPROFILE\.cargo\bin"

# Set target dir to avoid long paths
$env:CARGO_TARGET_DIR = "C:\sw-target"

Write-Host "LIB = $env:LIB"
Write-Host "Building SimWorld desktop app..."

Set-Location C:\sw
npm run tauri:build
