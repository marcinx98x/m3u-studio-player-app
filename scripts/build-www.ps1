# Buduje frontend i zbiera lokalny docroot www\ (UI playera + .htaccess).
# Gotowy pakiet do wgrania na vhost m3u-studio-player (bez API — API jest na studiu).
#
# Przykład:
#   .\scripts\build-www.ps1
#   npm run build:www
#   .\scripts\build-www.ps1 -SkipBuild

param(
    [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$wwwRoot = Join-Path $repoRoot "www"
$distDir = Join-Path $repoRoot "dist"
$htaccessExample = Join-Path $repoRoot "public\apache-player.htaccess.example"

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

if (-not (Test-Path -LiteralPath $wwwRoot)) {
    New-Item -ItemType Directory -Path $wwwRoot | Out-Null
}

Write-Host "==> Kopiuję UI (dist -> www)"
Get-ChildItem -LiteralPath $distDir -File | ForEach-Object {
    # Przykład htaccess z public kopiujemy osobno jako .htaccess
    if ($_.Name -eq "apache-player.htaccess.example") { return }
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $wwwRoot $_.Name) -Force
}

$assetsSrc = Join-Path $distDir "assets"
$assetsDst = Join-Path $wwwRoot "assets"
if (Test-Path -LiteralPath $assetsSrc) {
    robocopy $assetsSrc $assetsDst /MIR /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy assets nie powiódł się (kod $LASTEXITCODE)."
    }
}

Get-ChildItem -LiteralPath $distDir -Directory | Where-Object { $_.Name -ne "assets" } | ForEach-Object {
    $dst = Join-Path $wwwRoot $_.Name
    robocopy $_.FullName $dst /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy $($_.Name) nie powiódł się (kod $LASTEXITCODE)."
    }
}

$htDst = Join-Path $wwwRoot ".htaccess"
if (Test-Path -LiteralPath $htaccessExample) {
    Copy-Item -LiteralPath $htaccessExample -Destination $htDst -Force
    Write-Host "==> Skopiowano .htaccess z apache-player.htaccess.example"
} elseif (Test-Path -LiteralPath (Join-Path $distDir "apache-player.htaccess.example")) {
    Copy-Item -LiteralPath (Join-Path $distDir "apache-player.htaccess.example") -Destination $htDst -Force
    Write-Host "==> Skopiowano .htaccess z dist"
} else {
    Write-Warning "Brak apache-player.htaccess.example — www\.htaccess nie został utworzony."
}

Write-Host ""
Write-Host "Gotowe. Docroot: $wwwRoot"
Write-Host "Wgraj zawartość www\ na vhost m3u-studio-player.marcincloud.org"
