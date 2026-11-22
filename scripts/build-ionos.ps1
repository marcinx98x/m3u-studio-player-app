# Buduje frontend i odświeża lokalny pakiet IONOS\ (SPA pod SFTP na shared IONOS).
# Używa apache-player-ionos.htaccess (SPA, bez ProxyPass) — nie proxy variant z build:www.
# Zachowuje IONOS\DEPLOY-IONOS.md (checklista lokalna; nie wgrywać na produkcję).
#
# Przykład:
#   npm run build:ionos
#   .\scripts\build-ionos.ps1 -SkipBuild

param(
    [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$ionosRoot = Join-Path $repoRoot "IONOS"
$distDir = Join-Path $repoRoot "dist"
$htaccessSrc = Join-Path $repoRoot "public\apache-player-ionos.htaccess"
$deployDoc = Join-Path $ionosRoot "DEPLOY-IONOS.md"

if (-not $SkipBuild) {
    Write-Host "==> npm run build"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build nie powiódł się (kod $LASTEXITCODE)."
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $distDir "index.html"))) {
    throw "Brak dist\index.html — uruchom bez -SkipBuild albo najpierw: npm run build"
}

if (-not (Test-Path -LiteralPath $ionosRoot)) {
    New-Item -ItemType Directory -Path $ionosRoot | Out-Null
}

Write-Host "==> Kopiuję UI (dist -> IONOS)"
Get-ChildItem -LiteralPath $distDir -File | ForEach-Object {
    # Szablony htaccess z public nie trafiają jako osobne pliki do docrootu
    if ($_.Name -eq "apache-player.htaccess.example") { return }
    if ($_.Name -eq "apache-player-ionos.htaccess") { return }
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $ionosRoot $_.Name) -Force
}

$assetsSrc = Join-Path $distDir "assets"
$assetsDst = Join-Path $ionosRoot "assets"
if (Test-Path -LiteralPath $assetsSrc) {
    robocopy $assetsSrc $assetsDst /MIR /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy assets nie powiódł się (kod $LASTEXITCODE)."
    }
}

Get-ChildItem -LiteralPath $distDir -Directory | Where-Object { $_.Name -ne "assets" } | ForEach-Object {
    $dst = Join-Path $ionosRoot $_.Name
    robocopy $_.FullName $dst /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy $($_.Name) nie powiódł się (kod $LASTEXITCODE)."
    }
}

$htDst = Join-Path $ionosRoot ".htaccess"
if (Test-Path -LiteralPath $htaccessSrc) {
    Copy-Item -LiteralPath $htaccessSrc -Destination $htDst -Force
    Write-Host "==> Skopiowano .htaccess z apache-player-ionos.htaccess"
} else {
    Write-Warning "Brak public\apache-player-ionos.htaccess — IONOS\.htaccess nie został zaktualizowany."
}

# Usuń przypadkowe kopie szablonów htaccess z pakietu (nie powinny być w docroot)
foreach ($junk in @("apache-player.htaccess.example", "apache-player-ionos.htaccess")) {
    $junkPath = Join-Path $ionosRoot $junk
    if (Test-Path -LiteralPath $junkPath) {
        Remove-Item -LiteralPath $junkPath -Force
    }
}

if (-not (Test-Path -LiteralPath $deployDoc)) {
    Write-Warning "Brak IONOS\DEPLOY-IONOS.md — checklista deploy nie istnieje (opcjonalna)."
}

Write-Host ""
Write-Host "Gotowe. Pakiet: $ionosRoot"
Write-Host "Wgraj zawartość IONOS\ przez SFTP do docroot m3u-studio-player.marcincloud.org"
Write-Host "Nie wgrywaj DEPLOY-IONOS.md. Nie nadpisuj api/config.php studia."
