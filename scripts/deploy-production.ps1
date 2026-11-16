# Wgrywa build playera + pliki PHP Xtream na NAS (Apache).
# Uruchom gdy dysk \\DS920 jest dostępny (VPN / sieć lokalna).
param(
    [string]$StudioWebRoot = "\\Synology\web\m3u-studio",
    [string]$PlayerWebRoot = "\\Synology\web\m3u-studio-player",
    [string]$StudioAppRoot = "C:\Users\marcin\Desktop\Projekty\m3u-studio\m3u-studio-app",
    [string]$PlayerAppRoot = "C:\Users\marcin\Desktop\Projekty\m3u-studio\m3u-studio-player-app"
)

$ErrorActionPreference = "Stop"

function Test-DeployRoot {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path $Path)) {
        throw "Brak ścieżki $Label : $Path`nZamontuj NAS (\\DS920) lub podaj -$Label 'ścieżka'"
    }
}

$xtreamSrc = Join-Path $StudioAppRoot "api\xtream"
$playerDist = Join-Path $PlayerAppRoot "dist"
$htaccessExample = Join-Path $PlayerAppRoot "public\apache-player.htaccess.example"

if (-not (Test-Path $xtreamSrc)) { throw "Brak $xtreamSrc" }
if (-not (Test-Path $playerDist)) { throw "Brak $playerDist - uruchom najpierw: npm run build" }

Write-Host "=== Weryfikacja ścieżek docelowych ===" -ForegroundColor Cyan
Test-DeployRoot $StudioWebRoot "StudioWebRoot"
Test-DeployRoot $PlayerWebRoot "PlayerWebRoot"

$xtreamDst = Join-Path $StudioWebRoot "api\xtream"
New-Item -ItemType Directory -Force -Path $xtreamDst | Out-Null

Write-Host "`n=== PHP Xtream -> $xtreamDst ===" -ForegroundColor Cyan
robocopy $xtreamSrc $xtreamDst /E /XO /R:2 /W:3 /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "robocopy xtream failed: $LASTEXITCODE" }

Write-Host "`n=== Player dist -> $PlayerWebRoot ===" -ForegroundColor Cyan
robocopy $playerDist $PlayerWebRoot /E /XO /R:2 /W:3 /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "robocopy player dist failed: $LASTEXITCODE" }

if (Test-Path $htaccessExample) {
    $htDst = Join-Path $PlayerWebRoot ".htaccess"
    Copy-Item -Path $htaccessExample -Destination $htDst -Force
    Write-Host "Skopiowano .htaccess (proxy /api + SPA) -> $htDst" -ForegroundColor Green
}

Write-Host "`nGotowe. Sprawdź:" -ForegroundColor Green
Write-Host '  curl "https://m3u-studio.marcincloud.org/api/xtream/player_api.php?username=USER&password=PASS"'
Write-Host "  https://m3u-studio-player.marcincloud.org/"
