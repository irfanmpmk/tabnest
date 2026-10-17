# Packs the extension folder into dist\tabnest-<version>.zip for the Chrome Web Store.
# Run: powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$src = Join-Path $PSScriptRoot 'extension'
$manifest = Get-Content (Join-Path $src 'manifest.json') -Raw | ConvertFrom-Json
$dist = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zip = Join-Path $dist "tabnest-$($manifest.version).zip"
if (Test-Path $zip) { Remove-Item $zip }

# Entries are added one by one so paths use forward slashes, which the store expects.
$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  Get-ChildItem $src -Recurse -File | ForEach-Object {
    $entry = $_.FullName.Substring($src.Length + 1) -replace '\\', '/'
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entry, 'Optimal') | Out-Null
  }
} finally {
  $archive.Dispose()
}
Write-Host "Created $zip"
